/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as path from "path";

import exec from "./util/exec";
import Constants from "./constants";
import { awaitWithRetry } from "./util/util";
import { RunnerConfiguration } from "./types/types";
import { getKubeCommandExecutor } from "./types/kube-executor";

export default async function installRunner(config: RunnerConfiguration): Promise<string[]> {
    const gitPath = await io.which("git", true);

    const chartCloneDir = path.join(process.cwd(), `${Constants.CHART_REPO_NAME}-${Date.now()}/`);
    await exec(gitPath, [
        "clone",
        "--depth", "1",
        "--branch", Constants.CHART_REPO_REF,
        Constants.CHART_REPO_URL, chartCloneDir,
    ]);

    await exec(gitPath, [
        "-C", chartCloneDir,
        "log", "-1",
    ]);

    const chartDir = path.resolve(chartCloneDir, Constants.CHART_RELATIVE_PATH);

    try {
        await runHelmInstall(path.relative(".", chartDir), config);
    }
    finally {
        core.info(`Removing ${chartCloneDir}`);
        await io.rmRF(chartCloneDir);
    }

    return getAndWaitForPods(config.helmReleaseName, config.runnerReplicas, config.namespace);
}

enum HelmValueNames {
    RUNNER_IMAGE = "runnerImage",
    RUNNER_TAG = "runnerTag",
    RUNNER_LABELS = "runnerLabels",
    RUNNER_REPLICAS = "replicas",
    GITHUB_PAT = "githubPat",
    GITHUB_OWNER = "githubOwner",
    GITHUB_REPO = "githubRepository",
}

async function runHelmInstall(chartDir: string, config: RunnerConfiguration): Promise<void> {
    const helmPath = await io.which("helm", true);

    await exec(helmPath, [ "version" ]);
    await exec(helmPath, [ "ls" ]);

    const helmUpgradeArgs = [
        "upgrade",
        "--install",
        // "--debug",
        config.helmReleaseName,
        chartDir,
        "--set-string", `${HelmValueNames.RUNNER_IMAGE}=${config.runnerImage}`,
        "--set-string", `${HelmValueNames.RUNNER_TAG}=${config.runnerTag}`,
        "--set-string", `${HelmValueNames.GITHUB_PAT}=${config.githubPat}`,
        "--set-string", `${HelmValueNames.GITHUB_OWNER}=${config.runnerLocation.owner}`,
        "--set", `${HelmValueNames.RUNNER_REPLICAS}=${config.runnerReplicas}`,
    ];

    if (config.runnerLocation.repository) {
        helmUpgradeArgs.push(
            "--set-string", `${HelmValueNames.GITHUB_REPO}=${config.runnerLocation.repository}`
        );
    }

    if (config.runnerLabels.length > 0) {
        // the labels are passed using array syntax, which is: "{ label1, label2 }"
        // Do not put spaces after the comma -
        // it works locally because the chart trims the spaces but it works differently in actions/exec for some reason
        const labelsStringified = `{ ${config.runnerLabels.join("\\,")} }`;
        helmUpgradeArgs.push("--set", `${HelmValueNames.RUNNER_LABELS}=${labelsStringified}`);
    }

    if (config.helmExtraArgs.length > 0) {
        helmUpgradeArgs.push(...config.helmExtraArgs);
    }

    await exec(helmPath, helmUpgradeArgs);

    await core.group("Helm Manifest", async () => {
        await exec(helmPath, [ "get", "manifest", config.helmReleaseName ]);
    });
}

// Do not quote the jsonpath curly braces as you normally would - it looks like @actions/exec does some extra escaping.
const JSONPATH_NAME_ARG = `jsonpath={.items[*].metadata.name}{"\\n"}`;
const JSONPATH_REPLICAS_ARG = `jsonpath={.items[*].status.availableReplicas}{"\\n"}`;

const DEPLOYMENT_READY_TIMEOUT_S = 120;

async function getAndWaitForPods(
    releaseName: string, desiredNoReplicas: string, namespace?: string
): Promise<string[]> {
    // Helm adds the release name in an anntation by default, but you can't query by annotation.
    // I have modified the chart to add it to this label, too, so we can find the pods easily.
    const labelSelectorArg = `${Constants.RELEASE_NAME_LABEL}=${releaseName}`;

    const kubeExecutor = await getKubeCommandExecutor(labelSelectorArg, namespace);

    const deploymentName = await kubeExecutor.get(
        "deployments",
        JSONPATH_NAME_ARG,
    );

    const deploymentNotReadyMsg = `Deployment ${deploymentName} did not have any available replicas after `
        + `${DEPLOYMENT_READY_TIMEOUT_S}s. View the output above to diagnose the error.`;

    core.startGroup("Waiting for deployment to come up...");
    await awaitWithRetry(DEPLOYMENT_READY_TIMEOUT_S, 10, deploymentNotReadyMsg,
        async (resolve) => {
            await kubeExecutor.get("all");

            const availableReplicas = await kubeExecutor.get("deployments", JSONPATH_REPLICAS_ARG);

            if (availableReplicas === desiredNoReplicas) {
                core.info(`${deploymentName} has ${desiredNoReplicas} replicas!`);
                resolve();
            }
        })
        .catch(async (err) => {
            core.info(`Printing debug info...`);

            try {
                await kubeExecutor.describe("deployments");
                await kubeExecutor.get("replicasets");
                await kubeExecutor.get("pods");
            }
            catch (debugErr) {
                // nothing
            }

            throw err;
        })
        .finally(() => {
            core.endGroup();
        });

    core.info(`Deployment ${deploymentName} has successfully come up`);

    const podNamesStr = await kubeExecutor.get(
        "pods",
        JSONPATH_NAME_ARG,
    );

    const pods = podNamesStr.split(" ");
    // core.info(`Released pod${pods.length !== 1 ? "s are" : " is"} ${joinList(pods)}`);

    // show the resourecs in the familiar format
    await kubeExecutor.get("all");

    return pods;
}

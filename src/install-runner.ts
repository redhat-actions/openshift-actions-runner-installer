/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as path from "path";

import exec from "./util/exec";
import Constants from "./constants";
import { awaitWithRetry, splitByNewline } from "./util/util";
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

    const namespaceArgs = config.namespace ? [ "--namespace", config.namespace ] : [];

    await exec(helmPath, [ "version" ]);
    await exec(helmPath, [ "ls", ...namespaceArgs ]);

    const helmUpgradeArgs: string[] = [
        "upgrade",
        "--install",
        // "--debug",
        config.helmReleaseName,
        chartDir,
        ...namespaceArgs,
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
        await exec(helmPath, [ "get", "manifest", config.helmReleaseName, ...namespaceArgs ]);
    });
}

// Do not quote the jsonpath curly braces as you normally would - it looks like @actions/exec does some extra escaping.
const JSONPATH_METADATA_NAME = `jsonpath={.items[*].metadata.name}{"\\n"}`;
// we could also use "replicas" instead of "availableReplicas" to not wait for the container to start
const JSONPATH_DEPLOY_REPLICAS = `jsonpath={.items[*].status.availableReplicas}{"\\n"}`;
// This outputs a line per pod, "<pod name> <pod phase>"
// https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase
const JSONPATH_POD_PHASES = `jsonpath={range .items[*]}{.metadata.name}{" "}{.status.phase}{"\n"}{end}`;

const DEPLOYMENT_READY_TIMEOUT_S = 60;

async function getAndWaitForPods(
    releaseName: string, desiredNoReplicas: string, namespace?: string
): Promise<string[]> {
    // Helm adds the release name in an anntation by default, but you can't query by annotation.
    // I have modified the chart to add it to this label, too, so we can find the pods easily.
    const labelSelectorArg = `${Constants.RELEASE_NAME_LABEL}=${releaseName}`;

    const kubeExecutor = await getKubeCommandExecutor(labelSelectorArg, namespace);

    const deploymentName = await kubeExecutor.get(
        "deployments",
        JSONPATH_METADATA_NAME,
    );

    const deploymentNotReadyMsg = `Deployment ${deploymentName} did not have any available replicas after `
        + `${DEPLOYMENT_READY_TIMEOUT_S}s. View the output above to diagnose the error.`;

    await awaitWithRetry(
        DEPLOYMENT_READY_TIMEOUT_S, 5,
        "Waiting for deployment to come up...", deploymentNotReadyMsg,
        async (resolve) => {
            await kubeExecutor.get("all");

            const availableReplicas = await kubeExecutor.get("deployments", JSONPATH_DEPLOY_REPLICAS);

            if (availableReplicas === desiredNoReplicas) {
                core.info(`${deploymentName} has ${desiredNoReplicas} replicas!`);
                resolve();
            }
        }
    ).catch(async (err) => {
        core.info(`Printing debug info...`);

        try {
            await kubeExecutor.describe("deployments");
            await kubeExecutor.describe("replicasets");
            await kubeExecutor.describe("pods");

            // See the jsonpath above for what this output looks like
            const nonRunningPods = splitByNewline(await kubeExecutor.get("pods", JSONPATH_POD_PHASES))
                // map the lines to objects containing the podName and pod phase
                .map((podPhase) => {
                    const [ podName, phase ] = podPhase.split(" ");
                    return {
                        podName, phase,
                    };
                })
                // filter out the ones that succeeded
                .filter((podPhaseObj) => podPhaseObj.phase !== "Running");

            for (const nonRunningPod of nonRunningPods) {
                // and print the logs for the pods that did not succeed
                await kubeExecutor.logs(nonRunningPod.podName);
            }
        }
        catch (debugErr) {
            core.info(`Failed to print debug info: ${err}`);
        }

        throw err;
    });

    core.info(`Deployment ${deploymentName} has successfully come up`);

    const podNamesStr = await kubeExecutor.get(
        "pods",
        JSONPATH_METADATA_NAME,
    );

    const pods = podNamesStr.split(" ");
    // core.info(`Released pod${pods.length !== 1 ? "s are" : " is"} ${joinList(pods)}`);

    // show the resourecs in the familiar format
    await kubeExecutor.get("all");

    return pods;
}

/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as path from "path";

import exec from "./util/exec";
import Constants from "./constants";
import { splitByNewline } from "./util/util";
import { RunnerConfiguration } from "./types/types";

export default async function installRunner(config: RunnerConfiguration): Promise<void> {
    const gitPath = await io.which("git", true);
    // get kubeclient before we need it so that we can fail earlier if it's missing
    const kubeclientPath = await getKubeClientPath();

    const chartCloneDir = path.join(process.cwd(), `${Constants.CHART_REPO_NAME}-${Date.now()}`);
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

    await getAndWaitForPods(kubeclientPath, config.helmReleaseName, config.namespace);
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

async function getAndWaitForPods(kubeclientPath: string, releaseName: string, namespace?: string): Promise<string[]> {
    // Helm adds the release name in an anntation by default, but you can't query by annotation.
    // I have modified the chart to add it to this label, too, so we can find the pods easily.
    const labelSelectorArg = `${Constants.RELEASE_NAME_LABEL}=${releaseName}`;

    const deploymentName = await execKubeGet(
        kubeclientPath,
        namespace,
        "deployment",
        labelSelectorArg,
        JSONPATH_NAME_ARG,
    );

    // const deploymentObj = JSON.parse(getDeploymentsOutput);
    // const deploymentName = deploymentObj.metadata.name;
    core.info(`Deployment name is "${deploymentName}"`);

    let interval: NodeJS.Timeout | undefined;
    await new Promise<void>((resolve, reject) => {
        let tries = 0;
        const delayS = 5;
        const timeoutS = DEPLOYMENT_READY_TIMEOUT_S;
        const maxTries = timeoutS / delayS;

        // eslint-disable-next-line consistent-return
        interval = setInterval(async (): Promise<void> => {
            const noReplicas = await execKubeGet(
                kubeclientPath,
                namespace,
                "deployment",
                labelSelectorArg,
                JSONPATH_REPLICAS_ARG,
            );

            if (!Number.isNaN(noReplicas) && Number(noReplicas) > 0) {
                core.info(`${deploymentName} has at least one available replica`);
                return resolve();
            }

            if (tries > maxTries) {
                return reject(new Error(
                    `Deployment ${deploymentName} did not have any available replicas after ${timeoutS}s. `
                    + `Describe the deployment, replicaset, and pods to diagnose the eror.`
                ));
            }

            tries++;
        }, delayS * 1000);
    }).finally(() => {
        if (interval) {
            clearInterval(interval);
        }
    });

    const podNamesStr = await execKubeGet(
        kubeclientPath,
        namespace,
        "pods",
        labelSelectorArg,
        JSONPATH_NAME_ARG,
    );

    const pods = splitByNewline(podNamesStr);
    // core.info(`Released pod${pods.length !== 1 ? "s are" : " is"} ${joinList(pods)}`);

    // show the resourecs in the familiar format
    await execKubeGet(kubeclientPath, namespace, "deployments,replicasets,pods", labelSelectorArg);

    return pods;
}

async function execKubeGet(
    kubeClientPath: string, namespace: string | undefined,
    resourceType: string, labelSelector: string, outputFormat?: string,
): Promise<string> {
    const namespaceArg = namespace ? [ `--namespace=${namespace}` ] : [];
    const outputArg = outputFormat ? [ "-o", outputFormat ] : [];

    const result = await exec(kubeClientPath, [
        ...namespaceArg,
        "get",
        resourceType,
        "-l", labelSelector,
        ...outputArg,
    ]);

    return result.stdout;
}

/**
 * @returns The path to oc if it is which-findable, else the path to kubectl if it's findable.
 * @throws If neither oc nor kubectl is findable.
 */
async function getKubeClientPath(): Promise<string> {
    const ocPath = await io.which("oc");
    if (ocPath) {
        return ocPath;
    }

    const kubectlPath = await io.which("kubectl");
    if (!kubectlPath) {
        throw new Error(
            `Neither kubectl nor oc was found. One of these tools must be installed, and added to the PATH.`
        );
    }
    return kubectlPath;
}

/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as path from "path";

import { exec } from "./util/exec";
import Constants from "./constants";
import { joinList } from "./util/util";
import { RunnerConfiguration } from "./types/types";

export default async function installRunner(config: RunnerConfiguration): Promise<void> {
    const gitPath = await io.which("git", true);
    // get kubeclient before we need it so that we can fail earlier if it's missing
    const kubeclientPath = await getKubeClientPath();

    const cloneDirPath = path.join(process.cwd(), Constants.CHART_REPO_NAME + Date.now());
    await exec(gitPath, [ "clone", Constants.CHART_REPO_URL, cloneDirPath ]);
    const chartDir = path.resolve(cloneDirPath, Constants.CHART_RELATIVE_PATH);

    try {
        await runHelmInstall(chartDir, config);
    }
    finally {
        await io.rmRF(cloneDirPath);
    }

    await getAndWaitForPods(kubeclientPath, config.helmReleaseName, config.namespace);
}

async function runHelmInstall(chartDir: string, config: RunnerConfiguration): Promise<void> {
    const helmPath = await io.which("helm", true);

    // what to do with the existing deployment?
    await exec(helmPath, [ "ls" ]);

    const manifestGetResult = await exec(
        helmPath,
        [ "get", "manifest", config.helmReleaseName ],
        { ignoreReturnCode: true }
    );

    if (manifestGetResult.exitCode === 0) {
        core.info(`Release "${config.helmReleaseName}" already exists, and will be upgraded.`);
    }

    const helmUpgradeArgs = [
        "upgrade",
        "--install",
        "--debug",
        config.helmReleaseName,
        chartDir,
        "--set-string", `runnerImage=${config.image}`,
        "--set-string", `runnerTag=${config.tag}`,
        "--set-string", `githubPat=${config.githubPat}`,
        "--set-string", `githubOwner=${config.runnerLocation.owner}`,
    ];

    if (config.runnerLocation.repository) {
        helmUpgradeArgs.push(
            "--set-string", `githubRepository=${config.runnerLocation.repository}`
        );
    }

    if (config.runnerLabels.length > 0) {
        const labelsStringified = `{ ${config.runnerLabels.join(", ")} }`;
        helmUpgradeArgs.push("--set-string", labelsStringified);
    }

    if (config.helmExtraArgs.length > 0) {
        helmUpgradeArgs.push(...config.helmExtraArgs);
    }

    await exec(helmPath, helmUpgradeArgs);

    core.info(`Helm upgrade succeeded.`);

    await exec(helmPath, [ "get", "manifest", config.helmReleaseName ]);
}

// Helm adds the release name in an anntation by default, but you can't query by annotation.
// I have modified the chart to add it to this label, too, so we can find the pods easily.
const JSONPATH_NAME_ARG = `jsonpath='{.items[*].metadata.name}'`;
const DEPLOYMENT_READY_TIMEOUT_S = 120;

async function getAndWaitForPods(kubeclientPath: string, releaseName: string, namespace?: string): Promise<string[]> {
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
                "jsonpath='{.items[*].spec.status.availableReplicas}"
            );

            core.debug(`Number of replicas is "${noReplicas}"`);

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
        }, delayS / 1000);
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

    const pods = podNamesStr.split(" ");
    core.info(`Released pod${pods.length !== 1 ? "s are" : " is"} ${joinList(pods)}`);

    // do get po again just to show the pods in the familiar format
    await execKubeGet(kubeclientPath, namespace, "pods", labelSelectorArg);

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

    return result.out;
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

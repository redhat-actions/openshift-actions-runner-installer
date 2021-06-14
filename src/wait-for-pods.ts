/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";

import { awaitWithRetry, splitByNewline } from "./util/util";
import { getKubeCommandExecutor } from "./types/kube-executor";
import Constants from "./constants";

// Do not quote the jsonpath curly braces as you normally would - it looks like @actions/exec does some extra escaping.

const JSONPATH_METADATA_NAME = `jsonpath={.items[*].metadata.name}{"\\n"}`;
// we could also use "replicas" instead of "availableReplicas" to not wait for the container to start
const JSONPATH_DEPLOY_REPLICAS = `jsonpath={.items[*].status.availableReplicas}{"\\n"}`;

// This outputs a line per pod, "<pod name> <container name> <container ready (boolean)>"
// it only looks at the first container since we only have one per pod at this time
// eslint-disable-next-line max-len
const JSONPATH_CONTAINER_READY = `jsonpath={range .items[*]}{"podName="}{.metadata.name}{" containerName="}{.status.containerStatuses[0].name}{" ready="}{.status.containerStatuses[0].ready}{"\\n"}{end}`;

const DEPLOYMENT_READY_TIMEOUT_S = 120;

export default async function getAndWaitForPods(
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

    const deploymentNotReadyMsg = `Deployment ${deploymentName} did not have ${desiredNoReplicas} available replicas `
        + `after ${DEPLOYMENT_READY_TIMEOUT_S}s.`;

    await awaitWithRetry(
        DEPLOYMENT_READY_TIMEOUT_S, 5,
        `Waiting for deployment ${deploymentName} to come up...`, deploymentNotReadyMsg,
        async (resolve) => {
            await kubeExecutor.get("all");

            const availableReplicas = await kubeExecutor.get("deployments", JSONPATH_DEPLOY_REPLICAS);

            if (availableReplicas === desiredNoReplicas) {
                core.info(`${deploymentName} has ${desiredNoReplicas} replicas!`);
                resolve();
            }
        }
    ).catch(async (err) => {
        core.warning(err);
        core.info(`🐞 Running debug commands...`);

        try {
            await kubeExecutor.describe("deployments", undefined, true);
            await kubeExecutor.describe("replicasets", undefined, true);
            await kubeExecutor.describe("pods", undefined, true);

            // See the jsonpath above for what this output looks like
            const notReadyPods = splitByNewline(await kubeExecutor.get("pods", JSONPATH_CONTAINER_READY))
                // map the lines to objects containing the podName and pod phase
                .map((podStatus) => {
                    const [ podName, containerName, ready ] = podStatus.split(" ")
                        .map((item) => item.substring(item.indexOf("=") + 1, item.length));

                    return {
                        podName, containerName, ready,
                    };
                })
                // filter out the ones that succeeded
                .filter((podStatusObj) => podStatusObj.ready);

            if (notReadyPods.length > 0) {
                for (const notReadyPod of notReadyPods) {
                    // and print the logs for the pods that did not succeed
                    await kubeExecutor.logs(notReadyPod.podName, notReadyPod.containerName, true);
                }
            }
            else {
                core.info(`The first container in all pods is Ready - not printing any container logs.`);
            }
        }
        catch (debugErr) {
            core.info(`Failed to print debug info: ${debugErr}`);
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

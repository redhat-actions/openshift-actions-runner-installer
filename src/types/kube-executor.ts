/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as io from "@actions/io";

import exec from "../util/exec";

export async function getKubeCommandExecutor(
    labelSelector?: string | undefined, namespace?: string | undefined
): Promise<KubeCommandExecutor> {
    const kubeClientPath = await getKubeClientPath();

    return new KubeCommandExecutor(kubeClientPath, labelSelector, namespace);
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

type KubeResourceType = "all" | "pods" | "replicasets" | "deployments";        // well, these are all we need for now.

export class KubeCommandExecutor {
    constructor(
        private readonly kubeClientPath: string,
        private readonly labelSelector?: string,
        private readonly namespace?: string
    ) {

    }

    public describe(resourceType: KubeResourceType, outputFormat?: string): Promise<string> {
        return this.view("describe", resourceType, outputFormat);
    }

    public async get(resourceType: KubeResourceType, outputFormat?: string): Promise<string> {
        return this.view("get", resourceType, outputFormat);
    }

    private async view(
        operation: "get" | "describe", resourceType: KubeResourceType, outputFormat?: string
    ): Promise<string> {
        const namespaceArg = this.namespace ? [ "--namespace", this.namespace ] : [];
        const selectorArg = this.labelSelector ? [ "--selector", this.labelSelector ] : [];
        const outputArg = outputFormat ? [ "--output", outputFormat ] : [];

        const result = await exec(this.kubeClientPath, [
            ...namespaceArg,
            operation,
            resourceType,
            ...selectorArg,
            ...outputArg,
        ]);

        return result.stdout;
    }
}

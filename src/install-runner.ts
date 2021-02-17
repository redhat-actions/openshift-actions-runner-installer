/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as io from "@actions/io";

import exec from "./util/exec";
import Constants from "./constants";
import { RunnerConfiguration } from "./types/types";
import getAndWaitForPods from "./wait-for-pods";

enum HelmValueNames {
    RUNNER_IMAGE = "runnerImage",
    RUNNER_TAG = "runnerTag",
    RUNNER_LABELS = "runnerLabels",
    RUNNER_REPLICAS = "replicas",
    GITHUB_PAT = "githubPat",
    GITHUB_OWNER = "githubOwner",
    GITHUB_REPO = "githubRepository",
}

export default async function runHelmInstall(config: RunnerConfiguration): Promise<string[]> {
    const helmPath = await io.which("helm", true);

    await exec(helmPath, [ "repo", "add", Constants.CHART_REPO_NAME, Constants.CHART_REPO_URL ]);
    await exec(helmPath, [ "repo", "list" ]);
    await exec(helmPath, [ "repo", "update" ]);
    await exec(helmPath, [ "search", "repo", Constants.CHART_NAME ]);

    const namespaceArgs = config.namespace ? [ "--namespace", config.namespace ] : [];

    await exec(helmPath, [ "version" ]);
    await exec(helmPath, [ "ls", ...namespaceArgs ]);

    const helmUpgradeArgs: string[] = [
        "upgrade",
        "--install",
        // "--debug",
        config.helmReleaseName,
        Constants.CHART_REPO_NAME + "/" + Constants.CHART_NAME,
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
    await exec(helmPath, [ "get", "manifest", config.helmReleaseName, ...namespaceArgs ], { group: true });

    return getAndWaitForPods(config.helmReleaseName, config.runnerReplicas, config.namespace);
}

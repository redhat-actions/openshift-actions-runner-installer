/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as path from "path";

import exec from "./util/exec";
import Constants from "./constants";
import { RunnerConfiguration } from "./types/types";
import getAndWaitForPods from "./wait-for-pods";

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
    await exec(helmPath, [ "get", "manifest", config.helmReleaseName, ...namespaceArgs ], { group: true });
}

/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as io from "@actions/io";

import exec from "./util/exec";
import Constants from "./constants";
import { RunnerConfiguration } from "./types/types";
import getAndWaitForPods from "./wait-for-pods";
import { splitByNewline } from "./util/util";

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

    const namespaceArgs = config.namespace ? [ "--namespace", config.namespace ] : [];
    await exec(helmPath, [ "ls", ...namespaceArgs ]);

    if (config.helmUninstallIfExists) {
        core.info(`🔎 Checking if release ${config.helmReleaseName} already exists...`);

        const releasesStr = await exec(helmPath, [ "ls", "-q", ...namespaceArgs ]);
        const releases = splitByNewline(releasesStr.stdout);

        if (releases.includes(config.helmReleaseName)) {
            core.info(`ℹ️ Release ${config.helmReleaseName} already exists; removing.`);
            await exec(helmPath, [ "uninstall", config.helmReleaseName, ...namespaceArgs ]);
        }
        else {
            core.info(`Release ${config.helmReleaseName} does not exist.`);
        }
    }
    else {
        core.info(`Not checking if release already exists`);
    }

    await exec(helmPath, [ "repo", "add", Constants.CHART_REPO_NAME, Constants.CHART_REPO_URL ]);
    await exec(helmPath, [ "repo", "list" ]);
    await exec(helmPath, [ "repo", "update" ]);
    await exec(helmPath, [ "search", "repo", Constants.CHART_NAME ]);

    await exec(helmPath, [ "version" ]);

    const versionArgs = config.helmChartVersion ? [ "--version", config.helmChartVersion ] : [];

    const helmInstallCmd: string[] = [
        "install",
        // "--debug",
        config.helmReleaseName,
        Constants.CHART_REPO_NAME + "/" + Constants.CHART_NAME,
        ...namespaceArgs,
        ...versionArgs,
        "--set-string", `${HelmValueNames.RUNNER_IMAGE}=${config.runnerImage}`,
        "--set-string", `${HelmValueNames.RUNNER_TAG}=${config.runnerTag}`,
        "--set-string", `${HelmValueNames.GITHUB_PAT}=${config.githubPat}`,
        "--set-string", `${HelmValueNames.GITHUB_OWNER}=${config.runnerLocation.owner}`,
        "--set", `${HelmValueNames.RUNNER_REPLICAS}=${config.runnerReplicas}`,
    ];

    if (config.runnerLocation.repository) {
        helmInstallCmd.push(
            "--set-string", `${HelmValueNames.GITHUB_REPO}=${config.runnerLocation.repository}`
        );
    }

    if (config.runnerLabels.length > 0) {
        // the labels are passed using array syntax, which is: "{ label1, label2 }"
        // Do not put spaces after the comma -
        // it works locally because the chart trims the spaces but it works differently in actions/exec for some reason
        const labelsStringified = `{ ${config.runnerLabels.join("\\,")} }`;
        helmInstallCmd.push("--set", `${HelmValueNames.RUNNER_LABELS}=${labelsStringified}`);
    }

    if (config.helmExtraArgs.length > 0) {
        helmInstallCmd.push(...config.helmExtraArgs);
    }

    await exec(helmPath, helmInstallCmd);
    await exec(helmPath, [ "get", "manifest", config.helmReleaseName, ...namespaceArgs ], { group: true });

    return getAndWaitForPods(config.helmReleaseName, config.runnerReplicas, config.namespace);
}

/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";

import installRunner from "./install-runner";
import { joinList } from "./util/util";
import processInputs from "./process-inputs";
import { getMatchingOnlineRunners, waitForRunnersToBeOnline } from "./get-runners";
import { Outputs } from "./generated/inputs-outputs";

export async function run(): Promise<void> {
    const runnerConfig = processInputs();
    core.debug(`INPUTS:`);
    core.debug(JSON.stringify(runnerConfig, undefined, 2));

    const taggedImage = `${runnerConfig.runnerImage}:${runnerConfig.runnerTag}`;

    core.info(`🔎 Fetching self-hosted runners for ${runnerConfig.runnerLocation}`);

    const matchingOnlineRunners = await getMatchingOnlineRunners(
        // We label our runners with the taggedImage so that runner using the wrong image are not counted.
        runnerConfig.githubPat, runnerConfig.runnerLocation, runnerConfig.runnerLabels.concat(taggedImage),
    );

    if (matchingOnlineRunners.length > 0) {
        const runnerNames = matchingOnlineRunners.map((runner) => runner.name);
        if (matchingOnlineRunners.length === 1) {
            core.info(`✅ Runner ${runnerNames[0]} matches the given labels.`);
        }
        else {
            core.info(`✅ Runners ${joinList(runnerNames)} match the given labels.`);
        }

        // Outputs.HELM_RELEASE_NAME is not set here, since we did not do a helm release.
        core.setOutput(Outputs.INSTALLED, false);
        core.setOutput(Outputs.RUNNERS, JSON.stringify(runnerNames));
        return;
    }

    core.info(`❌ No online runner with all the required labels was found.`);
    core.info(`Installing a runner now.`);

    const installedRunnerPodnames = await installRunner(runnerConfig);
    core.debug(`installedRunnerPodnames are ${installedRunnerPodnames}`);

    // at present, the runner names == their hostnames === their pod names
    const newRunnerNames = installedRunnerPodnames;

    const newRunners = await waitForRunnersToBeOnline(
        runnerConfig.githubPat, runnerConfig.runnerLocation, newRunnerNames
    );

    const plural = newRunners.length !== 1;
    core.info(
        `✅ Success: new self-hosted runner${plural ? "s" : ""} `
        + `${joinList(newRunners)} ${plural ? "are" : "is"} up and running.`
    );

    core.setOutput(Outputs.HELM_RELEASE_NAME, runnerConfig.helmReleaseName);
    core.setOutput(Outputs.INSTALLED, true);
    core.setOutput(Outputs.RUNNERS, JSON.stringify(newRunners));
}

run().catch((err) => core.setFailed(err.message));

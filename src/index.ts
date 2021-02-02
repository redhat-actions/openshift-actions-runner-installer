/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";

import installRunner from "./install-runner";
import { joinList } from "./util/util";
import processInputs from "./process-inputs";
import { getMatchingOnlineRunners, waitForARunnerBeOneline } from "./get-runners";

export async function run(): Promise<void> {
    const runnerConfig = processInputs();
    core.debug(`INPUTS:`);
    core.debug(JSON.stringify(runnerConfig, undefined, 2));
    const taggedImage = `${runnerConfig.runnerImage}:${runnerConfig.runnerTag}`;

    core.info(`Fetching self-hosted runners for ${runnerConfig.runnerLocation}`);

    const matchingOnlineRunners = await getMatchingOnlineRunners(
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
        return;
    }

    core.info(`❌ No online runner with all the required labels was found.`);
    core.info(`Installing a runner now.`);

    const installedRunnerPodnames = await installRunner(runnerConfig);
    core.debug(`installedRunnerPodnames are ${installedRunnerPodnames}`);

    const newRunner = await waitForARunnerBeOneline(
        runnerConfig.githubPat, runnerConfig.runnerLocation, installedRunnerPodnames
    );

    core.info(`Success: new self-hosted runner ${newRunner} is up and running.`);
}

run().catch((err) => core.setFailed(err.message));

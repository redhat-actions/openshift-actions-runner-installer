/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as github from "@actions/github";

import RunnerLocation from "./types/runner-location";
import { Octokit, SelfHostedRunner, SelfHostedRunnersResponse } from "./types/types";
import { awaitWithRetry, joinList } from "./util/util";

export async function getMatchingOnlineRunners(
    githubPat: string, runnerLocation: RunnerLocation, requiredLabels: string[]
): Promise<SelfHostedRunner[]> {
    const selfHostedRunnersResponse = await listSelfHostedRunners(githubPat, runnerLocation);

    const noRunners = selfHostedRunnersResponse.total_count;

    core.info(`${runnerLocation.toString()} has ${noRunners} runner${noRunners !== 1 ? "s" : ""}.`);

    if (selfHostedRunnersResponse.total_count === 0) {
        return [];
    }

    core.info(`Looking for runner with labels: ${joinList(requiredLabels.map((label) => `"${label}"`))}`);

    const matchingOnlineRunners = selfHostedRunnersResponse.runners.filter((runner) => {
        const runnerLabels = runner.labels.map((label) => label.name);
        core.info(`${runner.name} has labels: ${runnerLabels.map((label) => `"${label}"`).join(", ")}`);

        const matchingLabels: string[] = [];
        const missingLabels: string[] = [];

        requiredLabels.forEach((label) => {
            if (runnerLabels.includes(label)) {
                matchingLabels.push(label);
            }
            else {
                missingLabels.push(label);
            }
        });

        if (missingLabels.length === 0) {
            // core.info(`${runner.name} has all the required labels`);
            const isOnline = runner.status === "online";
            if (isOnline) {
                core.info(`${runner.name} has the required labels and is online`);
            }
            else {
                core.info(`${runner.name} has all the required labels, but status is ${runner.status}`);
            }
            return isOnline;
        }

        const missingLabelsNoun = missingLabels.length > 1 ? "labels" : "label";
        core.info(
            `${runner.name} is missing the ${missingLabelsNoun} `
            + `${joinList(missingLabels.map((l) => `"${l}"`))}`
        );

        return false;
    });

    return matchingOnlineRunners;
}

const WAIT_FOR_RUNNERS_TIMEOUT = 60;

export async function waitForRunnersToBeOnline(
    githubPat: string, runnerLocation: RunnerLocation, newRunnerNames: string[]
): Promise<string[]> {
    const noRunnerErrMsg = `Not all of the new runners were added to ${runnerLocation}, or were not online `
        + `within ${WAIT_FOR_RUNNERS_TIMEOUT}s. Check if the pods failed to start, or exited.`;

    core.info(`⏳ Waiting for the new runners to come up: ${joinList(newRunnerNames, "and")}`);

    const newOnlineRunners: string[] = [];
    const newOfflineRunners: string[] = [];

    return awaitWithRetry<string[]>(
        WAIT_FOR_RUNNERS_TIMEOUT, 5,
        `Waiting for runners to come online...`, noRunnerErrMsg,
        async (resolve) => {
            const currentGHRunners = await listSelfHostedRunners(githubPat, runnerLocation);
            if (currentGHRunners.runners.length > 0) {
                const runnersWithStatus = currentGHRunners.runners.map((runner) => `${runner.name} (${runner.status})`);
                core.info(`${runnerLocation} runners are: ${joinList(runnersWithStatus)}`);
            }
            else {
                core.info(`${runnerLocation} has no runners.`);
            }

            // const currentGHRunnerNames = currentGHRunners.runners.map((runner) => runner.name);

            // collect the runners that have not yet appeared as online or offline
            const unresolvedRunners = newRunnerNames.filter(
                (newRunner) => !newOnlineRunners.includes(newRunner) && !newOfflineRunners.includes(newRunner)
            );

            if (unresolvedRunners.length === 0) {
                // all runners have been accounted for
                resolve(newOnlineRunners);
            }
            else {
                core.info(`Still waiting for ${joinList(unresolvedRunners)}`);
            }

            unresolvedRunners.forEach((newRunnerName) => {
                // look for one of the new runners to be known by github
                const newRunnerIndex = currentGHRunners.runners
                    .map((runner) => runner.name)
                    .findIndex((runnerName) => runnerName === newRunnerName);

                if (newRunnerIndex !== -1) {
                    const newRunner = currentGHRunners.runners[newRunnerIndex];
                    // if the runner is online, we are good and we return it
                    if (newRunner.status === "online") {
                        core.info(`✅ ${newRunner.name} is online`);
                        newOnlineRunners.push(newRunner.name);
                    }
                    // else, we have to log a warning, because this usually means the runner configured but then crashed
                    // but, only log one warning per runner.
                    else if (!newOfflineRunners.includes(newRunner.name)) {
                        core.warning(`New runner ${newRunner.name} connected to GitHub but is ${newRunner.status}`);
                        newOfflineRunners.push(newRunner.name);
                    }
                }
            });
        }
    );
}

async function listSelfHostedRunners(
    githubPat: string, runnerLocation: RunnerLocation
): Promise<SelfHostedRunnersResponse> {
    const octokit = await getOctokit(githubPat);

    let response;
    try {
        if (runnerLocation.repository) {
            // API Documentation:
            // https://docs.github.com/en/free-pro-team@latest/rest/reference/actions#self-hosted-runners
            // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-repo
            response = await octokit.actions.listSelfHostedRunnersForRepo({
                owner: runnerLocation.owner,
                repo: runnerLocation.repository,
            });
        }
        else {
            // org only
            // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-org
            response = await octokit.actions.listSelfHostedRunnersForOrg({
                org: runnerLocation.owner,
            });
        }
    }
    catch (err) {
        throw getBetterHttpError(err);
    }

    core.debug(`Self-hosted runners response: ${JSON.stringify(response.data, undefined, 2)}`);

    return response.data;
}

let cachedOctokit: Octokit | undefined;
async function getOctokit(githubPat: string): Promise<Octokit> {
    if (cachedOctokit) {
        return cachedOctokit;
    }

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage-
    const octokit: Octokit = github.getOctokit(githubPat);
    cachedOctokit = octokit;
    return octokit;
}

/**
 * The errors messages from octokit HTTP requests can be poor; prepending the status code helps clarify the problem.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBetterHttpError(err: any): Error {
    const status = err.status;
    if (status && err.message) {
        return new Error(`Received status ${status}: ${err.message}`);
    }
    return err;
}

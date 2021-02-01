/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as github from "@actions/github";

import RunnerLocation from "./types/runner-location";
import { Octokit, SelfHostedRunner, SelfHostedRunnersResponse } from "./types/types";
import { awaitWithRetry, joinList } from "./util/util";

export async function getMatchingRunners(
    githubPat: string, runnerLocation: RunnerLocation, requiredLabels: string[]
): Promise<SelfHostedRunner[] | undefined> {
    const selfHostedRunnersResponse = await listSelfHostedRunners(githubPat, runnerLocation);

    core.info(`${runnerLocation.toString()} has ${selfHostedRunnersResponse.total_count} runners.`);

    if (selfHostedRunnersResponse.total_count === 0) {
        return undefined;
    }

    core.info(`Looking for runner with labels: ${joinList(requiredLabels.map((label) => `"${label}"`))}`);

    const matchingRunners = selfHostedRunnersResponse.runners.filter((runner) => {
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

        const totalMatch = missingLabels.length === 0;
        if (totalMatch) {
            core.info(`${runner.name} has all the required labels`);
        }
        else {
            const missingLabelsNoun = missingLabels.length > 1 ? "labels" : "label";
            core.info(
                `${runner.name} is missing the ${missingLabelsNoun} `
                + `${joinList(missingLabels.map((l) => `"${l}"`))}`
            );
        }
        return totalMatch;
    });

    if (matchingRunners.length === 0) {
        core.info(`No runner with all required labels was found.`);
        return undefined;
    }

    return matchingRunners;
}

const WAIT_FOR_RUNNERS_TIMEOUT = 60;

export async function waitForARunnerToExist(
    githubPat: string, runnerLocation: RunnerLocation, newRunnerNames: string[]
): Promise<string> {
    const noRunnerErrMsg = `None of the expected runners were added to ${runnerLocation} `
        + `within ${WAIT_FOR_RUNNERS_TIMEOUT}s`;

    core.info(`Waiting for one of the new runners to come up: ${joinList(newRunnerNames, "or")}`);

    return awaitWithRetry<string>(
        WAIT_FOR_RUNNERS_TIMEOUT, 5,
        `Waiting for runners to become available...`, noRunnerErrMsg,
        async (resolve) => {
            const existingRunners = await listSelfHostedRunners(githubPat, runnerLocation);
            const existingRunnerNames = existingRunners.runners.map((runner) => runner.name);
            if (existingRunnerNames.length > 0) {
                core.info(`${runnerLocation} runners are: ${joinList(existingRunnerNames)}`);
            }
            else {
                core.info(`${runnerLocation} has no runners.`);
            }

            const newRunnerName = existingRunnerNames
                .find((existingRunnerName) => newRunnerNames.includes(existingRunnerName));

            if (newRunnerName != null) {
                core.info(`Found new runner ${newRunnerName}`);
                resolve(newRunnerName);
            }
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

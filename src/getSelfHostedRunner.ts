/** ***********************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 ************************************************************************************************ */
import * as core from "@actions/core";
import * as github from "@actions/github";
import { Inputs, Outputs } from "./generated/inputs-outputs";
import { Octokit, SelfHostedRunnersResponse } from "./types";

export async function run(): Promise<void> {
    const githubPAT = core.getInput(Inputs.GITHUB_PAT, { required: true });
    const inputLabels = core.getInput(Inputs.LABELS, { required: false });

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage-
    const octokit: Octokit = github.getOctokit(githubPAT);

    const repositoryPath = core.getInput(Inputs.RUNNER_LOCATION)
        || `${github.context.repo.owner}/${github.context.repo.repo}`;

    let selfHostedRunnersResponse: SelfHostedRunnersResponse;
    try {
        selfHostedRunnersResponse = await listSelfHostedRunners(
            octokit,
            repositoryPath,
        );
    }
    catch (err) {
        throw getBetterHttpError(err);
    }

    core.debug(JSON.stringify(selfHostedRunnersResponse.runners));

    core.info(`${repositoryPath} has ${selfHostedRunnersResponse.total_count} runners.`);

    let runnerFound: boolean;
    if (inputLabels) {
        runnerFound = await isRunnerPresent(selfHostedRunnersResponse, inputLabels.split(","));
    }
    else {
        runnerFound = await isRunnerPresent(selfHostedRunnersResponse);
    }

    core.setOutput(Outputs.RUNNER_PRESENT, runnerFound);
    if (core.getInput(Inputs.FAIL_IF_NOT_FOUND) === "true" && !runnerFound) {
        core.setFailed(`No matching runner was found for ${repositoryPath}.`);
    }
}

// Get Self Hosted Runners
async function listSelfHostedRunners(octokit: Octokit, repositoryPath: string): Promise<SelfHostedRunnersResponse> {
    const slashIndex = repositoryPath.indexOf("/");

    let response;
    if (slashIndex !== -1) {
        // repository provided
        core.info(`Fetching self-hosted runners for repository ${repositoryPath}`);

        const owner = repositoryPath.substring(0, slashIndex);
        const repo = repositoryPath.substring(slashIndex + 1);

        // API Documentation: https://docs.github.com/en/free-pro-team@latest/rest/reference/actions#self-hosted-runners
        // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-repo
        response = await octokit.actions.listSelfHostedRunnersForRepo({ owner, repo });
    }
    else {
        // org only
        const org = repositoryPath;
        core.info(`Fetching self-hosted runners for the ${org} organization`);

        // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-org
        response = await octokit.actions.listSelfHostedRunnersForOrg({ org });
    }
    return response.data;
}

async function isRunnerPresent(selfHostedRunnersResponse: SelfHostedRunnersResponse, requiredLabels?: string[]):
    Promise<boolean> {
    if (selfHostedRunnersResponse.total_count === 0) {
        return false;
    }
    else if (requiredLabels == null) {
        core.info("No labels provided.");
        return true;
    }

    core.info(`Looking for runner with labels: ${requiredLabels.join(", ")}`);

    const matchingRunner = selfHostedRunnersResponse.runners.find((runner) => {
        const runnerLabels = runner.labels.map((label) => label.name);
        core.info(`${runner.name} has labels: ${runnerLabels.join(", ")}`);

        const matchingLabels = requiredLabels.filter((reqdLabel) => runnerLabels.includes(reqdLabel));
        const totalMatch = matchingLabels.length === requiredLabels.length;
        if (totalMatch) {
            core.info(`${runner.name} has all the required labels`);
        }
        else {
            core.info(
                `${runner.name} only has ${matchingLabels.length} `
                + `of the ${requiredLabels.length} required labels`,
            );
        }
        return totalMatch;
    });

    if (!matchingRunner) {
        core.info(`No runner with all required labels was found.`);
        return false;
    }

    return true;
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

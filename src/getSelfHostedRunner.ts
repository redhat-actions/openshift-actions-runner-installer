/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/
import * as core from "@actions/core";
import * as github from "@actions/github";
export async function run() {
  try {
    const githubToken = core.getInput("github_token", { required: true });
    const labels = core.getInput("labels", { required: false });

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage-
    const octokit = github.getOctokit(githubToken);

    const repositoryPath =
      core.getInput("repository_path", { required: true }) ||
      `${github.context.repo.owner}/${github.context.repo.repo}`;

    const selfHostedRunnersListResponse = await listSelfHostedRunners(
      octokit,
      repositoryPath
    );

    core.debug(JSON.stringify(selfHostedRunnersListResponse));

    // Get the total_count of the self hosted runners from the response
    const {
      data: { total_count: totalCount, runners: runners },
    } = selfHostedRunnersListResponse;

    let isRunnerPresent = false;

    // Check if labels are provided or not
    if (labels === "") {
      core.debug("Labels not provided.");
      if (totalCount > 0) {
        isRunnerPresent = true;
      }
    } else {
      const inputLabels = labels.split(",");

      // Check if runner is present with the desired labels
      isRunnerPresent = await checkLabelExists(runners, inputLabels);
      console.log("Labels to check for: " + inputLabels);
    }

    core.setOutput("runner_present", isRunnerPresent);
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Get Self Hosted Runners
async function listSelfHostedRunners(octokit, repositoryPath) {
  const index = repositoryPath.indexOf("/");
  let org = "";
  let owner = "";
  let repo = "";
  let selfHostedRunnersListResponse = null;
  if (index !== -1) {
    // API Documentation: https://docs.github.com/en/free-pro-team@latest/rest/reference/actions#self-hosted-runners
    // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-repo
    owner = repositoryPath.substring(0, index);
    repo = repositoryPath.substring(index + 1);
    selfHostedRunnersListResponse = await octokit.actions.listSelfHostedRunnersForRepo(
      {
        owner,
        repo,
      }
    );
  } else {
    // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-org
    org = repositoryPath;
    selfHostedRunnersListResponse = await octokit.actions.listSelfHostedRunnersForOrg(
      {
        org,
      }
    );
  }
  return selfHostedRunnersListResponse;
}

async function checkLabelExists(runners, inputLabels) {
  runners.forEach((runner) => {
    let runnerLabels = [];

    runner.labels.forEach((runnerLabel) => {
      runnerLabels.push(runnerLabel.name);
    });

    inputLabels.forEach((inputLabel: string) => {
      if (!runnerLabels.includes(inputLabel)) {
        return false;
      }
    });
  });

  return true;
}

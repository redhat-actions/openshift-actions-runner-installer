/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/
import * as core from '@actions/core';
import * as github from '@actions/github';

export async function run() {
  try {
    const githubToken = core.getInput('github_token', { required: true });

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage-
    const octokit = github.getOctokit(githubToken);
    // const github = new GitHub(process.env.GITHUB_TOKEN);

    const repositoryPath = core.getInput('repository_path', { required: true }) || `${github.context.repo.owner}/${github.context.repo.repo}`;

    const index = repositoryPath.indexOf('/');

    let org = "";
    let owner = "";
    let repo = "";
    let selfHostedRunnersListResponse = null;
    if (index !== -1) {
      owner = repositoryPath.substring(0, index);
      repo = repositoryPath.substring(index + 1);
      selfHostedRunnersListResponse = await octokit.actions.listSelfHostedRunnersForRepo({
        owner,
        repo,
      });
    } else {
      // Get Self Hosted Runners
      // API Documentation: https://docs.github.com/en/free-pro-team@latest/rest/reference/actions#self-hosted-runners
      // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-org
      org = repositoryPath;
      selfHostedRunnersListResponse = await octokit.actions.listSelfHostedRunnersForOrg({
        org,
      });
    }

    core.debug(JSON.stringify(selfHostedRunnersListResponse));

    // Get the total_count of the self hosted runners from the response
    const {
      data: { total_count: totalCount, runners: runners }
    } = selfHostedRunnersListResponse

    let isRunnerPresent = false;

    const labels = core.getInput('labels', { required: false })

    let inputLabels = null;

    if (labels === "") {
      core.debug("Labels not provided.");
      
      if (totalCount > 0) {
        isRunnerPresent = true;
      }
    } else {
      inputLabels = labels.split(",");
      console.log("Labels to check for: " + inputLabels);

      let labelFound: boolean = true;

      runners.forEach((runner) => {

        labelFound = true;
        let runnerLabels = [];

        runner.labels.forEach(runnerLabel => {
          runnerLabels.push(runnerLabel.name);
        });

        inputLabels.forEach((inputLabel: string) => {
          if (!runnerLabels.includes(inputLabel)) {
            labelFound = false;
            return;
          }
        });

        if(labelFound === true) {
          return;
        }
      });

      if (labelFound === true) {
        console.log("Runner found with the desired labels")
        isRunnerPresent = true;
      }
    }

    core.setOutput('runner_present', isRunnerPresent);

  } catch (error) {
    core.setFailed(error.message);
  }
}

/*************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *************************************************************************************************/
import * as core from '@actions/core';
import * as github from '@actions/github';

export async function run() {
  try {
    const orgToken = core.getInput('org_token', { required: true });

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage-
    const octokit = github.getOctokit(orgToken);
    // const github = new GitHub(process.env.GITHUB_TOKEN);

    const org = core.getInput('org', { required: true });

    // Get Self Hosted Runners
    // API Documentation: https://docs.github.com/en/free-pro-team@latest/rest/reference/actions#self-hosted-runners
    // Octokit Documentation: https://octokit.github.io/rest.js/v17#actions-list-self-hosted-runners-for-org
    const selfHostedRunnersListResponse = await octokit.actions.listSelfHostedRunnersForOrg({
      org,
    });

    core.debug(JSON.stringify(selfHostedRunnersListResponse));

    // Get the total_count of the self hosted runners from the response
    const {
      data: { total_count: totalCount }
    } = selfHostedRunnersListResponse

    let isRunnerPresent = false;

    if (totalCount > 0) {
      isRunnerPresent = true;
    }

    core.setOutput('runner_present', isRunnerPresent);

  } catch (error) {
    core.setFailed(error.message);
  }
}

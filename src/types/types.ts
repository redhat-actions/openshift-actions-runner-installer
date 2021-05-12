/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import { GitHub } from "@actions/github/lib/utils";
import RunnerLocation from "./runner-location";

// The return type of getOctokit - copied from node_modules/@actions/github/lib/github.d.ts
export type Octokit = InstanceType<typeof GitHub>;

interface SelfHostedRunnerLabel {
    id: number;
    name: string;
    type: string;
}

export interface SelfHostedRunner {
    id: number;
    name: string;
    os: string;
    status: string;
    busy: boolean;
    labels: SelfHostedRunnerLabel[];
}

// https://docs.github.com/en/rest/reference/actions#list-self-hosted-runners-for-an-organization
// https://docs.github.com/en/rest/reference/actions#list-self-hosted-runners-for-a-repository
export interface SelfHostedRunnersResponse {
    // eslint-disable-next-line camelcase
    total_count: number;
    runners: SelfHostedRunner[];
}

/**
 * All the inputs we process from the user and then pass around to the helm commands.
 */
export interface RunnerConfiguration {
    namespace?: string | undefined;
    helmChartVersion: string | undefined;
    helmExtraArgs: string[];
    helmReleaseName: string;
    helmUninstallIfExists: boolean;
    githubPat: string;
    runnerLocation: RunnerLocation;
    runnerLabels: string[];
    runnerImage: string;
    runnerReplicas: string;
    runnerTag: string;
}

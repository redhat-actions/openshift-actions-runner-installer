import { GitHub } from "@actions/github/lib/utils";

type SelfHostedRunnerLabel = {
    id: number;
    name: string;
    type: string;
}

type SelfHostedRunner = {
    id: number;
    name: string;
    os: string;
    status: string;
    busy: boolean;
    labels: SelfHostedRunnerLabel[];
}

// https://docs.github.com/en/rest/reference/actions#list-self-hosted-runners-for-an-organization
// https://docs.github.com/en/rest/reference/actions#list-self-hosted-runners-for-a-repository
export type SelfHostedRunnersResponse = {
    // eslint-disable-next-line camelcase
    total_count: number;
    runners: SelfHostedRunner[]
}

// The return type of getOctokit - copied from node_modules/@actions/github/lib/github.d.ts
export type Octokit = InstanceType<typeof GitHub>;

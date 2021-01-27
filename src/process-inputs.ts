/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as github from "@actions/github";

import Constants from "./constants";
import { Inputs } from "./generated/inputs-outputs";
import RunnerLocation from "./types/runner-location";
import { RunnerConfiguration } from "./types/types";

export default function processInputs(): RunnerConfiguration {
    const githubPat = core.getInput(Inputs.GITHUB_PAT, { required: true });
    const helmReleaseName = core.getInput(Inputs.HELM_RELEASE_NAME, { required: true });

    const runnerLocationStr = core.getInput(Inputs.RUNNER_LOCATION)
    || `${github.context.repo.owner}/${github.context.repo.repo}`;

    const runnerLocation = getRunnerLocationObj(runnerLocationStr);

    const image = core.getInput(Inputs.IMAGE) || Constants.DEFAULT_IMG;
    const tag = core.getInput(Inputs.IMAGE_TAG) || Constants.DEFAULT_IMG_TAG;
    const taggedImage = `${image}:${tag}`;

    const inputLabelsStr = core.getInput(Inputs.RUNNER_LABELS);
    let inputLabels: string[] = [];
    if (inputLabelsStr) {
        inputLabels = inputLabelsStr.split(",").map((label) => label.trim());
    }
    const runnerLabels = [ taggedImage, ...inputLabels ];

    const inputExtraArgsStr = core.getInput(Inputs.HELM_EXTRA_ARGS);
    let helmExtraArgs: string[] = [];
    if (inputExtraArgsStr) {
        helmExtraArgs = inputExtraArgsStr.split("\r?\n").map((arg) => arg.trim());
    }

    let namespace: string | undefined = core.getInput(Inputs.NAMESPACE);
    if (namespace === "") {
        namespace = undefined;
    }

    return {
        githubPat,
        helmExtraArgs,
        helmReleaseName,
        image,
        namespace,
        runnerLabels,
        runnerLocation,
        tag,
    };
}

function getRunnerLocationObj(runnerLocationStr: string): RunnerLocation {
    const slashIndex = runnerLocationStr.indexOf("/");
    if (slashIndex >= 0) {
        core.info(`Fetching self-hosted runners for repository "${runnerLocationStr}"`);
        return {
            owner: runnerLocationStr.substring(0, slashIndex),
            repository: runnerLocationStr.substring(slashIndex + 1),
        };
    }

    core.info(`Fetching self-hosted runners for the "${runnerLocationStr}" organization`);
    return {
        owner: runnerLocationStr,
    };
}

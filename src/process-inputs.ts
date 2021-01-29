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
import { splitByNewline } from "./util/util";

export default function processInputs(): RunnerConfiguration {
    const githubPat = core.getInput(Inputs.GITHUB_PAT, { required: true });
    const encodedPat = Buffer.from(githubPat).toString("base64");
    core.setSecret(encodedPat);

    const runnerLocInput = core.getInput(Inputs.RUNNER_LOCATION);
    core.debug(`Runner location input is ${runnerLocInput}`);
    const runnerLocationStr = runnerLocInput || `${github.context.repo.owner}/${github.context.repo.repo}`;
    const runnerLocation = getRunnerLocationObj(runnerLocationStr);

    const helmReleaseNameInput = core.getInput(Inputs.HELM_RELEASE_NAME);
    const helmReleaseName = helmReleaseNameInput || `${runnerLocation.toString().replace(/\//g, "-")}-runner`;

    const runnerImage = core.getInput(Inputs.IMAGE) || Constants.DEFAULT_IMG;
    const runnerTag = core.getInput(Inputs.IMAGE_TAG) || Constants.DEFAULT_IMG_TAG;

    const inputLabelsStr = core.getInput(Inputs.RUNNER_LABELS);
    let runnerLabels: string[] = [];
    if (inputLabelsStr) {
        runnerLabels = inputLabelsStr.split(",").map((label) => label.trim());
    }

    const inputExtraArgsStr = core.getInput(Inputs.HELM_EXTRA_ARGS);
    let helmExtraArgs: string[] = [];
    if (inputExtraArgsStr) {
        // transform the array of lines into an array of arguments
        // by splitting over lines, then over spaces, then trimming.
        const lines = splitByNewline(inputExtraArgsStr);
        helmExtraArgs = lines.flatMap((line) => line.split(" ")).map((arg) => arg.trim());
    }

    let namespace: string | undefined = core.getInput(Inputs.NAMESPACE);
    if (namespace === "") {
        namespace = undefined;
    }

    const runnerReplicas = core.getInput(Inputs.RUNNER_REPLICAS) || "1";

    return {
        githubPat,
        helmExtraArgs,
        helmReleaseName,
        runnerImage,
        namespace,
        runnerLabels,
        runnerLocation,
        runnerReplicas,
        runnerTag,
    };
}

function getRunnerLocationObj(runnerLocationStr: string): RunnerLocation {
    const slashIndex = runnerLocationStr.indexOf("/");
    if (slashIndex >= 0) {
        return new RunnerLocation(
            runnerLocationStr.substring(0, slashIndex),
            runnerLocationStr.substring(slashIndex + 1),
        );
    }

    return new RunnerLocation(runnerLocationStr);
}

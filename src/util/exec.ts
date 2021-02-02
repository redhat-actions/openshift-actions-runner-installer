/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";

export default async function execute(
    executable: string,
    args: string[],
    execOptions: exec.ExecOptions & { group?: boolean } = {},
): Promise<{ exitCode: number, stdout: string, stderr: string }> {
    let stdout = "";
    let stderr = "";

    const finalExecOptions = { ...execOptions };
    finalExecOptions.ignoreReturnCode = true; // the return code is processed below

    finalExecOptions.listeners = {
        stdout: (data): void => {
            stdout += `${data.toString()}`;
        },
        stderr: (data): void => {
            stderr += `${data.toString()}`;
        },
    };

    if (execOptions.group) {
        const groupName = [ executable, ...args ].join(" ");
        core.startGroup(groupName);
    }

    try {
        const exitCode = await exec.exec(executable, args, finalExecOptions);

        if (execOptions.ignoreReturnCode !== true && exitCode !== 0) {
            // Throwing the stderr as part of the Error makes the stderr show up in the action outline,
            // which saves some clicking when debugging.
            let error = `${path.basename(executable)} exited with code ${exitCode}`;
            if (stderr) {
                error += `\n${stderr}`;
            }
            throw new Error(error);
        }

        return {
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
        };
    }
    finally {
        if (execOptions.group) {
            core.endGroup();
        }
    }
}

/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as ghExec from "@actions/exec";
import * as os from "os";

/**
 * Run 'oc' with the given arguments.
 *
 * @throws If the exitCode is not 0, unless execOptions.ignoreReturnCode is set.
 *
 * @param args Arguments and options to 'oc'. Use getOptions to convert an options mapping into a string[].
 * @param finalExecOptions Options for how to run the exec. See note about hideOutput on windows.
 * @returns Exit code and the contents of stdout/stderr.
 */
export async function exec(
    executable: string, args: string[] = [], execOptions: ghExec.ExecOptions = {}
): Promise<{ exitCode: number, out: string, err: string }> {
    // ghCore.info(`${EXECUTABLE} ${args.join(" ")}`)

    let stdout = "";
    let stderr = "";

    const finalExecOptions = { ...execOptions };
    finalExecOptions.ignoreReturnCode = true;     // the return code is processed below

    finalExecOptions.listeners = {
        stdline: (line): void => {
            stdout += line + os.EOL;
        },
        errline: (line): void => {
            stderr += line + os.EOL;
        },
    };

    const exitCode = await ghExec.exec(executable, args, finalExecOptions);

    if (!execOptions.ignoreReturnCode && exitCode !== 0) {
        // Throwing the stderr as part of the Error makes the stderr show up in the action outline,
        // which saves some clicking when debugging.
        let error = `${executable} exited with code ${exitCode}`;
        if (stderr) {
            error += `: \n${stderr}`;
        }
        throw new Error(error);
    }

    return {
        exitCode, out: stdout, err: stderr,
    };
}

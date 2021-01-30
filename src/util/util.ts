/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

import * as core from "@actions/core";

/**
 * Joins a string array into a user-friendly list.
 * Eg, `joinList([ "tim", "erin", "john" ], "and")` => "tim, erin and john"
 */
export function joinList(strings_: readonly string[], andOrOr: "and" | "or" = "and"): string {
    // we have to duplicate "strings" here since we modify the array below and it's passed by reference
    const strings = Array.from(strings_).filter((s) => {
        if (!s) {
            return false;
        }
        return true;
    });

    // separate the last string from the others since we have to prepend andOrOr to it
    const lastString = strings.splice(strings.length - 1, 1)[0];

    let joined = strings.join(", ");
    if (strings.length > 0) {
        joined = `${joined} ${andOrOr} ${lastString}`;
    }
    else {
        joined = lastString;
    }
    return joined;
}

export function splitByNewline(s: string): string[] {
    return s.split(/\r?\n/);
}

export function awaitWithRetry<T = void>(
    timeoutS: number, delayS: number, groupName: string, errMsg: string,
    executor: (resolve: (value: T) => void, reject?: (err: Error) => void) => Promise<void>
): Promise<T> {
    let tries = 0;
    const maxTries = timeoutS / delayS;

    let interval: NodeJS.Timeout | undefined;

    core.startGroup(groupName);

    return new Promise<T>((resolve, reject) => {
        interval = setInterval(async () => {
            await executor(resolve, reject);

            if (tries > maxTries) {
                reject(new Error(errMsg));
                return;
            }

            tries++;
        },
        delayS * 1000);
    }).finally(() => {
        if (interval) {
            clearInterval(interval);
        }
        core.endGroup();
    });
}

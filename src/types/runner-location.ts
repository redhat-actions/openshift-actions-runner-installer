/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

/**
 * Represents a place a self-hosted runner can be located. Either under an org, or under a repository.
 */
export default class RunnerLocation {
    // public readonly isRepository;

    constructor(
        public readonly owner: string,
        public readonly repository?: string,
    ) {
        // this.isRepository = !!this.repository;
    }

    public toString(): string {
        if (this.repository) {
            return `${this.owner}/${this.repository}`;
        }
        return this.owner;
    }
}

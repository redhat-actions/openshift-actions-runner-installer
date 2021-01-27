/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

namespace Constants {
    export const DEFAULT_IMG = "quay.io/redhat-github-actions/runner";
    export const DEFAULT_IMG_TAG = "v0.1";

    export const CHART_REPO_NAME = "openshift-actions-runner-chart";
    export const CHART_REPO_URL = `https://github.com/redhat-actions/${CHART_REPO_NAME}`;
    export const CHART_REPO_REF = "main";
    /**
     * Path to the chart relative to the root of the CHART_REPO
     */
    export const CHART_RELATIVE_PATH = "./actions-runner/";
    export const RELEASE_NAME_LABEL = "app.kubernetes.io/instance";
}

export default Constants;

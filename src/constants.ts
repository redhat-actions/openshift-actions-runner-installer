/***************************************************************************************************
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 **************************************************************************************************/

namespace Constants {
    export const DEFAULT_IMG = "quay.io/redhat-github-actions/runner";
    export const DEFAULT_IMG_TAG = "v1";

    export const CHART_REPO_NAME = "openshift-actions-runner-chart";
    export const CHART_NAME = "actions-runner";
    export const CHART_REPO_URL = `https://redhat-actions.github.io/openshift-actions-runner-chart/`;
    export const RELEASE_NAME_LABEL = "app.kubernetes.io/instance";
}

export default Constants;

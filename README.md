# OpenShift Actions Runner Installer

[![Install into repository](https://github.com/redhat-actions/openshift-actions-runner-installer/workflows/Install%20into%20repository/badge.svg)](https://github.com/redhat-actions/openshift-actions-runner-installer/actions)
[![Install into org](https://github.com/redhat-actions/openshift-actions-runner-installer/workflows/Install%20into%20redhat-actions/badge.svg)](https://github.com/redhat-actions/openshift-actions-runner-installer/actions)
[![CI checks](https://github.com/redhat-actions/openshift-actions-runner-installer/workflows/CI%20Checks/badge.svg)](https://github.com/redhat-actions/openshift-actions-runner-installer/actions)
[![Link checker](https://github.com/redhat-actions/openshift-actions-runner-installer/workflows/Link%20checker/badge.svg)](https://github.com/redhat-actions/openshift-actions-runner-installer/actions)

[![awesome-runners](https://img.shields.io/badge/listed%20on-awesome--runners-blue.svg)](https://github.com/jonico/awesome-runners)
[![tag badge](https://img.shields.io/github/v/tag/redhat-actions/openshift-actions-runner-installer)](https://github.com/redhat-actions/openshift-actions-runner-installer/tags)
[![license badge](https://img.shields.io/github/license/redhat-actions/kn-service-deploy)](./LICENSE)

The OpenShift Self-Hosted Actions Runner Installer is a GitHub Action to automatically install self-hosted Actions runner containers into a Kubernetes cluster.

The action uses the [**OpenShift Actions Runner Chart**](https://github.com/redhat-actions/openshift-actions-runner-chart/) to install runners.

By default, the chart installs the [**OpenShift Actions Runner**](https://github.com/redhat-actions/openshift-actions-runner). The image to use is configurable (see [Inputs](#inputs)).

This action uses these two projects to make the self-hosted runner installation on Kubernetes as easy as possible.

If a runner that uses the same image and has any requested labels is already present, the install step will be skipped. This action can be run as a prerequisite step to the "real" workflow to ensure the runner a workflow needs is available.

While this action, chart and images are developed for and tested on OpenShift, they do not contain any OpenShift specific code. This action should be compatible with any Kubernetes platform.

## Prerequisites
You must have access to a Kubernetes cluster. Visit [openshift.com/try](https://www.openshift.com/try) or sign up for our [Developer Sandbox](https://developers.redhat.com/developer-sandbox).

You must have authenticated to your Kubernetes cluster and set up a Kubernetes config. If you are using OpenShift, you can use [**oc-login**](https://github.com/redhat-actions/oc-login).

You must have `helm` v3 and either `oc` or `kubectl` installed. You can use the [**OpenShift CLI Installer**](https://github.com/redhat-actions/openshift-cli-installer) to install and cache these tools.

You do **not** need cluster administrator privileges to deploy the runners and run workloads. However, some images or tools may require special permissions.

<a id="example-workflows"></a>

## Example Workflows
Refer to the [**Repository Example**](./.github/workflows/repo_example.yml) and [**Organization Example**](./.github/workflows/org_example.yml). The Repository example is also an example of using a [`repository_dispatch` event](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#repository_dispatch) to trigger a separate workflow, once the runner is ready.

Remember to [create a secret](https://docs.github.com/en/actions/reference/encrypted-secrets) containing the GitHub PAT as detailed above, and pass it in the `github_pat` input. Below, the secret is named `PAT`.

All other inputs are optional.

### Minimal Example
```yaml
name: OpenShift Self-Hosted Installer Workflow
on: [ push, workflow_dispatch ]

jobs:
  install-runner:
    runs-on: ubuntu-20.04
    name: Install runner
    steps:
      - name: Install self hosted runner into this repository
        uses: redhat-actions/openshift-actions-runner-installer@v1
        with:
          github_pat: ${{ secrets.PAT }}

  self-hosted-workflow:
    # Now that the above job has ensured the runner container exists,
    # we can run our workflow inside it.
    name: OpenShift Self Hosted Workflow
    # Add other labels here if you have to filter by a runner type.
    runs-on: [ self-hosted ]
    needs: install-runner

    steps:
      - run: hostname
      - run: ls -Al
      # ... etc
```

<a id="inputs"></a>

## Inputs
The only required input is the `github_pat`, which is a [Personal Access Token](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token), with the appropriate permisions.

The token must have the `repo` permission scope. For organization runners, the token must also have the `admin:org` scope. Refer to the Runner [README](https://github.com/redhat-actions/openshift-actions-runner#pat-guidelines).

Note that the default workflow token `secrets.GITHUB_TOKEN` does **not** have the permissions required to check for and install self-hosted runners. Refer to [Permissions for the GITHUB_TOKEN](https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token).

| Input Name | Description | Default |
| ---------- | ----------- | ------- |
| github_pat | GitHub Personal access token. Refer to the description above. | **Must be provided**
| runner_image | Container image to use for the runner. | [`quay.io/redhat-github-actions/runner`](https://quay.io/redhat-github-actions/runner)
| runner_tag | Tag to use for the runner container image. | `v1` |
| runner_labels | [Labels](https://docs.github.com/en/actions/hosting-your-own-runners/using-labels-with-self-hosted-runners) to add to the self-hosted runner. Must be comma-separated, spaces after commas optional. | None |
| runner_location | Repository or organization for the self-hosted runner. | Workflow repository |
| runner_replicas | Number of replicas of the container to create. Each replica is its own pod, and its own runner. | 1
| namespace | Optional Kubernetes namespace to pass to all Helm and Kube client comands.  | None |
| helm_release_name | The Helm release name to use. | Runner location (repo or org) |
| helm_uninstall_existing | Uninstall any release that matches the `helm_release_name` and `namespace` before running `helm install`. If this is false, and the release exists, the action will fail when the `helm install` fails. | `true` |
| helm_chart_version | Version of our [Helm Chart](https://github.com/redhat-actions/openshift-actions-runner-chart) to install. | Latest release
| helm_extra_args | Arbitrary arguments to append to the `helm` command. Refer to the [Chart README](https://github.com/redhat-actions/openshift-actions-runner-chart). <br>Separate items by newline. Do not quote the arguments, since `@actions/exec` manages quoting. | None |

## Outputs
| Output Name | Description |
| ----------- | ----------- |
| helm_release_name | The name of the Helm release that was installed.<br>If the runners were present and the install was skipped, this value is undefined. |
| installed | Boolean value indicating if the runners were installed (`true`), or already present (`false`). |
| runners | JSON-parsable array of the matching runners' names, whether they were installed by this action or already present. |

## Removing runners
`helm uninstall` is sufficient to remove the runners. As long as the runners terminate gracefully, they will remove themselves from the repository or organization before exiting.

You can use the `helm_release_name` output to determine the helm release name to uninstall.

Refer to the [tear down example](./.github/workflows/tear_down_runners.yml) and the [organization workflow](./.github/workflows/org_example.yml) for examples.

<a id="troubleshooting"></a>
## Troubleshooting

See the Troubleshooting sections of [the chart README](https://github.com/redhat-actions/openshift-actions-runner-chart#Troubleshooting), and [the runner README](https://github.com/redhat-actions/openshift-actions-runner#Troubleshooting).

The most common errors are due to a missing or misconfigured GitHub PAT. Make sure that:
- The secret was created correctly.
- The secret is referred to by the correct name in the workflow file.
- The PAT in the secret has the correct permissions.

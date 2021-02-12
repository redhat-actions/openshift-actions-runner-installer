# Containerized Actions Runner Installer


[![Install into repository](https://github.com/redhat-actions/containerized-actions-runner-installer/workflows/Install%20into%20repository/badge.svg)](https://github.com/redhat-actions/containerized-actions-runner-installer/actions)
[![Install into org](https://github.com/redhat-actions/containerized-actions-runner-installer/workflows/Install%20into%20redhat-actions/badge.svg)](https://github.com/redhat-actions/containerized-actions-runner-installer/actions)
[![CI checks](https://github.com/redhat-actions/containerized-actions-runner-installer/workflows/CI%20Checks/badge.svg)](https://github.com/redhat-actions/containerized-actions-runner-installer/actions)
[![Link checker](https://github.com/redhat-actions/containerized-actions-runner-installer/workflows/Link%20checker/badge.svg)](https://github.com/redhat-actions/containerized-actions-runner-installer/actions)

[![tag badge](https://img.shields.io/github/v/tag/redhat-actions/containerized-actions-runner-installer)](https://github.com/redhat-actions/containerized-actions-runner-installer/tags)
[![license badge](https://img.shields.io/github/license/redhat-actions/kn-service-deploy)](./LICENSE)

The Containerized Self Hosted Actions Runner Installer is a GitHub Action to automatically install self-hosted Actions runner containers into a Kubernetes cluster.

The action uses the [**OpenShift Actions Runner Chart**](https://github.com/redhat-actions/openshift-actions-runner-chart/) to install one or more runner containers.

By default, the chart installs the [**OpenShift Actions Runner**](https://github.com/redhat-actions/openshift-actions-runner). This image is designed to be extended to install whatever tooling your workflows need. Then, provide your custom image in this action's Inputs.

If a runner that uses the same image and has any requested labels is already present, the install step will be skipped, so this action can be run as a prerequisite step to the "real" workflow to ensure the runner a workflow needs is available.

While the installer is developed for and tested on OpenShift, it does not contain any OpenShift specific code, and should be compatible with any Kubernetes platform.

## Inputs
The only required input is the `github_pat`, which is a ([Personal Access Token](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token)), with the appropriate permisions.

The token must have the `repo` permission scope. For organization runners, the token must also have the `admin:org` scope. Refer to the Runner [README](https://github.com/redhat-actions/openshift-actions-runner#pat-guidelines).

Note that the default workflow token `secrets.GITHUB_TOKEN` does **not** have the permissions required to check for and install self-hosted runners. Refer to [Permissions for the GITHUB_TOKEN](https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token).


| Input Name | Description | Default |
| ---------- | ----------- | ------- |
| github_pat | GitHub Personal access token. Refer to the description above. | **Must be provided**
| runner_location | Repository or organization for the self-hosted runner. | Workflow repository |
| runner_image | Container image to use for the runner. | [`quay.io/redhat-github-actions/runner`](https://quay.io/redhat-github-actions/runner)
| runner_tag | Tag to use for the runner container image. | `v1.0.0` |
| runner_labels | [Labels](https://docs.github.com/en/actions/hosting-your-own-runners/using-labels-with-self-hosted-runners) to add to the self-hosted runner. Must be comma-separated, spaces after commas optional. | None |
| runner_replicas | Number of replicas of the container to create. Each replica is its own runner. | 1
| namespace | Optional Kubernetes namespace to pass to all Helm and Kubernetes comands.  | None |
| helm_release_name | The Helm release name to use. | Runner location |
| helm_extra_args | Arbitrary arguments to append to the <code>helm&nbsp;upgrade&nbsp;‑‑install</code> command. Refer to the [Chart README](https://github.com/redhat-actions/openshift-actions-runner-chart). <br>Separate items by newline. Do not quote the arguments since `@actions/exec` manages quoting. | None |

## Outputs
| Output Name | Description |
| ----------- | ----------- |
| installed | Boolean value indicating if the runners were installed (installed=true), or already present (installed=false). |
| runners | JSON-parseable array of the matching runners' names, whether they were installed by this action or not. |

## Example Workflows
Refer to the [**Repository Example**](./.github/workflows/repo_example.yml) and [**Organiziation Example**](./.github/workflows/org_example.yml).

Remember to [create a secret](https://docs.github.com/en/actions/reference/encrypted-secrets) containing the GitHub PAT as detailed above, and pass it in the `github_pat`. Below, the secret is named `PAT`.

All other inputs are optional.

### Minimal Example
```yaml
name: Containerized Self-Hosted Workflow
on: [ push, workflow_dispatch ]

jobs:
  install-runner:
    runs-on: ubuntu-20.04
    name: Install org runner
    steps:
      - name: Install self hosted runner into this repository
        uses: redhat-actions/containized-runner-installer@v1
        with:
          github_pat: ${{ secrets.PAT }}

  self-hosted-workflow:
    # Now that the above job has ensured the runner container exists,
    # we can run our workflow inside it.
    name: Containized Self Hosted Workflow
    runs-on: [ self-hosted ]
    needs: install-runner

    steps:
      - run: hostname
      - run: ls -Al
```

## Troubleshooting

See the Troubleshooting sections of [the chart README](https://github.com/redhat-actions/openshift-actions-runner-chart#Troubleshooting), and [the runner README](https://github.com/redhat-actions/openshift-actions-runner#Troubleshooting).

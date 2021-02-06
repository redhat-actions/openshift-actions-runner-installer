# Self Hosted Runner Installer

The Self Hosted Runner Installer is a GitHub Action to automatically install self-hosted Actions runner containers into a Kubernetes cluster.

The action uses the [**OpenShift Actions Runner Chart**](https://github.com/redhat-actions/openshift-actions-runner-chart/) to install one or more runner containers, which by default run the [**OpenShift Actions Runner**](https://github.com/redhat-actions/openshift-actions-runner) image.

If a runner that uses the same image and has any requested labels is already present, the install step will be skipped, so this action can be run as a prerequisite step to the "real" workflow to ensure the runner a workflow needs is available.

While the installer is developed for and tested on OpenShift, it does not contain any OpenShift specific code, and should be compatible with any Kubernetes platform.

## Troubleshooting

See the [Troubleshooting section](https://github.com/redhat-actions/openshift-actions-runner-chart#Troubleshooting) of the chart README.

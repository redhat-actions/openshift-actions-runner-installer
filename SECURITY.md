# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities through GitHub's private security advisory feature:

1. Go to the [Security Advisories page](https://github.com/redhat-actions/openshift-actions-runner-installer/security/advisories)
2. Click "New draft security advisory"
3. Fill in the details of the vulnerability

Alternatively, you can email the Red Hat Product Security team at secalert@redhat.com.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v1.x    | Yes                |

## Security Best Practices for Users

- Always use a GitHub PAT with the minimum required scopes (`repo` for repository runners, plus `admin:org` for organization runners)
- Store PATs as [encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) -- never hardcode them in workflows
- Review the [GitHub Actions security hardening guide](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

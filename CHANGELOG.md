# openshift-actions-runner-installer Changelog

## v2.0.0 (Unreleased)

### Runtime & Dependencies
- Upgrade action runtime from Node.js 16 (EOL) to Node.js 24
- Upgrade TypeScript from 4.2 to 5.x, ESLint from 7 to 9 (flat config)
- Update all `@actions/*` packages to latest versions
- Update all dev dependencies, resolving all 24 npm audit vulnerabilities

### CI
- Update all GitHub Actions to latest versions (`actions/checkout@v7`, `actions/upload-artifact@v7`, etc.)
- Update CI runner from `ubuntu-20.04` (EOL) to `ubuntu-24.04`
- Replace `pull_request_target` trigger with `pull_request` in CI workflow
- Add `permissions: contents: read` to all workflows
- Add concurrency groups to prevent duplicate CI runs
- Move integration test workflows to `workflow_dispatch` only (require OpenShift cluster secrets)
- Replace archived `gaurav-nelson/github-action-markdown-link-check` with maintained `tcort/github-action-markdown-link-check`
- Add unit tests for pure logic functions using Vitest

### Bug Fixes
- Fix inverted pod-readiness filter in `wait-for-pods.ts` — was matching ready pods instead of not-ready ones
- Fix premature "runner offline" warnings during startup — runners are now polled until timeout instead of being permanently marked offline on first check
- Increase runner wait timeout from 60s to 180s to accommodate slower container startups
- Fix typo in error message ("Can only container" → "Can only contain")
- Fix `package.json` name to match repository
- Add `private: true` to prevent accidental npm publish

### Security
- Enable secret scanning and push protection
- Set default workflow permissions to read-only
- Disable force pushes on `main` branch
- Add CODEOWNERS, SECURITY.md, and Dependabot configuration

### Documentation
- Fix license badge pointing to wrong repository
- Remove stale badges for manual-only workflows
- Update example workflow to use `ubuntu-latest`
- Fix typo in inputs table ("comands" → "commands")

## v1.1
- Update action to run on Node16. https://github.blog/changelog/2022-05-20-actions-can-now-run-in-a-node-js-16-runtime/

## v1.0
Initial marketplace release

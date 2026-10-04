# repo-checks — Repository Checks

This `/repo-checks` prompt runs executable repository checks. It is distinct from
the report-only OpenSpec `/opsx-verify` workflow.

For every affected backend service, run:

```powershell
pnpm run validate:openapi -- --service <service>
pnpm run verify -- --service <service>
```

`verify` already runs the service-scoped contract tests together with the
repo-wide architecture, domain purity, invariant, and dependency checks, so no
separate `test:contract` call is needed. Only contract tests are scoped to the
selected service; the rest stay repo-wide.

For `web` changes, run the browser checks plus the repo-wide `verify`. The `web`
namespace has no OpenAPI contract, so there are no OpenAPI or service-scoped
contract checks for it:

```powershell
pnpm web:test
pnpm web:build
pnpm web:e2e
pnpm run verify
```

Then run `/opsx-verify` in GitHub Copilot/OpenCode or `/opsx:verify` in Claude
Code to compare implementation with the approved change.

Report each result separately. Do not silently fix failures, weaken architecture
rules, delete tests, or mark OpenSpec tasks complete when their verification has
not passed. Fixes that change required behavior must first update the reviewed
OpenSpec artifacts.

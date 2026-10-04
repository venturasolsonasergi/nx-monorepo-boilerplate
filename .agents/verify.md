# verify — Repository Checks and OpenSpec Verification

This legacy `/verify` prompt runs executable repository checks. It is distinct
from the report-only OpenSpec `/opsx-verify` workflow.

For every affected backend service, run:

```powershell
pnpm run validate:openapi -- --service <service>
pnpm run test:contract -- --service <service>
pnpm run verify -- --service <service>
```

For `web` changes, run the browser checks instead; they are distinct from the
report-only OpenSpec verify:

```powershell
pnpm web:test
pnpm web:build
pnpm web:e2e
```

The package `verify` command keeps architecture, domain purity, invariant, and
dependency checks repo-wide; only contract tests are scoped to the selected
service. Then run `/opsx-verify` in GitHub Copilot/OpenCode or `/opsx:verify` in
Claude Code to compare implementation with the approved change.

Report each result separately. Do not silently fix failures, weaken architecture
rules, delete tests, or mark OpenSpec tasks complete when their verification has
not passed. Fixes that change required behavior must first update the reviewed
OpenSpec artifacts.

# apply — Legacy Alias for OpenSpec Apply

Implementation is Phase 2 and must use the official OpenSpec change tasks. Do
not run the removed `pnpm apply` placeholder or claim it generates code.

Use `/opsx-apply` in GitHub Copilot/OpenCode or `/opsx:apply` in Claude Code for
the approved change. Work task by task and stop if a task conflicts with the
approved behavior or design.

After implementation, run for each affected backend service:

```powershell
pnpm run validate:openapi -- --service <service>
pnpm run test:contract -- --service <service>
pnpm run verify -- --service <service>
```

For `web` changes run the browser checks instead of the OpenAPI/contract checks:

```powershell
pnpm web:test
pnpm web:build
pnpm web:e2e
```

Then run the report-only OpenSpec verify workflow. Do not archive until all
checks pass, and do not create a Git commit.

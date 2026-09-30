# code-review — Final Checks and Commit Preparation

Run `pnpm run code_review -- --service <service>` after Phase 2 verification.
This runs lint and the repository validation suite; architecture and dependency
checks remain global while contract tests are scoped to the selected service.
If a check fails, report the failure and return to implementation. Do not fix
failures during review.

After Phase 3 archive, read the approved OpenSpec proposal, archived change,
affected service OpenAPI contracts, and `git diff --name-only HEAD`. Summarize
the implemented behavior and prepare a conventional commit message such as:

```text
feat(<service>): <behavior summary>

OpenSpec: <change-name>
- <key requirement or domain behavior>
- <key API or infrastructure change>
```

Report the changed-file summary and proposed commit message. Do not stage,
commit, tag, or push; the user reviews the diff and performs the Git operation.

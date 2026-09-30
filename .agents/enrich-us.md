# enrich-us — Legacy Alias for OpenSpec Explore

This prompt no longer writes `spec-context.md` or proposes requirements outside
OpenSpec. Use `/opsx-explore` in GitHub Copilot/OpenCode or `/opsx:explore` in
Claude Code to investigate an uncertain feature. Exploration is read-only unless
the user asks to capture the result in a change proposal.

When the behavior is clear, use the corresponding propose workflow. Before
creating artifacts, identify the affected service(s), inspect their existing
OpenSpec capabilities, OpenAPI contracts, implementation, and tests. Ask only
for material decisions not already settled by the user.

# Spec Context

This folder holds the enriched context file produced by `/enrich-us` for each
spec iteration. The file `spec-context.md` is consumed by `/new` to generate
the OpenAPI spec and serves as the shared state between workflow agents.

Files here are intentionally ephemeral — they represent the current in-progress
spec cycle and are overwritten on each new `/enrich-us` run.

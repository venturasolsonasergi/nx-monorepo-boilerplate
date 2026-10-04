# Proposal

## Why

The browser client in `apps/web` has observable behavior but no persistent OpenSpec requirements, and the repository's SDD guidance assumes every capability lives under a backend service. The web app is a product surface, not a microservice, so it needs a reviewed `web/<capability>` namespace plus browser test coverage before its behavior can be changed safely.

## What Changes

- Establish `web` as an OpenSpec namespace for browser-observable behavior: persistent specs at `openspec/specs/web/<capability>/spec.md` and deltas at `openspec/changes/<change>/specs/web/<capability>/spec.md`.
- Seed baseline, reviewed requirements for the currently implemented web surfaces: authentication entry points, profile creation, navigation, and inline error handling.
- Add a Playwright-based browser end-to-end project (`apps/web-e2e`) launched against the Vite dev server, plus a root `web:e2e` script and focused Vitest coverage so `web:test` verifies the client.
- Align SDD documentation and agent guidance so proposals may scope web capabilities, and so OpenAPI/contract validation is required only for affected backend services while `web:test`, `web:build`, and `web:e2e` are required for web changes.
- Non-goals: adding dashboard or settings behavior that does not exist yet; adding database, email, or live API dependencies to the browser smoke suite; moving the full API-backed auth journey into web e2e; creating a `web` microservice, OpenAPI contract, or Prisma schema.

## Capabilities

### New Capabilities

- `web/authentication`: Browser entry points for session-gated interactions and for the verification, password-reset, and OAuth callback routes the API redirects to.
- `web/user-management`: Creation of the authenticated caller's profile from the `/users` route, including required fields and session gating.
- `web/navigation`: Registration and composition of the client routes and the in-app links that connect them.
- `web/error-handling`: Inline, non-crashing surfacing of invalid or failed states such as bad tokens, failed providers, and missing sessions.

### Modified Capabilities

- None. No existing service capability requirements change.

## Impact

- New persistent specs under `openspec/specs/web/` after archive; `openspec/config.yaml` gains the `web` namespace convention and backend-only contract-validation wording.
- New `@playwright/test` devDependency, `apps/web-e2e/` project and specs, and the root `web:e2e` script; new Vitest tests under `apps/web/src`.
- Documentation and agent guidance updated in `docs/sdd-flow.md`, `docs/architecture-validation.md`, `README.md`, `.agents/project-context.md`, and the legacy `.agents/*.md` prompts plus their tool-specific aliases.
- No backend contract, Prisma schema, `microservice.json`, or `architecture/rules.json` change; `apps/web` stays excluded from service discovery, Prisma, contract-test, and OpenAPI validation.

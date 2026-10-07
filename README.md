# NestJS SDD Microservices Boilerplate

Backend boilerplate for microservices with:

- Spec Driven Development (SDD)
- OpenSpec for behavioral requirements and change history
- OpenAPI as the HTTP contract for each service
- Tactical DDD and clean architecture lite
- Prisma repositories in infrastructure
- Architecture validation harness

## Project Structure

- `apps/api/` NestJS API application and `apps/web/` React application
- `apps/api-e2e/` end-to-end tests for the API and `apps/web-e2e/` Playwright browser tests for the web app
- `libs/users/` and `libs/orders/` service modules:
  - `specs/openapi.yaml`, `domain/`, `application/`, `infrastructure/`, `tests/`
- `openspec/specs/<namespace>/<capability>/spec.md` — persistent behavioral specs namespaced per service, plus the browser client under `openspec/specs/web/`
- `openspec/changes/` — proposed changes and archive history
- `libs/shared/domain/`, `libs/shared/validation/`, and `libs/shared/api-contracts/`
- `architecture/` rules, graph and validation engine
- `scripts/` root workflow scripts

## Application Commands

- `pnpm api:start:dev` — start the API in watch mode
- `pnpm api:build` — build the API and package its generated Prisma clients
- `pnpm api:test` — run API unit and contract tests
- `pnpm api:test:e2e` — run API end-to-end tests
- `pnpm web:dev` — start the React app in Vite
- `pnpm web:build` — build the React app
- `pnpm web:test` — run the web unit and component tests (Vitest)
- `pnpm web:e2e` — run the Playwright browser smoke suite for the web app

## Core Commands

- `pnpm run validate:openapi` — validate all discovered service contracts
- `pnpm run validate:openapi -- --service orders` — validate one service contract
- `pnpm run validate:architecture`
- `pnpm run validate:domain`
- `pnpm run check:domain-invariants`
- `pnpm run check:dependencies`
- `pnpm run test:contract -- --service orders` — run one service's contract tests
- `pnpm run test:contract` — run contract tests for all discovered services

## Database Commands (Prisma)

Prisma commands are service-agnostic: they discover every service with a
`microservice.json` and use its
`libs/<service>/infrastructure/prisma/prisma.config.ts`. There are no per-service
scripts to maintain.

- `pnpm prisma:generate` — generate the Prisma client for all discovered services (services without a `prisma.config.ts` are skipped)
- `pnpm prisma:generate -- --service users` — generate one service's client
- `pnpm prisma:migrate -- --service users -- --name add_status` — run `prisma migrate dev` for one service

For `prisma:migrate`, `--service` is mandatory and any argument after the second
`--` is forwarded verbatim to the Prisma CLI.

`prisma:generate` already runs as a `pre*` hook of the build, start, test,
`verify` and `test:contract` scripts, so you rarely need to invoke it by hand.

## Local Mail (Mailpit)

Development email is captured by Mailpit, which starts with the rest of the
development stack via `docker compose up`:

- SMTP endpoint: `localhost:1025` (the API container reaches it as `mailpit:1025`)
- Web UI: http://localhost:8025

Leave `SMTP_HOST` empty when running the API in Compose so it uses the bundled
`mailpit:1025`. When running the API on the host, set `SMTP_HOST=localhost` and
`SMTP_PORT=1025`. Set `SMTP_HOST`, `SMTP_PORT`, and credentials to an external
SMTP server to override Mailpit. Production requires a syntactically valid
`SMTP_HOST` and `MAIL_FROM`; temporary unreachability does not prevent startup
but is reported as a failed send, and a failed send is never replaced by logging
the activation link.

## Trusted Proxies

Client source IPs for authentication rate limits and session attribution are
resolved from the network peer, not from caller-supplied headers. When the API
runs behind a reverse proxy, list the proxy IPs/CIDR ranges in
`AUTH_TRUSTED_PROXIES`; the leftmost untrusted hop of the proxy's
`X-Forwarded-For` chain is then used. Direct callers that are not trusted
proxies cannot spoof their source through forwarded headers. The same resolved
source is passed to every internal Better Auth request through an
adapter-owned header, so independent clients never share one global bucket.

## Registration and Email Verification

`POST /auth/signup` accepts only an email and creates a pending registration; it
does not create an identity, credential, session, or profile. A registration
expires exactly 48 hours after initiation, and repeating signup or requesting a
resend never extends that deadline. The response reports the transport outcome
(`emailStatus: accepted | failed | throttled`) for that attempt, not mailbox
delivery. Opening the emailed `GET /auth/verify-email` link only redirects to the
`/complete-signup` password form; it never consumes the token or signs anyone in.

`POST /auth/verification/resend` returns a uniform acceptance response for
pending, unknown, expired, and verified addresses and discloses no account state.
`POST /auth/signup/complete` consumes the single-use token, establishes the
verified identity and credential with the chosen password, and issues the
session cookie; replaying the token returns `400`. Signup and resend share
per-address and per-source limits, and a blocked source returns `429`. The
legacy password-free `POST /auth/verify-email` is retired and returns `410`.

## OpenSpec Workflow

Install Node.js 20.19 or newer and the OpenSpec CLI, then initialize the project
workflows from the repository root:

```powershell
npm install -g @fission-ai/openspec@latest
openspec init --tools "github-copilot,claude,opencode" --profile custom --language English --no-copilot-cloud
openspec update
```

The machine-wide OpenSpec profile must include the core workflows plus optional
`verify`, with delivery set to `both`. The workflow is split into three gated
phases; see [docs/sdd-flow.md](docs/sdd-flow.md) for commands and exit criteria.

A namespace is either a discovered backend microservice or the browser client
`web`. Changes that scope `web/<capability>` describe browser-observable behavior
and have no OpenAPI contract; only affected backend services require OpenAPI and
contract validation. Web changes require `pnpm web:test`, `pnpm web:build`, and
`pnpm web:e2e` before archive.

1. Draft and validate: `/opsx-explore` when needed, `/opsx-propose`, review, sync the affected OpenAPI contract for backend services with `/sync-openapi`, then validate.
2. Implement and test: `/opsx-apply`, service-scoped tests and repo-wide checks (plus the web checks for web changes) via `/repo-checks`, then `/opsx-verify`.
3. Archive and prepare commit: `/opsx-archive`, review the synced specs and diff; the user commits manually.

GitHub Copilot and OpenCode use `/opsx-propose`; Claude Code uses `/opsx:propose`.

`pnpm run verify -- --service orders` scopes contract tests to that service but
keeps architecture and dependency checks repo-wide. `pnpm run code_review`
performs final lint and validation. Use `/code-review` to prepare the commit
summary; neither command creates the commit.

## Add a New Microservice

1. Copy `libs/users/` as a template into `libs/<new-service>/`.
2. Update `<new-service>/microservice.json`.
3. Add its HTTP contract at `libs/<new-service>/specs/openapi.yaml` and its persistent behavioral capabilities under `openspec/specs/<new-service>/<capability>/`.
4. Reuse global scripts under `scripts/` (no custom per-service scripts required).
5. Register the module in `apps/api/src/app.module.ts`.
6. Discovered services are included automatically by OpenAPI validation, Prisma and contract test commands.

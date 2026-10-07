# Design

## Context

See `proposal.md - Why` and the auth/web delta specs for behavior. The installed Better
Auth version is 1.7.7. Its email signup requires a nonempty password, its default email
verification JWT lasts one hour and is not persisted, and its verification can optionally
create a session. These defaults cannot implement an email-only, single-use, fixed
48-hour registration just by setting `emailVerification.expiresIn`.

The current adapter creates users before email proof, relies on the signup callback to
send mail, and checks verification only after Better Auth creates a login session. It
also builds internal requests without client-IP information and interprets error
responses from session checks as missing sessions. The current web collects a password
at signup and treats verification as a step before manual login. Existing e2e tests use a
recording mail port rather than SMTP.

## Goals / Non-Goals

**Goals:**
- Keep unproven email registrations separate from identities and credentials.
- Make expiry, restart, token rotation, cleanup, and activation concurrency-safe.
- Establish a password only with email proof and return to the web authenticated.
- Retain Better Auth's compatible password hashing, sign-in, cookies, reset, and logout.
- Preserve safe client attribution and distinguish invalid sessions from provider failure.
- Keep signup/resend mail reporting honest and storage bounded.

**Non-Goals:**
- A durable outbound queue or retry worker.
- A redesign of password-reset mail or OAuth identity linking.
- Business-profile creation during activation or cross-service database writes.
- Deleting legacy identities solely because `email_verified` is false.
- Making SMTP reachability a hard startup dependency.

## Decisions

### Decision: persist a registration, not a premature identity
Add `PendingRegistration` mapped to `auth_pending_registrations`: a UUID-format text ID,
unique normalized email, `created_at`, fixed `expires_at`, unique nullable `token_hash`,
and nullable `consumed_at`. Index `expires_at` for cleanup. Store no password, session,
profile, or raw token in this table. A new request expires after exactly 172800 seconds;
the TTL is part of the contract, not a configurable sliding window.

Application use cases own initiate, resend, complete, and expiry decisions through
repository and activation ports. Prisma, transactions, SDK integration, and scheduled
cleanup stay in auth infrastructure. The domain represents registration state and deadline
without framework, Prisma, or Zod dependencies. No users-service domain or database is
imported. Retain camelCase Prisma bindings for Better Auth's existing canonical objects
and map physical names to the repository's snake_case conventions.

Alternative: keeping an unverified `auth_user` with a temporary password requires
credential revocation and later password reset, retains the pre-registration risk, and
makes cleanup unsafe. This plan replaces that earlier design entirely.

### Decision: fixed deadline, persisted single-use tokens, safe link opening
Generate a cryptographically random opaque token with at least 256 bits of entropy and
store only its hash on the current registration. Bind validation to its registration ID,
current token hash, unconsumed state, and absolute deadline. Do not reuse Better Auth's
stateless email JWT: an old email-bound token must never activate a new attempt.

An allowed send rotates the token under the registration lock. Repeat signup reuses the
unexpired registration; resend never starts a registration or changes `expires_at`.
Throttling rotates nothing. A failed send leaves the registration recoverable, but not
its deadline extended. Restart after expiry replaces the attempt with a new ID and token,
making all prior links unusable. Cleanup is not required before restart can succeed.

The email URL remains `GET /auth/verify-email?token=...`; that handler only redirects to
the fixed configured web destination `/complete-signup?token=...`, without consuming or
verifying anything. It does not accept an arbitrary caller-selected activation redirect.
The former password-free `POST /auth/verify-email` returns `410`, and legacy JWTs are not
accepted by the completion endpoint. Mail scanners opening a GET cannot activate accounts.

Alternative: a new 48-hour token after every resend extends abandoned registrations
indefinitely and permits old-link resurrection. Setting only the SDK token TTL does not
give single-use behavior or a registration deadline.

### Decision: shared source-first reservation and honest mail outcomes
Reuse a dedicated `VerificationResendThrottle` table mapped to
`auth_verification_resend_throttle`, with text `identifier`, `window_started_at`, `count`,
and an index on the timestamp. Namespaced keys distinguish `email:<normalized>` and
`ip:<trusted-source>`. A conditional atomic upsert reserves a slot and caps its counter
when denied, avoiding unbounded increments. Default address limit: one attempt per 60 s.
Default source limit: 20 attempts per 3600 s, configured through
`AUTH_VERIFICATION_RESEND_WINDOW_SECONDS`, `AUTH_VERIFICATION_SOURCE_WINDOW_SECONDS`, and
`AUTH_VERIFICATION_SOURCE_MAX`; reject invalid values.

Reserve the source first, short-circuit when denied, then reserve the address. A blocked
source creates no pending-registration or per-address rows. Its signup returns `429` and
`Retry-After`; resend still returns the uniform acceptance envelope with the retry
interval. Address-throttled signup may retain a registration and return `201` with
`emailStatus: throttled`. Include its original `expiresAt` and `retryAfterSeconds`.

Signup and resend use one reserve/prepare-token/send path. Persist the registration/token
change before calling `MailPort`; perform no SMTP I/O while database locks are held.
Signup reports `accepted` only for recipient acceptance by SMTP, `failed` otherwise.
Resend returns request acceptance for unknown, expired, verified, and pending addresses,
including when SMTP fails, and never reports actual sending or identity state. Apply the
same reservations to all these address states. Log operational failures without raw
tokens, passwords, or full email bodies; do not fall back to logging activation links.

Alternative: separate initial and resend paths allow multiple emails in the same window;
reserving email before source permits a blocked source to grow per-address storage.

### Decision: activate identity and credential atomically, then issue the session
`POST /auth/signup/complete` accepts a token and password, not an email or user ID supplied
by the caller. Validate password policy before consuming anything. Use Better Auth's
configured password hashing/verification implementation, not a new handwritten hash or
a temporary password. Isolate the version-specific integration in the infrastructure
activation adapter; an integration test must prove its credential rows are accepted by
the installed SDK's normal sign-in and reset operations.

The activation repository locks the pending row and re-checks the current token,
deadline, and consumed state. In one auth database transaction it creates the verified
identity and credential account with the owner's chosen password and marks the token
consumed. New user/account IDs use UUID-format text; credential `accountId` is the user
ID and `providerId` is `credential`. The adapter uses the existing mapped auth schema and
SDK-compatible hash. Re-check the email uniqueness inside this transaction to handle a
concurrent OAuth/identity creation safely; do not overwrite a verified or linked account.

For an eligible legacy unverified local-only identity, lock that identity too, preserve
its ID, and establish the new credential and verified flag only after the registration
token proves control. Do not revoke or modify a legacy credential at initial signup or
resend. Never automatically replace/delete OAuth-linked identities. An ineligible or
concurrently verified identity produces a conflict without consuming an unrelated token
or changing credentials. Existing verified identity IDs and sessions remain untouched.

Concurrent activation, resend, expiry cleanup, and restart serialize on the pending row;
uniqueness constraints protect the email. Only one activation can commit. A replay
returns `400`, changes no password, and issues no fresh session. This intentionally
replaces the old idempotent verification-token behavior.

After commit, issue the session through Better Auth sign-in with the now-verified identity
and the owner's password, forwarding every `Set-Cookie` to the browser. On success the
web clears previous private caches, replaces the token-bearing URL, and navigates to
`/users` to complete the profile already authenticated. Session issuance is outside the
persistence transaction;
if it fails, return the classified `429`/service error with `accountActivated: true` so the
owner can use normal login. Never roll back a committed identity on a session failure or
pretend the cookie was issued. Network ambiguity can be recovered through normal login.

Alternative: auto-sign-in on a verification GET enables scanners and token replay to
create sessions. Verifying first and asking for a reset later reintroduces a credential
activation gap; issuing a cookie before database commit creates orphan sessions.

### Decision: trusted client attribution and precise session failures
Resolve source IP in Nest from the network peer and explicitly configured trusted
proxies; do not trust arbitrary `X-Forwarded-For` from direct callers. Pass a primitive
request context through auth ports for login, completion, session checks, logout, reset,
and OAuth rather than mutating shared singleton state. Construct an adapter-owned
internal IP header from that resolved source and configure Better Auth to read it. Never
copy that header from public input or silently fall back to one shared production bucket.

Enable `emailAndPassword.requireEmailVerification: true` and keep signup auto-sign-in
disabled. Normal login then rejects unverified identities before creating a session.
Session loading and refresh also require `emailVerified`, and provider failures must be
classified before reading session data. Refresh uses a checked provider response rather
than two unchecked session calls. Preserve `429`/retry metadata and service failures;
only actual absent/invalid/revoked/expired/unverified sessions become `401`. Propagate
replacement cookies. Apply the same error distinction to login and other adapter
wrappers without redesigning password-reset mail.

Expose `Retry-After` through the host's credentialed CORS configuration when necessary.
The existing origin-validation middleware remains in force for mutating auth requests.
No new cross-cutting platform capability is introduced.

Alternative: retaining SDK defaults without source propagation puts all internal requests
into the installed version's `no-trusted-ip` per-path bucket. Mapping every provider
failure to `401` contradicts the browser's unknown-session-state contract.

### Decision: safe cleanup and explicit legacy transition
Run a periodic infrastructure cleanup, clearing its timer on module destruction. Remove
pending registrations after `expires_at`, including consumed registrations after their
deadline, with predicates and locks compatible with activation. Expiry is also enforced
on every request using authoritative server time; equality with the deadline is expired.
Throttle retention defaults to 24 h and must be at least the longest configured window.
Cleanup is indexed, idempotent across replicas, and never deletes `auth_users` or profiles.

Existing unverified users remain legacy identities, not cleanup targets. Disable old
activation endpoints/tokens at rollout. Their next email-only signup starts the new
pending-registration flow; eligible completion preserves their ID and replaces the
credential only after proof. Verified and linked identities keep their current flows.
No age-only bulk delete or cross-service cascade is included. Document the transition and
test existing referenced IDs; do not presume an environment has no persisted users.

Alternative: deleting every unverified `auth_user` older than 48 h can remove linked or
referenced identities and mixes authentication persistence with abandoned signup state.

### Decision: mail, support configuration, and browser routes
Production initialization requires syntactically valid SMTP configuration, not a live
`transporter.verify()` success. Development may start unconfigured and report failed
sends. Compose gains Mailpit with SMTP `1025` and web UI `8025`; preserve environment
overrides so external SMTP remains usable. Use `mailpit:1025` in the API container and
`localhost:1025` outside Compose. Bind the local mail UI appropriately for development.

`AUTH_SUPPORT_EMAIL` is a validated public email, required in production and explicitly
documented for development. `GET /auth/public-config` returns only `supportEmail` (nullable
outside production), never secrets. The web fetches this config and offers an accessible
`mailto:` link; a failed config fetch does not block signup/resend or invent a contact.

Routes: `/signup` collects email and shows the deadline, mail outcome, resend, and help;
`/complete-signup` collects a single password (with a show/hide control) and, on
authenticated success, continues to `/users` to complete the profile in the same flow,
replacing the token-bearing URL. The retired `/verified` outcome screen is removed. Expired
links offer signup restart. Query parameters are never proof of login. Keep tokens out of
browser storage/logs and restrict referrer leakage from the completion page. Existing
login, reset, logout, private-cache isolation, and OAuth routes remain functional.

Alternative: baking server env into the browser can leak secrets or drift between
deployments; public configuration exposes only the intended help contact.

### Decision: contract first and verification boundaries
Synchronize and review `libs/auth/specs/openapi.yaml` before runtime edits: email-only
signup without `userId`; resend; public config; safe GET return; retired legacy POST;
completion and its session/partial-activation errors; and classified login/refresh
responses. Update auth/web consumers together. Domain/application tests cover deadlines,
tokens, and validation; real PostgreSQL tests cover locks, rollback, uniqueness, cleanup,
and concurrent activation. A mock cannot prove a locking guarantee.

The host e2e follows a real local SMTP link through safe GET, password submission, all
cookies, `/auth/refresh`, and a protected route. Also cover failed initial sending followed
by resend and completion, 48-hour boundaries without waiting, restarts and old links,
token replay, unverified login creating no session, IP isolation/spoofing, and operational
session errors. Browser e2e uses mocked public contracts for UI states and return paths;
it supplements, not replaces, the live host/SMTP test. Every task includes its local test
or observable verification, with the existing repo-wide gates at the end.

## Risks / Trade-offs

- SDK-compatible credential persistence is version-sensitive: isolate it in infrastructure
  and require real sign-in/reset integration tests before enabling activation.
- Tokens in email URLs are bearer credentials: store hashes only, suppress them in logs,
  restrict referrers, consume once, and erase token-bearing URLs after completion.
- Resend supersedes an earlier link even if SMTP subsequently fails: show honest outcomes,
  retain the pending deadline, and allow a later resend; do not extend expiry to compensate.
- Account commit can precede a session failure: report the activated-account state and
  recover via normal login rather than replaying a token or deleting the account.
- Per-source limits can affect shared networks: defaults are configurable and proxy trust
  is explicit; test independent clients and expose meaningful retry intervals.
- Multiple replicas and distributed abuse still require deployment-level capacity
  controls; source limits and retention bound per-source and historical application state.

## Migration Plan

- Review and validate the complete auth contract and change before implementation.
- Add pending-registration and throttle tables/indexes without rewriting identity IDs or
  bulk-deleting users. Ship config, backend, and web changes together for the breaking API.
- Announce the new email-only entry, fixed deadline, latest-link behavior, and retirement
  of legacy verification links. Existing verified users retain credentials and sessions.
- Provide SMTP/support config and trusted-proxy settings; enable cleanup and run the
  SMTP, database-concurrency, browser, and repository checks before rollout.
- Rollback must retain newly activated identities and compatible credential rows. Do not
  drop pending/throttle state while new code runs. Reverting to the old flow invalidates
  new pending links; communicate restart/recovery rather than attempting to restore old
  passwords. Legacy credentials changed after owner proof cannot be restored by a code
  revert. Review data backup and transition behavior before deployment.

## Open Questions

None blocking. The fixed 48-hour lifetime, no sliding resend deadline, source-first
limits, password-on-activation, session-on-success, legacy ID preservation, and
configuration-only SMTP startup policy are decided. Deployment-specific SMTP credentials,
support address, proxy CIDRs, and rate-limit tuning are configuration, not deferred flow
decisions.

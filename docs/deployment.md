# Production Deployment Runbook

This runbook documents the production deploy path: a one-time database
bootstrap, app creation on the platform, the environment each app needs, the
first-deploy smoke test, and rollback. It targets nan.builders Spaces (apps
build from a repository `Dockerfile` and auto-deploy on push; the PostgreSQL
instance is an app in the same Space), but the steps apply to any platform
that builds from `docker/api/Dockerfile` and `docker/web/Dockerfile`.

The production environment variables are listed in `.env.example` under
"Production environment" and are reproduced verbatim in
[Environment variables](#environment-variables) below.

## One-time database bootstrap

The managed PostgreSQL instance hosts one database per service. Databases are
an explicit provisioning step — the API never creates them. Connect to the
instance from inside the cluster (or via the support-provided path) with an
administrative role and create the three databases owned by the app user:

```sql
CREATE DATABASE auth_db OWNER <app_user>;
CREATE DATABASE users_db OWNER <app_user>;
CREATE DATABASE orders_db OWNER <app_user>;
```

Verify from inside the cluster that the app user sees the three databases:

```sql
\l
-- or: SELECT datname FROM pg_database WHERE datname IN ('auth_db', 'users_db', 'orders_db');
```

Also rotate any database credential that was ever shared in plaintext; only
the platform secret store should hold the final password used in
`*_DATABASE_URL`.

## App creation

### API app

- **Dockerfile**: `docker/api/Dockerfile` (build context: repository root)
- **Internal port**: `3000`
- **Runtime environment**: the full production variable list below
  (`APP_VERSION` and `GIT_SHA` included so every log entry identifies the
  release)

The image's entrypoint applies pending migrations with `prisma migrate deploy`
for every service that owns migrations (today: auth, users; orders is skipped
until it owns one) before the API process starts. A failed migration aborts
startup, so no traffic is served against an unmigrated schema.

### Web app

- **Dockerfile**: `docker/web/Dockerfile` (build context: repository root)
- **Internal port**: `80`
- **Build variable**: `VITE_API_URL=<api origin>` — the API base URL is baked
  into the client at build time, so changing the API origin later requires a
  web redeploy.

Keep both apps as sibling subdomains of one registrable domain (for example
`<api-app-origin>` and `<web-app-origin>` under `apps.nan.builders`), so the
session cookie stays same-site and no `SameSite=None` reconfiguration is
needed.

## Environment variables

Set these on the API app (values are placeholders; see `.env.example`):

| Variable | Example |
| --- | --- |
| `AUTH_DATABASE_URL` | `postgresql://<user>:<password>@<managed-postgres-host>:5432/auth_db?schema=public&sslmode=require` |
| `USERS_DATABASE_URL` | `postgresql://<user>:<password>@<managed-postgres-host>:5432/users_db?schema=public&sslmode=require` |
| `ORDERS_DATABASE_URL` | `postgresql://<user>:<password>@<managed-postgres-host>:5432/orders_db?schema=public&sslmode=require` |
| `AUTH_SECRET` | `<strong-unique-secret-at-least-32-chars>` |
| `AUTH_BASE_URL` | `https://<api-app-origin>` |
| `AUTH_WEB_URL` | `https://<web-app-origin>` |
| `AUTH_TRUSTED_ORIGINS` | `https://<web-app-origin>` |
| `AUTH_SUPPORT_EMAIL` | `<support@example.com>` |
| `SMTP_HOST` | `<outbound-smtp-host>` |
| `MAIL_FROM` | `<no-reply@your-domain>` |
| `APP_VERSION` | `0.0.1` |
| `GIT_SHA` | `<commit-sha>` |
| `LOG_LEVEL` | `info` |
| `PORT` | `3000` |

`AUTH_SUPPORT_EMAIL`, `SMTP_HOST`, and `MAIL_FROM` are required in production:
the auth service refuses to start without them, even though delivery itself is
a separate concern. `LOG_LEVEL` defaults to `warn` in production; set `info`
for the first deploy so the listening log is visible in deploy output.

## First-deploy smoke test

1. Deploy the API app. The deploy logs must show, in order:
   `migrate deploy` applying the auth and users migrations, then
   `API listening on port 3000` (visible with `LOG_LEVEL=info`). The first
   build doubles as the cross-app connectivity check: if the migrations apply,
   the API app reached the database app.
2. `GET https://<api-app-origin>/users/health` returns
   `200 {"status":"ok"}`.
3. Deploy the web app, then from its origin:
   - a direct visit renders the client, and a deep link (refresh on a client
     route) renders the app instead of a not-found error;
   - an authenticated sign-in round trip completes with the session cookie
     preserved (same-site flow).
4. Release identification: trigger any request and confirm an operational log
   entry on the platform's log view carries `version` and `commit` fields
   matching the configured `APP_VERSION`/`GIT_SHA` (a failed-route `warn` also
   serves).

## Rollback

Redeploy the previous commit from the platform (auto-deploy makes this a
revert + push). Migrations are forward-only: `migrate deploy` never rolls
back, so schema changes must stay backward-compatible across one deploy
window, and a rollback that crosses a migration re-introduces the previous
image against a newer schema — only acceptable when the migrations in between
are additive. A failing migration blocks every subsequent deploy until it is
resolved forward with a corrected migration; never hand-edit migration state.

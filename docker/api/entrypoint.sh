#!/bin/sh
# Container entrypoint: apply pending migrations for every service that owns a
# migrations/ directory (today: auth, users; a service without migrations, like
# orders today, is simply not enumerated — design decision 1), then exec the
# API process. A failed migration aborts startup so no traffic is served
# against an unmigrated schema.
set -eu

for migrations in /app/libs/*/infrastructure/prisma/migrations; do
  # With no owning service the glob stays literal and is not a directory.
  [ -d "${migrations}" ] || continue

  service="${migrations#/app/libs/}"
  service="${service%/infrastructure/prisma/migrations}"
  config="/app/libs/${service}/infrastructure/prisma/prisma.config.ts"

  if [ ! -f "${config}" ]; then
    echo "[entrypoint] ERROR: '${service}' owns migrations but its prisma.config.ts is missing from the image" >&2
    exit 1
  fi

  echo "[entrypoint] applying migrations for '${service}'"
  /app/node_modules/.bin/prisma migrate deploy --config "${config}"
done

echo "[entrypoint] migrations applied; starting API"
exec node dist/apps/api/src/main.js

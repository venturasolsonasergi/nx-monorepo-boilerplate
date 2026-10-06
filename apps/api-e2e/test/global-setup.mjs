import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUTH_TABLES,
  USERS_TABLES,
  ensureDatabaseExists,
  getTestDatabaseUrls,
  truncateTables,
} from './support/test-databases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const PRISMA_BIN = resolve(repoRoot, 'node_modules', 'prisma', 'build', 'index.js');

function migrate(service, envVar, url) {
  const configPath = resolve(
    repoRoot,
    'libs',
    service,
    'infrastructure',
    'prisma',
    'prisma.config.ts',
  );

  const result = spawnSync(
    process.execPath,
    [PRISMA_BIN, 'migrate', 'deploy', '--config', configPath],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, [envVar]: url },
    },
  );

  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed for service '${service}'`);
  }
}

export default async function globalSetup() {
  const { authUrl, usersUrl } = getTestDatabaseUrls();

  await ensureDatabaseExists(authUrl);
  await ensureDatabaseExists(usersUrl);

  migrate('auth', 'AUTH_DATABASE_URL', authUrl);
  migrate('users', 'USERS_DATABASE_URL', usersUrl);

  await truncateTables(authUrl, AUTH_TABLES);
  await truncateTables(usersUrl, USERS_TABLES);
}

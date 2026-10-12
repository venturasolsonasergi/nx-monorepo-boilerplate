#!/usr/bin/env node
// Smoke test for the production images (docker/api/Dockerfile, docker/web/Dockerfile).
// Covers the platform/production-runtime and web/production-serving scenarios:
//   - failed migration prevents startup
//   - pending migrations are applied before serving
//   - startup without pending migrations is idempotent
//   - SIGTERM stops gracefully (prompt exit, no shutdown errors, no DB connections left)
//   - the web origin serves the client shell on / and deep links, and real files for hashed assets
// Preconditions: Docker running and the compose Postgres up (docker compose up -d postgres).
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_IMAGE = 'nx-monorepo-boilerplate-api:smoke';
const WEB_IMAGE = 'nx-monorepo-boilerplate-web:smoke';
const API_CONTAINER = 'api-production-smoke';
const WEB_CONTAINER = 'web-production-smoke';
const SMOKE_DBS = ['auth_smoke', 'users_smoke', 'orders_smoke'];
const DB_HOST = 'host.docker.internal';
const DB_PORT = 5432;

function docker(args, options = {}) {
  return execFileSync('docker', args, { cwd: ROOT, encoding: 'utf8', ...options });
}

function psql(sql) {
  return docker(['exec', postgresContainer, 'psql', '-U', 'postgres', '-t', '-A', '-c', sql]);
}

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

let postgresContainer;

function fail(message) {
  throw new Error(message);
}

function findComposePostgres() {
  const id = docker(['compose', '-f', 'docker-compose.yml', 'ps', '-q', 'postgres']).trim();
  if (id.length === 0) {
    fail('Compose Postgres is not running. Start it with: docker compose up -d postgres');
  }
  return id;
}

function recreateSmokeDatabases() {
  for (const db of SMOKE_DBS) {
    psql(`DROP DATABASE IF EXISTS ${db};`);
    psql(`CREATE DATABASE ${db};`);
  }
}

function dropSmokeDatabases() {
  for (const db of SMOKE_DBS) {
    try {
      psql(`DROP DATABASE IF EXISTS ${db};`);
    } catch {
      // Best-effort cleanup; never mask a test failure with a cleanup error.
    }
  }
}

function buildImages() {
  console.log('Building API image...');
  docker(['build', '-f', 'docker/api/Dockerfile', '-t', API_IMAGE, '.']);
  console.log('Building web image...');
  docker(['build', '-f', 'docker/web/Dockerfile', '--build-arg', 'VITE_API_URL=https://api.example.test', '-t', WEB_IMAGE, '.']);
}

function publishedPort(container, internalPort) {
  const mapping = docker(['port', container, String(internalPort)]).trim();
  const lastLine = mapping.split('\n').at(-1);
  const port = lastLine?.split(':').at(-1);
  if (!port) {
    fail(`Cannot resolve published port for ${container}:${internalPort} (got: ${mapping})`);
  }
  return port;
}

function containerLogs(container) {
  const result = spawnSync('docker', ['logs', container], { cwd: ROOT, encoding: 'utf8' });
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function isRunning(container) {
  return docker(['inspect', '-f', '{{.State.Running}}', container]).trim() === 'true';
}

async function waitForExit(container, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isRunning(container)) {
      return docker(['inspect', '-f', '{{.State.ExitCode}}', container]).trim();
    }
    await delay(500);
  }
  fail(`Container ${container} did not exit within ${timeoutMs}ms`);
}

async function waitForHealth(container, port, timeoutMs = 90000) {
  const url = `http://127.0.0.1:${port}/users/health`;
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (!isRunning(container)) {
      const exitCode = docker(['inspect', '-f', '{{.State.ExitCode}}', container]).trim();
      console.error(`--- ${container} exited (code ${exitCode}) before becoming healthy; last logs: ---`);
      console.error(containerLogs(container).split('\n').slice(-20).join('\n'));
      fail(`Container ${container} exited (code ${exitCode}) before answering ${url}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.text()).trim();
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  fail(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

function databaseUrls(dbName) {
  const url = (db) => `postgresql://postgres:postgres@${DB_HOST}:${DB_PORT}/${db}?schema=public&sslmode=disable`;
  return {
    AUTH_DATABASE_URL: url(dbName ? dbName.auth : 'auth_smoke'),
    USERS_DATABASE_URL: url(dbName ? dbName.users : 'users_smoke'),
    ORDERS_DATABASE_URL: url(dbName ? dbName.orders : 'orders_smoke'),
  };
}

function apiEnv(extra = {}) {
  return {
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
    AUTH_SECRET: 'smoke-secret-smoke-secret-smoke-secret',
    AUTH_BASE_URL: 'http://localhost:3000',
    AUTH_WEB_URL: 'http://localhost:4200',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:4200',
    AUTH_SUPPORT_EMAIL: 'support@example.com',
    SMTP_HOST: 'localhost',
    MAIL_FROM: 'no-reply@example.com',
    APP_VERSION: '0.0.1-smoke',
    GIT_SHA: 'smoketest',
    ...extra,
  };
}

function runApiContainer(name, env) {
  const args = ['run', '-d', '--name', name, '--add-host', 'host.docker.internal:host-gateway', '-p', '127.0.0.1::3000'];
  for (const [key, value] of Object.entries(env)) {
    args.push('-e', `${key}=${value}`);
  }
  args.push(API_IMAGE);
  docker(args);
  return Number(publishedPort(name, 3000));
}

async function scenarioFailedMigrationPreventsStartup() {
  console.log('Scenario: failed migration prevents startup');
  const env = apiEnv(databaseUrls({ auth: 'auth_smoke', users: 'users_smoke', orders: 'orders_smoke' }));
  env.AUTH_DATABASE_URL = `postgresql://postgres:postgres@${DB_HOST}:5999/auth_smoke?schema=public&sslmode=disable`;
  const args = ['run', '-d', '--name', API_CONTAINER, '--add-host', 'host.docker.internal:host-gateway'];
  for (const [key, value] of Object.entries(env)) {
    args.push('-e', `${key}=${value}`);
  }
  args.push(API_IMAGE);
  docker(args);

  const exitCode = await waitForExit(API_CONTAINER, 60000);
  const logs = containerLogs(API_CONTAINER);
  if (exitCode !== '1') {
    fail(`Expected exit code 1 for a failed migration, got ${exitCode}`);
  }
  if (!/P1001|Can't reach database server/.test(logs)) {
    fail('Expected a database connection failure in the logs of the failed-migration container');
  }
  if (logs.includes('migrations applied; starting API')) {
    fail('The API process must not start after a failed migration');
  }
  docker(['rm', '--force', API_CONTAINER]);
}

async function scenarioMigrationsBeforeServing() {
  console.log('Scenario: pending migrations are applied before serving');
  const port = runApiContainer(API_CONTAINER, apiEnv(databaseUrls()));
  const body = await waitForHealth(API_CONTAINER, port);
  if (body !== '{"status":"ok"}') {
    fail(`Unexpected health body: ${body}`);
  }

  const logs = containerLogs(API_CONTAINER);
  const listening = logs.indexOf('API listening on port 3000');
  const authApply = logs.indexOf("applying migrations for 'auth'");
  const usersApply = logs.indexOf("applying migrations for 'users'");
  if (listening === -1 || authApply === -1 || usersApply === -1) {
    fail('Expected migrate deploy output for auth and users followed by the listening log');
  }
  if (!(authApply < listening && usersApply < listening)) {
    fail('Migrations must be applied before the API listens');
  }
  return port;
}

async function scenarioGracefulShutdown(port) {
  console.log('Scenario: SIGTERM stops gracefully');
  await fetch(`http://127.0.0.1:${port}/auth/login`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:4200', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@example.com', password: 'wrong-password-123' }),
  }).catch(() => undefined);

  const before = psql(`SELECT count(*) FROM pg_stat_activity WHERE datname LIKE '%_smoke';`).trim();
  if (before === '0') {
    fail('Expected at least one open smoke-database connection while the API runs');
  }

  const startedAt = Date.now();
  docker(['stop', '-t', '30', API_CONTAINER]);
  const elapsed = Date.now() - startedAt;
  const exitCode = docker(['inspect', '-f', '{{.State.ExitCode}}', API_CONTAINER]).trim();
  if (exitCode !== '143') {
    fail(`Expected graceful SIGTERM exit code 143, got ${exitCode}`);
  }
  if (elapsed >= 25000) {
    fail(`Graceful stop took ${elapsed}ms; the process did not exit promptly`);
  }
  const logs = containerLogs(API_CONTAINER);
  if (/error during shutdown/i.test(logs)) {
    fail('Shutdown logged an error; lifecycle hooks did not complete cleanly');
  }
  const remaining = psql(`SELECT count(*) FROM pg_stat_activity WHERE datname LIKE '%_smoke';`).trim();
  if (remaining !== '0') {
    fail(`Expected every smoke-database connection to close on shutdown, found ${remaining}`);
  }
}

async function scenarioIdempotentRestart() {
  console.log('Scenario: restart without pending migrations');
  docker(['start', API_CONTAINER]);
  const port = Number(publishedPort(API_CONTAINER, 3000));
  await waitForHealth(API_CONTAINER, port);

  const applied = containerLogs(API_CONTAINER).split('No pending migrations to apply.').length - 1;
  if (applied !== 2) {
    fail(`Expected both auth and users restarts to report no pending migrations (found ${applied})`);
  }
  return port;
}

async function scenarioWebServing() {
  console.log('Scenario: web serving with SPA fallback and asset caching');
  docker([
    'run', '-d', '--name', WEB_CONTAINER,
    '-p', '127.0.0.1::80',
    WEB_IMAGE,
  ]);
  const port = Number(publishedPort(WEB_CONTAINER, 80));
  const base = `http://127.0.0.1:${port}`;

  const root = await fetch(`${base}/`);
  if (root.status !== 200 || !(root.headers.get('content-type') ?? '').includes('text/html')) {
    fail(`GET / must return 200 text/html, got ${root.status} ${root.headers.get('content-type')}`);
  }
  const shell = await root.text();
  if (!shell.includes('<!doctype html>')) {
    fail('GET / did not return the built client shell');
  }
  if ((root.headers.get('cache-control') ?? '') !== 'no-cache') {
    fail(`index.html must be no-cache, got: ${root.headers.get('cache-control')}`);
  }

  const deepLink = await fetch(`${base}/dashboard`);
  if (deepLink.status !== 200 || !(await deepLink.text()).includes('<!doctype html>')) {
    fail('Deep link must return the client shell (200 HTML), not an error');
  }

  const assetMatch = shell.match(/\/assets\/index-[^"']+\.js/);
  if (!assetMatch) {
    fail('Client shell does not reference a hashed /assets/index-*.js script');
  }
  const asset = await fetch(`${base}${assetMatch[0]}`);
  const assetBody = await asset.text();
  if (asset.status !== 200 || !/(application\/javascript|text\/javascript)/.test(asset.headers.get('content-type') ?? '')) {
    fail(`Hashed asset must be served as JavaScript, got ${asset.status} ${asset.headers.get('content-type')}`);
  }
  if (assetBody.includes('<!doctype html>')) {
    fail('Asset path was replaced by the client shell');
  }
  if (!(asset.headers.get('cache-control') ?? '').includes('immutable')) {
    fail(`Hashed asset must be immutable, got: ${asset.headers.get('cache-control')}`);
  }
}

function cleanup() {
  for (const container of [API_CONTAINER, WEB_CONTAINER]) {
    try {
      docker(['rm', '--force', container]);
    } catch {
      // Container may not exist.
    }
  }
  dropSmokeDatabases();
}

async function main() {
  postgresContainer = findComposePostgres();
  try {
    buildImages();
    recreateSmokeDatabases();
    await scenarioFailedMigrationPreventsStartup();
    const port = await scenarioMigrationsBeforeServing();
    await scenarioGracefulShutdown(port);
    await scenarioIdempotentRestart();
    await scenarioWebServing();
    console.log('\nAll production image smoke scenarios passed.');
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(`SMOKE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

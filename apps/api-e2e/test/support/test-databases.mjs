import pg from 'pg';

const { Client } = pg;

export const AUTH_TABLES = [
  'auth_users',
  'auth_sessions',
  'auth_accounts',
  'auth_verification_tokens',
];

export const USERS_TABLES = ['user_profiles'];

export function getTestDatabaseUrls() {
  const authUrl = process.env.AUTH_TEST_DATABASE_URL;
  const usersUrl = process.env.USERS_TEST_DATABASE_URL;

  if (!authUrl || !usersUrl) {
    throw new Error(
      'Missing AUTH_TEST_DATABASE_URL / USERS_TEST_DATABASE_URL. ' +
        'Define them in .env (see .env.example) so e2e tests run against disposable test databases.',
    );
  }

  return { authUrl, usersUrl };
}

function databaseName(url) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

function withDatabase(url, database) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

export async function ensureDatabaseExists(testUrl) {
  const target = databaseName(testUrl);
  const admin = await connect(withDatabase(testUrl, 'postgres'));

  try {
    const existing = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [target],
    );
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${target}"`);
    }
  } finally {
    await admin.end();
  }
}

export async function truncateTables(url, tables) {
  if (tables.length === 0) {
    return;
  }

  const client = await connect(url);
  try {
    const list = tables.map((table) => `"${table}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

export async function countRows(url, tables) {
  const client = await connect(url);
  try {
    const counts = {};
    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM "${table}"`,
      );
      counts[table] = result.rows[0].count;
    }
    return counts;
  } finally {
    await client.end();
  }
}

import 'dotenv/config';

import {
  AUTH_TABLES,
  USERS_TABLES,
  countRows,
  getTestDatabaseUrls,
} from './support/test-databases.mjs';

export default async function globalTeardown() {
  const { authUrl, usersUrl } = getTestDatabaseUrls();

  const authCounts = await countRows(authUrl, AUTH_TABLES);
  const usersCounts = await countRows(usersUrl, USERS_TABLES);

  const leaks = Object.entries({ ...authCounts, ...usersCounts })
    .filter(([, count]) => count > 0)
    .map(([table, count]) => `${table}: ${count}`);

  if (leaks.length > 0) {
    throw new Error(
      'E2E database leak detected: test tables were not empty after the run. ' +
        'Every e2e test must clean up the data it created. Leftovers:\n  - ' +
        leaks.join('\n  - '),
    );
  }
}

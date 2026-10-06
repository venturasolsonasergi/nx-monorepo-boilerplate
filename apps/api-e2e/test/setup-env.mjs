import { getTestDatabaseUrls } from './support/test-databases.mjs';

const { authUrl, usersUrl } = getTestDatabaseUrls();

process.env.AUTH_DATABASE_URL = authUrl;
process.env.USERS_DATABASE_URL = usersUrl;

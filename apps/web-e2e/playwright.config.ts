import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Browser smoke coverage for apps/web. The Vite dev server is started by
// Playwright; specs mock the few backend calls they need with page.route, so
// the suite requires no database, email, or live API.
//
// A dedicated port is used so the suite always starts its own fresh dev server,
// independent of any other server that may already occupy the app's default port.
const PORT = 4300;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Run the root web:dev script from the repository root explicitly, so the
    // command does not depend on Playwright's default working directory.
    command: `pnpm exec vite --config apps/web/vite.config.ts --port ${PORT} --strictPort`,
    cwd: path.resolve(__dirname, '..', '..'),
    url: baseURL,
    // Locally this reuses any server already answering on PORT, so a stale
    // instance could produce misleading results; CI always starts a fresh one.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

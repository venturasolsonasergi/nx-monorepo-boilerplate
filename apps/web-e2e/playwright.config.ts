import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Browser smoke coverage for apps/web. The Vite dev server is started by
// Playwright; specs mock the few backend calls they need with page.route, so
// the suite requires no database, email, or live API.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Run the root web:dev script from the repository root explicitly, so the
    // command does not depend on Playwright's default working directory.
    command: 'pnpm run web:dev',
    cwd: path.resolve(__dirname, '..', '..'),
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

import { expect, test, type Page } from '@playwright/test';

const THEME_KEY = 'nx.theme';

const profileA = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};

function json(body: unknown) {
  return { contentType: 'application/json', body: JSON.stringify(body) };
}

async function routeAnonymous(page: Page) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{}',
    }),
  );
  await page.route('**/users/me/settings', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{}',
    }),
  );
}

async function seedTheme(page: Page, value: string) {
  await page.addInitScript(
    ({ key, theme }) => window.localStorage.setItem(key, theme),
    { key: THEME_KEY, theme: value },
  );
}

test.describe('theme first paint', () => {
  test('a cached dark preference renders dark before first paint', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await seedTheme(page, 'dark');

    await page.goto('/');

    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('an invalid cached value falls back to the system scheme', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await seedTheme(page, 'sepia');
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/');

    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('no cached preference follows a light system scheme', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto('/');

    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('signed-in theme', () => {
  test('a selection applies, persists through the API, and returns on reload', async ({
    page,
  }) => {
    let storedTheme = 'system';
    let patched: unknown = null;

    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );
    await page.route('**/auth/account', (route) =>
      route.fulfill({
        status: 200,
        ...json({
          email: 'a@example.com',
          hasPassword: true,
          passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
        }),
      }),
    );
    await page.route('**/users/me/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        patched = route.request().postDataJSON();
        const next =
          (patched as { theme?: string } | null)?.theme ?? storedTheme;
        storedTheme = next;
        return route.fulfill({
          status: 200,
          ...json({ language: 'es', theme: storedTheme }),
        });
      }
      return route.fulfill({
        status: 200,
        ...json({ language: 'es', theme: storedTheme }),
      });
    });

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Tema' })).toBeVisible();

    await page.getByRole('radio', { name: 'Oscuro' }).click();

    await expect
      .poll(() => patched)
      .toEqual({
        language: 'es',
        theme: 'dark',
      });
    await expect(page.locator('html')).toHaveClass(/dark/);

    // The session resolves again on reload and the stored theme is applied.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

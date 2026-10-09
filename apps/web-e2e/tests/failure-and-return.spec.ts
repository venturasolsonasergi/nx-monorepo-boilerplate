import { expect, test, type Page } from '@playwright/test';

function json(body: unknown) {
  return { contentType: 'application/json', body: JSON.stringify(body) };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/users/me/settings', (route) =>
    route.fulfill({ status: 401, ...json({}) }),
  );
  // The settings page discloses the account summary; keep it deterministic.
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
});

async function openUserMenu(page: Page) {
  await page.getByRole('button', { name: 'Cuenta de usuario' }).click();
}

test.describe('failure and return paths', () => {
  test('a network failure on the session check is not presented as signed out', async ({
    page,
  }) => {
    await page.route('**/auth/refresh', (route) => route.abort('failed'));
    await page.goto('/');
    await openUserMenu(page);
    await expect(
      page.getByRole('menu').getByText('No se pudo comprobar la sesión.'),
    ).toBeVisible();
    await expect(
      page.getByRole('menu').getByRole('menuitem', { name: 'Acceder' }),
    ).toHaveCount(0);
  });

  test('a logout failure is recoverable and does not sign the user out', async ({
    page,
  }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/auth/logout', (route) => route.abort('failed'));
    await page.route('**/users/me', (route) =>
      route.fulfill({
        status: 200,
        ...json({
          id: 1,
          authUserId: 'A',
          name: 'Ana',
          surname: 'García',
          address: 'Calle 1',
          phone: '600000000',
        }),
      }),
    );

    await page.goto('/settings');
    await expect(page.getByText('Ana García')).toBeVisible();

    // Click the workspace shell's logout button
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'No se pudo cerrar la sesión.',
    );
    await expect(
      page
        .locator('[data-slot="sidebar-menu"]')
        .getByRole('link', { name: 'Mi perfil' }),
    ).toBeVisible();
  });

  // Simulated contracts: this verifies the browser flow and that the session
  // cookie survives the return path, not a real backend authentication.
  test('oauth callback continues to /users with the session cookie preserved', async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: 'session-value',
        url: 'http://localhost:4300',
      },
    ]);
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({
        status: 200,
        ...json({
          id: 1,
          authUserId: 'A',
          name: 'Ana',
          surname: 'García',
          address: 'Calle 1',
          phone: '600000000',
        }),
      }),
    );

    await page.goto('/auth/oauth/callback');
    await expect(
      page.getByText('Sesión iniciada correctamente.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/es\/settings$/);
    await expect(page.getByText('Ana García')).toBeVisible();

    const cookies = await page.context().cookies();
    expect(
      cookies.some((cookie) => cookie.name === 'better-auth.session_token'),
    ).toBe(true);
  });
});

import { expect, test, type Page } from '@playwright/test';

function json(body: unknown) {
  return { contentType: 'application/json', body: JSON.stringify(body) };
}

async function routeAnonymous(page: Page) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({ status: 401, ...json({}) }),
  );
}

const profileA = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};

test.describe('Google sign-in action', () => {
  test('is offered on login and signup when the provider is configured', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await page.route('**/auth/public-config', (route) =>
      route.fulfill({
        status: 200,
        ...json({ supportEmail: null, allowedProviders: ['google'] }),
      }),
    );

    await page.goto('/login');
    await expect(
      page.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeVisible();

    await page.goto('/signup');
    await expect(
      page.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeVisible();
  });

  test('is hidden when the provider is not configured', async ({ page }) => {
    await routeAnonymous(page);
    await page.route('**/auth/public-config', (route) =>
      route.fulfill({
        status: 200,
        ...json({ supportEmail: null, allowedProviders: [] }),
      }),
    );

    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Acceder' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continuar con Google' }),
    ).toHaveCount(0);

    await page.goto('/signup');
    await expect(
      page.getByRole('button', { name: 'Crear cuenta' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Continuar con Google' }),
    ).toHaveCount(0);
  });
});

test.describe('OAuth callback continuation', () => {
  test('lands on the profile creation form for an identity without a profile', async ({
    page,
  }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 404, ...json({}) }),
    );
    await page.route('**/users/me/settings', (route) =>
      route.fulfill({ status: 401, ...json({}) }),
    );
    await page.route('**/auth/account', (route) =>
      route.fulfill({
        status: 200,
        ...json({
          email: 'a@example.com',
          name: 'Joan Pere Sila',
          hasPassword: false,
          passwordUpdatedAt: null,
        }),
      }),
    );

    await page.goto('/auth/oauth/callback');

    await expect(page).toHaveURL(/\/es\/settings/);
    await expect(
      page.getByRole('heading', { name: 'Crear perfil' }),
    ).toBeVisible();
    // The provider display name pre-fills the empty creation form.
    await expect(page.getByLabel('Nombre')).toHaveValue('Joan');
    await expect(page.getByLabel('Apellidos')).toHaveValue('Pere Sila');
  });

  test('continues to the dashboard for an identity with a profile', async ({
    page,
  }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );
    await page.route('**/users/me/settings', (route) =>
      route.fulfill({ status: 401, ...json({}) }),
    );

    await page.goto('/auth/oauth/callback');

    await expect(page).toHaveURL(/\/es\/dashboard$/);
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

const authenticatedSession = JSON.stringify({
  userId: 'user-1',
  status: 'authenticated',
});

test.beforeEach(async ({ page }) => {
  // Public pages render the shared header, which probes the session. Default to
  // an anonymous session; individual tests override this with their own routes.
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{}',
    }),
  );
});

test.describe('navigation', () => {
  test('root route shows the landing page', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'nx-monorepo-boilerplate' }),
    ).toBeVisible();
  });

  test('verification page continues to login', async ({ page }) => {
    await page.goto('/verified?verified=true');
    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('authentication entry points', () => {
  test('verification success is announced', async ({ page }) => {
    await page.goto('/verified?verified=true');
    await expect(
      page.getByText('Tu correo se ha verificado correctamente.'),
    ).toBeVisible();
  });

  test('verification failure shows the error value', async ({ page }) => {
    await page.goto('/verified?error=INVALID_TOKEN');
    await expect(
      page.getByText('No se pudo verificar el correo (INVALID_TOKEN).'),
    ).toBeVisible();
  });

  test('oauth callback success is announced', async ({ page }) => {
    await page.goto('/auth/oauth/callback');
    await expect(
      page.getByText('Sesión iniciada correctamente.'),
    ).toBeVisible();
  });

  test('oauth callback failure shows the error value', async ({ page }) => {
    await page.goto('/auth/oauth/callback?error=access_denied');
    await expect(
      page.getByText(
        'No se pudo completar el inicio de sesión (access_denied).',
      ),
    ).toBeVisible();
  });

  test('missing reset token is rejected without a form', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(
      page.getByText('Falta el token de restablecimiento.'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Restablecer contraseña' }),
    ).toBeHidden();
  });

  test('reset password form is shown with a token', async ({ page }) => {
    await page.goto('/reset-password?token=abc');
    await expect(
      page.getByRole('heading', { name: 'Restablecer contraseña' }),
    ).toBeVisible();
    await expect(page.getByLabel('Nueva contraseña')).toBeVisible();
  });

  test('failed password reset is surfaced inline', async ({ page }) => {
    await page.route('**/auth/reset-password/confirm', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await page.goto('/reset-password?token=abc');
    await page.getByLabel('Nueva contraseña').fill('password123');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(
      page.getByText('El enlace no es válido o ha caducado.'),
    ).toBeVisible();
  });
});

test.describe('profile session gating', () => {
  test('without a session the profile is withheld behind a login prompt', async ({
    page,
  }) => {
    await page.goto('/users');
    await expect(
      page.getByText(
        'Necesitas iniciar sesión con un correo verificado para ver o crear tu perfil.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  test('with a session but no profile the creation form is shown', async ({
    page,
  }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authenticatedSession,
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await page.goto('/users');
    await expect(
      page.getByRole('heading', { name: 'Crear perfil' }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Nombre')).toBeVisible();
  });
});

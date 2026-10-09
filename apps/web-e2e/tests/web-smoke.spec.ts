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

test.beforeEach(async ({ page }) => {
  await page.route('**/users/me/settings', (route) =>
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
});

test.describe('authentication entry points', () => {
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
    await page.getByLabel('Nueva contraseña').fill('N3w!Passphrase');
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
    await page.goto('/settings');
    await expect(
      page.getByText(
        'Necesitas iniciar sesión con un correo verificado para ver o crear tu perfil.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/es/login');
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
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: 'Crear perfil' }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Nombre')).toBeVisible();
    // `/settings` now renders inside the workspace shell, not the public header.
    await expect(page.locator('aside[data-slot="sidebar"]')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Cuenta de usuario' }),
    ).toHaveCount(0);
  });
});

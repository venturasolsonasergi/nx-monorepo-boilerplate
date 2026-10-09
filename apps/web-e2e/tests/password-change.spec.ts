import { expect, test, type Page } from '@playwright/test';

const profile = {
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

async function routeAuthenticatedSettings(page: Page) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      ...json({ userId: 'A', status: 'authenticated' }),
    }),
  );
  await page.route('**/users/me', (route) =>
    route.fulfill({ status: 200, ...json(profile) }),
  );
  await page.route('**/users/me/settings', (route) =>
    route.fulfill({ status: 401, ...json({}) }),
  );
}

test.describe('change-password flow', () => {
  test('stays signed in on this device and refreshes the summary', async ({
    page,
  }: {
    page: Page;
  }) => {
    let accountReads = 0;
    await routeAuthenticatedSettings(page);
    await page.route('**/auth/account', (route) => {
      accountReads += 1;
      return route.fulfill({
        status: 200,
        ...json({
          email: 'a@example.com',
          hasPassword: true,
          passwordUpdatedAt:
            accountReads > 1
              ? '2026-02-03T04:05:06.000Z'
              : '2026-01-02T03:04:05.000Z',
        }),
      });
    });
    let changeRequests = 0;
    await page.route('**/auth/password/change', (route) => {
      changeRequests += 1;
      return route.fulfill({ status: 200, ...json({ status: 'ok' }) });
    });

    await page.goto('/es/settings');

    await expect(
      page.getByRole('heading', { name: 'Seguridad de la cuenta' }),
    ).toBeVisible();
    await expect(page.getByText('a@example.com')).toBeVisible();
    await expect(page.getByText('Contraseña modificada')).toBeVisible();

    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/se cerrará la sesión en el resto de dispositivos/),
    ).toBeVisible();

    const submit = dialog.getByRole('button', { name: 'Cambiar contraseña' });
    await expect(submit).toBeDisabled();

    await dialog
      .getByRole('textbox', { name: 'Contraseña actual' })
      .fill('Current!Pass1');
    await dialog
      .getByRole('textbox', { name: 'Nueva contraseña' })
      .fill('N3w!Passphrase');
    await dialog.getByRole('checkbox').check();
    await expect(submit).toBeEnabled();
    await submit.click();

    // The caller stays signed in on /settings with a confirmation, and the
    // account summary is refreshed.
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/es\/settings$/);
    await expect(page.getByText('Contraseña actualizada.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeVisible();
    expect(changeRequests).toBe(1);
    await expect.poll(() => accountReads).toBeGreaterThan(1);
  });

  test('a recoverable failure keeps the dialog open without signing out', async ({
    page,
  }: {
    page: Page;
  }) => {
    await routeAuthenticatedSettings(page);
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
    await page.route('**/auth/password/change', (route) =>
      route.fulfill({ status: 503, ...json({}) }),
    );

    await page.goto('/es/settings');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('textbox', { name: 'Contraseña actual' })
      .fill('Current!Pass1');
    await dialog
      .getByRole('textbox', { name: 'Nueva contraseña' })
      .fill('N3w!Passphrase');
    await dialog.getByRole('checkbox').check();
    await dialog
      .getByRole('button', { name: 'Cambiar contraseña' })
      .last()
      .click();

    await expect(
      dialog.getByText('No se pudo cambiar la contraseña. Inténtalo de nuevo.'),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    // Still on the authenticated settings page: the caller was not signed out.
    await expect(page).toHaveURL(/\/es\/settings$/);
  });
});

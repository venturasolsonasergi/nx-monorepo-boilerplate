import { expect, test, type Page } from '@playwright/test';

const profile = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};

const updatedProfile = {
  ...profile,
  name: 'Anita',
  address: 'Calle 9',
};

const accountSummary = {
  email: 'a@example.com',
  hasPassword: true,
  passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
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
  await page.route('**/users/me/settings', (route) =>
    route.fulfill({ status: 401, ...json({}) }),
  );
  await page.route('**/auth/account', (route) =>
    route.fulfill({ status: 200, ...json(accountSummary) }),
  );
}

test.describe('profile editing', () => {
  test('edit -> save shows the updated values', async ({
    page,
  }: {
    page: Page;
  }) => {
    let patches = 0;
    await routeAuthenticatedSettings(page);
    await page.route('**/users/me', (route) => {
      if (route.request().method() === 'PATCH') {
        patches += 1;
        return route.fulfill({ status: 200, ...json(updatedProfile) });
      }
      return route.fulfill({ status: 200, ...json(profile) });
    });

    await page.goto('/es/settings');
    await expect(page.getByText('Ana', { exact: true })).toBeVisible();
    await expect(page.getByText('Calle 1', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Editar perfil' }).click();

    // The form opens pre-filled with the stored values.
    await expect(page.getByLabel('Nombre')).toHaveValue('Ana');
    await expect(page.getByLabel('Apellidos')).toHaveValue('García');
    await expect(page.getByLabel('Dirección')).toHaveValue('Calle 1');
    await expect(page.getByLabel('Teléfono')).toHaveValue('600000000');

    await page.getByLabel('Nombre').fill('Anita');
    await page.getByLabel('Dirección').fill('Calle 9');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    // The display returns showing the updated values in place of the form.
    await expect(page.getByText('Anita', { exact: true })).toBeVisible();
    await expect(page.getByText('Calle 9', { exact: true })).toBeVisible();
    expect(patches).toBe(1);
    await expect(
      page.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeHidden();
  });

  test('cancel keeps the stored values without a request', async ({
    page,
  }: {
    page: Page;
  }) => {
    let patches = 0;
    await routeAuthenticatedSettings(page);
    await page.route('**/users/me', (route) => {
      if (route.request().method() === 'PATCH') {
        patches += 1;
        return route.fulfill({ status: 200, ...json(updatedProfile) });
      }
      return route.fulfill({ status: 200, ...json(profile) });
    });

    await page.goto('/es/settings');
    await expect(page.getByText('Ana', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.getByLabel('Nombre').fill('Cambiado');
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // The read-only display shows the stored values and no request was made.
    await expect(page.getByText('Ana', { exact: true })).toBeVisible();
    await expect(page.getByText('Cambiado')).toBeHidden();
    expect(patches).toBe(0);
  });
});

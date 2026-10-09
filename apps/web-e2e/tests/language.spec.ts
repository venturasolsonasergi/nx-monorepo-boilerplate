import { expect, test, type Page } from '@playwright/test';

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

async function routeAuthenticated(page: Page) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      ...json({ userId: 'A', status: 'authenticated' }),
    }),
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
}

test.describe('language preference', () => {
  test('completing the profile persists the language before creating the profile', async ({
    page,
  }) => {
    const calls: string[] = [];
    await routeAuthenticated(page);
    await page.route('**/users/me/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        calls.push('settings');
        return route.fulfill({
          status: 200,
          ...json({ language: 'ca', theme: 'system' }),
        });
      }
      return route.fulfill({
        status: 200,
        ...json({ language: 'es', theme: 'system' }),
      });
    });
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 404, ...json({}) }),
    );
    await page.route('**/users', (route) => {
      if (route.request().method() === 'POST') {
        calls.push('profile');
        return route.fulfill({ status: 201, ...json(profileA) });
      }
      return route.continue();
    });

    await page.goto('/settings');
    await page.getByPlaceholder('Nombre').fill('Ana');
    await page.getByPlaceholder('Apellidos').fill('García');
    await page.getByPlaceholder('Dirección').fill('Calle 1');
    await page.getByPlaceholder('Teléfono').fill('600000000');
    await page.locator('#profile-language').selectOption('ca');
    await page.getByRole('button', { name: 'Crear perfil' }).click();

    await expect(page.getByRole('heading', { name: 'Idioma' })).toBeVisible();
    expect(calls).toEqual(['settings', 'profile']);
  });

  test('the signed-in language setting overrides the URL prefix', async ({
    page,
  }) => {
    await routeAuthenticated(page);
    await page.route('**/users/me/settings', (route) =>
      route.fulfill({
        status: 200,
        ...json({ language: 'en', theme: 'system' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/es/settings');
    await expect(page).toHaveURL(/\/en\/settings$/);
    await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  });

  test('the settings page presents a titled language preference with a description', async ({
    page,
  }) => {
    await routeAuthenticated(page);
    await page.route('**/users/me/settings', (route) =>
      route.fulfill({
        status: 200,
        ...json({ language: 'es', theme: 'system' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Idioma' })).toBeVisible();
    await expect(
      page.getByText(
        'Selecciona tu idioma preferido para navegar y las comunicaciones que recibas.',
      ),
    ).toBeVisible();
    // The workspace shell has no language switcher: only the settings one exists.
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveCount(1);
  });

  test('the language switcher persists a signed-in choice', async ({
    page,
  }) => {
    let patched: unknown = null;
    await routeAuthenticated(page);
    await page.route('**/users/me/settings', (route) => {
      if (route.request().method() === 'PATCH') {
        patched = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          ...json({ language: 'en', theme: 'system' }),
        });
      }
      return route.fulfill({
        status: 200,
        ...json({ language: 'es', theme: 'system' }),
      });
    });
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/settings');
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');

    await expect.poll(() => patched).toEqual({ language: 'en' });
  });
});

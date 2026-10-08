import { expect, test, type Page } from '@playwright/test';

// Simulated contracts: this suite mocks `/auth/*` and `/users/me` with
// `page.route`, so it exercises the browser flow without a database, email, or a
// live API.
const profileA = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};
const profileB = {
  id: 2,
  authUserId: 'B',
  name: 'Beto',
  surname: 'López',
  address: 'Calle 2',
  phone: '600000001',
};

function json(body: unknown) {
  return { contentType: 'application/json', body: JSON.stringify(body) };
}

async function routeAnonymous(page: Page) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({ status: 401, ...json({}) }),
  );
}

async function routeAuthenticated(page: Page, userId = 'A') {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      ...json({ userId, status: 'authenticated' }),
    }),
  );
}

async function loginAs(page: Page, email: string) {
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Acceder' }).click();
}

test.describe('dashboard gating', () => {
  test('a direct visit with a session shows the workspace', async ({
    page,
  }) => {
    await routeAuthenticated(page);
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();
    await expect(page.getByText('Calle 1')).toBeVisible();
  });

  test('a reload keeps the workspace and renders exactly one header', async ({
    page,
  }) => {
    await routeAuthenticated(page);
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();
    await expect(page.locator('header')).toHaveCount(1);
  });

  test('without a session it continues to /login preserving the destination', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard/);
  });

  test('a successful login continues to the dashboard', async ({ page }) => {
    let authenticated = false;
    await page.route('**/auth/refresh', (route) =>
      route.fulfill(
        authenticated
          ? { status: 200, ...json({ userId: 'A', status: 'authenticated' }) }
          : { status: 401, ...json({}) },
      ),
    );
    await page.route('**/auth/login', (route) => {
      authenticated = true;
      return route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      });
    });
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/login?returnTo=%2Fdashboard');
    await loginAs(page, 'a@example.com');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();
  });

  test('a missing profile continues to /users preserving the destination', async ({
    page,
  }) => {
    await routeAuthenticated(page);
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 404, ...json({}) }),
    );

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/users\?returnTo=%2Fdashboard/);
    await expect(
      page.getByRole('heading', { name: 'Crear perfil' }),
    ).toBeVisible();
  });

  test('a session that expires on the profile read continues to /login', async ({
    page,
  }) => {
    await routeAuthenticated(page);
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 401, ...json({}) }),
    );

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard/);
  });

  test('a later user does not inherit the previous profile', async ({
    page,
  }) => {
    let authenticated = false;
    let currentUser = 'A';
    await page.route('**/auth/refresh', (route) =>
      route.fulfill(
        authenticated
          ? {
              status: 200,
              ...json({ userId: currentUser, status: 'authenticated' }),
            }
          : { status: 401, ...json({}) },
      ),
    );
    await page.route('**/auth/login', (route) => {
      const email = (route.request().postDataJSON() as { email: string }).email;
      currentUser = email.startsWith('a') ? 'A' : 'B';
      authenticated = true;
      return route.fulfill({
        status: 200,
        ...json({ userId: currentUser, status: 'authenticated' }),
      });
    });
    await page.route('**/auth/logout', (route) => {
      authenticated = false;
      return route.fulfill({ status: 200, ...json({ status: 'ok' }) });
    });
    await page.route('**/users/me', (route) =>
      route.fulfill({
        status: 200,
        ...json(currentUser === 'A' ? profileA : profileB),
      }),
    );

    await page.goto('/login?returnTo=%2Fdashboard');
    await loginAs(page, 'a@example.com');
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'nx-monorepo-boilerplate' }),
    ).toBeVisible();

    await page.goto('/login?returnTo=%2Fdashboard');
    await loginAs(page, 'b@example.com');

    await expect(
      page.getByRole('heading', { name: 'Hola, Beto López' }),
    ).toBeVisible();
    await expect(page.getByText('Ana García')).toHaveCount(0);
  });

  test('logout failure is recoverable and stays signed in', async ({
    page,
  }) => {
    await routeAuthenticated(page);
    await page.route('**/auth/logout', (route) => route.abort('failed'));
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'No se pudo cerrar la sesión.',
    );
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();
  });
});

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

test.beforeEach(async ({ page }) => {
  await page.route('**/users/me/settings', (route) =>
    route.fulfill({ status: 401, ...json({}) }),
  );
});

async function loginAndRoute(page: Page) {
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
}

async function login(page: Page) {
  await page.getByLabel('Correo electrónico').fill('a@example.com');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Acceder' }).click();
}

test.describe('allow-listed returnTo on login', () => {
  test('an authorized value continues to the dashboard', async ({ page }) => {
    await loginAndRoute(page);
    await page.goto('/login?returnTo=%2Fdashboard');
    await login(page);
    await expect(page).toHaveURL(/\/es\/dashboard$/);
  });

  test('an external URL is discarded and continues to /users', async ({
    page,
  }) => {
    await loginAndRoute(page);
    await page.goto('/login?returnTo=https%3A%2F%2Fevil.example.com');
    await login(page);
    await expect(page).toHaveURL(/\/es\/dashboard$/);
  });

  test('a protocol-relative host is discarded and continues to /users', async ({
    page,
  }) => {
    await loginAndRoute(page);
    await page.goto('/login?returnTo=%2F%2Fevil.example.com');
    await login(page);
    await expect(page).toHaveURL(/\/es\/dashboard$/);
  });

  test('another internal route is discarded and continues to /users', async ({
    page,
  }) => {
    await loginAndRoute(page);
    await page.goto('/login?returnTo=%2Fsignup');
    await login(page);
    await expect(page).toHaveURL(/\/es\/dashboard$/);
  });
});

test.describe('allow-listed returnTo on /users', () => {
  test('an existing profile continues to the dashboard', async ({ page }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/settings?returnTo=%2Fdashboard');
    await expect(page).toHaveURL(/\/es\/dashboard$/);
  });

  test('an unauthorized value keeps the profile on /users', async ({
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

    await page.goto('/settings?returnTo=https%3A%2F%2Fevil.example.com');
    await expect(page).toHaveURL(/\/es\/settings/);
    await expect(page.getByText('Ana García')).toBeVisible();
  });
});

test('the preserved journey terminates with no redirect loop', async ({
  page,
}) => {
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

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/es\/login\?returnTo=%2Fdashboard/);
  await login(page);
  await expect(page).toHaveURL(/\/es\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: 'Hola, Ana García' }),
  ).toBeVisible();

  // The destination is consumed once; the page stays put.
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/es\/dashboard$/);
});

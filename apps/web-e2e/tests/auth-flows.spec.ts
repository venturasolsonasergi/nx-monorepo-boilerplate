import { expect, test, type Page } from '@playwright/test';

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

async function openUserMenu(page: Page) {
  if (
    await page
      .getByRole('menu')
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }
  await page.getByRole('button', { name: 'Cuenta de usuario' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
}

test.describe('landing and anonymous header', () => {
  test('landing shows the project and an anonymous header', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'nx-monorepo-boilerplate' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Acceder' })).toBeVisible();
  });
});

test.describe('login', () => {
  test('success continues to /users with the authenticated menu', async ({
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

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('a@example.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Acceder' }).click();

    await expect(page).toHaveURL(/\/users$/);
    await openUserMenu(page);
    await expect(
      page.getByRole('menuitem', { name: 'Mi perfil' }),
    ).toBeVisible();
  });

  test('invalid credentials are surfaced inline', async ({ page }) => {
    await routeAnonymous(page);
    await page.route('**/auth/login', (route) =>
      route.fulfill({ status: 401, ...json({}) }),
    );

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('a@example.com');
    await page.getByLabel('Contraseña').fill('wrong');
    await page.getByRole('button', { name: 'Acceder' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Correo o contraseña no válidos.',
    );
  });
});

test.describe('signup', () => {
  test('confirms the pending registration and keeps the header anonymous', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await page.route('**/auth/public-config', (route) =>
      route.fulfill({
        status: 200,
        ...json({ supportEmail: 'help@example.com' }),
      }),
    );
    await page.route('**/auth/signup', (route) =>
      route.fulfill({
        status: 201,
        ...json({
          status: 'pending-verification',
          expiresAt: '2030-01-03T00:00:00.000Z',
          emailStatus: 'accepted',
        }),
      }),
    );

    await page.goto('/signup');
    await page.getByLabel('Correo electrónico').fill('a@example.com');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(
      page.getByRole('heading', { name: 'Revisa tu correo' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /soporte/i })).toBeVisible();
    await openUserMenu(page);
    await expect(
      page.getByRole('menu').getByRole('menuitem', { name: 'Acceder' }),
    ).toBeVisible();
  });

  test('resend returns uniform acceptance without revealing account state', async ({
    page,
  }) => {
    await routeAnonymous(page);
    await page.route('**/auth/public-config', (route) =>
      route.fulfill({ status: 200, ...json({ supportEmail: null }) }),
    );
    await page.route('**/auth/signup', (route) =>
      route.fulfill({
        status: 201,
        ...json({
          status: 'pending-verification',
          expiresAt: '2030-01-03T00:00:00.000Z',
          emailStatus: 'accepted',
        }),
      }),
    );
    await page.route('**/auth/verification/resend', (route) =>
      route.fulfill({ status: 200, ...json({ status: 'accepted' }) }),
    );

    await page.goto('/signup');
    await page.getByLabel('Correo electrónico').fill('a@example.com');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.getByRole('button', { name: 'Reenviar enlace' }).click();

    await expect(
      page.getByRole('heading', { name: 'Revisa tu correo' }),
    ).toBeVisible();
    await expect(page.getByText(/No se pudo/)).toHaveCount(0);
  });
});

test.describe('complete signup', () => {
  test('activates and continues to /users to complete the profile', async ({
    page,
  }) => {
    let activated = false;
    await page.route('**/auth/public-config', (route) =>
      route.fulfill({ status: 200, ...json({ supportEmail: null }) }),
    );
    await page.route('**/auth/refresh', (route) =>
      route.fulfill(
        activated
          ? { status: 200, ...json({ userId: 'A', status: 'authenticated' }) }
          : { status: 401, ...json({}) },
      ),
    );
    await page.route('**/auth/signup/complete', (route) => {
      activated = true;
      return route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      });
    });
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 404, ...json({}) }),
    );

    await page.goto('/complete-signup?token=token-1');
    await page.getByLabel('Contraseña', { exact: true }).fill('password123');
    await page.getByRole('button', { name: 'Activar cuenta' }).click();

    await expect(page).toHaveURL(/\/users$/);
    await expect(
      page.getByRole('heading', { name: 'Crear perfil' }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/token=/);
  });

  test('an invalid token offers a restart', async ({ page }) => {
    await routeAnonymous(page);
    await page.route('**/auth/signup/complete', (route) =>
      route.fulfill({ status: 400, ...json({}) }),
    );

    await page.goto('/complete-signup?token=expired');
    await page.getByLabel('Contraseña', { exact: true }).fill('password123');
    await page.getByRole('button', { name: 'Activar cuenta' }).click();

    await expect(
      page.getByRole('link', { name: 'Iniciar registro de nuevo' }),
    ).toBeVisible();
  });
});

test.describe('password recovery request', () => {
  test('shows a uniform confirmation', async ({ page }) => {
    await routeAnonymous(page);
    await page.route('**/auth/reset-password/request', (route) =>
      route.fulfill({
        status: 200,
        ...json({ status: 'accepted', message: 'ok' }),
      }),
    );

    await page.goto('/forgot-password');
    await page.getByLabel('Correo electrónico').fill('a@example.com');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    await expect(
      page.getByText(
        'Si el correo corresponde a una cuenta, recibirás un enlace para restablecer tu contraseña.',
      ),
    ).toBeVisible();
  });
});

test.describe('/users profile states', () => {
  test('shows the existing profile when it exists', async ({ page }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/users');
    await expect(page.getByText('Ana')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Crear perfil' }),
    ).toBeHidden();
  });

  test('shows the creation form when no profile exists', async ({ page }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        ...json({ userId: 'A', status: 'authenticated' }),
      }),
    );
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 404, ...json({}) }),
    );

    await page.goto('/users');
    await expect(
      page.getByRole('heading', { name: 'Crear perfil' }),
    ).toBeVisible();
  });

  test('asks to sign in when there is no session', async ({ page }) => {
    await routeAnonymous(page);
    await page.goto('/users');
    await expect(
      page.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeVisible();
  });
});

test.describe('logout and user switch', () => {
  test('logout clears private data and returns to the anonymous menu', async ({
    page,
  }) => {
    let authenticated = true;
    await page.route('**/auth/refresh', (route) =>
      route.fulfill(
        authenticated
          ? { status: 200, ...json({ userId: 'A', status: 'authenticated' }) }
          : { status: 401, ...json({}) },
      ),
    );
    await page.route('**/auth/logout', (route) => {
      authenticated = false;
      return route.fulfill({ status: 200, ...json({ status: 'ok' }) });
    });
    await page.route('**/users/me', (route) =>
      route.fulfill({ status: 200, ...json(profileA) }),
    );

    await page.goto('/users');
    await expect(page.getByText('Ana')).toBeVisible();

    await openUserMenu(page);
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(
      page.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeVisible();

    await openUserMenu(page);
    await expect(
      page.getByRole('menu').getByRole('menuitem', { name: 'Acceder' }),
    ).toBeVisible();
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

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('a@example.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Acceder' }).click();
    await expect(page.getByText('Ana')).toBeVisible();

    await openUserMenu(page);
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(
      page.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('b@example.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Acceder' }).click();

    await expect(page.getByText('Beto')).toBeVisible();
    await expect(page.getByText('Ana')).toBeHidden();
  });
});

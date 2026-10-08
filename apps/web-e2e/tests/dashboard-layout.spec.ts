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

async function routeWorkspace(page: Page) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      ...json({ userId: 'A', status: 'authenticated' }),
    }),
  );
  await page.route('**/users/me', (route) =>
    route.fulfill({ status: 200, ...json(profileA) }),
  );
}

test.describe('dashboard shell layout', () => {
  test('the desktop sidebar is collapsible and its destinations stay reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeWorkspace(page);
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();

    const sidebar = page.locator('aside[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');

    await page.getByRole('button', { name: 'Alternar menú lateral' }).click();
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await expect(sidebar.getByText('Panel')).toBeHidden();

    await expect(sidebar.getByRole('link', { name: /Panel/ })).toBeVisible();
    await expect(
      sidebar.getByRole('list').getByRole('link', { name: 'Mi perfil' }),
    ).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Inicio/ })).toBeVisible();

    const noHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noHorizontalScroll).toBe(true);
  });

  test('the header and work area do not overlap on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeWorkspace(page);
    await page.goto('/dashboard');

    const header = await page.locator('header').boundingBox();
    const workArea = await page.locator('main').first().boundingBox();
    expect(header).not.toBeNull();
    expect(workArea).not.toBeNull();
    expect(workArea!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
  });

  test('/users renders inside the same workspace shell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeWorkspace(page);
    await page.goto('/settings');

    await expect(page.locator('aside[data-slot="sidebar"]')).toBeVisible();
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('header')).toContainText('Mi perfil');
    await expect(
      page.getByRole('button', { name: 'Cuenta de usuario' }),
    ).toHaveCount(0);
  });

  test('the mobile side menu is accessible and restores focus on Escape', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await routeWorkspace(page);
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeVisible();

    await expect(page.locator('aside[data-slot="sidebar"]')).toBeHidden();

    const trigger = page.getByRole('button', { name: 'Alternar menú lateral' });
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Menú de navegación' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('list').getByRole('link', { name: 'Mi perfil' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    const noHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noHorizontalScroll).toBe(true);
  });

  test('the sidebar toggle is keyboard operable on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await routeWorkspace(page);
    await page.goto('/dashboard');

    const sidebar = page.locator('aside[data-slot="sidebar"]');
    const trigger = page.getByRole('button', { name: 'Alternar menú lateral' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  });
});

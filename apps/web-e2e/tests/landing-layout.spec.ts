import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/users/me/settings', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{}',
    }),
  );
});

const SIZES = [
  { name: 'mobile', width: 375, height: 800 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const size of SIZES) {
  test(`landing and header reflow without overflow on ${size.name}`, async ({
    page,
  }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'nx-monorepo-boilerplate' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Arquitectura' }),
    ).toBeVisible();

    const noHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noHorizontalScroll).toBe(true);

    const header = await page.locator('header').boundingBox();
    const architecture = await page
      .getByRole('heading', { name: 'Arquitectura' })
      .boundingBox();
    expect(header).not.toBeNull();
    expect(architecture).not.toBeNull();
    // The architecture content starts below the header: they do not overlap.
    expect(architecture!.y).toBeGreaterThanOrEqual(
      header!.y + header!.height - 1,
    );
  });
}

test('the header user control can be opened on a narrow viewport', async ({
  page,
}) => {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{}',
    }),
  );
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Cuenta de usuario' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(
    page.getByRole('menu').getByRole('menuitem', { name: 'Acceder' }),
  ).toBeVisible();
});

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

test('session menu is keyboard operable and restores focus on Escape', async ({
  page,
}) => {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ userId: 'A', status: 'authenticated' }),
    }),
  );
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Cuenta de usuario' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const profileItem = page.getByRole('menuitem', { name: 'Mi perfil' });
  await expect(profileItem).toBeVisible();
  await expect(profileItem).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');

  await expect(profileItem).toBeHidden();
  await expect(trigger).toBeFocused();
});

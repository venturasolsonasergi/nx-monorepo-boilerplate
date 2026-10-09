import { expect, test } from '@playwright/test';

function json(body: unknown) {
  return { contentType: 'application/json', body: JSON.stringify(body) };
}

test.describe('password policy checklist', () => {
  test('unmet rules block submission and met rules enable it on /complete-signup', async ({
    page,
  }) => {
    let completions = 0;
    await page.route('**/auth/signup/complete', (route) => {
      completions += 1;
      return route.fulfill({ status: 400, ...json({}) });
    });

    await page.goto('/es/complete-signup?token=token-1');

    const submit = page.getByRole('button', { name: 'Activar cuenta' });
    const checklist = page.getByRole('list', {
      name: 'Requisitos de la contraseña',
    });
    const password = page.getByRole('textbox', {
      name: 'Contraseña',
      exact: true,
    });
    await expect(checklist).toBeVisible();
    await expect(submit).toBeDisabled();

    // A weak password leaves unmet rules and blocks submission.
    await password.fill('password123');
    await expect(checklist.locator('[data-met="false"]')).not.toHaveCount(0);
    await expect(submit).toBeDisabled();
    await submit.click({ force: true });
    expect(completions).toBe(0);

    // A policy-conforming password meets every rule and enables submission.
    await password.fill('Str0ng!Passphrase');
    await expect(checklist.locator('[data-met="true"]')).toHaveCount(6);
    await expect(submit).toBeEnabled();
  });

  test('unmet rules block submission and met rules enable it on /reset-password', async ({
    page,
  }) => {
    let confirmations = 0;
    await page.route('**/auth/reset-password/confirm', (route) => {
      confirmations += 1;
      return route.fulfill({ status: 200, ...json({ status: 'ok' }) });
    });

    await page.goto('/es/reset-password?token=token-1');

    const submit = page.getByRole('button', { name: 'Cambiar contraseña' });
    const checklist = page.getByRole('list', {
      name: 'Requisitos de la contraseña',
    });
    const password = page.getByRole('textbox', {
      name: 'Nueva contraseña',
      exact: true,
    });
    await expect(checklist).toBeVisible();

    await password.fill('weak');
    await expect(submit).toBeDisabled();
    await submit.click({ force: true });
    expect(confirmations).toBe(0);

    await password.fill('N3w!Passphrase');
    await expect(checklist.locator('[data-met="true"]')).toHaveCount(6);
    await expect(submit).toBeEnabled();

    await submit.click();
    expect(confirmations).toBe(1);
    await expect(
      page.getByText('Contraseña actualizada. Ya puedes iniciar sesión.'),
    ).toBeVisible();
  });
});

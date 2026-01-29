import { test, expect } from '@playwright/test';

test.use({
  storageState: 'e2e/.auth/staging.json',
  viewport: { width: 1280, height: 720 },
});

test('signed-in: can send a global message', async ({ page }) => {
  await page.goto('/');

  // Prove we’re not in guest mode.
  await expect(page.getByLabel('Sign in to chat', { exact: true })).toBeHidden({ timeout: 30_000 });

  // Composer exists only for signed-in users.
  const composer = page.getByPlaceholder(/type a message/i);
  await expect(composer).toBeVisible({ timeout: 30_000 });

  const msg = `e2e smoke ${Date.now()}`;
  await composer.fill(msg);

  await composer.press('Enter');

  await expect(page.getByText(msg)).toBeVisible({ timeout: 30_000 });
  await expect(composer).toBeVisible({ timeout: 30_000 });

  await page.reload();

  await expect(page.getByLabel('Sign in to chat', { exact: true })).toBeHidden({ timeout: 30_000 });
  await expect(page.getByPlaceholder(/type a message/i)).toBeVisible({ timeout: 30_000 });
});

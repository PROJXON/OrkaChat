import fs from 'node:fs';
import path from 'node:path';
import { chromium, type FullConfig, expect } from '@playwright/test';

const STORAGE_STATE_PATH = path.resolve(process.cwd(), 'e2e/.auth/staging.json');

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

async function dismissAboutIfPresent(page: import('@playwright/test').Page) {
  const dismissAbout = page.getByLabel('Dismiss about', { exact: true });
  const aboutVisible = await dismissAbout
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (aboutVisible) {
    await dismissAbout.click();
    await dismissAbout.waitFor({ state: 'hidden', timeout: 10_000 });
  }
}

export default async function globalSetup(_config: FullConfig) {
  // Allow running guest-only tests without requiring auth secrets.
  const email = getEnv('E2E_EMAIL');
  const password = getEnv('E2E_PASSWORD');
  const recoveryPassphrase = getEnv('E2E_RECOVERY_PASSPHRASE');
  if (!email || !password || !recoveryPassphrase) {
    // eslint-disable-next-line no-console
    console.log(
      '[globalSetup] Skipping auth storageState (missing E2E_EMAIL/E2E_PASSWORD/E2E_RECOVERY_PASSPHRASE).',
    );
    return;
  }

  // Reuse existing storageState locally to keep runs fast; CI should be fresh.
  if (!process.env.CI && fs.existsSync(STORAGE_STATE_PATH)) return;

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await page.goto('/');
  await dismissAboutIfPresent(page);

  await page.getByLabel('Sign in to chat', { exact: true }).click();

  await page.getByPlaceholder('Enter your Email').fill(email);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();

  const recoveryTitle = page.getByText('Enter Your Recovery Passphrase', { exact: true });
  const recoveryVisible = await recoveryTitle
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (recoveryVisible) {
    await page.getByPlaceholder('Enter Passphrase').fill(recoveryPassphrase);
    await page.getByText('Submit', { exact: true }).click();
    await recoveryTitle.waitFor({ state: 'hidden', timeout: 60_000 });
  }

  await expect(page.getByPlaceholder(/type a message/i)).toBeVisible({ timeout: 60_000 });

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

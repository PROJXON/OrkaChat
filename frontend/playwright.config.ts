import { defineConfig, devices } from '@playwright/test';

const slowMo = Number(process.env.E2E_SLOW_MO ?? 0);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: slowMo > 0 ? { slowMo } : undefined,
  },

  retries: process.env.CI ? 2 : 0,

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

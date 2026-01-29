import { defineConfig, devices } from '@playwright/test';

const slowMo = Number(process.env.E2E_SLOW_MO ?? 0);
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';

function shouldUseLocalWebServer(url: string) {
  // If the user points to a deployed URL (staging/prod), don't try to export+serve locally.
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    // If it's not a valid URL, fall back to the old behavior (no webServer).
    return false;
  }
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  globalSetup: './e2e/global-setup',

  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: slowMo > 0 ? { slowMo } : undefined,
  },

  retries: process.env.CI ? 2 : 0,

  webServer: shouldUseLocalWebServer(baseURL)
    ? {
        // Exports + serves a static web build (more stable than Metro).
        command: 'node scripts/e2e-webserver.mjs',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,

  projects: [
    {
      name: 'guest',
      testMatch: /.*\.guest\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'signedin',
      testMatch: /.*\.signedin\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/staging.json',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});

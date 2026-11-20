import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec turbo run build --filter=@sandi/jev-showcase... && env -u TYPESAFE_API_KEY JEV_MODE=mock PORT=4173 pnpm --filter @sandi/jev-showcase start',
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

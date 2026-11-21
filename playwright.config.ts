import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '4173';
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('PLAYWRIGHT_PORT must be a valid TCP port.');
const baseURL = `http://127.0.0.1:${port}`;

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
    command: `pnpm exec turbo run build --filter=@sandi/jev-showcase... && env -u TYPESAFE_API_KEY -u OLLAMA_BASE_URL -u OLLAMA_MODEL JEV_MODE=mock PORT=${port} pnpm --filter @sandi/jev-showcase start`,
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

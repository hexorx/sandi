import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ externalJevRequests: string[] }>({
  externalJevRequests: [async ({ page }, use) => {
    const requests: string[] = [];
    await page.route('https://api.typesafe.ai/**', async (route) => {
      requests.push(route.request().url());
      await route.abort();
    });
    await use(requests);
    expect(requests).toEqual([]);
  }, { auto: true }],
});

export { expect };

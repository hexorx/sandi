import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ externalJevRequests: string[] }>({
  externalJevRequests: [async ({ page }, use) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).hostname === 'api.typesafe.ai') requests.push(request.url());
    });
    await use(requests);
    expect(requests).toEqual([]);
  }, { auto: true }],
});

export { expect };

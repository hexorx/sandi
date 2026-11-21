import { expect, test } from './fixtures.js';

test.beforeEach(async ({ page, externalJevRequests }) => {
  await page.goto('/');
  await expect(page.getByLabel('Runtime mode')).toHaveText('MOCK');
  expect(externalJevRequests).toEqual([]);
});

test('shows the mock badge and navigates to the tool safety example', async ({ page }) => {
  await page.getByRole('link', { name: 'Tool safety' }).click();
  await expect(page).toHaveURL(/\/tool-safety$/);
  await expect(page.getByRole('heading', { name: 'Should this tool call run?' })).toBeVisible();
});

test('evaluates a dangerous tool call in mock mode', async ({ page }) => {
  await page.goto('/tool-safety');
  await page.getByTestId('tool-safety-select').selectOption('delete-tree');
  await page.getByTestId('tool-safety-evaluate').click();
  await expect(page.getByTestId('tool-safety-decision')).toHaveText(/^(BLOCK|REVIEW|ALLOW)$/);
  await expect(page.getByTestId('tool-safety-mode')).toHaveText('MOCK');
  await expect(page.getByTestId('tool-safety-reason')).not.toBeEmpty();
  await expect(page.getByTestId('tool-safety-probability-allow')).toContainText('%');
  await expect(page.getByTestId('tool-safety-probability-block')).toContainText('%');
});

test('routes a low confidence support ticket to a human', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('triage-button').click();
  await expect(page.getByTestId('triage-result')).toBeVisible();
  await expect(page.getByTestId('needs-human')).toContainText('Needs human review');
  await expect(page.getByText('human-review', { exact: true })).toBeVisible();
});

test('returns a moderation decision and keeps the mock badge visible', async ({ page }) => {
  await page.goto('/content-moderation');
  await expect(page.getByTestId('app__mode-badge')).toHaveText('MOCK');
  await page.getByTestId('content-moderation__run-button').click();
  await expect(page.getByTestId('content-moderation__decision-chip')).toBeVisible();
  await expect(page.getByTestId('content-moderation__review-band')).toBeVisible();
});

test('runs the Jev consulting agent without leaving mock mode', async ({ page }) => {
  await page.goto('/jev-agent');
  await expect(page.getByTestId('app__mode-badge')).toHaveText('MOCK');
  await page.getByTestId('jev-agent__run-button').click();
  await expect(page.getByTestId('jev-agent__timeline')).toBeVisible();
  await expect(page.getByTestId('jev-agent__trace-result')).toBeVisible();
});

test('blocks synthetic sensitive data before the mock agent receives it', async ({ page }) => {
  await page.goto('/pii-phi-guardrails');
  await expect(page.getByTestId('app__mode-badge')).toHaveText('MOCK');
  await page.getByTestId('pii-phi__run').click();
  await expect(page.getByTestId('pii-phi__result-jev')).toContainText('block');
  await expect(page.getByTestId('pii-phi__agent-blocked')).toContainText('received nothing');
});

test('updates the confidence playground decision as the slider changes', async ({ page }) => {
  await page.goto('/#confidence-playground');
  const confidence = page.getByTestId('threshold-confidence');
  await confidence.focus();
  await confidence.press('End');
  await expect(page.getByTestId('confidence-value')).toHaveText('100%');
  await expect(page.getByTestId('threshold-decision')).toContainText('allow');
});

test('runs the decision pipeline and shows receipts for every gate', async ({ page }) => {
  await page.goto('/decision-pipeline');
  await expect(page.getByRole('heading', { name: 'Decision pipeline' })).toBeVisible();
  await expect(page.getByLabel('Runtime mode')).toHaveText('MOCK');
  await page.getByTestId('run-decision-pipeline').click();

  await expect(page.getByTestId('decision-final-action')).toHaveText('approved-queue');
  const receipts = page.getByTestId('decision-receipt-log');
  await expect(receipts.locator('li')).toHaveCount(3);
  await expect(receipts).toContainText('safety');
  await expect(receipts).toContainText('quality');
  await expect(receipts).toContainText('routing');
  await expect(receipts).toContainText('Quality passed; routed to the approved queue.');
});

test('shows an actionable error when moderation cannot reach its endpoint', async ({ page }) => {
  await page.route('**/api/use-cases/content-moderation/run', (route) => route.abort());
  await page.goto('/content-moderation');
  await page.getByTestId('content-moderation__run-button').click();
  await expect(page.getByTestId('content-moderation__error')).toHaveText('Decision unavailable. Try again.');
});

test('switches and compares engines across every use case in mock mode', async ({ page, externalJevRequests }) => {
  const compare = async (path: string, run: () => Promise<void>) => {
    await page.goto(path);
    await expect(page.getByLabel('Decision engine')).toHaveCount(2);
    await page.getByLabel('Decision engine').last().check();
    const checkbox = page.getByLabel('Compare engines');
    if (await checkbox.count()) await checkbox.check();
    await run();
    const result = page.getByTestId('engine-compare-result').first();
    await expect(result).toContainText('decider');
    await expect(result).toContainText('jev');
  };

  await compare('/tool-safety', async () => { await page.getByTestId('tool-safety-evaluate').click(); });
  await compare('/', async () => { await page.getByTestId('triage-button').click(); });
  await compare('/content-moderation', async () => { await page.getByTestId('content-moderation__run-button').click(); });
  await compare('/decision-pipeline', async () => { await page.getByTestId('run-decision-pipeline').click(); });
  await compare('/jev-agent', async () => { await page.getByTestId('jev-agent__run-button').click(); });
  await compare('/', async () => { await page.getByTestId('threshold-engine-run').click(); });
  await compare('/pii-phi-guardrails', async () => { await page.getByTestId('pii-phi__run').click(); });
  expect(externalJevRequests).toEqual([]);
});

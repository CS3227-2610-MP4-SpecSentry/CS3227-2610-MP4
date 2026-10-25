import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('built client talks to the same-origin API and passes automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SpecSentry', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Service is online.');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

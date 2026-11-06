import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createPatchRiskFixture } from './fixtures/reviewer-patch-risk';

test('reviewer-accessibility keyboard labels status axe and narrow reflow', async ({ page }) => {
  const fixture = await createPatchRiskFixture('unavailable');
  try {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
    await page.goto('/reviewer');
    await page.getByLabel('Username').fill(fixture.prefix + '-reviewer');
    await page.getByLabel('Password').fill(fixture.password);
    await page.getByLabel('Password').press('Enter');
    const claim = page.getByRole('button', { name: 'Claim ' + fixture.prefix, exact: true });
    await claim.focus(); await expect(claim).toBeFocused(); await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: 'Patch Risk assistant' });
    await expect(panel.getByRole('checkbox')).toHaveCount(fixture.criteria.length);
    for (const [index, id] of fixture.criteria.entries()) {
      await expect(panel.getByRole('checkbox', { name: `AC-${index + 1} (${id})`, exact: true })).toBeVisible();
    }
    const checkbox = panel.getByRole('checkbox').first();
    await checkbox.focus(); await page.keyboard.press('Space'); await expect(checkbox).toBeChecked();
    const analyze = panel.getByRole('button', { name: 'Analyze selected criteria' });
    await page.keyboard.press('Tab'); await expect(panel.getByRole('checkbox').nth(1)).toBeFocused();
    await page.keyboard.press('Tab'); await expect(analyze).toBeFocused(); await page.keyboard.press('Enter');
    await expect(panel.getByRole('status')).toContainText('unavailable');
    const manual = page.getByRole('form', { name: 'Create finding', exact: true });
    await expect(manual.getByLabel('Description', { exact: true })).toBeEditable();
    await expect(manual.getByRole('button', { name: 'Create finding', exact: true })).toBeEnabled();
    const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    // A 320 CSS-pixel viewport covers reflow; CSS zoom separately exercises text/control enlargement.
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('html').evaluate(element => { element.style.zoom = '2'; });
    await expect(panel.getByRole('status')).toBeVisible();
    await expect(manual.getByLabel('Description', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await fixture.dispose(); }
});

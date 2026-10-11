import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations, signInWithDemoOtp } from './helpers';

// The policy desk sees aggregates over live + clearly-labelled synthetic applications.
const POLICY_DESK = '9000000040';

test('the policy desk sees labelled, privacy-safe aggregates', async ({ page }) => {
  await page.goto('/login?next=/insights');
  await signInWithDemoOtp(page, POLICY_DESK);
  await expect(page).toHaveURL(/^[^?]*\/insights/);

  await expect(page.getByTestId('synthetic-banner')).toContainText('synthetic');
  const tiles = page.getByTestId('insights-tiles');
  await expect(tiles).toContainText('Applications');
  await expect(tiles).toContainText('%'); // approval rate
  await expect(tiles).toContainText('days'); // time to sanction
  for (const id of ['district', 'scheme', 'status']) await expect(page.getByTestId(`insights-${id}`).locator('tbody tr').first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  // Gujarat only: every district row is a Gujarat district, and the Gujarat scheme shows up
  await page.locator('select[name="state"]').selectOption('GJ');
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(page).toHaveURL(/state=GJ/);
  await expect(page.getByTestId('insights-district')).toContainText('Gandhinagar');
  await expect(page.getByTestId('insights-district')).not.toContainText('Barmer');
  await expect(page.getByTestId('insights-scheme')).toContainText('Mahila Utkarsh');

  // live only: no synthetic banner
  await page.locator('select[name="source"]').selectOption('live');
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(page.getByTestId('synthetic-banner')).toHaveCount(0);
});

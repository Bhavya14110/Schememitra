import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations, installFakeSpeech, setLocale, signInWithDemoOtp, willSay } from './helpers';

// Persona 1 — Savitaben Rathwa, Dahod (fictional). Gujarati voice intake, spoken read-back,
// submit. Claims exercised: C6, C7, C17 (+ C1, C2, C3, C5, C9, C16, C18 on the way).
// Every turn goes through the mic. The browser's recogniser is replaced by a stand-in that
// "hears" the lines below (Playwright can't speak), so what lands in the form is exactly what
// she said - no demo script, no DEMO badge.
const SAID = [
  'મારું નામ સવિતાબેન રાઠવા છે, મારી ઉંમર ચોત્રીસ વર્ષ છે, હું દાહોદ જિલ્લામાં રહું છું.',
  'હું સ્ત્રી છું, અનુસૂચિત જાતિમાંથી છું, કોઈ વિકલાંગતા નથી.',
  'મારે બે દુધાળા પશુ લેવા છે, કુલ ખર્ચ સાઠ હજાર રૂપિયા, અને લોન પણ સાઠ હજાર જોઈએ.',
  'ઘરની વર્ષની આવક એક લાખ વીસ હજાર છે, હું ચાર ધોરણ સુધી ભણી છું.',
  'હું સખી મંડળની સભ્ય છું, અને મારી પાસે બીજી કોઈ લોન નથી.',
  'હા, બરાબર છે.',
];

test.use({ permissions: ['geolocation', 'microphone'] });

test('Savitaben applies by voice in Gujarati within 3 minutes', async ({ page }) => {
  const started = Date.now();
  await installFakeSpeech(page);
  await setLocale(page, 'gu');
  await page.goto('/');
  await page.locator('a[href="/apply/voice"]').first().click();

  await expect(page).toHaveURL(/\/apply\/voice/);
  await expect(page.getByTestId('voice-reply').first()).toContainText('નમસ્તે');
  await expect(page.getByTestId('voice-engine-note')).toBeVisible();
  await expect(page.getByTestId('demo-banner')).toHaveCount(0);
  await expect(page.getByTestId('voice-demo-chip')).toHaveCount(0);
  await expectNoSeriousA11yViolations(page);

  const mic = page.getByTestId('voice-mic');
  for (const [i, line] of SAID.entries()) {
    await expect(mic).toBeEnabled();
    await willSay(page, line);
    await mic.click();
    await expect(page.getByTestId('voice-user-line')).toHaveCount(i + 1);
    await expect(page.getByTestId('voice-user-line').nth(i)).toHaveText(line);
    if (i === 0) {
      await expect(page.getByTestId('voice-field-district_code')).toHaveAttribute('data-filled', 'true');
      await expect(page.getByTestId('voice-field-district_code')).toContainText('દાહોદ');
    }
  }
  expect(await page.evaluate(() => (window as unknown as { __speechLangs: string[] }).__speechLangs[0])).toBe('gu-IN');
  await expect(page.getByText(/^(SANDBOX|DEMO)/)).toHaveCount(0);
  await expect(page.getByTestId('voice-filled')).toContainText('13 માંથી 13');
  for (const field of ['full_name', 'age', 'gender', 'social_category', 'business_type', 'project_cost_paise', 'loan_needed_paise',
    'annual_family_income_paise', 'education_level', 'shg_member', 'existing_loans']) {
    await expect(page.getByTestId(`voice-field-${field}`)).toHaveAttribute('data-filled', 'true');
  }
  await expect(page.getByTestId('voice-field-loan_needed_paise')).toContainText('₹60,000');
  await expectNoSeriousA11yViolations(page);
  await page.getByTestId('voice-finish').click();

  // Rule Check → Money → Partner
  await expect(page).toHaveURL(/\/apply\/rules/);
  await expect(page.getByTestId('scheme-NSFDC_MICRO_CREDIT')).toBeVisible();
  await page.getByTestId('choose-NSFDC_MICRO_CREDIT').click();
  await expect(page).toHaveURL(/\/apply\/money/);
  await expect(page.getByTestId('funding-split')).toContainText('90%');
  await page.getByTestId('money-next').click();
  await expect(page).toHaveURL(/\/apply\/partner/);
  await page.getByTestId('partner-list').locator('[data-testid^="choose-partner-"]').first().click();
  await page.getByTestId('partner-next').click();

  // Send: sign in, documents, spoken read-back confirmed by voice, consent, submit.
  await expect(page).toHaveURL(/\/apply\/send/);
  await page.locator('a[href^="/login"]').first().click();
  await signInWithDemoOtp(page, '9000000001');
  await expect(page).toHaveURL(/\/apply\/send/);

  const docButtons = page.locator('[data-testid^="demo-doc-"]');
  await expect(docButtons.first()).toBeVisible();
  const docCount = await docButtons.count();
  for (let i = 0; i < docCount; i++) {
    await page.locator('[data-testid^="demo-doc-"]:not([disabled])').first().click();
    await page.waitForTimeout(400);
  }
  const readiness = page.getByTestId('readiness');
  await expect(readiness).toContainText('તમારી ફાઇલ મોકલવા માટે તૈયાર છે.', { timeout: 40_000 });

  const readback = page.getByTestId('readback');
  await expect(page.getByTestId('readback-text')).toContainText('સવિતાબેન રાઠવા');
  // she says "yes" to the read-back out loud; that transcript becomes the consent evidence
  await expect(page.getByTestId('readback-demo-chip')).toHaveCount(0);
  await willSay(page, 'હા, બરાબર છે.');
  await page.getByTestId('readback-mic').click();
  await expect(page.getByTestId('readback-reply')).toContainText('હા, બરાબર છે');
  await expect(readback.getByTestId('readback-confirm')).toHaveClass(/bg-success/);
  await page.getByTestId('consent-agree').check();
  await page.getByTestId('submit-application').click();

  await expect(page).toHaveURL(/\/apply\/done/);
  const tid = (await page.getByTestId('tracking-id').innerText()).trim();
  expect(tid).toMatch(/^SM-GJ-\d{2}-[0-9A-Z]{7}$/);
  expect(Date.now() - started).toBeLessThan(180_000);
});

test('with no recogniser available, the voice page says so and typing still fills the form', async ({ page }) => {
  // an old browser (or one without a speech service): no SpeechRecognition at all, and no
  // Bhashini key on the server. The app must not pretend to listen.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  await setLocale(page, 'gu');
  await page.goto('/apply/voice');
  await expect(page.getByTestId('voice-reply').first()).toContainText('નમસ્તે');
  await expect(page.getByTestId('voice-mic')).toBeDisabled();
  await expect(page.getByTestId('voice-unavailable')).toContainText('લખીને જવાબ આપો');

  await page.getByTestId('voice-typed').fill(SAID[0]!);
  await page.getByTestId('voice-typed').press('Enter');
  await expect(page.getByTestId('voice-user-line').first()).toHaveText(SAID[0]!);
  await expect(page.getByTestId('voice-field-district_code')).toContainText('દાહોદ');
  await expect(page.getByTestId('voice-field-age')).toHaveAttribute('data-filled', 'true');
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations, installFakeSpeech, setLocale, signInWithDemoOtp, willSay } from './helpers';

// Persona 5 — Jyoti Vaghela, Gandhinagar (fictional). This is the README demo script, end to end:
// Gujarati voice form → eligible schemes with reasons → documents and readiness → submit →
// a Gandhinagar bank sanctions with a PDF letter → she tracks it → the policy desk sees it.
// Voice goes through the browser-recogniser path, with Playwright standing in for her voice.

const JYOTI = '9000000006';
const GANDHINAGAR_BANK_OFFICER = '9000000024';
const POLICY_DESK = '9000000040';
const SAID = [
  'મારું નામ જ્યોતિ વાઘેલા છે, મારી ઉંમર ઓગણત્રીસ વર્ષ છે, હું ગાંધીનગર જિલ્લામાં રહું છું.',
  'હું સ્ત્રી છું, અન્ય પછાત વર્ગમાંથી છું, કોઈ વિકલાંગતા નથી.',
  'મારે સિલાઈનું કામ શરૂ કરવું છે, કુલ ખર્ચ નેવું હજાર રૂપિયા, અને લોન એંસી હજાર જોઈએ.',
  'ઘરની વર્ષની આવક દોઢ લાખ છે, હું દસ ધોરણ સુધી ભણી છું.',
  'હું સખી મંડળની સભ્ય નથી, અને મારી પાસે બીજી કોઈ લોન નથી.',
  'હા, બરાબર છે.',
];
const gu = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'packages', 'i18n', 'locales', 'gu.json'), 'utf8'));

test.use({ permissions: ['geolocation', 'microphone'] });

test('demo script: Jyoti in Gandhinagar, from speaking to a sanctioned loan', async ({ page, browser }) => {
  await installFakeSpeech(page);
  await setLocale(page, 'gu');
  await page.goto('/apply/voice');

  // 1. Voice form, in Gujarati
  const mic = page.getByTestId('voice-mic');
  for (const [i, line] of SAID.entries()) {
    await expect(mic).toBeEnabled();
    await willSay(page, line);
    await mic.click();
    await expect(page.getByTestId('voice-user-line')).toHaveCount(i + 1);
  }
  await expect(page.getByTestId('voice-field-district_code')).toContainText('ગાંધીનગર');
  await page.getByTestId('voice-finish').click();

  // 2. Eligible schemes, with the reasons spelled out
  await expect(page).toHaveURL(/\/apply\/rules/);
  const scheme = page.getByTestId('scheme-GJ_MAHILA_UTKARSH');
  await expect(scheme).toBeVisible();
  await expect(scheme).toContainText('મહિલા ઉત્કર્ષ');
  await expectNoSeriousA11yViolations(page);
  await page.getByTestId('choose-GJ_MAHILA_UTKARSH').click();
  await expect(page).toHaveURL(/\/apply\/money/);
  await expect(page.getByTestId('emi-value')).toContainText('₹'); // 0% interest: the EMI is the loan over 60 months
  await page.getByTestId('money-next').click();

  // a Gandhinagar bank that offers this scheme
  await expect(page).toHaveURL(/\/apply\/partner/);
  await page.getByTestId('partner-list').locator('li').filter({ hasText: 'Janseva' }).locator('[data-testid^="choose-partner-"]').first().click();
  await page.getByTestId('partner-next').click();

  // 3. Sign in, documents, readiness
  await expect(page).toHaveURL(/\/apply\/send/);
  await page.locator('a[href^="/login"]').first().click();
  await signInWithDemoOtp(page, JYOTI);
  await expect(page).toHaveURL(/^[^?]*\/apply\/send/);
  const docButtons = page.locator('[data-testid^="demo-doc-"]');
  await expect(docButtons.first()).toBeVisible();
  const docCount = await docButtons.count();
  for (let i = 0; i < docCount; i++) {
    await page.locator('[data-testid^="demo-doc-"]:not([disabled])').first().click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId('readiness')).toContainText(gu.docs.readiness_ok, { timeout: 40_000 });

  // 4. Spoken read-back, consent, submit
  await willSay(page, 'હા, બરાબર છે.');
  await page.getByTestId('readback-mic').click();
  await expect(page.getByTestId('readback-reply')).toContainText('હા, બરાબર છે');
  await page.getByTestId('consent-agree').check();
  await page.getByTestId('submit-application').click();
  await expect(page).toHaveURL(/\/apply\/done/);
  const trackingId = (await page.getByTestId('tracking-id').innerText()).trim();
  expect(trackingId).toMatch(/^SM-GJ-\d{2}-[0-9A-Z]{7}$/);

  // 5. The Gandhinagar bank reviews and sanctions; a PDF letter is issued
  const officerContext = await browser.newContext();
  const officer = await officerContext.newPage();
  await setLocale(officer, 'en');
  await officer.goto('/login');
  await signInWithDemoOtp(officer, GANDHINAGAR_BANK_OFFICER);
  await expect(officer).toHaveURL(/\/partner/);
  await officer.getByTestId(`queue-open-${trackingId}`).click();
  await expect(officer.getByTestId('review-integrity')).toContainText('Unchanged since submission');
  await officer.getByTestId('action-receive').click();
  await officer.getByTestId('decision-confirm').click();
  await officer.getByTestId('action-start_review').click();
  await officer.getByTestId('decision-confirm').click();
  await officer.getByTestId('action-approve').click();
  await officer.getByTestId('sanction-amount').fill('80000');
  await officer.getByTestId('decision-confirm').click();
  await expect(officer.getByTestId('decision-done')).toBeVisible();
  const applicationId = officer.url().split('/').pop()!;
  const letter = await officer.request.get(`/api/v1/applications/${applicationId}/sanction-letter.pdf`);
  expect(letter.status()).toBe(200);
  expect(letter.headers()['content-type']).toContain('application/pdf');

  // 6. She tracks it, in Gujarati
  await page.goto(`/track/${trackingId}`);
  await expect(page.getByTestId('track-status')).toHaveText(gu.track.status.sanctioned);

  // 7. The policy desk sees Gandhinagar on the dashboard
  const deskContext = await browser.newContext();
  const desk = await deskContext.newPage();
  await desk.goto('/login?next=/insights');
  await signInWithDemoOtp(desk, POLICY_DESK);
  await expect(desk).toHaveURL(/^[^?]*\/insights/); // signed in before we move on
  await desk.goto('/insights?state=GJ');
  await expect(desk.getByTestId('insights-district')).toContainText('Gandhinagar');
  await officerContext.close();
  await deskContext.close();
});

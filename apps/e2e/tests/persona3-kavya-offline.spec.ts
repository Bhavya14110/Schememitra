import { expect, test } from '@playwright/test';

import { answer, setLocale, signInWithDemoOtp } from './helpers';

// Persona 3 — Kavya Selvam, Madurai (fictional). Tamil, and the village has no data signal.
// Claims: C13 (offline + SMS), C14 (works on a dead 2G cell), C5.
// The offline half needs the service worker, which `next dev` deliberately does not register,
// so those steps run against a production build (`node scripts/make.mjs demo`).

const KAVYA = '9000000003';

test('Kavya fills the form with no signal and sends it by SMS', async ({ page, context }) => {
  const built = await page.request.get('/sw.js').then((r) => r.ok()).catch(() => false);
  test.skip(!built, 'needs the production build (service worker): run `node scripts/make.mjs demo`');

  await setLocale(page, 'ta');
  await page.goto('/');
  // Warm the shell and the offline rule bundle, the way a first visit at the CSC or a bus stop would.
  await page.goto('/apply');
  // Wait for the service worker to install and take control; until it does, a reload still
  // needs the network. A real first visit is the same: install, then it works offline.
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active), undefined, { timeout: 30_000 });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 30_000 });
  // The app stores the rule bundle (and the district list) in IndexedDB on load.
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('schememitra');
        open.onsuccess = () => {
          const database = open.result;
          if (!database.objectStoreNames.contains('kv')) return resolve(false);
          const row = database.transaction('kv').objectStore('kv').get('rules-bundle');
          row.onsuccess = () => resolve(Boolean(row.result));
          row.onerror = () => resolve(false);
        };
        open.onerror = () => resolve(false);
      }),
    undefined,
    { timeout: 30_000 },
  );

  // The signal drops.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('offline-status')).toContainText('இணையம் இல்லை');

  await answer(page, { text: 'Kavya Selvam' });
  await answer(page, { text: '19' });
  await answer(page, { choice: 'பெண்' });
  await answer(page, { choice: 'பிற்படுத்தப்பட்ட வகுப்பு (OBC)' });
  await answer(page, { choice: 'இல்லை' });
  await answer(page, { choice: 'தமிழ்நாடு' });
  await answer(page, { choice: 'Madurai' });  // district names come from the reference data, in English
  await answer(page, { text: '625001' });
  await answer(page, { text: '150000' });
  await answer(page, { choice: '12-ஆம் வகுப்பு' });
  await answer(page, { choice: 'கல்வி / படிப்புக் கட்டணம்' });
  await answer(page, { choice: 'ஆம்' });
  await answer(page, { text: '240000' });
  await answer(page, { text: '200000' });
  await answer(page, { choice: 'இல்லை' });
  await answer(page, { choice: 'இல்லை' });
  await answer(page, { text: KAVYA });

  // Eligibility was worked out on the phone from the cached rule bundle, and says so.
  await expect(page).toHaveURL(/\/apply\/rules/);
  await expect(page.getByTestId('scheme-NBCFDC_EDUCATION_LOAN')).toBeVisible();
  await expect(page.getByText(/தற்காலிகம்/).first()).toBeVisible();

  await page.getByTestId('choose-NBCFDC_EDUCATION_LOAN').click();
  await expect(page).toHaveURL(/\/apply\/money/);
  await expect(page.getByTestId('emi-value')).toContainText('₹'); // the maths runs on the phone too
  await page.getByTestId('money-next').click();

  // Picking a lender needs live data, so with no signal that step offers SMS straight away
  // (the server picks the nearest healthy lender when it decodes the message).
  await expect(page).toHaveURL(/\/apply\/partner/);
  await expect(page.getByTestId('partner-offline')).toBeVisible();
  await expect(page.getByTestId('sms-fallback')).toBeVisible();

  // The send screen, opened directly from the phone's cache, offers the same route.
  await page.goto('/apply/send', { timeout: 20_000 });
  const fallback = page.getByTestId('sms-fallback');
  await expect(fallback).toBeVisible();
  // the raw message sits inside a collapsed Help section, so read textContent, not innerText
  const wire = ((await page.getByTestId('sms-fallback-body').textContent()) ?? '').trim();
  expect(wire.startsWith('SM1*')).toBe(true);
  expect(wire).toContain('d=TN-MDU');
  expect(wire).toContain('l=200000');
  expect(wire.split('\n').length).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('sms-fallback-send')).toHaveAttribute('href', /^sms:/);

  // The answers live in IndexedDB, not in memory: a reload with no signal keeps them.
  await page.reload().catch(() => undefined);
  await expect(page.getByTestId('sms-fallback-body')).toContainText('l=200000');

  // Back on the network: she signs in, picks a lender, and the saved draft goes up exactly once.
  await context.setOffline(false);
  await page.goto('/login?next=/apply/partner');
  await signInWithDemoOtp(page, KAVYA);
  // (the login URL itself contains "next=/apply/partner", so anchor on the path)
  await expect(page).toHaveURL(/^[^?]*\/apply\/partner$/);
  await expect(page.getByTestId('partner-list')).toBeVisible();
  const mine = async () => {
    const res = await page.request.get('/api/v1/applications');
    const body = await res.json();
    expect(res.ok(), JSON.stringify(body)).toBe(true);
    return (body as { id: string }[]).map((a) => a.id);
  };
  const before = await mine();
  await page.getByTestId('partner-list').locator('[data-testid^="choose-partner-"]').first().click();
  await page.getByTestId('partner-next').click();
  await expect(page).toHaveURL(/\/apply\/send/);
  await expect(page.getByTestId('readiness')).toBeVisible(); // only renders once the draft is on the server
  const after = await mine();
  expect(after.length).toBe(before.length + 1);
  // nothing was retyped: the draft that reached the server is the one filled offline
  const saved = after.find((id) => !before.includes(id))!;
  const app = (await (await page.request.get(`/api/v1/applications/${saved}`)).json()) as { lang: string; scheme_code?: string };
  expect(app.lang).toBe('ta');

  // A reload, a flush of the outbox and a second save all hit the same client_uuid: no duplicate.
  await page.reload();
  await expect(page.getByTestId('readiness')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByTestId('offline-status')).toBeHidden({ timeout: 15_000 });
  expect((await mine()).length).toBe(after.length);
});

test('a mistyped tracking ID is caught before it reaches the database', async ({ request }) => {
  // People read these IDs off an SMS and type them back in, so the check character matters (C9).
  const wellFormedButUnknown = await request.get('/api/v1/track/SM-TN-26-K7Q2MX9');
  expect([404, 422]).toContain(wellFormedButUnknown.status());
  const typo = await request.get('/api/v1/track/SM-TN-26-K7Q2MX8');
  expect(typo.status()).toBe(422);
  const nonsense = await request.get('/api/v1/track/hello');
  expect(nonsense.status()).toBe(422);
});

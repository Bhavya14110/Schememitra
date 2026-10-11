import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

// Installable PWA: Chrome itself says there is nothing stopping "Add to home screen", and the
// pieces it looks at (manifest, icons, a controlling service worker) are really there.
// Needs the production build (`node scripts/make.mjs demo`); `next dev` has no service worker.

test('Chrome considers the app installable', async ({ request, baseURL }) => {
  const built = await request.get('/sw.js').then((r) => r.ok()).catch(() => false);
  test.skip(!built, 'needs the production build (service worker)');

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ short_name: 'SchemeMitra', start_url: '/', display: 'standalone' });
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find((i: { sizes: string; purpose?: string }) => i.sizes === size && !i.purpose);
    const png = await request.get(icon.src);
    expect(png.ok()).toBe(true);
    // PNG width/height live at bytes 16-23 of the IHDR chunk; check the file matches its label
    const body = await png.body();
    expect(`${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`).toBe(size);
  }
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

  // Playwright's usual contexts are incognito, where Chrome skips the install check entirely,
  // so use a throwaway real profile for this one.
  const profile = mkdtempSync(join(tmpdir(), 'sm-pwa-'));
  const context = await chromium.launchPersistentContext(profile, { channel: process.env.CI ? undefined : 'chrome', baseURL });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('/');
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active), undefined, { timeout: 30_000 });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 30_000 });

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
});

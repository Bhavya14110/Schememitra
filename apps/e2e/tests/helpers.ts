import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function setLocale(page: Page, locale: string) {
  await page.goto('/');
  await page.evaluate(async (l) => {
    await fetch('/api/locale', { method: 'POST', body: JSON.stringify({ locale: l }) });
    try {
      indexedDB.deleteDatabase('schememitra');
      localStorage.clear();
    } catch {
      /* fresh context */
    }
  }, locale);
}

/** Answers the current intake screen and presses Continue. */
export async function answer(page: Page, value: { choice?: string; text?: string; skip?: boolean }) {
  if (value.choice) await page.getByRole('radio', { name: value.choice, exact: true }).click();
  if (value.text !== undefined) {
    const input = page.locator('main input').first();
    await input.fill(value.text);
  }
  await page.getByTestId('intake-next').click();
}

/** Works in any UI language: the demo OTP is pre-filled in dev mode. */
export async function signInWithDemoOtp(page: Page, phone: string) {
  await expect(page).toHaveURL(/\/login/);
  const field = page.getByTestId('login-phone');
  if ((await field.inputValue()) !== phone) await field.fill(phone);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-otp')).toBeVisible();
  await expect(page.getByTestId('login-otp')).not.toHaveValue('');
  await page.getByTestId('login-submit').click();
}

export async function expectNoSeriousA11yViolations(page: Page, disable: string[] = []) {
  // Cards fade in; a colour sampled mid-animation is half-transparent and fails contrast
  // for a few hundred milliseconds. Let animations finish so we audit the settled page.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(disable).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} — ${n.failureSummary ?? ''}`).join(' | ')}`)).toEqual([]);
}

/**
 * Stands in for the browser's speech service. Playwright can't talk into a real recogniser, so
 * the test says what the person "said" and everything after that - the app's handling of the
 * transcript, the server, slots, read-back - runs for real. `lang` records what the app asked
 * the recogniser for, so we can check it picked gu-IN and not some default.
 */
export async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __heard: string[]; __speechLangs: string[]; SpeechRecognition: unknown; webkitSpeechRecognition: unknown };
    w.__heard = [];
    w.__speechLangs = [];
    class FakeRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      private timer = 0;
      start() {
        w.__speechLangs.push(this.lang);
        this.timer = window.setTimeout(() => this.finish(), 400);
      }
      stop() {
        window.clearTimeout(this.timer);
        this.finish();
      }
      abort() {
        window.clearTimeout(this.timer);
        this.onend?.();
      }
      private finish() {
        const text = w.__heard.shift();
        if (text) {
          const result = Object.assign([{ transcript: text, confidence: 0.92 }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [result] });
        } else {
          this.onerror?.({ error: 'no-speech' });
        }
        this.onend?.();
      }
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
}

/** Queue what the person will say on the next mic tap. */
export async function willSay(page: Page, text: string) {
  await page.evaluate((t) => (window as unknown as { __heard: string[] }).__heard.push(t), text);
}

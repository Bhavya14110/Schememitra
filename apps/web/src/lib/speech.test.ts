import { describe, expect, it } from 'vitest';

import { BROWSER_LANGS, pickRecogniser, type Abilities } from './speech';

const base: Abilities = { serverAsr: null, locale: 'gu', browserSpeech: true, mic: true, online: true };

describe('pickRecogniser', () => {
  it('prefers Bhashini when the server has a key', () => {
    expect(pickRecogniser({ ...base, serverAsr: 'bhashini' })).toBe('server');
  });

  it('uses the browser recogniser when there is no key', () => {
    expect(pickRecogniser(base)).toBe('browser');
  });

  it('only uses demo lines when the server says demo mode is on', () => {
    expect(pickRecogniser({ ...base, serverAsr: 'demo' })).toBe('server');
    expect(pickRecogniser({ ...base, serverAsr: null })).not.toBe('server');
  });

  it('keeps whisper as the backup, behind the browser', () => {
    expect(pickRecogniser({ ...base, serverAsr: 'whisper' })).toBe('browser');
    expect(pickRecogniser({ ...base, serverAsr: 'whisper', browserSpeech: false })).toBe('server');
  });

  it('falls back to typing when nothing can actually hear the person', () => {
    expect(pickRecogniser({ ...base, browserSpeech: false })).toBe('none'); // old browser, no key
    expect(pickRecogniser({ ...base, online: false, serverAsr: 'bhashini' })).toBe('none'); // offline
    expect(pickRecogniser({ ...base, locale: 'or' })).toBe('none'); // Odia isn't on our browser list
    expect(pickRecogniser({ ...base, serverAsr: 'bhashini', mic: false, browserSpeech: false })).toBe('none');
  });

  it('a Bhashini key with no mic API still lets the browser recogniser try', () => {
    expect(pickRecogniser({ ...base, serverAsr: 'bhashini', mic: false })).toBe('browser');
  });

  it('maps app languages to Indian-English style BCP-47 tags', () => {
    expect(BROWSER_LANGS.gu).toBe('gu-IN');
    expect(BROWSER_LANGS.hi).toBe('hi-IN');
    expect(BROWSER_LANGS.en).toBe('en-IN');
    expect(BROWSER_LANGS.as).toBeUndefined();
  });
});

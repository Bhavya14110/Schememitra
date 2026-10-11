'use client';

import type { LocaleCode } from '@sm/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRecorder } from './recorder';

/**
 * Who turns speech into text, in order: Bhashini on the server (when a key is set) → the
 * browser's own recogniser → typing. Scripted demo lines only ever come from the server, and
 * only when someone set DEMO_MODE=true on purpose.
 *
 * The rule we care about: if nobody can actually hear the person, say so and hand them the
 * keyboard. Never fill the form with a guess.
 */

export type ServerAsr = 'bhashini' | 'whisper' | 'demo' | null | undefined;
export type Recogniser = 'server' | 'browser' | 'none';

// Languages Chrome's recogniser (Google's speech service, also used by Android Chrome) lists
// for India. Odia, Assamese and Punjabi are left out on purpose: we couldn't confirm them, and
// a recogniser that half-works is worse than a clear "please type".
export const BROWSER_LANGS: Partial<Record<LocaleCode, string>> = {
  en: 'en-IN',
  hi: 'hi-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  ur: 'ur-IN',
};

export interface Abilities {
  serverAsr: ServerAsr;
  locale: LocaleCode;
  browserSpeech: boolean; // SpeechRecognition exists and hasn't failed this session
  mic: boolean; // getUserMedia + MediaRecorder, needed to send audio to the server
  online: boolean;
}

export function pickRecogniser({ serverAsr, locale, browserSpeech, mic, online }: Abilities): Recogniser {
  // every recogniser we have needs a network; offline the typed form is the honest answer
  if (!online) return 'none';
  // a real Bhashini key, or a deliberately switched-on demo, takes priority
  if ((serverAsr === 'bhashini' || serverAsr === 'demo') && mic) return 'server';
  if (browserSpeech && BROWSER_LANGS[locale]) return 'browser';
  // self-hosted whisper is slower than the browser, so it's the backup, not the first pick
  if (serverAsr === 'whisper' && mic) return 'server';
  return 'none';
}

/* Minimal typing for the Web Speech API; TypeScript's DOM lib doesn't ship it. */
interface SpeechAlt {
  transcript: string;
  confidence: number;
}
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<SpeechAlt> & { isFinal: boolean }>;
}
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecCtor = new () => SpeechRec;

function browserCtor(): SpeechRecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechState = 'idle' | 'listening' | 'blocked';
/** i18n key for the last problem, shown in the user's language. */
export type SpeechIssue = 'voice.not_heard' | 'voice.speech_failed' | 'voice.mic_blocked' | null;

export function useSpeechInput({
  locale,
  serverAsr,
  onText,
  onAudio,
}: {
  locale: LocaleCode;
  serverAsr: ServerAsr;
  onText: (text: string) => void;
  onAudio: (audio: Blob) => void;
}) {
  const [ready, setReady] = useState(false);
  const [browserOk, setBrowserOk] = useState(false);
  const [mic, setMic] = useState(false);
  const [online, setOnline] = useState(true);
  const [state, setState] = useState<SpeechState>('idle');
  const [interim, setInterim] = useState('');
  const [issue, setIssue] = useState<SpeechIssue>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const textRef = useRef(onText);
  textRef.current = onText;

  const recorder = useRecorder(onAudio);

  useEffect(() => {
    setBrowserOk(Boolean(browserCtor()));
    setMic(Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined');
    const update = () => setOnline(navigator.onLine);
    update();
    setReady(true);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      recRef.current?.abort();
    };
  }, []);

  const recogniser: Recogniser = ready ? pickRecogniser({ serverAsr, locale, browserSpeech: browserOk, mic, online }) : 'none';

  const startBrowser = useCallback(() => {
    const Ctor = browserCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = BROWSER_LANGS[locale] ?? 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    let failed = false;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) finalText += text;
        else live += text;
      }
      setInterim((finalText + ' ' + live).trim());
    };
    rec.onerror = (e) => {
      failed = true;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setState('blocked');
        setIssue('voice.mic_blocked');
      } else if (e.error === 'no-speech' || e.error === 'aborted') {
        setIssue('voice.not_heard');
      } else {
        // network, language-not-supported, audio-capture...: this recogniser won't work here,
        // so stop offering it for the rest of the visit and fall through to the next option
        setBrowserOk(false);
        setIssue('voice.speech_failed');
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setState((s) => (s === 'blocked' ? s : 'idle'));
      setInterim('');
      const text = finalText.trim();
      if (text) textRef.current(text);
      else if (!failed) setIssue('voice.not_heard');
    };
    recRef.current = rec;
    setIssue(null);
    setInterim('');
    setState('listening');
    try {
      rec.start();
    } catch {
      setState('idle');
      setBrowserOk(false);
      setIssue('voice.speech_failed');
    }
  }, [locale]);

  const start = useCallback(() => {
    setIssue(null);
    if (recogniser === 'browser') startBrowser();
    else if (recogniser === 'server') void recorder.start();
  }, [recogniser, recorder, startBrowser]);

  const stop = useCallback(() => {
    if (recRef.current) recRef.current.stop();
    else recorder.stop();
  }, [recorder]);

  const listening = state === 'listening' || recorder.state === 'listening';
  const blocked = state === 'blocked' || recorder.state === 'blocked';
  return {
    recogniser,
    listening,
    blocked,
    level: recorder.level,
    interim,
    issue: blocked ? 'voice.mic_blocked' : issue,
    start,
    stop,
  } as const;
}

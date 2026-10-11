'use client';

import type { components } from '@sm/contracts/client';
import type { LocaleCode } from '@sm/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Icon } from '@/components/icons';
import { Button, Card, cx, Notice, SandboxBadge } from '@/components/ui';
import { api, ApiError, unwrap } from '@/lib/api';
import { useSpeechInput } from '@/lib/speech';

import { ListenButton, stopSpeaking } from './shell';

type Readback = components['schemas']['ReadbackOut'];
type Reply = components['schemas']['ReadbackReplyOut'];

/**
 * Voice read-back before submit (claim C6): the summary is spoken in the applicant's language;
 * "haan, sahi hai" confirms and the transcript is kept as text-only consent evidence, naming a
 * field sends them back to change it. A plain Yes button always works too.
 */
export function ReadbackCard({
  applicationId,
  summary,
  confirmed,
  onConfirmed,
  onChange,
}: {
  applicationId: string | null;
  summary: string;
  confirmed: boolean;
  onConfirmed: (voiceEvidence: Record<string, unknown> | null) => void;
  onChange: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as LocaleCode;
  const [readback, setReadback] = useState<Readback | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    unwrap(api.POST('/v1/voice/readback', { body: { application_id: applicationId } }))
      .then(setReadback)
      .catch(() => setReadback(null));
  }, [applicationId, summary]);

  async function answer(input: { text?: string; audio?: Blob; source?: 'typed' | 'browser' }) {
    if (!applicationId) return;
    stopSpeaking();
    setBusy(true);
    setError(null);
    const form = new FormData();
    if (input.text) {
      form.set('text', input.text);
      form.set('source', input.source ?? 'typed');
    }
    if (input.audio) form.set('audio', input.audio, 'readback.webm');
    try {
      const res = await fetch(`/api/v1/voice/readback/${applicationId}/reply`, { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new ApiError(json);
      const out = json as Reply;
      setReply(out);
      if (out.intent === 'confirm') onConfirmed(out.evidence ?? {});
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.user_message_key : 'errors.network');
    } finally {
      setBusy(false);
    }
  }

  const speech = useSpeechInput({
    locale,
    serverAsr: readback?.server_asr,
    onText: (heard) => void answer({ text: heard, source: 'browser' }),
    onAudio: (audio) => void answer({ audio }),
  });
  const listening = speech.listening;
  const text = readback?.text ?? summary;
  // no recogniser (offline, old browser, unsupported language): the Yes button still works
  const canUseVoice = Boolean(applicationId) && speech.recogniser !== 'none';

  return (
    <Card className="flex flex-col gap-3" data-testid="readback">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">{t('send.readback_title')}</h2>
        <ListenButton text={text} audioUrl={readback?.audio_url} />
      </div>
      <p className="text-lg leading-relaxed" data-testid="readback-text" lang={locale}>
        {text}
      </p>
      <p className="text-sm text-muted">{applicationId ? t('voice.readback_say') : t('send.readback_hint')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={confirmed ? 'success' : 'secondary'}
          icon="check"
          onClick={() => onConfirmed(null)}
          data-testid="readback-confirm"
          disabled={busy}
        >
          {confirmed ? t('send.readback_confirmed') : t('common.yes')}
        </Button>
        {canUseVoice && !confirmed ? (
          <Button
            variant={listening ? 'danger' : 'primary'}
            icon={listening ? 'stop' : 'mic'}
            loading={busy}
            onClick={() => (listening ? speech.stop() : speech.start())}
            aria-pressed={listening}
            data-testid="readback-mic"
          >
            {listening ? t('voice.listening') : t('common.speak')}
          </Button>
        ) : null}
        <Button variant="ghost" icon="chevronLeft" onClick={onChange}>
          {t('common.edit')}
        </Button>
      </div>

      {readback?.demo_reply && !confirmed ? (
        <button
          type="button"
          onClick={() => answer({ text: readback.demo_reply! })}
          disabled={busy}
          className="sm-tap flex items-center gap-2 self-start rounded-xl border border-dashed border-brand/40 px-3 py-2 text-start hover:bg-brand-tint"
          data-testid="readback-demo-chip"
        >
          <SandboxBadge label="DEMO" /> “{readback.demo_reply}”
        </button>
      ) : null}

      {reply ? (
        <p
          className={cx('flex items-start gap-2 text-sm font-semibold', reply.intent === 'confirm' ? 'text-success-ink' : 'text-warning-ink')}
          role="status"
          data-testid="readback-reply"
        >
          <Icon name={reply.intent === 'confirm' ? 'check' : 'alert'} size={16} className="mt-0.5 shrink-0" />
          <span>
            {reply.reply_text} {reply.demo ? <SandboxBadge label="DEMO" /> : null}
          </span>
        </p>
      ) : null}
      {listening && speech.interim ? <p className="text-sm text-muted" data-testid="readback-interim">{speech.interim}…</p> : null}
      {speech.issue ? <Notice tone="warning" icon="alert">{t(speech.issue)}</Notice> : null}
      {error ? <Notice tone="warning" icon="alert">{t(error as never)}</Notice> : null}
    </Card>
  );
}

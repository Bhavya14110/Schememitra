'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CitizenHeader } from '@/components/citizen-header';
import { Icon } from '@/components/icons';
import { ButtonLink, Card, Notice, Skeleton } from '@/components/ui';
import { api, unwrap } from '@/lib/api';
import { DIGILOCKER_PENDING, readPending } from '@/lib/digilocker';
import { useDraft } from '@/stores/draft';

/**
 * Where DigiLocker sends the person back after they approve (or refuse) sharing a document.
 * We check the `state` matches what we stored before leaving, swap the one-time code for a
 * consent token, pull the document onto the application, and go back to where they were.
 */
export default function DigiLockerCallback() {
  const t = useTranslations();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [back, setBack] = useState('/apply/send');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // strict mode runs effects twice; the code is single-use
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const pending = readPending();
    sessionStorage.removeItem(DIGILOCKER_PENDING);
    if (pending) setBack(pending.back);
    // no code (they said no), no pending request, or a state we didn't issue: attach nothing
    if (!code || !pending || params.get('state') !== pending.state) {
      setFailed(true);
      return;
    }
    (async () => {
      const { consent_token } = (await unwrap(api.POST('/v1/documents/digilocker/consent', { body: { code } }))) as { consent_token: string };
      const doc = await unwrap(
        api.POST('/v1/documents/digilocker/pull', {
          body: { application_id: pending.applicationId, doc_type: pending.docType, consent_token },
        }),
      );
      useDraft.getState().setDocument(pending.docType, { documentId: doc.document_id, status: doc.status as never, confidence: doc.confidence, issues: doc.issues });
      router.replace(pending.back);
    })().catch(() => setFailed(true));
  }, [router]);

  return (
    <>
      <CitizenHeader />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <Card className="flex flex-col gap-3" data-testid="digilocker-callback">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Icon name="shield" size={26} className="text-success-ink" /> DigiLocker
          </h1>
          {failed ? (
            <>
              <Notice tone="warning" icon="alert">{t('docs.digilocker_failed')}</Notice>
              <ButtonLink href={back} size="lg" icon="chevronLeft">
                {t('common.back')}
              </ButtonLink>
            </>
          ) : (
            <>
              <p role="status">{t('docs.digilocker_returning')}</p>
              <Skeleton className="h-16" />
            </>
          )}
        </Card>
      </main>
    </>
  );
}

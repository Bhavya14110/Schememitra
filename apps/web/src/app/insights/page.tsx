import { getLocale, getTranslations } from 'next-intl/server';

import { OfficerShell } from '@/components/officer-shell';
import { Card, Notice, SandboxBadge } from '@/components/ui';
import { gatewayFetch, requireRole } from '@/lib/session';

export const metadata = { title: 'Policy insights' };

interface Cell {
  key: string;
  label: string | Record<string, string>;
  count: number | null;
  suppressed: boolean;
}
interface Insights {
  k_min: number;
  total: number | null;
  synthetic_count: number;
  live_count: number;
  includes_synthetic: boolean;
  by_district: Cell[];
  by_scheme: Cell[];
  by_status: Cell[];
  approval_rate_bps: number | null;
  decided_count: number | null;
  median_days_to_sanction: number | null;
  p75_days_to_sanction: number | null;
}

const fmt = new Intl.NumberFormat('en-IN');

/**
 * One screen for the policy desk: where applications come from, which schemes, where they are
 * stuck, how many get sanctioned and how fast. Aggregates only; the API already hides any cell
 * under k records, and this page never tries to guess what's behind a hidden one.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string; source?: string }> }) {
  const user = await requireRole('policy_viewer', 'admin');
  const t = await getTranslations('officer');
  const locale = await getLocale();
  const { state = '', source = 'all' } = await searchParams;
  const params = new URLSearchParams({ source, ...(state ? { state } : {}) });
  const res = await gatewayFetch(`/v1/insights/summary?${params}`);
  const data: Insights | null = res.ok ? await res.json() : null;
  const label = (c: Cell) => (typeof c.label === 'string' ? c.label : (c.label[locale] ?? c.label.en ?? c.key));

  return (
    <OfficerShell user={user} title={t('nav.insights')}>
      {/* filters live in one row above everything they control */}
      <form className="flex flex-wrap items-end gap-3" method="get" data-testid="insights-filters">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('insights.state')}
          <select name="state" defaultValue={state} className="sm-tap rounded-md border border-border-strong bg-surface px-2">
            <option value="">{t('insights.all_states')}</option>
            <option value="GJ">Gujarat</option>
            <option value="RJ">Rajasthan</option>
            <option value="UP">Uttar Pradesh</option>
            <option value="MH">Maharashtra</option>
            <option value="TN">Tamil Nadu</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('insights.source')}
          <select name="source" defaultValue={source} className="sm-tap rounded-md border border-border-strong bg-surface px-2">
            <option value="all">{t('insights.source_all')}</option>
            <option value="live">{t('insights.source_live')}</option>
            <option value="synthetic">{t('insights.source_synthetic')}</option>
          </select>
        </label>
        <button type="submit" className="sm-tap rounded-md bg-brand px-4 font-semibold text-on-brand">{t('insights.apply')}</button>
      </form>

      {!data ? (
        <Notice tone="danger">{t('insights.unavailable')}</Notice>
      ) : (
        <>
          {data.includes_synthetic ? (
            <Notice tone="warning" icon="info" data-testid="synthetic-banner">
              <span className="flex flex-wrap items-center gap-2">
                <SandboxBadge label="SYNTHETIC" />
                {t('insights.synthetic_note', { synthetic: fmt.format(data.synthetic_count), live: fmt.format(data.live_count) })}
              </span>
            </Notice>
          ) : null}
          <p className="text-sm text-muted">{t('insights.privacy_note', { k: data.k_min })}</p>

          <div className="grid gap-3 sm:grid-cols-3" data-testid="insights-tiles">
            <Tile label={t('insights.applications')} value={data.total == null ? null : fmt.format(data.total)} hidden={t('insights.hidden', { k: data.k_min })} />
            <Tile
              label={t('insights.approval_rate')}
              value={data.approval_rate_bps == null ? null : `${(data.approval_rate_bps / 100).toFixed(1)}%`}
              sub={data.decided_count == null ? undefined : t('insights.of_decided', { n: fmt.format(data.decided_count) })}
              hidden={t('insights.hidden', { k: data.k_min })}
            />
            <Tile
              label={t('insights.days_to_sanction')}
              value={data.median_days_to_sanction == null ? null : t('insights.days', { n: data.median_days_to_sanction })}
              sub={data.p75_days_to_sanction == null ? undefined : t('insights.p75', { n: data.p75_days_to_sanction })}
              hidden={t('insights.hidden', { k: data.k_min })}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Bars id="district" title={t('insights.by_district')} cells={data.by_district} label={label} limit={state ? undefined : 15} t={t} k={data.k_min} />
            <Bars id="scheme" title={t('insights.by_scheme')} cells={data.by_scheme} label={label} t={t} k={data.k_min} />
            <Bars id="status" title={t('insights.by_status')} cells={data.by_status} label={(c) => t(`insights.status.${c.key}` as never)} t={t} k={data.k_min} />
          </div>
        </>
      )}
    </OfficerShell>
  );
}

function Tile({ label, value, sub, hidden }: { label: string; value: string | null; sub?: string; hidden: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-bold tabular">{value ?? '—'}</p>
      <p className="text-xs text-muted">{value == null ? hidden : sub}</p>
    </Card>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<'officer'>>>;

/** Single-series horizontal bars as a real table: every number is printed, so the chart reads
 * fine for screen readers, in print and without colour. */
function Bars({ id, title, cells, label, limit, t, k }: { id: string; title: string; cells: Cell[]; label: (c: Cell) => string; limit?: number; t: T; k: number }) {
  const shown = limit ? cells.slice(0, limit) : cells;
  const max = Math.max(1, ...cells.map((c) => c.count ?? 0));
  const more = cells.length - shown.length;
  return (
    <Card className="flex flex-col gap-3" data-testid={`insights-${id}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      <table className="w-full border-separate border-spacing-y-1 text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">{title}</th>
            <th scope="col">{t('insights.applications')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => (
            <tr key={c.key} title={c.suppressed ? t('insights.hidden', { k }) : `${label(c)}: ${fmt.format(c.count!)}`}>
              <th scope="row" className="w-2/5 pe-3 text-start font-normal">{label(c)}</th>
              <td className="pe-2">
                <div className="h-3 rounded-e bg-border/40">
                  {c.count != null ? (
                    <div className="h-3 rounded-e bg-brand" style={{ width: `${Math.max(2, (100 * c.count) / max)}%` }} />
                  ) : null}
                </div>
              </td>
              <td className="w-20 text-end tabular text-muted">{c.count != null ? fmt.format(c.count) : `<${k}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 ? <p className="text-xs text-muted">{t('insights.more', { n: more })}</p> : null}
    </Card>
  );
}

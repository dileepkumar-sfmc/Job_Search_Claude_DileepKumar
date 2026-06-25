import type { Job } from '../../types';

interface Props {
  jobs: Job[];
}

/**
 * A thin pipeline-health strip under the nav: at-a-glance counts plus a response
 * rate (share of applied-or-beyond jobs that advanced to interview/offer).
 */
export function PipelineStats({ jobs }: Props) {
  const by = (c: Job['column']) => jobs.filter((j) => j.column === c).length;
  const applied = by('applied');
  const interview = by('interview');
  const offer = by('offer');
  const rejected = by('rejected');

  const active = applied + interview; // in-flight
  const decided = applied + interview + offer + rejected; // everything past wishlist
  const responseRate = decided > 0 ? Math.round(((interview + offer) / decided) * 100) : null;

  const items: { label: string; value: string; color?: string }[] = [
    { label: 'Total', value: String(jobs.length) },
    { label: 'Active', value: String(active) },
    { label: 'Interviews', value: String(interview), color: 'var(--status-interview)' },
    { label: 'Offers', value: String(offer), color: 'var(--status-offer)' },
  ];

  return (
    <div className="shrink-0 flex items-center gap-1 px-5 h-11 border-b border-hairline overflow-x-auto">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-1.5 px-3 py-1 shrink-0">
          {it.color && (
            <span className="w-1.5 h-1.5 rounded-full mr-0.5 self-center" style={{ backgroundColor: it.color }} />
          )}
          <span className="text-[14px] font-semibold text-ink tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            {it.value}
          </span>
          <span className="text-[11px] text-ink-subtle">{it.label}</span>
        </div>
      ))}

      {responseRate !== null && (
        <>
          <span className="w-px h-4 bg-hairline mx-1.5 shrink-0" />
          <div className="flex items-baseline gap-1.5 px-3 py-1 shrink-0" title="Share of applied-or-later jobs that advanced to an interview or offer">
            <span className="text-[14px] font-semibold text-ink tabular-nums" style={{ letterSpacing: '-0.02em' }}>
              {responseRate}%
            </span>
            <span className="text-[11px] text-ink-subtle">response rate</span>
          </div>
        </>
      )}
    </div>
  );
}

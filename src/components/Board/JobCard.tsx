import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Job } from '../../types';
import { useJobsStore } from '../../store/jobs';
import { COLUMNS } from '../../lib/columns';

interface Props {
  job: Job;
  accent: string;
  index: number;
  onClick: () => void;
}

export function JobCard({ job, accent, index, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
  });
  const moveJob = useJobsStore((s) => s.moveJob);
  // Right-click "move to" menu — viewport coords, or null when closed.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Close the menu on any outside interaction or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    animationDelay: `${120 + index * 45}ms`,
  };

  // Days the card has sat in its current stage (falls back to creation date).
  const stageDays = Math.floor(
    (Date.now() - new Date(job.stageChangedAt ?? job.createdAt).getTime()) / 86_400_000
  );
  const stageLabel = stageDays <= 0 ? 'today' : `${stageDays}d in stage`;
  // Flag in-flight cards that have gone quiet — actionable staleness signal.
  const stale = stageDays >= 14 && (job.column === 'applied' || job.column === 'interview');

  // Which AI documents have been generated (for the count badge + tooltip).
  const DOC_LABELS: Record<string, string> = {
    coverLetter: 'Cover Letter',
    tailoredResume: 'Resume',
    interviewQuestions: 'Interview Prep',
    companyBrief: 'Company Brief',
    outreachEmail: 'Recruiter Email',
  };
  const docNames = job.generated
    ? Object.entries(job.generated)
        .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
        .map(([k]) => DOC_LABELS[k] ?? k)
    : [];

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    // Clamp so the ~190px-wide menu never spills off the right/bottom edge.
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 240);
    setMenu({ x, y });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onContextMenu={openMenu}
      className="group relative bg-surface-1 border border-hairline rounded-lg edge-top
                 hover:border-hairline-strong hover:bg-surface-2 hover:-translate-y-px
                 transition-all duration-150 select-none animate-fade-up overflow-hidden"
    >
      {/* Accent left bar */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] opacity-70 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: accent }}
      />

      {/* Drag handle — only this triggers dnd */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-[3px] top-0 bottom-0 w-5 flex items-center justify-center
                   cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100
                   transition-opacity hover:bg-surface-3/60"
        title="Drag to move"
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" className="text-ink-tertiary">
          <circle cx="2" cy="2" r="1" /><circle cx="6" cy="2" r="1" />
          <circle cx="2" cy="7" r="1" /><circle cx="6" cy="7" r="1" />
          <circle cx="2" cy="12" r="1" /><circle cx="6" cy="12" r="1" />
        </svg>
      </div>

      {/* Clickable content area */}
      <div onClick={onClick} className="pl-6 pr-3.5 py-3.5 cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="text-[13px] font-medium text-ink leading-snug truncate"
              style={{ letterSpacing: '-0.01em' }}
            >
              {job.title || 'Untitled Role'}
            </p>
            <p className="text-[12px] text-ink-muted mt-0.5 truncate">
              {job.company || 'Unknown Company'}
            </p>
          </div>
          {docNames.length > 0 && (
            <span
              className="shrink-0 text-[10px] h-5 px-1.5 flex items-center gap-0.5 rounded-md
                         bg-primary/15 text-primary-hover font-medium tabular-nums"
              title={`Generated: ${docNames.join(', ')}`}
            >
              ✦ {docNames.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2.5 text-[11px] text-ink-tertiary">
          {job.location && (
            <>
              <span className="truncate max-w-[120px]">{job.location}</span>
              <span className="w-1 h-1 rounded-full bg-ink-tertiary/50 shrink-0" />
            </>
          )}
          <span
            className={`tabular-nums shrink-0 ${stale ? 'text-status-interview font-medium' : ''}`}
            title={stale ? 'No movement in 2+ weeks' : undefined}
          >
            {stale && '⚠ '}{stageLabel}
          </span>
        </div>
      </div>

      {/* Right-click "Move to" menu (portaled to escape the card's overflow-hidden) */}
      {menu &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
            <div
              className="fixed z-[61] w-[190px] bg-surface-2 border border-hairline rounded-lg edge-top
                         py-1 animate-scale-in"
              style={{ left: menu.x, top: menu.y }}
            >
              <p className="px-3 py-1.5 text-[10px] font-medium text-ink-tertiary uppercase tracking-wide">
                Move to
              </p>
              {COLUMNS.map((col) => {
                const current = col.id === job.column;
                return (
                  <button
                    key={col.id}
                    disabled={current}
                    onClick={() => {
                      if (!current) moveJob(job.id, col.id);
                      setMenu(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors
                      ${current
                        ? 'text-ink-tertiary cursor-default'
                        : 'text-ink-muted hover:text-ink hover:bg-surface-3'
                      }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: col.color }}
                    />
                    {col.label}
                    {current && <span className="ml-auto text-[10px] text-ink-tertiary">current</span>}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

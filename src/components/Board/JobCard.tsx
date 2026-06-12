import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Job } from '../../types';

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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    animationDelay: `${120 + index * 45}ms`,
  };

  const date = new Date(job.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
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
          {job.generated && (
            <span
              className="shrink-0 text-[10px] w-5 h-5 flex items-center justify-center rounded-md
                         bg-primary/15 text-primary-hover"
              title="AI documents generated"
            >
              ✦
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2.5 text-[11px] text-ink-tertiary">
          {job.location && (
            <>
              <span className="truncate max-w-[140px]">{job.location}</span>
              <span className="w-1 h-1 rounded-full bg-ink-tertiary/50 shrink-0" />
            </>
          )}
          <span className="tabular-nums shrink-0">{date}</span>
        </div>
      </div>
    </div>
  );
}

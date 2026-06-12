import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Job } from '../../types';
import type { ColumnMeta } from '../../lib/columns';
import { JobCard } from './JobCard';

interface Props {
  meta: ColumnMeta;
  index: number;
  jobs: Job[];
  onCardClick: (job: Job) => void;
  onAddClick: () => void;
}

export function KanbanColumn({ meta, index, jobs, onCardClick, onAddClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });

  return (
    <div
      className="flex flex-col shrink-0 w-[280px] h-full animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1.5 mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}55` }}
          />
          <span className="text-[11px] font-semibold text-ink-subtle tracking-[0.06em] uppercase">
            {meta.label}
          </span>
          <span className="text-[11px] tabular-nums text-ink-tertiary font-medium">
            {jobs.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          className="text-ink-tertiary hover:text-ink transition-colors w-6 h-6 flex items-center
                     justify-center rounded-md hover:bg-surface-2"
          title={`Add job to ${meta.label}`}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-32 transition-all duration-200
          border border-transparent
          ${isOver
            ? 'bg-surface-2/60 border-hairline-strong'
            : 'bg-surface-1/30'
          }`}
      >
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map((job, i) => (
            <JobCard
              key={job.id}
              job={job}
              accent={meta.color}
              index={i}
              onClick={() => onCardClick(job)}
            />
          ))}
        </SortableContext>

        {jobs.length === 0 && (
          <button
            onClick={onAddClick}
            className="flex-1 flex flex-col items-center justify-center gap-2 py-8 rounded-lg
                       border border-dashed border-hairline text-ink-tertiary
                       hover:border-hairline-strong hover:text-ink-subtle transition-colors group"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                 className="opacity-50 group-hover:opacity-100 transition-opacity">
              <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="text-[11px]">Add a job</span>
          </button>
        )}
      </div>
    </div>
  );
}

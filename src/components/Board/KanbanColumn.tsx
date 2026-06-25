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
      <div className="flex items-center justify-between px-1.5 mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}55` }}
          />
          <span className="text-[11px] font-semibold text-ink-subtle tracking-[0.06em] uppercase">
            {meta.label}
          </span>
          <span
            className="text-[10px] tabular-nums font-semibold leading-none px-1.5 py-0.5 rounded-full
                       bg-surface-2 border border-hairline"
            style={{ color: meta.color }}
          >
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

      {/* Accent rule — ties the column to its stage color */}
      <div
        className="h-[2px] rounded-full mx-1.5 mb-2 opacity-40"
        style={{ backgroundColor: meta.color }}
      />

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
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-8 rounded-lg
                       border border-dashed border-hairline/70 text-ink-tertiary
                       hover:border-hairline-strong hover:text-ink-subtle transition-colors group"
          >
            <span
              className="w-7 h-7 flex items-center justify-center rounded-full mb-0.5
                         transition-transform group-hover:scale-110"
              style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
            >
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none" style={{ color: meta.color }}>
                <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-[12px] font-medium text-ink-subtle">{meta.emptyHint}</span>
            <span className="text-[10px] opacity-70">Click to add</span>
          </button>
        )}
      </div>
    </div>
  );
}

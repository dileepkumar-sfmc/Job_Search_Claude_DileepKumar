import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Job, ColumnId } from '../../types';
import { useJobsStore } from '../../store/jobs';
import { COLUMNS, COLUMN_IDS, COLUMN_BY_ID } from '../../lib/columns';
import { KanbanColumn } from './KanbanColumn';
import { JobCard } from './JobCard';

interface Props {
  onCardClick: (job: Job) => void;
  onAddClick: (defaultColumn?: ColumnId) => void;
  onSearch: () => void;
}

export function KanbanBoard({ onCardClick, onAddClick, onSearch }: Props) {
  const { jobs, moveJob, importJobs } = useJobsStore();
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find((j) => j.id === event.active.id);
    setActiveJob(job ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveJob(null);
    const { active, over } = event;
    if (!over) return;

    const activeJob = jobs.find((j) => j.id === active.id);
    if (!activeJob) return;

    const overColumnId = COLUMN_IDS.includes(over.id as ColumnId)
      ? (over.id as ColumnId)
      : jobs.find((j) => j.id === over.id)?.column;

    if (!overColumnId) return;

    if (activeJob.column !== overColumnId) {
      moveJob(activeJob.id, overColumnId);
      return;
    }

    // Reorder within same column
    const colJobs = jobs.filter((j) => j.column === overColumnId);
    const oldIdx = colJobs.findIndex((j) => j.id === active.id);
    const newIdx = colJobs.findIndex((j) => j.id === over.id);
    if (oldIdx !== newIdx) {
      const reordered = arrayMove(colJobs, oldIdx, newIdx);
      const otherJobs = jobs.filter((j) => j.column !== overColumnId);
      importJobs([...otherJobs, ...reordered]);
    }
  }

  // First-run: a welcoming hero instead of five empty columns.
  if (jobs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center animate-fade-up">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 edge-top mb-5">
          <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5 13.5 4.75v6.5L8 14.5 2.5 11.25v-6.5L8 1.5Z" stroke="var(--primary-hover)" strokeWidth="1.1" strokeLinejoin="round" />
            <circle cx="8" cy="8" r="2" fill="var(--primary-hover)" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-ink" style={{ letterSpacing: '-0.03em' }}>
          Track your whole job search here
        </h2>
        <p className="text-[13px] text-ink-subtle mt-2 max-w-sm leading-relaxed">
          Add a role to your board, then let the copilot tailor your resume, cover letter, and recruiter email for it. Drag or right-click cards to move them through your pipeline.
        </p>
        <div className="flex items-center gap-2.5 mt-6">
          <button
            onClick={() => onAddClick('wishlist')}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 bg-primary hover:bg-primary-hover
                       text-white text-[13px] font-medium rounded-md transition-all edge-top-strong active:scale-[0.98]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Add your first job
          </button>
          <button
            onClick={onSearch}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 bg-surface-2 hover:bg-surface-3
                       text-ink border border-hairline text-[13px] font-medium rounded-md transition-all edge-top active:scale-[0.98]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6.2" cy="6.2" r="3.8" stroke="currentColor" strokeWidth="1.5" />
              <path d="m9.2 9.2 2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Find Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full px-5 pb-6 overflow-x-auto">
        {COLUMNS.map((col, i) => (
          <KanbanColumn
            key={col.id}
            meta={col}
            index={i}
            jobs={jobs.filter((j) => j.column === col.id)}
            onCardClick={onCardClick}
            onAddClick={() => onAddClick(col.id)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeJob && (
          <div className="rotate-2 cursor-grabbing edge-top-strong rounded-lg">
            <JobCard
              job={activeJob}
              accent={COLUMN_BY_ID[activeJob.column].color}
              index={0}
              onClick={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

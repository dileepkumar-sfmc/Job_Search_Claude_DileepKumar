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
}

export function KanbanBoard({ onCardClick, onAddClick }: Props) {
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

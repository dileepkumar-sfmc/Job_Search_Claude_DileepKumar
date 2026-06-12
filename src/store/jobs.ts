import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Job, ColumnId, GeneratedContent } from '../types';

interface JobsStore {
  jobs: Job[];
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  moveJob: (id: string, column: ColumnId) => void;
  setGenerated: (id: string, generated: GeneratedContent) => void;
  deleteJob: (id: string) => void;
  importJobs: (jobs: Job[]) => void;
}

export const useJobsStore = create<JobsStore>()(
  persist(
    (set) => ({
      jobs: [],
      addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
      updateJob: (id, updates) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)) })),
      moveJob: (id, column) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, column } : j)) })),
      setGenerated: (id, generated) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, generated } : j)) })),
      deleteJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
      importJobs: (jobs) => set({ jobs }),
    }),
    { name: 'jsc-jobs' }
  )
);

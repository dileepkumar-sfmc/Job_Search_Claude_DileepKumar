import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Job, ColumnId, GeneratedContent } from '../types';
import { supabase, AUTH_ENABLED } from '../lib/supabase';
import { useUiStore } from './ui';

interface JobsStore {
  jobs: Job[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
  addJob: (job: Job) => Promise<void>;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
  moveJob: (id: string, column: ColumnId) => Promise<void>;
  setGenerated: (id: string, generated: Partial<GeneratedContent>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  importJobs: (jobs: Job[]) => Promise<void>;
}

// --- Row <-> Job mapping (DB stores the pipeline column as `status`) --------
interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  raw_text: string;
  summary: string;
  status: string;
  generated: GeneratedContent | null;
  created_at: string;
}

const rowToJob = (r: JobRow): Job => ({
  id: r.id,
  title: r.title,
  company: r.company,
  location: r.location,
  url: r.url,
  rawText: r.raw_text,
  summary: r.summary,
  column: r.status as ColumnId,
  createdAt: r.created_at,
  generated: r.generated ?? undefined,
});

const jobToRow = (j: Job) => ({
  id: j.id,
  title: j.title,
  company: j.company,
  location: j.location,
  url: j.url,
  raw_text: j.rawText,
  summary: j.summary,
  status: j.column,
  generated: j.generated ?? null,
  created_at: j.createdAt,
});

function jobToRowPatch(u: Partial<Job>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (u.title !== undefined) p.title = u.title;
  if (u.company !== undefined) p.company = u.company;
  if (u.location !== undefined) p.location = u.location;
  if (u.url !== undefined) p.url = u.url;
  if (u.rawText !== undefined) p.raw_text = u.rawText;
  if (u.summary !== undefined) p.summary = u.summary;
  if (u.column !== undefined) p.status = u.column;
  if (u.generated !== undefined) p.generated = u.generated ?? null;
  return p;
}

const notify = (msg: string) => useUiStore.getState().notify(msg);

/**
 * One-time migration: when auth is first enabled and the cloud board is empty,
 * push up any jobs this browser accumulated in localStorage so nothing is lost.
 * Guarded by a flag so it never runs twice.
 */
async function migrateLocalJobs(userId: string): Promise<Job[]> {
  if (localStorage.getItem('jsc-migrated')) return [];
  let local: Job[] = [];
  try {
    const raw = localStorage.getItem('jsc-jobs');
    if (raw) {
      const parsed = JSON.parse(raw);
      local = parsed?.state?.jobs ?? (Array.isArray(parsed) ? parsed : []);
    }
  } catch {
    local = [];
  }
  if (!local.length) {
    localStorage.setItem('jsc-migrated', '1');
    return [];
  }
  const rows = local.map((j) => ({ ...jobToRow(j), user_id: userId }));
  const { error } = await supabase.from('jobs').insert(rows);
  if (error) {
    notify('Could not migrate your existing jobs.');
    return [];
  }
  localStorage.setItem('jsc-migrated', '1');
  return local;
}

export const useJobsStore = create<JobsStore>()(
  persist(
    (set, get) => ({
      jobs: [],
      loading: false,
      loaded: false,

      // When auth is off, jobs are already rehydrated from localStorage by the
      // persist middleware — nothing to fetch. When on, pull from Supabase.
      load: async () => {
        if (!AUTH_ENABLED) {
          set({ loaded: true });
          return;
        }
        set({ loading: true });
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          notify('Could not load your jobs.');
          set({ loading: false });
          return;
        }
        let jobs = (data as JobRow[]).map(rowToJob);
        if (jobs.length === 0) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            const migrated = await migrateLocalJobs(auth.user.id);
            if (migrated.length) jobs = migrated;
          }
        }
        set({ jobs, loading: false, loaded: true });
      },

      reset: () => set({ jobs: [], loaded: false, loading: false }),

      addJob: async (job) => {
        set((s) => ({ jobs: [job, ...s.jobs] })); // optimistic
        if (!AUTH_ENABLED) return;
        const { error } = await supabase.from('jobs').insert(jobToRow(job));
        if (error) {
          set((s) => ({ jobs: s.jobs.filter((j) => j.id !== job.id) })); // revert
          notify('Could not save the job.');
        }
      },

      updateJob: async (id, updates) => {
        const prev = get().jobs;
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)) }));
        if (!AUTH_ENABLED) return;
        const { error } = await supabase.from('jobs').update(jobToRowPatch(updates)).eq('id', id);
        if (error) {
          set({ jobs: prev });
          notify('Could not save your change.');
        }
      },

      moveJob: async (id, column) => {
        await get().updateJob(id, { column });
      },

      setGenerated: async (id, generated) => {
        // Merge so individually-generated docs accumulate onto the same job.
        const existing = get().jobs.find((j) => j.id === id)?.generated;
        const merged: GeneratedContent = {
          coverLetter: '',
          tailoredResume: '',
          interviewQuestions: '',
          companyBrief: '',
          outreachEmail: '',
          ...existing,
          ...generated,
        };
        await get().updateJob(id, { generated: merged });
      },

      deleteJob: async (id) => {
        const prev = get().jobs;
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
        if (!AUTH_ENABLED) return;
        const { error } = await supabase.from('jobs').delete().eq('id', id);
        if (error) {
          set({ jobs: prev });
          notify('Could not delete the job.');
        }
      },

      importJobs: async (jobs) => {
        const prev = get().jobs;
        set({ jobs }); // optimistic: reflect the new set/order immediately
        if (!AUTH_ENABLED) return;
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const rows = jobs.map((j) => ({ ...jobToRow(j), user_id: auth.user!.id }));
        const { error } = await supabase.from('jobs').upsert(rows);
        if (error) {
          set({ jobs: prev });
          notify('Could not import jobs.');
        }
      },
    }),
    {
      name: 'jsc-jobs',
      partialize: (s) => ({ jobs: s.jobs }), // only the board persists locally
    }
  )
);

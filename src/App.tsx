import { useState } from 'react';
import type { Job, ColumnId } from './types';
import { KanbanBoard } from './components/Board/KanbanBoard';
import { AddJobModal } from './components/AddJob/AddJobModal';
import { JobSearchModal } from './components/JobSearch/JobSearchModal';
import { JobDetailDrawer } from './components/JobDetail/JobDetailDrawer';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { useJobsStore } from './store/jobs';

export default function App() {
  const { jobs } = useJobsStore();
  const [addColumn, setAddColumn] = useState<ColumnId | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Keep selected job in sync with store updates
  const liveJob = selectedJob ? (jobs.find((j) => j.id === selectedJob.id) ?? selectedJob) : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Nav */}
      <header className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-hairline">
        <div className="flex items-center gap-3">
          {/* Brand mark — geometric copilot glyph */}
          <div className="relative flex items-center justify-center w-7 h-7 rounded-md bg-primary edge-top-strong">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5 13.5 4.75v6.5L8 14.5 2.5 11.25v-6.5L8 1.5Z" stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" opacity="0.95" />
              <circle cx="8" cy="8" r="2" fill="#fff" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold text-ink" style={{ letterSpacing: '-0.03em' }}>
              Job Search Copilot
            </span>
            <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-subtle border border-hairline edge-top">
              {jobs.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-surface-2 hover:bg-surface-3
                       text-ink border border-hairline text-[13px] font-medium rounded-md transition-all
                       duration-150 edge-top active:scale-[0.98]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6.2" cy="6.2" r="3.8" stroke="currentColor" strokeWidth="1.5" />
              <path d="m9.2 9.2 2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Find Jobs
          </button>
          <button
            onClick={() => setAddColumn('wishlist')}
            className="group flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-primary hover:bg-primary-hover
                       text-white text-[13px] font-medium rounded-md transition-all duration-150
                       edge-top-strong active:scale-[0.98]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="transition-transform group-hover:rotate-90 duration-200">
              <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Add Job
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-ink-subtle hover:text-ink transition-colors rounded-md hover:bg-surface-2"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
              <path
                fillRule="evenodd"
                d="M7.11.15a1 1 0 0 1 1.78 0l.59 1.18c.23.46.7.74 1.2.72l1.32-.05a1 1 0 0 1 .89 1.54l-.68 1.1a1.4 1.4 0 0 0 0 1.52l.68 1.1a1 1 0 0 1-.89 1.54l-1.32-.05a1.4 1.4 0 0 0-1.2.72l-.59 1.18a1 1 0 0 1-1.78 0l-.59-1.18a1.4 1.4 0 0 0-1.2-.72l-1.32.05a1 1 0 0 1-.89-1.54l.68-1.1a1.4 1.4 0 0 0 0-1.52l-.68-1.1A1 1 0 0 1 4.1 1.54l1.32.05c.5.02.97-.26 1.2-.72L7.11.15Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 overflow-hidden pt-6">
        <KanbanBoard
          onCardClick={setSelectedJob}
          onAddClick={(col) => setAddColumn(col ?? 'wishlist')}
        />
      </main>

      {/* Modals */}
      {addColumn && (
        <AddJobModal defaultColumn={addColumn} onClose={() => setAddColumn(null)} />
      )}
      {showSearch && <JobSearchModal onClose={() => setShowSearch(false)} />}
      {liveJob && (
        <JobDetailDrawer job={liveJob} onClose={() => setSelectedJob(null)} />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

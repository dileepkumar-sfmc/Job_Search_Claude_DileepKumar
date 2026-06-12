import { useState } from 'react';
import type { Job } from '../../types';
import { useJobsStore } from '../../store/jobs';
import { useSettingsStore } from '../../store/settings';
import { generateAll } from '../../lib/ai';
import { COLUMNS } from '../../lib/columns';
import { GeneratedDocs } from './GeneratedDocs';

interface Props {
  job: Job;
  onClose: () => void;
}

export function JobDetailDrawer({ job, onClose }: Props) {
  const { moveJob, setGenerated, deleteJob } = useJobsStore();
  const { apiKey, provider, resumeText, openRouterModel } = useSettingsStore();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  async function handleGenerate() {
    setError('');
    setGenerating(true);
    try {
      const result = await generateAll(provider, apiKey, job.rawText, resumeText, openRouterModel);
      setGenerated(job.id, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function handleDelete() {
    if (confirm(`Delete "${job.title}"? This cannot be undone.`)) {
      deleteJob(job.id);
      onClose();
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 animate-overlay-in backdrop-blur-[2px]"
        style={{ background: 'var(--semantic-overlay)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-2xl bg-surface-1 border-l border-hairline
                      flex flex-col overflow-hidden animate-slide-in-right edge-top">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-hairline shrink-0">
          <div className="min-w-0">
            <h2
              className="text-xl font-semibold text-ink leading-tight"
              style={{ letterSpacing: '-0.4px' }}
            >
              {job.title || 'Untitled Role'}
            </h2>
            <p className="text-sm text-ink-muted mt-0.5">
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
            </p>
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary-hover transition-colors mt-1 block truncate"
              >
                {job.url}
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-ink-subtle hover:text-ink transition-colors text-2xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-hairline shrink-0 overflow-x-auto">
          <span className="text-[11px] text-ink-subtle shrink-0 mr-1">Status</span>
          {COLUMNS.map((col) => {
            const active = job.column === col.id;
            return (
              <button
                key={col.id}
                onClick={() => moveJob(job.id, col.id)}
                className={`shrink-0 flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-[11px]
                  font-medium transition-all border
                  ${active
                    ? 'bg-surface-2 text-ink border-hairline-strong'
                    : 'bg-transparent text-ink-subtle hover:text-ink border-hairline hover:bg-surface-2'
                  }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full transition-transform"
                  style={{
                    backgroundColor: col.color,
                    boxShadow: active ? `0 0 6px ${col.color}99` : 'none',
                  }}
                />
                {col.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Generate button */}
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink tracking-[-0.01em]">AI Documents</h3>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 pl-3 pr-3.5 py-2 bg-primary hover:bg-primary-hover
                         text-white text-[13px] font-medium rounded-md transition-all edge-top-strong
                         active:scale-[0.98] disabled:opacity-50"
            >
              {generating ? (
                <>
                  <span className="animate-spin-slow">⟳</span>
                  Generating…
                </>
              ) : (
                <>
                  <span className="text-primary-hover" style={{ filter: 'brightness(2)' }}>✦</span>
                  {job.generated ? 'Regenerate' : 'Generate All'}
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-surface-2 border border-hairline rounded-lg px-4 py-3 text-xs text-ink-muted
                            flex gap-2 items-start">
              <span className="text-status-rejected shrink-0">●</span>
              <span>{error}</span>
            </div>
          )}

          {job.generated && !generating && (
            <GeneratedDocs generated={job.generated} company={job.company} title={job.title} />
          )}

          {generating && (
            <div className="border border-hairline rounded-xl p-8 flex flex-col items-center gap-3 edge-top bg-surface-1">
              <span className="animate-spin-slow text-2xl text-primary-hover">⟳</span>
              <p className="text-xs text-ink-subtle">Tailoring your documents…</p>
            </div>
          )}

          {!job.generated && !generating && !error && (
            <div className="border border-dashed border-hairline rounded-xl p-8 text-center bg-surface-1/40">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mx-auto mb-3 edge-top">
                <span className="text-primary-hover text-lg" style={{ filter: 'brightness(1.6)' }}>✦</span>
              </div>
              <p className="text-[13px] text-ink-subtle leading-relaxed max-w-sm mx-auto">
                Generate a tailored <strong className="text-ink font-medium">cover letter</strong>,{' '}
                <strong className="text-ink font-medium">resume</strong>,{' '}
                <strong className="text-ink font-medium">interview prep</strong>, and{' '}
                <strong className="text-ink font-medium">company brief</strong> — all in one click.
              </p>
            </div>
          )}

          {/* Job description */}
          <div>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-1 text-xs text-ink-subtle hover:text-ink transition-colors mb-2"
            >
              <span className={`transition-transform ${showRaw ? 'rotate-90' : ''}`}>▶</span>
              Job Description
            </button>
            {showRaw && (
              <pre className="text-xs text-ink-tertiary whitespace-pre-wrap bg-surface-2 border border-hairline
                              rounded-lg p-4 max-h-64 overflow-y-auto font-sans leading-relaxed">
                {job.rawText}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-hairline shrink-0 flex justify-end">
          <button
            onClick={handleDelete}
            className="text-xs text-ink-tertiary hover:text-ink transition-colors px-3 py-2
                       rounded-md hover:bg-surface-2"
          >
            Delete Job
          </button>
        </div>
      </div>
    </>
  );
}

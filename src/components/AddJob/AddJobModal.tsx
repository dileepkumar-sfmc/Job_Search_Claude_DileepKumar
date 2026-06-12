import { useState } from 'react';
import type { ColumnId } from '../../types';
import { useJobsStore } from '../../store/jobs';
import { useSettingsStore } from '../../store/settings';
import { fetchJobFromUrl } from '../../lib/jobScraper';
import { extractJobMeta } from '../../lib/ai';

interface Props {
  defaultColumn: ColumnId;
  onClose: () => void;
}

export function AddJobModal({ defaultColumn, onClose }: Props) {
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const { addJob } = useJobsStore();
  const { apiKey, provider, openRouterModel } = useSettingsStore();

  async function handleUrlFetch() {
    if (!urlInput.trim()) return;
    setUrlError('');
    setLoading(true);
    setStatus('Fetching listing…');
    try {
      const text = await fetchJobFromUrl(urlInput);
      setTextInput(text);
      setStatus('Got it — review the text below and click Add Job.');
    } catch {
      setUrlError("That site blocks automated fetching — paste the listing text below instead.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    const rawText = textInput.trim();
    if (!rawText) return;

    setLoading(true);
    setStatus('Extracting job details…');
    const meta = await extractJobMeta(provider, apiKey, rawText, openRouterModel);
    setStatus('');
    setLoading(false);

    addJob({
      id: crypto.randomUUID(),
      title: meta.title,
      company: meta.company,
      location: meta.location,
      url: urlInput.trim(),
      rawText,
      summary: meta.summary,
      column: defaultColumn,
      createdAt: new Date().toISOString(),
    });

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-in backdrop-blur-[2px]"
      style={{ background: 'var(--semantic-overlay)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-1 border border-hairline rounded-xl w-full max-w-lg flex flex-col max-h-[90vh]
                      animate-scale-in edge-top">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h2 className="text-base font-semibold text-ink" style={{ letterSpacing: '-0.025rem' }}>
            Add Job
          </h2>
          <button
            onClick={onClose}
            className="text-ink-subtle hover:text-ink transition-colors text-xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* URL row */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-subtle block">Job URL <span className="text-ink-tertiary font-normal">(optional)</span></label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
                placeholder="https://jobs.company.com/role/123"
                className="flex-1 bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm
                           text-ink placeholder:text-ink-tertiary outline-none
                           focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50"
              />
              <button
                onClick={handleUrlFetch}
                disabled={!urlInput.trim() || loading}
                className="px-3 py-2 bg-surface-2 border border-hairline hover:bg-surface-3 text-ink
                           text-xs font-medium rounded-md transition-colors disabled:opacity-40"
              >
                Fetch
              </button>
            </div>
            {urlError && (
              <p className="text-xs text-ink-muted bg-surface-2 border border-hairline rounded-md px-3 py-2">
                {urlError}
              </p>
            )}
          </div>

          {/* Text area */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-subtle block">
              Job description <span className="text-ink-tertiary font-normal">(paste the full listing)</span>
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste the job listing text here…"
              rows={12}
              className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm
                         text-ink placeholder:text-ink-tertiary outline-none resize-none
                         focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50"
            />
          </div>

          {status && <p className="text-xs text-ink-subtle">{status}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-hairline">
          <button
            onClick={onClose}
            className="px-3 py-2 bg-surface-2 border border-hairline text-ink text-xs font-medium
                       rounded-md hover:bg-surface-3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!textInput.trim() || loading}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-medium
                       rounded-md transition-colors disabled:opacity-40"
          >
            {loading ? 'Adding…' : 'Add Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

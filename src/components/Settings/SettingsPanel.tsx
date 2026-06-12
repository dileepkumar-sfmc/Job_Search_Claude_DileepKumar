import { useRef, useState } from 'react';
import type { AIProvider } from '../../types';
import { useSettingsStore } from '../../store/settings';
import { useJobsStore } from '../../store/jobs';
import { parseResume } from '../../lib/resumeParser';

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const { apiKey, provider, openRouterModel, searchModel, resumeText, resumeFileName, setApiKey, setProvider, setOpenRouterModel, setSearchModel, setResume } =
    useSettingsStore();
  const { jobs, importJobs } = useJobsStore();

  const [localKey, setLocalKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(openRouterModel);
  const [localSearchModel, setLocalSearchModel] = useState(searchModel);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    setApiKey(localKey.trim());
    setOpenRouterModel(localModel.trim() || 'anthropic/claude-sonnet-4-6');
    setSearchModel(localSearchModel.trim() || 'perplexity/sonar-pro');
    onClose();
  }

  async function handleResumeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setParseError('');
    try {
      const text = await parseResume(file);
      setResume(text, file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse file');
    } finally {
      setParsing(false);
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jsc-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) importJobs(data);
      } catch {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 animate-overlay-in backdrop-blur-[2px]"
        style={{ background: 'var(--semantic-overlay)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-surface-1 border border-hairline rounded-xl w-full max-w-md flex flex-col max-h-[90vh]
                        animate-scale-in edge-top pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
            <h2 className="text-base font-semibold text-ink" style={{ letterSpacing: '-0.025rem' }}>
              Settings
            </h2>
            <button
              onClick={onClose}
              className="text-ink-subtle hover:text-ink transition-colors text-xl leading-none p-1"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* AI Provider */}
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-ink-subtle uppercase tracking-eyebrow">
                AI Provider
              </h3>
              <div className="flex gap-2">
                {(['openrouter', 'claude', 'openai'] as AIProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors border
                      ${provider === p
                        ? 'bg-surface-2 text-ink border-hairline-strong'
                        : 'bg-surface-1 text-ink-subtle border-hairline hover:text-ink'
                      }`}
                  >
                    {p === 'openrouter' ? 'OpenRouter' : p === 'claude' ? 'Claude' : 'OpenAI'}
                  </button>
                ))}
              </div>

              {provider === 'openrouter' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-ink-subtle block">Model</label>
                  <input
                    type="text"
                    value={localModel}
                    onChange={(e) => setLocalModel(e.target.value)}
                    placeholder="anthropic/claude-sonnet-4-6"
                    className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm
                               text-ink placeholder:text-ink-tertiary outline-none font-mono
                               focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50"
                  />
                  <p className="text-xs text-ink-tertiary">
                    Any model slug from{' '}
                    <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer"
                       className="text-primary hover:text-primary-hover underline">
                      openrouter.ai/models
                    </a>
                  </p>
                </div>
              )}

              {provider === 'openrouter' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-ink-subtle block">Job-search model (live web)</label>
                  <input
                    type="text"
                    value={localSearchModel}
                    onChange={(e) => setLocalSearchModel(e.target.value)}
                    placeholder="perplexity/sonar-pro"
                    className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm
                               text-ink placeholder:text-ink-tertiary outline-none font-mono
                               focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50"
                  />
                  <p className="text-xs text-ink-tertiary">
                    Used by <span className="text-ink-subtle">Find Jobs</span>. Use a web-search model like
                    {' '}<span className="font-mono">perplexity/sonar-pro</span>.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-ink-subtle block">API Key</label>
                <input
                  type="password"
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder={
                    provider === 'openrouter' ? 'sk-or-…' :
                    provider === 'claude' ? 'sk-ant-…' : 'sk-…'
                  }
                  className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm
                             text-ink placeholder:text-ink-tertiary outline-none font-mono
                             focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50"
                />
                <p className="text-xs text-ink-tertiary">
                  Stored only in your browser's localStorage.
                </p>
              </div>
            </section>

            {/* Resume */}
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-ink-subtle uppercase tracking-eyebrow">
                Resume
              </h3>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
                className="w-full py-2.5 border border-dashed border-hairline-strong rounded-lg text-xs
                           text-ink-subtle hover:text-ink hover:border-primary transition-colors text-center"
              >
                {parsing
                  ? 'Parsing…'
                  : resumeFileName
                  ? `Replace: ${resumeFileName}`
                  : 'Upload PDF or Word (.docx)'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeFile}
                className="hidden"
              />
              {parseError && <p className="text-xs text-ink-muted">{parseError}</p>}
              {resumeText && !parsing && (
                <div className="bg-surface-2 border border-hairline rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-ink-tertiary font-mono whitespace-pre-wrap leading-relaxed">
                    {resumeText.slice(0, 400)}…
                  </p>
                </div>
              )}
            </section>

            {/* Data */}
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-ink-subtle uppercase tracking-eyebrow">
                Data
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 py-2 bg-surface-2 border border-hairline rounded-md text-xs
                             text-ink-subtle hover:text-ink transition-colors"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => importRef.current?.click()}
                  className="flex-1 py-2 bg-surface-2 border border-hairline rounded-md text-xs
                             text-ink-subtle hover:text-ink transition-colors"
                >
                  Import JSON
                </button>
                <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-hairline">
            <button
              onClick={onClose}
              className="px-3 py-2 bg-surface-2 border border-hairline text-ink text-xs font-medium
                         rounded-md hover:bg-surface-3 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-medium
                         rounded-md transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

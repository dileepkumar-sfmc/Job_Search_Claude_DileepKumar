import { useEffect, useRef, useState } from 'react';
import type { SearchPrefs, JobSearchResult } from '../../types';
import { useJobsStore } from '../../store/jobs';
import { useSettingsStore } from '../../store/settings';
import { searchJobs } from '../../lib/ai';
import { searchRealJobs, searchRemotiveJobs } from '../../lib/jobsApi';
import { safeHttpUrl } from '../../lib/url';
import { buildBoardLinks, jobSearchUrl } from '../../lib/boards';

interface Props {
  onClose: () => void;
}

const EMPLOYMENT_TYPES = ['Full-time', 'Contract/C2C', 'Part-time', 'Internship'];
const WORK_MODES: SearchPrefs['workMode'][] = ['any', 'remote', 'onsite', 'hybrid'];
const DATE_POSTED: { value: SearchPrefs['datePosted']; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '24h', label: 'Past 24h' },
  { value: '3d', label: 'Past 3 days' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
];

const inputCls =
  'w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-tertiary outline-none focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50';

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function JobSearchModal({ onClose }: Props) {
  const { jobs, addJob } = useJobsStore();
  const { apiKey, jobsApiKey, searchModel, resumeText } = useSettingsStore();

  const [prefs, setPrefs] = useState<SearchPrefs>({
    role: '',
    location: '',
    workMode: 'any',
    employmentTypes: [],
    seniority: '',
    salary: '',
    datePosted: 'any',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<JobSearchResult[] | null>(null);
  const [source, setSource] = useState<'api' | 'remotive' | 'ai'>('ai');
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const resultsRef = useRef<HTMLDivElement>(null);

  // When a scan finishes (results array OR error), pull the user's eye down to it —
  // otherwise the outcome renders below the prominent boards section and is missed.
  useEffect(() => {
    if (results !== null || error) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results, error]);

  // Source priority: JSearch (best, needs key) → Remotive (real, no key) → AI leads.
  const useRealApi = Boolean(jobsApiKey);

  const existingKeys = new Set(jobs.map((j) => `${norm(j.title)}@${norm(j.company)}`));
  const boardLinks = buildBoardLinks(prefs);

  function toggleType(t: string) {
    setPrefs((p) => ({
      ...p,
      employmentTypes: p.employmentTypes.includes(t)
        ? p.employmentTypes.filter((x) => x !== t)
        : [...p.employmentTypes, t],
    }));
  }

  async function handleSearch() {
    setError('');
    setLoading(true);
    setResults(null);
    try {
      if (useRealApi) {
        setSource('api');
        setResults(await searchRealJobs(jobsApiKey, prefs));
      } else {
        // No key: try real remote postings (Remotive, no key) first; if it finds
        // nothing or errors, fall back to AI leads so the user always gets results.
        let remotive: JobSearchResult[] = [];
        try {
          remotive = await searchRemotiveJobs(prefs);
        } catch {
          remotive = [];
        }
        if (remotive.length) {
          setSource('remotive');
          setResults(remotive);
        } else {
          setSource('ai');
          setResults(await searchJobs(apiKey, searchModel, prefs, resumeText));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(r: JobSearchResult) {
    const key = `${norm(r.title)}@${norm(r.company)}`;
    // Real (JSearch) postings carry the full JD — use it verbatim for tailoring.
    // AI leads have only a short summary, so fall back to the assembled fields.
    const rawText = r.description?.trim()
      ? [r.title, r.company, r.location, r.employmentType, '', r.description.trim()]
          .filter((x) => x !== undefined)
          .join('\n')
      : [r.title, r.company, r.location, r.employmentType, r.summary, r.fit]
          .filter(Boolean)
          .join('\n');
    addJob({
      id: crypto.randomUUID(),
      title: r.title,
      company: r.company,
      location: r.location,
      url: r.url,
      rawText,
      summary: r.summary,
      column: 'wishlist',
      createdAt: new Date().toISOString(),
    });
    setAddedKeys((s) => new Set(s).add(key));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-in backdrop-blur-[2px]"
      style={{ background: 'var(--semantic-overlay)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-1 border border-hairline rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-scale-in edge-top">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink" style={{ letterSpacing: '-0.025rem' }}>
              Find Jobs
            </h2>
            <p className="text-[11px] text-ink-subtle mt-0.5">
              Open the real boards pre-filtered with your criteria{useRealApi ? ' · or run an in-app scan via JSearch' : ' · or run a remote-only in-app scan'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-subtle hover:text-ink transition-colors text-xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Preference form */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-ink-subtle block">Target role</label>
              <input
                className={inputCls}
                value={prefs.role}
                onChange={(e) => setPrefs({ ...prefs, role: e.target.value })}
                placeholder="e.g. Senior Java Developer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-ink-subtle block">Location</label>
              <input
                className={inputCls}
                value={prefs.location}
                onChange={(e) => setPrefs({ ...prefs, location: e.target.value })}
                placeholder="e.g. Remote, US"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-ink-subtle block">Work mode</label>
              <select
                className={inputCls + ' capitalize'}
                value={prefs.workMode}
                onChange={(e) => setPrefs({ ...prefs, workMode: e.target.value as SearchPrefs['workMode'] })}
              >
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-ink-subtle block">Seniority</label>
              <input
                className={inputCls}
                value={prefs.seniority}
                onChange={(e) => setPrefs({ ...prefs, seniority: e.target.value })}
                placeholder="e.g. Senior, Lead"
              />
            </div>
          </div>

          {/* Employment type (multi-select) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-ink-subtle block">Employment type</label>
            <div className="flex flex-wrap gap-1.5">
              {EMPLOYMENT_TYPES.map((t) => {
                const on = prefs.employmentTypes.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`px-2.5 py-1 rounded-full text-[12px] font-medium border transition-all
                      ${on
                        ? 'bg-primary text-white border-transparent edge-top'
                        : 'bg-surface-2 text-ink-subtle border-hairline hover:text-ink'
                      }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Posted within (single-select) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-ink-subtle block">Posted within</label>
            <div className="flex flex-wrap gap-1.5">
              {DATE_POSTED.map(({ value, label }) => {
                const on = prefs.datePosted === value;
                return (
                  <button
                    key={value}
                    onClick={() => setPrefs((p) => ({ ...p, datePosted: value }))}
                    className={`px-2.5 py-1 rounded-full text-[12px] font-medium border transition-all
                      ${on
                        ? 'bg-primary text-white border-transparent edge-top'
                        : 'bg-surface-2 text-ink-subtle border-hairline hover:text-ink'
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-ink-subtle block">
              Salary target <span className="text-ink-tertiary font-normal">(optional)</span>
            </label>
            <input
              className={inputCls}
              value={prefs.salary}
              onChange={(e) => setPrefs({ ...prefs, salary: e.target.value })}
              placeholder="e.g. $140k+ or $80/hr"
            />
          </div>

          {/* PRIMARY action: live board deep-links. Each opens the real board with the
              form's role/location/work-mode/date filters pre-applied — the most reliable
              way to surface real, current postings (especially for US contract market). */}
          <div className="space-y-2.5 border-t border-hairline pt-4">
            <div className="flex items-baseline justify-between">
              <label className="text-[12px] font-semibold text-ink block tracking-[-0.005em]">
                Search on a live job board
              </label>
              <span className="text-[10px] text-ink-tertiary">Real postings · pre-filtered</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {boardLinks.map((b) => (
                <a
                  key={b.name}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center justify-center gap-1 px-3 py-3.5 rounded-lg
                             bg-surface-2 border border-hairline hover:border-primary hover:bg-surface-3
                             transition-all edge-top"
                >
                  <span className="text-[13px] font-semibold text-ink group-hover:text-primary transition-colors">
                    {b.name}
                  </span>
                  <span className="text-[10px] text-ink-tertiary group-hover:text-primary/80 transition-colors">
                    Open ↗
                  </span>
                </a>
              ))}
            </div>
            <p className="text-[11px] text-ink-tertiary">
              Opens the real board with your role, location, work mode, and date pre-applied.
              Paste any listing back via <strong className="text-ink-subtle font-medium">Add Job</strong> to tailor your resume and cover letter for it.
            </p>
          </div>

          {!resumeText && (
            <p className="text-[11px] text-ink-muted bg-surface-2 border border-hairline rounded-md px-3 py-2">
              Tip: upload your resume in Settings for sharper, profile-matched results.
            </p>
          )}

          <div ref={resultsRef}>
            {error && (
              <div className="bg-surface-2 border border-hairline rounded-md px-3 py-2 text-[12px] text-ink-muted flex gap-2">
                <span className="text-status-rejected shrink-0">●</span>
                <span>{error}</span>
              </div>
            )}

            {/* Results */}
            {loading && (
              <div className="border border-hairline rounded-xl p-8 flex flex-col items-center gap-3 edge-top">
                <span className="animate-spin-slow text-2xl text-primary-hover">⟳</span>
                <p className="text-xs text-ink-subtle">Searching live job boards…</p>
              </div>
            )}

            {results && results.length === 0 && !loading && (
              <div className="border border-hairline rounded-xl p-5 edge-top bg-surface-2 flex flex-col items-center gap-2 text-center">
                <span className="text-2xl text-ink-tertiary">⌕</span>
                <p className="text-[13px] text-ink font-medium">No matches in the in-app scan</p>
                <p className="text-[12px] text-ink-subtle max-w-md">
                  The free remote sources don't have postings for these filters. Try a board above (<strong className="text-ink font-medium">Google Jobs</strong> has the widest coverage) — one click opens it with your filters pre-applied.
                </p>
              </div>
            )}

          {results && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-ink-tertiary">{results.length} results</p>
              {results.map((r, i) => {
                const key = `${norm(r.title)}@${norm(r.company)}`;
                const added = addedKeys.has(key) || existingKeys.has(key);
                const safeUrl = safeHttpUrl(r.url);
                return (
                  <div
                    key={i}
                    className="bg-surface-1 border border-hairline rounded-lg edge-top p-3.5 animate-fade-up"
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate" style={{ letterSpacing: '-0.01em' }}>
                          {r.title}
                        </p>
                        <p className="text-[12px] text-ink-muted truncate">
                          {r.company}
                          {r.location ? ` · ${r.location}` : ''}
                          {r.employmentType ? ` · ${r.employmentType}` : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.posted && (
                            <span className="text-[11px] text-ink-tertiary">Posted {r.posted}</span>
                          )}
                          {r.source && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success
                                             bg-success/10 border border-success/30 rounded-full px-1.5 py-0.5">
                              <span className="text-[8px]">●</span> via {r.source}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAdd(r)}
                        disabled={added}
                        className={`shrink-0 text-[11px] px-2.5 py-1 rounded-md border transition-all
                          ${added
                            ? 'bg-success/15 border-success/40 text-success cursor-default'
                            : 'bg-primary text-white border-transparent hover:bg-primary-hover edge-top'
                          }`}
                      >
                        {added ? '✓ Added' : '+ Wishlist'}
                      </button>
                    </div>
                    {(r.summary || r.fit) && (
                      <p className="text-[12px] text-ink-subtle mt-2 leading-relaxed">{r.fit || r.summary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {source !== 'ai' ? (
                        // Real source (JSearch/Remotive): the URL is a genuine apply link — lead with it.
                        <>
                          {safeUrl && (
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover"
                            >
                              Apply ↗
                            </a>
                          )}
                          <a
                            href={jobSearchUrl(r.title, r.company, r.location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-ink-tertiary hover:text-ink-subtle"
                          >
                            Search more ↗
                          </a>
                        </>
                      ) : (
                        // AI leads: direct URLs are unreliable (Sonar often fabricates
                        // or returns stale links). Drop the unverified link entirely
                        // and only show a Google Jobs deep-link that lands in the real
                        // Jobs tab with current postings matching this title + company.
                        <a
                          href={jobSearchUrl(r.title, r.company, r.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover"
                        >
                          Open on Google Jobs ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Footer — boards above are the primary path; the in-app scan is secondary
            (best when JSearch key is set; otherwise remote-only via Remotive + AI fallback). */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-hairline shrink-0">
          <span className="text-[11px] text-ink-tertiary">
            {results && results.length > 0 && source === 'ai'
              ? 'AI-suggested leads — click Open on Google Jobs to find the real posting.'
              : results && results.length > 0
                ? 'Real postings — apply links open the live listing.'
                : useRealApi
                  ? 'In-app scan uses your JSearch key for real, current postings.'
                  : 'In-app scan covers remote-only roles. The boards above have wider coverage.'}
          </span>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-surface-3
                       text-ink-subtle hover:text-ink text-[12px] font-medium rounded-md
                       border border-hairline transition-all disabled:opacity-50"
            title={useRealApi ? 'Run a JSearch query inside the app' : 'Scan remote-only sources (Remotive + AI fallback)'}
          >
            {loading ? <span className="animate-spin-slow">⟳</span> : '🔍'}
            {loading
              ? 'Scanning…'
              : results
                ? 'Scan again'
                : useRealApi
                  ? 'Quick scan (JSearch)'
                  : 'Quick scan (remote-only)'}
          </button>
        </div>
      </div>
    </div>
  );
}

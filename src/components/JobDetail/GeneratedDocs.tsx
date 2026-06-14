import { useState } from 'react';
import type { GeneratedContent } from '../../types';
import type { DocKind } from '../../lib/ai';
import { downloadDocx, downloadTxt } from '../../lib/download';

interface Props {
  generated: GeneratedContent | undefined;
  company: string;
  title: string;
  recruiterEmail?: string;
  onGenerate: (kind: DocKind) => void;
  generatingKind: DocKind | null;
}

/** Split a generated email into its Subject line and body. */
function splitEmail(text: string): { subject: string; body: string } {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^\s*subject:/i.test(l));
  if (i === -1) return { subject: '', body: text.trim() };
  const subject = lines[i].replace(/^\s*subject:\s*/i, '').trim();
  const body = lines.slice(i + 1).join('\n').trim();
  return { subject, body };
}

const TABS: { id: DocKind; label: string; docFormat: 'docx' | 'txt'; fileLabel: string }[] = [
  { id: 'coverLetter', label: 'Cover Letter', docFormat: 'docx', fileLabel: 'Cover-Letter' },
  { id: 'tailoredResume', label: 'Tailored Resume', docFormat: 'docx', fileLabel: 'Resume' },
  { id: 'interviewQuestions', label: 'Interview Prep', docFormat: 'txt', fileLabel: 'Interview-Prep' },
  { id: 'companyBrief', label: 'Company Brief', docFormat: 'txt', fileLabel: 'Company-Brief' },
  { id: 'outreachEmail', label: 'Email', docFormat: 'txt', fileLabel: 'Outreach-Email' },
];

export function GeneratedDocs({ generated, company, title, recruiterEmail, onGenerate, generatingKind }: Props) {
  const [activeTab, setActiveTab] = useState<DocKind>('coverLetter');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const tab = TABS.find((t) => t.id === activeTab)!;
  const content = generated?.[activeTab] ?? '';
  const hasContent = content.trim().length > 0;
  const isGenerating = generatingKind === activeTab;

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleOpenInGmail() {
    const { subject, body } = splitEmail(content);
    const params = new URLSearchParams({ view: 'cm', fs: '1' });
    if (recruiterEmail) params.set('to', recruiterEmail);
    if (subject) params.set('su', subject);
    params.set('body', body || content);
    window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  async function handleDownload() {
    setSaving(true);
    try {
      const base = [company, title, tab.fileLabel].filter(Boolean).join('-') || tab.fileLabel;
      if (tab.docFormat === 'docx') {
        await downloadDocx(content, base, activeTab === 'tailoredResume' ? 'resume' : 'plain');
      } else {
        await downloadTxt(content, base);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs — a dot marks docs already generated */}
      <div className="flex flex-wrap gap-1 p-1 bg-surface-1 border border-hairline rounded-lg edge-top">
        {TABS.map((t) => {
          const done = (generated?.[t.id] ?? '').trim().length > 0;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all
                ${activeTab === t.id ? 'bg-surface-3 text-ink edge-top' : 'text-ink-subtle hover:text-ink'}`}
            >
              {done && <span className="text-[8px] text-success">●</span>}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="relative bg-surface-2 border border-hairline rounded-xl p-5 edge-top animate-fade-up min-h-[120px]">
        {hasContent && !isGenerating && (
          <>
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              {activeTab === 'outreachEmail' && (
                <button
                  onClick={handleOpenInGmail}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border
                             bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 transition-all"
                  title="Open a Gmail compose window with this email pre-filled"
                >
                  ✉ Open in Gmail
                </button>
              )}
              <button
                onClick={() => onGenerate(activeTab)}
                className="text-[11px] px-2.5 py-1 rounded-md border bg-surface-3 border-hairline
                           text-ink-subtle hover:text-ink transition-all"
                title="Regenerate this document"
              >
                ↻ Redo
              </button>
              <button
                onClick={handleCopy}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-all
                  ${copied
                    ? 'bg-success/15 border-success/40 text-success'
                    : 'bg-surface-3 border-hairline text-ink-subtle hover:text-ink'
                  }`}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                disabled={saving}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border
                           bg-surface-3 border-hairline text-ink-subtle hover:text-ink transition-all
                           disabled:opacity-50"
                title={`Download as .${tab.docFormat}`}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1.5v6m0 0L3.5 5M6 7.5 8.5 5M2 9.5v.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-.5"
                        stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {saving ? 'Saving…' : `.${tab.docFormat}`}
              </button>
            </div>
            <pre
              className="text-[13px] text-ink-muted whitespace-pre-wrap font-sans leading-[1.7] pr-40 mt-1"
              style={{ letterSpacing: '-0.003em' }}
            >
              {content}
            </pre>
          </>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <span className="animate-spin-slow text-2xl text-primary-hover">⟳</span>
            <p className="text-xs text-ink-subtle">Generating {tab.label.toLowerCase()}…</p>
          </div>
        )}

        {!hasContent && !isGenerating && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="text-[13px] text-ink-subtle">
              {tab.label} not generated yet.
            </p>
            <button
              onClick={() => onGenerate(activeTab)}
              className="flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary-hover
                         text-white text-[12px] font-medium rounded-md transition-all edge-top-strong
                         active:scale-[0.98]"
            >
              <span className="text-primary-hover" style={{ filter: 'brightness(2)' }}>✦</span>
              Generate {tab.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

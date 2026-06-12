import { useState } from 'react';
import type { GeneratedContent } from '../../types';
import { downloadDocx, downloadTxt } from '../../lib/download';

interface Props {
  generated: GeneratedContent;
  company: string;
  title: string;
}

type DocTab = 'coverLetter' | 'tailoredResume' | 'interviewQuestions' | 'companyBrief';

const TABS: { id: DocTab; label: string; docFormat: 'docx' | 'txt'; fileLabel: string }[] = [
  { id: 'coverLetter', label: 'Cover Letter', docFormat: 'docx', fileLabel: 'Cover-Letter' },
  { id: 'tailoredResume', label: 'Tailored Resume', docFormat: 'docx', fileLabel: 'Resume' },
  { id: 'interviewQuestions', label: 'Interview Prep', docFormat: 'txt', fileLabel: 'Interview-Prep' },
  { id: 'companyBrief', label: 'Company Brief', docFormat: 'txt', fileLabel: 'Company-Brief' },
];

export function GeneratedDocs({ generated, company, title }: Props) {
  const [activeTab, setActiveTab] = useState<DocTab>('coverLetter');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const tab = TABS.find((t) => t.id === activeTab)!;
  const content = generated[activeTab];

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-surface-1 border border-hairline rounded-lg edge-top">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all
              ${activeTab === t.id
                ? 'bg-surface-3 text-ink edge-top'
                : 'text-ink-subtle hover:text-ink'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative bg-surface-2 border border-hairline rounded-xl p-5 edge-top animate-fade-up">
        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
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
          className="text-[13px] text-ink-muted whitespace-pre-wrap font-sans leading-[1.7] pr-28 mt-1"
          style={{ letterSpacing: '-0.003em' }}
        >
          {content}
        </pre>
      </div>
    </div>
  );
}

export type ColumnId = 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface GeneratedContent {
  coverLetter: string;
  tailoredResume: string;
  interviewQuestions: string;
  companyBrief: string;
  outreachEmail: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  rawText: string;
  summary: string;
  column: ColumnId;
  createdAt: string;
  /** When the job last moved to its current column (for the "days in stage" cue).
   *  Client-only/optimistic; falls back to createdAt when absent. */
  stageChangedAt?: string;
  generated?: GeneratedContent;
}

export interface SearchPrefs {
  role: string;
  location: string;
  workMode: 'any' | 'remote' | 'onsite' | 'hybrid';
  employmentTypes: string[];
  seniority: string;
  salary: string;
  datePosted: 'any' | '24h' | '3d' | 'week' | 'month';
}

export interface JobSearchResult {
  title: string;
  company: string;
  location: string;
  url: string;
  employmentType: string;
  summary: string;
  fit: string;
  posted: string; // how recently posted, e.g. "2 days ago" — best-effort, may be ''
  source?: string; // real-API only: where the posting came from, e.g. "LinkedIn" or "greenhouse.io"
  description?: string; // real-API only: the FULL job description (used as rawText for tailoring)
}

export type AIProvider = 'openrouter' | 'claude' | 'openai';

export interface Settings {
  apiKey: string;
  provider: AIProvider;
  resumeText: string;
  resumeFileName: string;
}

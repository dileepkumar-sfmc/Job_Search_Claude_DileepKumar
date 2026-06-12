export type ColumnId = 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface GeneratedContent {
  coverLetter: string;
  tailoredResume: string;
  interviewQuestions: string;
  companyBrief: string;
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
  generated?: GeneratedContent;
}

export interface SearchPrefs {
  role: string;
  location: string;
  workMode: 'any' | 'remote' | 'onsite' | 'hybrid';
  employmentTypes: string[];
  seniority: string;
  salary: string;
}

export interface JobSearchResult {
  title: string;
  company: string;
  location: string;
  url: string;
  employmentType: string;
  summary: string;
  fit: string;
}

export type AIProvider = 'openrouter' | 'claude' | 'openai';

export interface Settings {
  apiKey: string;
  provider: AIProvider;
  resumeText: string;
  resumeFileName: string;
}

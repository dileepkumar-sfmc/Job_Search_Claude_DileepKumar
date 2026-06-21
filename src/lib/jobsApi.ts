import type { SearchPrefs, JobSearchResult } from '../types';

// Real job listings via JSearch (RapidAPI) — aggregates Google for Jobs, so every
// result is an actual open posting with a working apply link. Unlike the AI search,
// nothing here is synthesized: titles, employers, and URLs come straight from the
// provider. The user supplies their own RapidAPI key (stored locally, never synced).

const JSEARCH_HOST = 'jsearch.p.rapidapi.com';

// SearchPrefs.datePosted → JSearch `date_posted`.
const DATE_MAP: Record<SearchPrefs['datePosted'], string> = {
  any: 'all',
  '24h': 'today',
  '3d': '3days',
  week: 'week',
  month: 'month',
};

// Our employment-type labels → JSearch `employment_types`.
const EMP_MAP: Record<string, string> = {
  'Full-time': 'FULLTIME',
  'Contract/C2C': 'CONTRACTOR',
  'Part-time': 'PARTTIME',
  Internship: 'INTERN',
};

interface JSearchJob {
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_apply_link?: string;
  job_publisher?: string;
  job_employment_type?: string;
  job_description?: string;
  job_posted_at_datetime_utc?: string;
}

/** Prefer the publisher name; fall back to the apply-link's domain. */
function sourceLabel(j: JSearchJob): string {
  if (j.job_publisher?.trim()) return j.job_publisher.trim();
  try {
    return new URL(j.job_apply_link || '').hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function relativePosted(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
}

function composeLocation(j: JSearchJob): string {
  if (j.job_is_remote) return 'Remote';
  return [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ');
}

/** Search real, currently-open job postings. Returns listings with working links. */
export async function searchRealJobs(
  apiKey: string,
  prefs: SearchPrefs,
  limit = 20
): Promise<JobSearchResult[]> {
  if (!apiKey) throw new Error('Add a RapidAPI (JSearch) key in Settings to fetch real jobs.');

  // JSearch takes a single free-text query; fold role + location into it.
  const queryParts = [prefs.role.trim() || 'developer'];
  if (prefs.seniority.trim()) queryParts.unshift(prefs.seniority.trim());
  if (prefs.location.trim()) queryParts.push(`in ${prefs.location.trim()}`);

  const params = new URLSearchParams({
    query: queryParts.join(' '),
    page: '1',
    num_pages: '1',
    date_posted: DATE_MAP[prefs.datePosted],
  });
  if (prefs.workMode === 'remote') params.set('remote_jobs_only', 'true');
  const empTypes = prefs.employmentTypes.map((t) => EMP_MAP[t]).filter(Boolean);
  if (empTypes.length) params.set('employment_types', empTypes.join(','));

  let res: Response;
  try {
    res = await fetch(`https://${JSEARCH_HOST}/search?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': JSEARCH_HOST },
    });
  } catch {
    throw new Error('Network error reaching the jobs API.');
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Jobs API rejected the key — check your RapidAPI key in Settings.');
  }
  if (res.status === 429) {
    throw new Error('Jobs API rate limit hit — wait a bit or upgrade your RapidAPI plan.');
  }
  if (!res.ok) throw new Error(`Jobs API error (${res.status}).`);

  const json = (await res.json()) as { data?: JSearchJob[] };
  const jobs = Array.isArray(json.data) ? json.data : [];

  return jobs.slice(0, limit).map((j) => ({
    title: j.job_title?.trim() || 'Untitled role',
    company: j.employer_name?.trim() || 'Unknown company',
    location: composeLocation(j),
    url: j.job_apply_link?.trim() || '',
    employmentType: j.job_employment_type
      ? j.job_employment_type.charAt(0) + j.job_employment_type.slice(1).toLowerCase()
      : '',
    summary: (j.job_description || '').replace(/\s+/g, ' ').trim().slice(0, 280),
    fit: '', // real listings carry no AI fit narrative
    posted: relativePosted(j.job_posted_at_datetime_utc),
    source: sourceLabel(j),
    description: (j.job_description || '').trim(), // full real JD — feeds tailoring
  }));
}

// --- Remotive: a free, NO-KEY real-jobs source (remote roles only) -----------
// Public API, no signup. Coverage is remote-only and smaller than JSearch, but
// every result is a real posting with a working URL — a good zero-setup default.

const MAX_DAYS: Record<SearchPrefs['datePosted'], number> = {
  any: 9999,
  '24h': 1,
  '3d': 3,
  week: 7,
  month: 31,
};

// Our employment labels → Remotive `job_type` values.
const REMOTIVE_TYPES: Record<string, string[]> = {
  'Full-time': ['full_time'],
  'Contract/C2C': ['contract', 'freelance'],
  'Part-time': ['part_time'],
  Internship: ['internship'],
};

interface RemotiveJob {
  url?: string;
  title?: string;
  company_name?: string;
  candidate_required_location?: string;
  job_type?: string;
  category?: string;
  publication_date?: string;
  description?: string;
}

// Remotive's `search` param matches loosely (returns off-target roles), so we
// re-filter on the role keywords client-side. Drop seniority filler words and
// require at least one meaningful term to appear in the title or category.
const ROLE_FILLER = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal', 'mid', 'entry', 'level',
]);

// Generic role-type words that appear in nearly every job title. If the user
// query contains a SPECIFIC discriminator (Java, Salesforce, DevOps, etc.),
// matching only on these would let everything through ("Java Developer" must
// not return "Frontend Developer"). Used to split tokens into specific vs generic.
const ROLE_GENERIC = new Set([
  'developer', 'engineer', 'engineering', 'programmer', 'architect',
  'analyst', 'specialist', 'consultant', 'manager', 'coordinator',
  'administrator', 'admin',
]);

function roleTokens(role: string): string[] {
  return role
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length >= 3 && !ROLE_FILLER.has(t));
}

/**
 * Pass only when the candidate's title/category contains at least one of the
 * SPECIFIC (non-generic) tokens — e.g. "Java Developer" requires "java" to
 * appear, not just "developer". If the query has no specific tokens (e.g. user
 * typed only "Developer"), fall back to matching any token.
 */
function matchesRole(hay: string, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const h = hay.toLowerCase();
  const specific = tokens.filter((t) => !ROLE_GENERIC.has(t));
  const required = specific.length ? specific : tokens;
  return required.some((t) => h.includes(t));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Search real remote postings via Remotive — no API key required. */
export async function searchRemotiveJobs(prefs: SearchPrefs, limit = 20): Promise<JobSearchResult[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (prefs.role.trim()) params.set('search', prefs.role.trim());

  let res: Response;
  try {
    res = await fetch(`https://remotive.com/api/remote-jobs?${params.toString()}`);
  } catch {
    throw new Error('Network error reaching the jobs source.');
  }
  if (!res.ok) throw new Error(`Jobs source error (${res.status}).`);

  const json = (await res.json()) as { jobs?: RemotiveJob[] };
  let jobs = Array.isArray(json.jobs) ? json.jobs : [];

  // Re-filter Remotive's loose search down to titles actually matching the role.
  const tokens = roleTokens(prefs.role);
  if (tokens.length) jobs = jobs.filter((j) => matchesRole(`${j.title ?? ''} ${j.category ?? ''}`, tokens));

  // Client-side filters Remotive's simple API doesn't expose.
  const wantTypes = prefs.employmentTypes.flatMap((t) => REMOTIVE_TYPES[t] ?? []);
  if (wantTypes.length) jobs = jobs.filter((j) => j.job_type && wantTypes.includes(j.job_type));

  const maxDays = MAX_DAYS[prefs.datePosted];
  if (maxDays < 9999) {
    jobs = jobs.filter((j) => {
      if (!j.publication_date) return false;
      const days = (Date.now() - new Date(j.publication_date).getTime()) / 86_400_000;
      return days <= maxDays;
    });
  }

  return jobs.slice(0, limit).map((j) => {
    const full = stripHtml(j.description || '');
    return {
      title: j.title?.trim() || 'Untitled role',
      company: j.company_name?.trim() || 'Unknown company',
      location: j.candidate_required_location?.trim() || 'Remote',
      url: j.url?.trim() || '',
      employmentType: j.job_type ? j.job_type.replace('_', '-') : '',
      summary: full.slice(0, 280),
      fit: '',
      posted: relativePosted(j.publication_date),
      source: 'Remotive',
      description: full,
    };
  });
}

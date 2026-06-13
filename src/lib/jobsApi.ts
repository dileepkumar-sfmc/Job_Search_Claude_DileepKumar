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
  job_employment_type?: string;
  job_description?: string;
  job_posted_at_datetime_utc?: string;
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
  }));
}

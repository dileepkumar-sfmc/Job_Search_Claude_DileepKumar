import type { SearchPrefs } from '../types';

export interface BoardLink {
  name: string;
  url: string;
}

// Map our preference fields onto each board's real search-filter query params,
// so a click opens the board pre-filtered exactly like a manual search. Verified
// against a live Dice URL: postedDate=ONE, employmentType=CONTRACTS,
// workplaceTypes=Remote, q=senior+java+developer.

const DICE_POSTED: Partial<Record<SearchPrefs['datePosted'], string>> = {
  '24h': 'ONE',
  '3d': 'THREE',
  week: 'SEVEN',
  // 'month' has no exact Dice bucket — omit the filter (shows all recent).
};
const DICE_EMP: Record<string, string> = {
  'Full-time': 'FULLTIME',
  'Contract/C2C': 'CONTRACTS',
  'Part-time': 'PARTTIME',
};
const DICE_WORKPLACE: Partial<Record<SearchPrefs['workMode'], string>> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-Site',
};

// LinkedIn time-posted is "recent within N seconds".
const LI_TPR: Partial<Record<SearchPrefs['datePosted'], string>> = {
  '24h': 'r86400',
  '3d': 'r259200',
  week: 'r604800',
  month: 'r2592000',
};
const LI_WT: Partial<Record<SearchPrefs['workMode'], string>> = {
  onsite: '1',
  remote: '2',
  hybrid: '3',
};
const LI_JT: Record<string, string> = {
  'Full-time': 'F',
  'Contract/C2C': 'C',
  'Part-time': 'P',
  Internship: 'I',
};

// Indeed "fromage" is a number of days.
const INDEED_DAYS: Partial<Record<SearchPrefs['datePosted'], string>> = {
  '24h': '1',
  '3d': '3',
  week: '7',
  month: '14',
};

// Google for Jobs uses `ibp=htl;jobs` to land in the Jobs tab and `chips=key:value,...`
// for structured filters. Date + employment type ride in chips; role/location/work
// mode go in the natural-language query so Google's NLP also picks them up.
const GOOGLE_DATE: Partial<Record<SearchPrefs['datePosted'], string>> = {
  '24h': 'today',
  '3d': '3days',
  week: 'week',
  month: 'month',
};
const GOOGLE_EMP: Record<string, string> = {
  'Full-time': 'FULLTIME',
  'Contract/C2C': 'CONTRACTOR',
  'Part-time': 'PARTTIME',
  Internship: 'INTERN',
};

/**
 * A reliable "find this exact posting" link. AI search often returns fabricated
 * or stale direct URLs that 404; a Google query for the title + company always
 * loads and surfaces the real listing across whatever board hosts it.
 */
export function jobSearchUrl(title: string, company: string, location = ''): string {
  const terms = [title && `"${title}"`, company && `"${company}"`, location, 'job']
    .filter(Boolean)
    .join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
}

export function buildBoardLinks(p: SearchPrefs): BoardLink[] {
  const q = p.role.trim() || 'jobs';
  const loc = p.location.trim();

  // --- Dice ---
  const dice = new URLSearchParams({ q });
  if (DICE_POSTED[p.datePosted]) dice.set('filters.postedDate', DICE_POSTED[p.datePosted]!);
  const diceEmp = p.employmentTypes.map((t) => DICE_EMP[t]).filter(Boolean);
  if (diceEmp.length) dice.set('filters.employmentType', diceEmp.join('|'));
  if (DICE_WORKPLACE[p.workMode]) dice.set('filters.workplaceTypes', DICE_WORKPLACE[p.workMode]!);
  if (loc) dice.set('location', loc);

  // --- LinkedIn ---
  const li = new URLSearchParams({ keywords: q });
  if (loc) li.set('location', loc);
  if (LI_TPR[p.datePosted]) li.set('f_TPR', LI_TPR[p.datePosted]!);
  if (LI_WT[p.workMode]) li.set('f_WT', LI_WT[p.workMode]!);
  const liJt = p.employmentTypes.map((t) => LI_JT[t]).filter(Boolean);
  if (liJt.length) li.set('f_JT', liJt.join(','));

  // --- Indeed (simpler filter set; fold remote into the query) ---
  const indeed = new URLSearchParams({ q: p.workMode === 'remote' ? `${q} remote` : q });
  if (loc) indeed.set('l', loc);
  if (INDEED_DAYS[p.datePosted]) indeed.set('fromage', INDEED_DAYS[p.datePosted]!);

  // --- Google Jobs (aggregator — broadest coverage; pulls from every JobPosting-
  //     tagged page on the web). Free, no API, no scraping; just a deep-link. ---
  const gParts = [q];
  if (p.employmentTypes.includes('Contract/C2C')) gParts.push('contract');
  if (p.workMode === 'remote') gParts.push('remote');
  if (loc) gParts.push(`in ${loc}`);
  gParts.push('jobs');
  const google = new URLSearchParams({ q: gParts.join(' '), ibp: 'htl;jobs' });
  const gChips: string[] = [];
  if (GOOGLE_DATE[p.datePosted]) gChips.push(`date_posted:${GOOGLE_DATE[p.datePosted]}`);
  const gEmp = p.employmentTypes.map((t) => GOOGLE_EMP[t]).filter(Boolean);
  if (gEmp.length === 1) gChips.push(`employment_type:${gEmp[0]}`); // Google takes one
  if (gChips.length) google.set('chips', gChips.join(','));

  return [
    { name: 'Google Jobs', url: `https://www.google.com/search?${google.toString()}` },
    { name: 'Dice', url: `https://www.dice.com/jobs?${dice.toString()}` },
    { name: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?${li.toString()}` },
    { name: 'Indeed', url: `https://www.indeed.com/jobs?${indeed.toString()}` },
  ];
}

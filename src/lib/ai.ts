import type { GeneratedContent, AIProvider, SearchPrefs, JobSearchResult } from '../types';

/** The four documents that can be generated, individually or all at once. */
export type DocKind = keyof GeneratedContent;

// Per-document specs, single-sourced so generateAll (JSON) and generateDoc
// (single plain-text) stay in sync. The resume spec is the prompt half of the
// prompt↔renderer contract with buildResumeDocx in lib/download.ts — change both
// together.
const COVER_SPEC = 'A professional, tailored cover letter (3-4 paragraphs).';

const RESUME_SPEC = `The candidate's resume rewritten to maximize match with THIS job while staying 100% truthful. It MUST follow this EXACT structure and conventions so it parses cleanly into an ATS and into a Word document. Output as plain text — NO tables, columns, text boxes, graphics, markdown symbols (no #, *, **), or emojis. Single column only.

  STRUCTURE (in this order):
  Line 1: The candidate's full name only.
  Line 2: A professional title/headline aligned to THIS job's role, in the form "<Role Title> | <focus area>" (e.g. "Senior QA Analyst | Mobile Functional Testing" or "Salesforce Marketing Cloud Developer | AMPscript & Journey Builder"). Use the TARGET job's role title and focus ONLY when the candidate's resume genuinely supports that background (their real experience clearly maps to that role); if the resume does not match the target role, use the candidate's actual professional title instead. Never claim a role or specialization the resume doesn't back up. This line must NOT contain a pipe-separated contact list — it is the headline only.
  Line 3: Contact info on one line, pipe-separated: phone  |  email  |  location  |  linkedin. Take ALL of these — phone, email, location, and linkedin — EXACTLY as they appear in the source resume. Never substitute or invent a number or link. If the resume lists more than one profile link (e.g. LinkedIn plus a Trailblazer/portfolio URL), include them too, pipe-separated.
  Then a blank line, then these sections. Each section heading goes ALONE on its own line in Title Case, EXACTLY: "Professional Summary", "Technical Skills", "Professional Experience", "Education" (add "Certifications" only if the source has them). Omit a section only if the source has zero data for it.

  Professional Summary: 6-12 concise qualification statements, each on its own line and PREFIXED WITH "- " (a plain hyphen + space) so the renderer formats them as ATS-safe bullet points. Lead with the ones most relevant to this job; weave in the job's key title and required technologies wherever the candidate genuinely has them. Start each bullet with a strong noun phrase or trait (e.g. "Salesforce Certified…", "Hands-on…", "Proven record of…") so the section scans cleanly.

  Technical Skills: one category per line in the form "Category: item, item, item". Reorder the categories and the items within them so the skills this job emphasizes appear first. Mirror the job description's exact keywords/phrasing where the candidate truthfully has the skill. Never invent skills.

  Professional Experience: reverse-chronological. For EACH role, output these lines exactly:
    Client: <Company>, <Location> | <Start> – <End>
    Role: <Title>
    Description: <one or two sentence context> (include only if the source has it)
    Responsibilities:
    - <bullet starting with a strong action verb, quantified where the source supports it>
    - <...more bullets...>
    Each role MUST have AT LEAST 10 responsibility bullets. Mine the source resume for this role and reasonably infer standard duties the candidate genuinely performed, prioritizing the skills, tools, and outcomes THIS job description asks for. Keep every bullet truthful — reframe and expand real work, never fabricate roles, employers, or accomplishments.
    Environment: <comma-separated tech list — surface the technologies this job asks for that the candidate truly used>
  Reframe/reorder bullets and the Environment list to surface what THIS job values most. Keep every company, title, location, and date exactly as in the source.

  Education: take the degrees, schools, and years EXACTLY from the source resume (one per line, form "Degree — School, Year"), reverse-chronological. Never invent or substitute a school, degree, or year the resume does not list. If the source resume contains NO education entries at all, OMIT the entire Education section from the output — do not fabricate one, do not guess based on the candidate's name or background, and do not insert placeholders.

  Certifications: if the source resume lists certifications, include a "Certifications" section and list each certification on its own line, exactly as named in the resume (most relevant to THIS job first). Omit the section entirely if the resume has none.`;

const INTERVIEW_SPEC = '10 likely interview questions with brief answer guidance for each.';

const BRIEF_SPEC = 'A 1-page brief on the company — mission, culture, recent highlights from the job description, and why this role matters.';

const EMAIL_SPEC = `A warm, natural, HUMAN-sounding email to the recruiter or hiring contact for THIS job. It must read like a real person wrote it in two minutes - NOT like AI. Do NOT use generic filler like "I am interested in this position", "I am writing to express my interest", or "I am excited about this opportunity". Be specific and conversational, reacting to the ACTUAL role and tech. It MUST paste cleanly into Gmail: output PLAIN TEXT ONLY - no markdown, asterisks, bold, numbered or bulleted lists, or "Label: value" lines, and no em/en dashes (use a plain hyphen "-" only). Keep it short, simple, and straight to the point, clearly tailored to THIS job description. Structure:

  Subject: "Subject: <role title> - <Candidate Name>". Add a "Re: " prefix ONLY if the posting is clearly a message the recruiter personally sent the candidate (a genuine reply).

  Greeting: "Hi <recruiter first name if the posting names one, otherwise 'there'>,".

  Opening: 1-2 sentences, and pick the framing HONESTLY based on the posting. If the posting reads like a recruiter personally reached out to the candidate (it is a recruiter's message, says "I have an opening", or asks the candidate to share their resume/details), open by thanking them for reaching out. If it is just a job description the candidate found on their own, do NOT pretend they contacted you - instead open by noting you came across the <role title> opening at <company> and that it caught your eye as a strong match. Either way, name the actual role and a key technology from the JD so it feels genuine, not templated. NEVER thank them for reaching out unless the posting clearly shows they did.

  Body: ONE natural paragraph (2-4 sentences) connecting the candidate's real, resume-backed experience to the specific skills and tools THIS job emphasizes. Mention total years of experience and 2-3 of the most relevant technologies by name. Truthful only - never claim a skill the resume does not show.

  Logistics: ONE short conversational sentence that works the key details in naturally (NOT as a labeled list): that the candidate is based in <city, state from the resume>, is on H1B with no sponsorship needed, and is open to C2C at market rate.

  Closing: a friendly line offering to talk, with availability (weekdays, flexible after 10 AM EST).

  Then a blank line, then the sign-off, each on its own line:
  Thanks,
  <candidate full name>
  <candidate's mobile number exactly as it appears in the resume>
  <email from resume>
  <linkedin from resume>

  Do NOT include any "Reason for Change" or "Best Fit" section, and do NOT use labeled detail lines or a skill-by-skill list. Keep the whole email under ~150 words before the signature.`;

const DOC_SPEC: Record<DocKind, string> = {
  coverLetter: COVER_SPEC,
  tailoredResume: RESUME_SPEC,
  interviewQuestions: INTERVIEW_SPEC,
  companyBrief: BRIEF_SPEC,
  outreachEmail: EMAIL_SPEC,
};

const SYSTEM_PROMPT = `You are a professional career coach, resume writer, and ATS (Applicant Tracking System) optimization expert.
Given a job description and a candidate's resume, produce five outputs in a single JSON response.
Return ONLY valid JSON with this exact structure:
{
  "coverLetter": "...",
  "tailoredResume": "...",
  "interviewQuestions": "...",
  "companyBrief": "...",
  "outreachEmail": "..."
}

- coverLetter: ${COVER_SPEC}

- tailoredResume: ${RESUME_SPEC}

- interviewQuestions: ${INTERVIEW_SPEC}

- companyBrief: ${BRIEF_SPEC}

- outreachEmail: ${EMAIL_SPEC}`;

// System prompt for generating ONE document as plain text (no JSON wrapper).
function singleDocPrompt(kind: DocKind): string {
  return `You are a professional career coach, resume writer, and ATS (Applicant Tracking System) optimization expert.
Given a job description and a candidate's resume, produce ONLY the document described below.
Output it as plain text — no JSON, no markdown fences, no preamble, no commentary, just the document content.

${DOC_SPEC[kind]}`;
}

function buildUserMessage(jobText: string, resumeText: string): string {
  return `JOB DESCRIPTION:\n${jobText}\n\n---\n\nMY RESUME:\n${resumeText}`;
}

// OpenRouter — OpenAI-compatible, routes to any model
async function callOpenRouter(
  apiKey: string,
  model: string,
  jobText: string,
  resumeText: string
): Promise<GeneratedContent> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://job-search-copilot.local',
      'X-Title': 'Job Search Copilot',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(jobText, resumeText) },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${err}`);
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const text = data.choices[0]?.message?.content ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in OpenRouter response');
  return JSON.parse(jsonMatch[0]) as GeneratedContent;
}

async function callClaude(apiKey: string, jobText: string, resumeText: string): Promise<GeneratedContent> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(jobText, resumeText) }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json() as { content: Array<{ text: string }> };
  const text = data.content[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  return JSON.parse(jsonMatch[0]) as GeneratedContent;
}

async function callOpenAI(apiKey: string, jobText: string, resumeText: string): Promise<GeneratedContent> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 8192,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(jobText, resumeText) },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const text = data.choices[0]?.message?.content ?? '';
  return JSON.parse(text) as GeneratedContent;
}

export async function generateAll(
  provider: AIProvider,
  apiKey: string,
  jobText: string,
  resumeText: string,
  openRouterModel = 'anthropic/claude-sonnet-4-6'
): Promise<GeneratedContent> {
  if (!apiKey) throw new Error('No API key configured. Open Settings to add one.');
  if (!resumeText) throw new Error('No resume found. Open Settings to upload your resume.');
  if (provider === 'openrouter') return callOpenRouter(apiKey, openRouterModel, jobText, resumeText);
  if (provider === 'claude') return callClaude(apiKey, jobText, resumeText);
  return callOpenAI(apiKey, jobText, resumeText);
}

// Provider call that returns raw plain text (for single-document generation).
async function callProviderText(
  provider: AIProvider,
  apiKey: string,
  system: string,
  user: string,
  openRouterModel: string
): Promise<string> {
  if (provider === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: Array<{ text: string }> };
    return data.content[0]?.text ?? '';
  }

  const url = provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://job-search-copilot.local';
    headers['X-Title'] = 'Job Search Copilot';
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider === 'openai' ? 'gpt-4o' : openRouterModel,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${provider} API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

/** Generate a SINGLE document (cheaper/faster when you don't need all four). */
export async function generateDoc(
  provider: AIProvider,
  apiKey: string,
  kind: DocKind,
  jobText: string,
  resumeText: string,
  openRouterModel = 'anthropic/claude-sonnet-4-6'
): Promise<string> {
  if (!apiKey) throw new Error('No API key configured. Open Settings to add one.');
  if (!resumeText) throw new Error('No resume found. Open Settings to upload your resume.');
  const text = await callProviderText(
    provider,
    apiKey,
    singleDocPrompt(kind),
    buildUserMessage(jobText, resumeText),
    openRouterModel
  );
  return text.trim();
}

// Live job search via OpenRouter (Perplexity Sonar models have web access).
export async function searchJobs(
  apiKey: string,
  model: string,
  prefs: SearchPrefs,
  resumeText: string
): Promise<JobSearchResult[]> {
  if (!apiKey) throw new Error('No API key configured. Add your OpenRouter key in Settings.');

  const DATE_WINDOW: Record<Exclude<SearchPrefs['datePosted'], 'any'>, string> = {
    '24h': 'the last 24 hours',
    '3d': 'the last 3 days',
    week: 'the last 7 days',
    month: 'the last 30 days',
  };

  // Hard requirements — every result MUST satisfy these.
  const must: string[] = [];
  if (prefs.location) {
    must.push(`Location: the role must be based in or explicitly hiring for "${prefs.location}". Exclude roles located anywhere else.`);
  }
  if (prefs.workMode && prefs.workMode !== 'any') {
    must.push(`Work mode: only ${prefs.workMode} roles. Exclude any posting that is not ${prefs.workMode}.`);
  }
  if (prefs.datePosted && prefs.datePosted !== 'any') {
    must.push(`Recency: only postings published within ${DATE_WINDOW[prefs.datePosted]}. Omit anything older or with no determinable post date.`);
  }

  // Soft preferences — rank by these, but they are not exclusionary.
  const prefer: string[] = [];
  if (prefs.role) prefer.push(`Target role: ${prefs.role}`);
  if (prefs.employmentTypes.length) prefer.push(`Employment type: ${prefs.employmentTypes.join(', ')}`);
  if (prefs.seniority) prefer.push(`Seniority: ${prefs.seniority}`);
  if (prefs.salary) prefer.push(`Salary target: ${prefs.salary}`);

  const system = `You are a job-search assistant with live web access. Find CURRENT, real job openings for the candidate.
Return ONLY a JSON array (no prose, no markdown fences). Each item must be:
{"title":"","company":"","location":"","url":"","employmentType":"","summary":"","fit":"","posted":""}
- The HARD REQUIREMENTS in the user message are MANDATORY: every result must satisfy ALL of them. Never include a role that violates them, and never pad the list — return fewer results (even zero) instead of off-target ones.
- posted: how recently it was posted, e.g. "2 days ago" or "2024-06-10". Use "" only if you truly cannot determine it.
- url: a direct link to the live posting when available; otherwise the company's careers page. Never invent URLs.
- employmentType: e.g. "Full-time", "Contract", "C2C", "Part-time".
- summary: 1-2 sentences on the role. fit: one sentence on why it matches THIS candidate.
Return up to 12 results. If you cannot verify a real posting that meets every hard requirement, omit it rather than fabricate or substitute a non-matching role.`;

  const user = `HARD REQUIREMENTS (every result must satisfy all of these):
${must.length ? must.join('\n') : '(none specified)'}

PREFERENCES (rank results by these):
${prefer.length ? prefer.join('\n') : '(infer sensible defaults from the resume)'}

CANDIDATE RESUME:
${resumeText.slice(0, 4000) || '(no resume provided — use the preferences above)'}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://job-search-copilot.local',
      'X-Title': 'Job Search Copilot',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Search failed (${res.status}): ${err}`);
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const text = data.choices[0]?.message?.content ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No results returned. Try broadening your search.');
  const parsed = JSON.parse(match[0]) as JobSearchResult[];
  return parsed
    .filter((j) => j && j.title && j.company)
    .filter((j) => matchesWorkMode(j, prefs.workMode));
}

// Conservative backstop for the work-mode requirement: when "remote" is asked
// for, drop only results that explicitly say on-site/in-office and never mention
// remote. Deliberately lenient so genuine matches aren't discarded; the prompt
// does the primary enforcement.
function matchesWorkMode(r: JobSearchResult, mode: SearchPrefs['workMode']): boolean {
  if (mode !== 'remote') return true;
  const hay = `${r.location} ${r.employmentType} ${r.summary}`.toLowerCase();
  const saysOnsite = /\bon-?site\b|\bin-office\b|\bin office\b/.test(hay);
  const saysRemote = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b/.test(hay);
  return !(saysOnsite && !saysRemote);
}

export async function extractJobMeta(
  provider: AIProvider,
  apiKey: string,
  jobText: string,
  openRouterModel = 'anthropic/claude-sonnet-4-6'
): Promise<{ title: string; company: string; location: string; summary: string }> {
  if (!apiKey) return { title: 'Untitled Role', company: 'Unknown Company', location: '', summary: '' };

  const prompt = `Extract job metadata from this posting. Return ONLY valid JSON:
{"title":"...","company":"...","location":"...","summary":"one sentence summary"}

JOB POSTING:
${jobText.slice(0, 3000)}`;

  try {
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://job-search-copilot.local',
          'X-Title': 'Job Search Copilot',
        },
        body: JSON.stringify({
          model: openRouterModel,
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      const text = data.choices[0]?.message?.content ?? '';
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } else if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json() as { content: Array<{ text: string }> };
      const text = data.content[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      return JSON.parse(data.choices[0]?.message?.content ?? '{}');
    }
  } catch {
    // fall through to defaults
  }
  return { title: 'New Role', company: 'Unknown Company', location: '', summary: '' };
}

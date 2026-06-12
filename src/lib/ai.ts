import type { GeneratedContent, AIProvider, SearchPrefs, JobSearchResult } from '../types';

const SYSTEM_PROMPT = `You are a professional career coach, resume writer, and ATS (Applicant Tracking System) optimization expert.
Given a job description and a candidate's resume, produce four outputs in a single JSON response.
Return ONLY valid JSON with this exact structure:
{
  "coverLetter": "...",
  "tailoredResume": "...",
  "interviewQuestions": "...",
  "companyBrief": "..."
}

- coverLetter: A professional, tailored cover letter (3-4 paragraphs).

- tailoredResume: The candidate's resume rewritten to maximize match with THIS job while staying 100% truthful. It MUST follow this EXACT structure and conventions so it parses cleanly into an ATS and into a Word document. Output as plain text — NO tables, columns, text boxes, graphics, markdown symbols (no #, *, **), or emojis. Single column only.

  STRUCTURE (in this order):
  Line 1: The candidate's full name only.
  Line 2: Contact info on one line, pipe-separated: phone  |  email  |  location  |  linkedin (use whatever the source resume provides).
  Then a blank line, then these sections. Each section heading goes ALONE on its own line in Title Case, EXACTLY: "Professional Summary", "Technical Skills", "Professional Experience", "Education" (add "Certifications" only if the source has them). Omit a section only if the source has zero data for it.

  Professional Summary: 6-12 concise qualification statements, ONE PER LINE (no bullet characters). Lead with the ones most relevant to this job; weave in the job's key title and required technologies wherever the candidate genuinely has them.

  Technical Skills: one category per line in the form "Category: item, item, item". Reorder the categories and the items within them so the skills this job emphasizes appear first. Mirror the job description's exact keywords/phrasing where the candidate truthfully has the skill. Never invent skills.

  Professional Experience: reverse-chronological. For EACH role, output these lines exactly:
    Client: <Company>, <Location> | <Start> – <End>
    Role: <Title>
    Description: <one or two sentence context> (include only if the source has it)
    Responsibilities:
    - <bullet starting with a strong action verb, quantified where the source supports it>
    - <...more bullets...>
    Environment: <comma-separated tech list — surface the technologies this job asks for that the candidate truly used>
  Reframe/reorder bullets and the Environment list to surface what THIS job values most. Keep every company, title, location, and date exactly as in the source.

  Education: one per line in the form "Degree — School, Year".

- interviewQuestions: 10 likely interview questions with brief answer guidance for each.

- companyBrief: A 1-page brief on the company — mission, culture, recent highlights from the job description, and why this role matters.`;

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

// Live job search via OpenRouter (Perplexity Sonar models have web access).
export async function searchJobs(
  apiKey: string,
  model: string,
  prefs: SearchPrefs,
  resumeText: string
): Promise<JobSearchResult[]> {
  if (!apiKey) throw new Error('No API key configured. Add your OpenRouter key in Settings.');

  const wants: string[] = [];
  if (prefs.role) wants.push(`Target role: ${prefs.role}`);
  if (prefs.location) wants.push(`Location: ${prefs.location}`);
  if (prefs.workMode && prefs.workMode !== 'any') wants.push(`Work mode: ${prefs.workMode}`);
  if (prefs.employmentTypes.length) wants.push(`Employment type: ${prefs.employmentTypes.join(', ')}`);
  if (prefs.seniority) wants.push(`Seniority: ${prefs.seniority}`);
  if (prefs.salary) wants.push(`Salary target: ${prefs.salary}`);

  const system = `You are a job-search assistant with live web access. Find CURRENT, real job openings that match the candidate's profile and preferences.
Return ONLY a JSON array (no prose, no markdown fences). Each item must be:
{"title":"","company":"","location":"","url":"","employmentType":"","summary":"","fit":""}
- url: a direct link to the live posting when available; otherwise the company's careers page. Never invent URLs.
- employmentType: e.g. "Full-time", "Contract", "C2C", "Part-time".
- summary: 1-2 sentences on the role.
- fit: one sentence on why it matches THIS candidate.
Return 8-12 results, preferring postings from roughly the last 30 days. If you cannot verify a real posting, omit it rather than fabricate.`;

  const user = `CANDIDATE PREFERENCES:
${wants.length ? wants.join('\n') : '(infer sensible defaults from the resume)'}

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
  return parsed.filter((j) => j && j.title && j.company);
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

/**
 * Return `url` only if it is a well-formed absolute http(s) link, otherwise
 * `undefined`.
 *
 * Job and search-result URLs come from untrusted sources — the web-search model
 * (subject to prompt injection from poisoned postings) and imported backup JSON.
 * Rendering an attacker-controlled `javascript:` or `data:` URL inside an
 * `href` is an XSS sink that can read the resume + API key out of localStorage.
 * Call this before any `href={...}` that uses such a value; render plain text
 * when it returns `undefined`.
 */
export function safeHttpUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

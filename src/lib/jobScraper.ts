export async function fetchJobFromUrl(url: string): Promise<string> {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
  const data = await res.json() as { contents?: string; status?: { http_code: number } };
  if (data.status?.http_code && data.status.http_code >= 400) {
    throw new Error(`Site returned ${data.status.http_code}`);
  }
  const html = data.contents ?? '';
  return stripHtml(html);
}

function stripHtml(html: string): string {
  // Remove scripts, styles, nav, header, footer
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n\n')
    .trim();
  // Return first ~8000 chars to stay within token limits
  return cleaned.slice(0, 8000);
}

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False on a clone with no Supabase env vars — the app shows a config notice. */
export const supabaseReady = Boolean(url && anonKey);

/**
 * Master switch for sign-in + cloud sync. While `false`, the app skips the
 * auth gate entirely and persists jobs/settings to localStorage (per-browser),
 * so it's usable without email setup. Flip to `true` to re-enable magic-link
 * auth + Supabase sync — on the first login, jobs saved locally are migrated up
 * automatically (see migrateLocalJobs in store/jobs.ts), so nothing is lost.
 */
export const AUTH_ENABLED = false;

// Single shared client. The session is persisted to localStorage and the
// magic-link redirect (?code=…) is parsed automatically on page load.
export const supabase = supabaseReady
  ? createClient(url as string, anonKey as string)
  : (null as never);

/**
 * The one email address allowed to sign in. This mirrors the RLS policy in the
 * database (the real enforcement) — the client-side check only exists to show a
 * clear "private board" message instead of a silently empty board.
 */
export const ALLOWED_EMAIL = 'dileep.official2@gmail.com';

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js is installed as a portable binary at `C:\tools\node-v22.13.0-win-x64`. It is not in the system PATH, so prefix all npm commands with the full path or use the wrapper script:

```powershell
# Dev server (uses dev.cmd wrapper that sets PATH)
$env:PATH = "C:\tools\node-v22.13.0-win-x64;$env:PATH"
npm run dev        # starts Vite at http://localhost:5173
npm run build      # tsc + vite build
npm run preview    # serve the production build
```

The dev server is also configured in `.claude/launch.json` for `preview_start "Vite Dev Server"`.

No test runner is configured yet.

## Architecture

Client-side React + TypeScript app with an optional **Supabase** backend (magic-link auth + synced jobs/settings) behind a single flag, **`AUTH_ENABLED` in `src/lib/supabase.ts`**. AI calls always go directly from the browser to the provider's API using the user's own key (never sent to Supabase). **Currently `AUTH_ENABLED = false`**: the app skips sign-in and persists jobs/settings to `localStorage` (per-browser). Flip it to `true` to gate behind sign-in + cloud sync — local jobs migrate up on first login. See **Backend (Supabase)** below.

### Environment / API keys
- Keys live in `server/.env` (gitignored). Vite reads this directory via `envDir: './server'` in `vite.config.ts`.
- `server/.env.example` documents the format — copy it to `server/.env` to get started.
- Primary provider is **OpenRouter** (`VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_MODEL`). Direct Anthropic and OpenAI keys are also supported.
- Env vars are loaded as defaults in `src/store/settings.ts`; the Settings UI can override them at runtime (stored in localStorage).
- **The API key only auto-loads in dev.** Vite inlines `VITE_*` into the bundle at build time, so shipping a built-in key would expose it to every visitor. `ENV_KEY` in `src/store/settings.ts` is gated behind `import.meta.env.DEV` — in a production build it constant-folds to `''` (verified: the key string does not appear in `dist/`). The non-secret model/provider env vars still load in prod; production users supply their own key via Settings. **Do not disable minification** for prod builds — key-stripping relies on dead-code elimination.
- The job-URL fetch (`src/lib/jobScraper.ts`) validates the URL is plain http(s) (no `javascript:`/`data:`/credentials) before routing it through the third-party CORS proxy. Untrusted URLs from AI search results / job cards are run through `safeHttpUrl()` (`src/lib/url.ts`) before being rendered as an `href` — anything else renders as plain text.
- **Restart the dev server** after editing `server/.env` — Vite only reads env vars on startup.

### Backend (Supabase)
- **`AUTH_ENABLED` flag** (`src/lib/supabase.ts`) gates everything here. When `false` (current), the stores branch to localStorage-only and `App.tsx` skips all auth/config gates; the Supabase code stays dormant. The store methods and `App` effects all check `AUTH_ENABLED` before touching Supabase.
- Client + config in `src/lib/supabase.ts` (env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — **publishable, safe to ship**; RLS protects data). `supabaseReady` is false on a clone with no env vars → App shows a config notice (only when `AUTH_ENABLED`).
- **Auth** (`src/store/auth.ts`) — passwordless **magic link** (`signInWithOtp`). The app is gated: `App.tsx` shows `SignIn` until `status === 'signed-in'`. Access is **locked to a single email** (`ALLOWED_EMAIL`) both client-side (UX) and in **RLS** (the real enforcement). On sign-in, `App` calls `jobs.load()` + `settings.load()`; on sign-out it calls `jobs.reset()`.
- **Tables** (migration `init_jobs_and_settings_with_rls`): `jobs` (the pipeline column is stored as **`status`** because `column` is reserved; `generated` is `jsonb`) and `user_settings`. Both have RLS = own rows AND `auth.jwt()->>'email' = ALLOWED_EMAIL`. To change the allowed user, update **both** `ALLOWED_EMAIL` and the RLS policies.
- **Mapping contract** (`src/store/jobs.ts`): `rowToJob`/`jobToRow`/`jobToRowPatch` translate `Job` ↔ row (`column`↔`status`, `rawText`↔`raw_text`, `createdAt`↔`created_at`). Keep these in sync with the `Job` type.
- **First sign-in migration**: `migrateLocalJobs()` pushes any pre-backend `localStorage['jsc-jobs']` up once (guarded by a `jsc-migrated` flag).

### State (Zustand)
- `src/store/jobs.ts` — Supabase-backed. Methods (`addJob`, `updateJob`, `moveJob`, `setGenerated`, `deleteJob`, `importJobs`) keep their original signatures but are now async with **optimistic updates + revert-on-error** (errors surface via `src/store/ui.ts` → the `SyncNotice` banner in `App.tsx`). No more localStorage persist for jobs.
- `src/store/settings.ts` — **API key stays local** (localStorage, never synced). `resumeText`, `resumeFileName`, `provider`, `openRouterModel`, `searchModel` write-through to `user_settings` and are reloaded via `load()` on sign-in.

Both stores are the single source of truth. Components read from these stores and never manage their own copies of jobs or settings.

### Data flow for adding a job
1. `AddJobModal` shows a single screen: optional URL field (fetches via CORS proxy in `lib/jobScraper.ts`) + paste-text area — both visible at once, no tabs.
2. Calls `extractJobMeta()` in `lib/ai.ts` (cheap/fast model call, returns `{title, company, location, summary}`)
3. Adds a `Job` object to the Zustand store — card appears on the board immediately.

### Data flow for AI generation
**All-at-once or per-document.** `JobDetailDrawer` offers both:
- **Generate All** → `generateAll()` in `lib/ai.ts`: one prompt, expects a JSON object with all six keys (`coverLetter`, `tailoredResume`, `interviewQuestions`, `companyBrief`, `outreachEmail`, `applicationEmail`). One API call — cheapest when you want everything.
- **Per-document** → `generateDoc(provider, apiKey, kind, …)`: one focused plain-text prompt for a single `DocKind`, returned as raw text (via `callProviderText`). Cheaper/faster when you only need one or two docs. Each tab in `GeneratedDocs` has its own **Generate**/**↻ Redo** button; a green dot marks tabs already generated.

Both call `setGenerated(id, partial)`, which **merges** the partial onto the job's existing `generated` (so individually-generated docs accumulate). The per-document prompts are single-sourced with the JSON prompt via the `DOC_SPEC` constants (`COVER_SPEC`/`RESUME_SPEC`/`INTERVIEW_SPEC`/`BRIEF_SPEC`/`EMAIL_SPEC`) — **`RESUME_SPEC` is the prompt half of the resume↔renderer contract; keep it in sync with `buildResumeDocx`.**

There is **one email doc**, plain-text-ready-to-send with a `Subject:` line:
- **`outreachEmail`** (`EMAIL_SPEC`) — a ready-to-send email to the recruiter/contact for the job. Deliberately written to sound **human, not AI** — no "I am interested in this position" filler; it reacts to the actual role/tech. **Context-aware opening (truthful):** it thanks the recruiter for reaching out ONLY if the posting reads like an inbound recruiter message (asks for resume/details, "I have an opening", etc.); if it's just a JD the candidate found themselves (the Find Jobs flow), it opens as the candidate reaching out ("I came across your opening for…") instead of falsely claiming contact. The `Re:` subject prefix is added only for genuine replies. Structure: a short context-aware opening that references THIS role → one natural paragraph mapping the candidate's real, resume-backed experience (years + 2-3 key technologies) to the JD → one conversational line that works the logistics in naturally (based in `<location>`, on **H1B no-sponsorship**, open to **C2C at market rate**) — **NOT** as a labeled list → a friendly closing with weekday availability → a signature (name, **mobile number**, email, linkedin). **No "Reason for Change" or "Best Fit" section, no labeled `Label: value` lines, no skill-by-skill list.** Kept **paste-clean**: plain text only, no numbered/bulleted lists, plain hyphens (no em/en dashes), since those mangle when pasted into Gmail. Renders as the **Recruiter Email** tab.

The baked-in **stance** (H1B / no-sponsorship / C2C) lives in `EMAIL_SPEC`; the **phone, email, and linkedin are pulled from the saved resume** (no longer hard-coded), so they update when the user swaps resumes. The email `.txt`-downloads and gets an **"Open in Gmail"** button (gated by the `EMAIL_TABS` set in `GeneratedDocs.tsx`): `splitEmail()` parses the `Subject:` line vs. body, and `JobDetailDrawer` extracts a `recruiterEmail` from the job text (`rawText`) for the `To` field, so the button opens a Gmail compose deep-link (`mail.google.com/mail/?view=cm&su=&body=&to=`) pre-filled with native Gmail formatting — no copy-paste. (Email tabs use a wider content right-padding so a long `Subject:` line clears the action-button bar.)

`lib/ai.ts` routes to three providers:
- **OpenRouter** — `https://openrouter.ai/api/v1/chat/completions`, model from `openRouterModel` setting (default `anthropic/claude-sonnet-4-6`)
- **Claude** (direct) — `https://api.anthropic.com/v1/messages`, model `claude-sonnet-4-6`
- **OpenAI** (direct) — `https://api.openai.com/v1/chat/completions`, model `gpt-4o`

### Tailored resume format (ATS) — prompt ↔ renderer contract
The `SYSTEM_PROMPT` in `lib/ai.ts` makes `tailoredResume` emit a **C2C consulting resume** in a fixed plain-text structure, and `lib/download.ts` (`buildResumeDocx`) parses that exact structure into a formatted `.docx`. **These two are a contract — change them together.** The structure:
- Line 1 = full name; line 2 = pipe-separated contact (`phone | email | location | linkedin`)
- Title-Case section headings on their own line: `Professional Summary`, `Technical Skills`, `Professional Experience`, `Education` (+ optional `Certifications`)
- Summary = `- ` bulleted qualification statements (ATS-safe — the renderer turns them into Word bullet points for visual rhythm); Skills = `Category: comma, list`; Experience per role = `Client: Company, Location | Dates` / `Role:` / `Description:` / `Responsibilities:` + `- ` bullets / `Environment:`; Education = `Degree — School, Year`
- The renderer keys off: line index (name/contact), the `SECTION_HEADINGS` set, `^[-•*] ` bullets, and `^Label: value` lines (`Client` gets right-aligned dates via a right tab stop; `Environment` is italic). It must stay ATS-safe — single column, no tables. Output is tailored/reordered per JD but facts (companies, titles, dates) stay truthful.
- **Navy accent:** the **name** and **section headings** (+ heading underline) render in navy `ACCENT = '1F3864'` (`lib/download.ts`). This is text-only coloring, so it stays ATS-safe — parsers read the characters and ignore the color. To restyle, change the `ACCENT` constant.
- **Bullet minimum:** the prompt requires **at least 10 responsibility bullets per role**, tailored to the JD (truthful reframing/expansion of real work — never fabricated).
- **Everything is sourced from the saved resume (no hard-locks).** The contact line (**phone, email, location, linkedin** — plus any second profile link like a Trailblazer/portfolio URL), **Education** (degrees/schools/years, reverse-chronological), and **Certifications** (each on its own line, JD-relevant first; section omitted if the resume has none) are all taken **exactly as they appear in the parsed resume** — `RESUME_SPEC` forbids inventing or substituting any of them. Swapping the resume in Settings updates all of these automatically. *(Historical note: phone and Education used to be hard-locked to a fixed number/school; that was removed so the generator follows whatever resume is uploaded.)*
- **Certifications stay text-only (ATS-safe) — no image logos/badges.** Cert badge images would break ATS parsing and the single-column text contract, so certifications render as a plain `Certifications` text section, never embedded images.

`GeneratedDocs.tsx` downloads each tab: resume + cover letter → `.docx` (resume uses `kind: 'resume'`, the structured renderer; cover letter uses the plain prose renderer), interview prep + company brief + recruiter email → `.txt`. The **Cover Letter** tab also exposes a **`.pdf`** button alongside `.docx` (gated by the `PDF_TABS` set in `GeneratedDocs.tsx`) — `downloadPdf` in `lib/download.ts` dynamically imports `jspdf` (so it only ships when the user actually clicks) and renders the prose at letter-size with 1-inch margins in Times 11pt (the standard cover-letter format). Saving prefers the File System Access API (`showSaveFilePicker` — native Save-As dialog) and falls back to `file-saver`; the picker is blocked in cross-origin iframes (e.g. the embedded preview pane) so it silently downloads to the Downloads folder there.

### Live job search (Find Jobs)
**Three sources, in priority order:** JSearch (best, needs key) → Remotive (real, no key) → AI leads (fallback). `useRealApi = Boolean(jobsApiKey)` in `JobSearchModal.tsx`: with a key it calls JSearch; without a key it tries **Remotive** first and only falls back to the **AI search** if Remotive returns nothing/errors. `source` state (`'api' | 'remotive' | 'ai'`) drives the labels — `source !== 'ai'` is treated as a real link (leads with **Apply ↗**); only `'ai'` shows the unverified-link layout.

- **Remotive (real, NO key):** `searchRemotiveJobs()` in `lib/jobsApi.ts` hits the free public `remotive.com/api/remote-jobs` (no signup, no key). **Remote-only, smaller coverage** than JSearch, but every result is a real posting with a working `url`. Remotive's `search` matches loosely, so we **re-filter client-side** (`roleTokens`/`matchesRole`: drop seniority filler, require a role keyword in title/category) and also client-filter by `datePosted` window and employment type (`REMOTIVE_TYPES`). HTML descriptions are stripped; `source: 'Remotive'`, full `description` kept for tailoring.
- **Real postings (preferred):** `searchRealJobs()` in `lib/jobsApi.ts` calls **JSearch on RapidAPI** (`jsearch.p.rapidapi.com/search`) — aggregates Google for Jobs, so every result is an actual open listing with a working `job_apply_link`. Nothing is synthesized. It maps prefs → JSearch params (`datePosted`→`date_posted` all/today/3days/week/month; employment types→`employment_types` FULLTIME/CONTRACTOR/PARTTIME/INTERN; `workMode==='remote'`→`remote_jobs_only`; role+seniority+location folded into the free-text `query`) and maps the response → `JobSearchResult` (real `url`, relative `posted` from `job_posted_at_datetime_utc`, `fit: ''`, and **`source`** = `job_publisher` or the apply-link domain — rendered as a green "● via {source}" legitimacy badge on each card, real-API results only; plus **`description`** = the FULL real `job_description`). On **+ Wishlist**, a real posting stores its **full JD as `rawText`** (so Generate-All tailors off the complete description, not the 280-char preview); AI leads have no `description` and fall back to the assembled summary fields. The key is **`jobsApiKey`** in `store/settings.ts` — **local-only (never synced), dev-auto-loads from `VITE_JOBS_API_KEY` gated behind `import.meta.env.DEV`** exactly like the AI key. In the result list, `source==='api'` leads with an **Apply ↗** (the real link) + a secondary "Search more".
- **AI leads (fallback, no key):** the AI search below. These are approximate/synthesized — links can be stale or fabricated, so `source==='ai'` leads with a guaranteed-working **"Find this posting ↗"** Google search (`jobSearchUrl`) and shows the AI's own URL only as "direct link (unverified)".

The **Find Jobs** button in the top nav opens `components/JobSearch/JobSearchModal.tsx`. It collects preference fields (role, location, work mode, employment type multi-select, seniority, salary, **and `datePosted` — a single-select "Posted within" pill row: any / 24h / 3d / week / month**) and calls `searchJobs()` in `lib/ai.ts`. `searchJobs` always hits **OpenRouter** directly (not the provider router) using a **web-search model** — default `perplexity/sonar-pro` (the `searchModel` setting, configurable in Settings; env default `VITE_OPENROUTER_SEARCH_MODEL`). The prompt **splits preferences into HARD REQUIREMENTS vs. soft preferences**: location, work mode, and `datePosted` recency are mandatory ("omit rather than pad with off-target roles"), while role/employment-type/seniority/salary only rank. It demands a **JSON array** of `JobSearchResult` (`title, company, location, url, employmentType, summary, fit, posted`); the parser extracts the first `[...]` block, then applies a **conservative client-side work-mode backstop** (`matchesWorkMode` — when `remote` is requested, drops results that explicitly say on-site and never mention remote). Results render as a review list showing each posting's **`posted` ("Posted ~X ago")** date, and the user clicks **+ Wishlist** to add each as a `Job` (reusing the store + the existing Generate-All flow). Dedupe is by normalized `title@company` against jobs already on the board. Because these are AI-surfaced leads (links can be stale/approximate, and date-filtering is best-effort — hence the visible `posted` date), the UI flags "verify link" and shows a disclaimer — it is not a guaranteed real-time feed.

Because LLM web-search can't match a real job board's structured index, the modal also shows **live-board deep-links** (`lib/boards.ts` → `buildBoardLinks(prefs)`): it maps the same preference fields onto **Dice / LinkedIn / Indeed** search-query params (e.g. Dice `filters.postedDate`/`employmentType`/`workplaceTypes`, LinkedIn `f_TPR`/`f_WT`/`f_JT`, Indeed `fromage`) so one click opens the real board pre-filtered identically. These links update live with the form. To change board mappings, edit `lib/boards.ts`.

### Columns (single source of truth)
The five pipeline columns are defined once in `src/lib/columns.ts` (`COLUMNS`, `COLUMN_IDS`, `COLUMN_BY_ID`) — id, label, and an accent `color` CSS var per column. The board, cards, and the drawer's status pills all read from this. Add or reorder columns here, not in individual components.

### Drag and drop
Cards use `@dnd-kit/sortable` (`useSortable`) with a **dedicated drag handle** (grip icon, left edge of each card, visible on hover). The `{...listeners}` are spread only on the handle div — the rest of the card is a plain `onClick` target to open the detail drawer. This separates drag from click and prevents conflicts. Columns use `useDroppable`. Cross-column drops are resolved in `handleDragEnd` in `KanbanBoard.tsx`.

### Design system
All colors are CSS custom properties defined in `src/styles/tokens.css` and mapped into Tailwind via `tailwind.config.js`. Use the token names (`bg-canvas`, `text-ink`, `border-hairline`, etc.) — never hardcode hex values. The full token spec is in `linear.md` at the repo root.

Elevation is expressed through the surface ladder (`surface-1` → `surface-4`) and 1px hairline borders. **No `box-shadow` for drop shadows.** Depth comes from: the surface ladder, hairline borders, and the signature inset top-edge highlight — apply the `.edge-top` / `.edge-top-strong` utility class to lifted panels. The canvas color is `#010102` (near-black with a faint blue tint) — do not use true black. `body::before` / `body::after` render a faint ambient glow + grain texture over the canvas.

**Status accents:** per-column colors live as `--status-*` vars (e.g. `--status-offer`) and are exposed as `bg-status-offer` etc. via Tailwind. This is the product-UI palette (allowed per `linear.md`) — the marketing-chrome rule of "one chromatic accent" does not apply to these status indicators.

**Motion:** keyframe utilities are defined in `tokens.css` — `.animate-fade-up` (staggered card/column entrance via inline `animationDelay`), `.animate-scale-in` (modals), `.animate-slide-in-right` (drawer), `.animate-overlay-in` (backdrops), `.animate-spin-slow` (loading). All motion is disabled under `prefers-reduced-motion`. When adding animated UI, reuse these classes rather than inventing new keyframes.

A `frontend-design` skill is installed at `.claude/skills/frontend-design/SKILL.md` — its principles (commit fully to a distinctive aesthetic, meticulous execution, no generic defaults) guide UI work here. The committed direction is the Linear dark system; elevate execution within it.

### Resume parsing
`lib/resumeParser.ts` extracts text from PDF (via `pdfjs-dist`) or `.docx` (via `mammoth`) entirely in the browser. The extracted plain text is stored in the settings store and passed to every AI generation call.

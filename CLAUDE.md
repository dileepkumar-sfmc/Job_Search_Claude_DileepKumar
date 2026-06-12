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

Pure client-side React + TypeScript app. No backend — all AI calls go directly from the browser to the AI provider's API using a key loaded from `server/.env` at build time.

### Environment / API keys
- Keys live in `server/.env` (gitignored). Vite reads this directory via `envDir: './server'` in `vite.config.ts`.
- `server/.env.example` documents the format — copy it to `server/.env` to get started.
- Primary provider is **OpenRouter** (`VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_MODEL`). Direct Anthropic and OpenAI keys are also supported.
- Env vars are loaded as defaults in `src/store/settings.ts`; the Settings UI can override them at runtime (stored in localStorage).
- **Restart the dev server** after editing `server/.env` — Vite only reads env vars on startup.

### State (Zustand + persist middleware)
- `src/store/jobs.ts` — all job cards; persisted to `localStorage` key `jsc-jobs`
- `src/store/settings.ts` — API key, provider, OpenRouter model, resume text; persisted to `jsc-settings`

Both stores are the single source of truth. Components read from these stores and never manage their own copies of jobs or settings.

### Data flow for adding a job
1. `AddJobModal` shows a single screen: optional URL field (fetches via CORS proxy in `lib/jobScraper.ts`) + paste-text area — both visible at once, no tabs.
2. Calls `extractJobMeta()` in `lib/ai.ts` (cheap/fast model call, returns `{title, company, location, summary}`)
3. Adds a `Job` object to the Zustand store — card appears on the board immediately.

### Data flow for AI generation
`JobDetailDrawer` calls `generateAll()` in `lib/ai.ts`, which sends a single prompt and expects a JSON object with four keys: `coverLetter`, `tailoredResume`, `interviewQuestions`, `companyBrief`. The result is stored back on the `Job` object via `setGenerated()`.

`lib/ai.ts` routes to three providers:
- **OpenRouter** — `https://openrouter.ai/api/v1/chat/completions`, model from `openRouterModel` setting (default `anthropic/claude-sonnet-4-6`)
- **Claude** (direct) — `https://api.anthropic.com/v1/messages`, model `claude-sonnet-4-6`
- **OpenAI** (direct) — `https://api.openai.com/v1/chat/completions`, model `gpt-4o`

### Tailored resume format (ATS) — prompt ↔ renderer contract
The `SYSTEM_PROMPT` in `lib/ai.ts` makes `tailoredResume` emit a **C2C consulting resume** in a fixed plain-text structure, and `lib/download.ts` (`buildResumeDocx`) parses that exact structure into a formatted `.docx`. **These two are a contract — change them together.** The structure:
- Line 1 = full name; line 2 = pipe-separated contact (`phone | email | location | linkedin`)
- Title-Case section headings on their own line: `Professional Summary`, `Technical Skills`, `Professional Experience`, `Education` (+ optional `Certifications`)
- Summary = one statement per line; Skills = `Category: comma, list`; Experience per role = `Client: Company, Location | Dates` / `Role:` / `Description:` / `Responsibilities:` + `- ` bullets / `Environment:`; Education = `Degree — School, Year`
- The renderer keys off: line index (name/contact), the `SECTION_HEADINGS` set, `^[-•*] ` bullets, and `^Label: value` lines (`Client` gets right-aligned dates via a right tab stop; `Environment` is italic). It must stay ATS-safe — single column, no tables. Output is tailored/reordered per JD but facts (companies, titles, dates) stay truthful.

`GeneratedDocs.tsx` downloads each tab: resume + cover letter → `.docx` (resume uses `kind: 'resume'`, the structured renderer; cover letter uses the plain prose renderer), interview prep + company brief → `.txt`. Saving prefers the File System Access API (`showSaveFilePicker` — native Save-As dialog) and falls back to `file-saver`; the picker is blocked in cross-origin iframes (e.g. the embedded preview pane) so it silently downloads to the Downloads folder there.

### Live job search (Find Jobs)
The **Find Jobs** button in the top nav opens `components/JobSearch/JobSearchModal.tsx`. It collects preference fields (role, location, work mode, employment type multi-select, seniority, salary) and calls `searchJobs()` in `lib/ai.ts`. `searchJobs` always hits **OpenRouter** directly (not the provider router) using a **web-search model** — default `perplexity/sonar-pro` (the `searchModel` setting, configurable in Settings; env default `VITE_OPENROUTER_SEARCH_MODEL`). The prompt sends the resume + preferences and demands a **JSON array** of `JobSearchResult` (`title, company, location, url, employmentType, summary, fit`); the parser extracts the first `[...]` block. Results render as a review list — the user clicks **+ Wishlist** to add each as a `Job` (reusing the store + the existing Generate-All flow). Dedupe is by normalized `title@company` against jobs already on the board. Because these are AI-surfaced leads (links can be stale/approximate), the UI flags "verify link" and shows a disclaimer — it is not a guaranteed real-time feed.

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

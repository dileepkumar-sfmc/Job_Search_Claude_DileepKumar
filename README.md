# Job Search Copilot

A client-side React + TypeScript job-application tracker with AI assistance — a Kanban pipeline board, one-click AI generation (cover letter, ATS-friendly tailored resume, interview prep, company brief), and live job search via Perplexity Sonar. No backend; all data lives in your browser's `localStorage`.

## Prerequisites

- **Node.js 18+** and npm. ([nodejs.org](https://nodejs.org))
- An **OpenRouter API key** (recommended) — get one at [openrouter.ai/keys](https://openrouter.ai/keys). Direct Anthropic or OpenAI keys also work.

> On this project's original Windows machine, Node is a portable binary at `C:\tools\node-v22.13.0-win-x64` (not on PATH). Use the `dev.cmd` wrapper, or prefix commands with:
> ```powershell
> $env:PATH = "C:\tools\node-v22.13.0-win-x64;$env:PATH"
> ```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file from the template, then add your key
cp server/.env.example server/.env        # Windows: copy server\.env.example server\.env
#    Edit server/.env and set:
#      VITE_OPENROUTER_API_KEY=sk-or-...
#      VITE_OPENROUTER_MODEL=anthropic/claude-sonnet-4-6
#      VITE_OPENROUTER_SEARCH_MODEL=perplexity/sonar-pro
#      VITE_AI_PROVIDER=openrouter
```

The API key is **never committed** (`server/.env` is git-ignored). On a fresh clone you must create `server/.env` yourself, or paste your key in the app's **Settings** panel at runtime instead.

## Run

```bash
npm run dev        # start the dev server → http://localhost:5173
```

On Windows you can also just run **`dev.cmd`** (sets the Node PATH and starts the dev server).

## Other commands

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## Notes

- **Restart the dev server after editing `server/.env`** — Vite only reads env vars at startup.
- All jobs and settings are stored in the browser's `localStorage`, so data is per-browser and not synced across devices.
- **Find Jobs** uses a live web-search model (default `perplexity/sonar-pro`). Results are AI-surfaced leads — always verify the posting link before applying.

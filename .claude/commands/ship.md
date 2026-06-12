---
description: Summarize what you did this session and how, grounded in the real changes — adapts to code vs. document work.
argument-hint: "[optional focus, e.g. 'just the AI changes']"
---

You are wrapping up a work session. Produce a clear **ship summary**: what was accomplished, how, and the concrete changes. This command only *reports* — do not commit, push, or modify any files.

## 1. Classify the work
Look over what happened this session and the working tree, and decide the primary kind of work — let it shape the summary:
- **Code** — source files changed (feature, fix, refactor, config).
- **Document / content** — prose, docs, specs, or other written deliverables.
- **Mixed / other** — a combination, or research/investigation with few file changes.

## 2. Ground it in the actual changes
Never invent changes — report only what actually happened this session.
- In a git repo: run `git status --short` and `git diff --stat` (and `git diff` for specifics) to see real edits, including **untracked** files. Distinguish changes you made this session from pre-existing uncommitted ones if it matters.
- For files not tracked by git: identify what you created or edited this session.

## 3. Write the summary
Adapt the shape to the work; this is a sensible default:

**Shipped** — 1–2 sentences on the outcome / goal achieved.

**Changes** — a tight, scannable list of concrete changes, grouped sensibly:
- *Code:* by file or feature, each a one-line "what + why". Flag new files, deletions, and any contracts/configs touched (e.g. paired prompt↔renderer changes).
- *Document:* by document or section — what was added, rewritten, or removed.

**How** — the approach and notable decisions, trade-offs, or things deliberately left out. State what was tested/verified vs. not — be honest about gaps.

**Follow-ups** — only if real: anything open, untested, or worth doing next.

If `$ARGUMENTS` is given, focus the summary on that. Keep it concise and skimmable — no filler.

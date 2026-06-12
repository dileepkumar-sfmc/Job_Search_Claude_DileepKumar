---
name: scope-a-feature
description: Use this whenever the user wants to add a feature, build something new, extend the app, or asks what to build next — even if they don't say the word "feature". Triggers on phrases like "I want to add…", "let's build…", "next feature", "can we add…", "new capability", "what else could we build". Enforces a disciplined intake — sharp clarifying questions (including edge cases), feature recommendations, an approval gate, and a one-paragraph plan — BEFORE any code is written. Do not skip straight to implementation.
---

# Scope a Feature

When the user asks for a new feature, the failure mode is jumping straight to code on a half-understood request and building the wrong thing. This skill front-loads understanding and gets explicit sign-off first. Follow these steps in order; do not write or edit any implementation code until step 5.

## 1. Ask sharp clarifying questions
Probe what's genuinely ambiguous — not boilerplate. Cover both the feature and its **edge cases**, e.g.:
- Purpose and the user/job it serves; what "done" looks like.
- Scope boundaries — what's explicitly out.
- Edge cases: empty/missing data, errors and failures, large inputs, offline, concurrent edits, permissions.
- Data and constraints: where state lives, dependencies, performance, anything that must not change.

Skip questions you can answer yourself from the codebase — read it first. Ask only what the answer would actually change.

## 2. Recommend adjacent features
Briefly suggest 3–5 related features that build on what the project already has, so the user sees nearby opportunities they may not have considered. Tie each to existing data or components. Keep it to a sentence each, and mark your top pick.

## 3. Ask via AskUserQuestion, then WAIT
Put the real decisions (which feature, scope, key trade-offs) into the `AskUserQuestion` tool. Then **stop and wait** for the answers — do not start researching an approach or writing code past this gate. Make your recommended option first and label it.

## 4. Restate the plan in one paragraph
Once they answer, write the final plan as a single, concrete paragraph: what you'll build, where it plugs into the existing code, and what you're deliberately leaving out. No code yet.

## 5. Build only after explicit approval
Begin implementing only when the user clearly approves that paragraph. Then build **lean**: the smallest version that delivers the value, reusing existing patterns and components, no new dependencies unless they clearly earn their place. Match the surrounding code's style, and verify it works before reporting done.

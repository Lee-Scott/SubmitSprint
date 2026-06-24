# SubmitSprint Workflow

## Purpose

SubmitSprint uses a two-layer workflow:

- universal software-agent rules shared across Lee's coding projects
- SubmitSprint-specific repo and project rules stored locally

This repo contains the SubmitSprint-local copy of the universal workflow,
adapted to SubmitSprint. It is not the master source of truth for every
project.

## Universal Workflow Rules

- ChatGPT/GPT-5.5 is used for planning, architecture, prompt generation,
  review, and commit isolation.
- Codex/Spark is used for implementation.
- Work is split into small controlled batches.
- Avoid giant prompts by default.
- Every coding-agent pass starts with read-only repo inspection.
- Every implementation pass requires a Repo Reality Check before edits.
- Unrelated dirty files must be reported and preserved.
- No commits unless explicitly requested.
- No cross-project assumptions.
- No invented files, APIs, endpoints, schemas, dependencies, or conventions.
- Prefer existing patterns and small diffs.

## Required Prompt Format

Use this order for coding-agent prompts:

```text
GOAL
CHAT
MODEL
PROMPT
SMOKE TEST
COMMIT MESSAGE
```

## Required Coding-Agent Loop

1. Spec
2. Repo Reality Check
3. Small implementation batch
4. Verifier
5. Final report
6. GPT review
7. Manual smoke test
8. Docs update
9. Manual commit

## Required Review Format

Use this format for review output:

```text
WHAT IT DID
WHAT LOOKS GOOD
CONCERNS
MISSING ITEMS
RECOMMENDATION
```

Recommendation values:

- Accept
- Accept With Changes
- Reject

## SubmitSprint-Specific Rules

- SubmitSprint is a local-first frontend app for startup directory submission
  tracking.
- Preserve local-first behavior.
- Do not introduce backend dependencies unless explicitly approved.
- Preserve directory dataset integrity.
- Do not modify public directory dataset files unless explicitly required.
- Preserve status, notes, sprint-session state, backup import/export, and merge
  behavior.
- Do not break localStorage persistence or backup compatibility without an
  explicit migration plan.
- Be careful with virtualized table/list behavior and mobile spacing.
- Keep Sprint Mode, smart views, filters, search, keyboard shortcuts, and
  import/export workflows stable unless directly scoped.
- Do not modify deployment config, domains, Cloudflare/Vercel behavior,
  analytics, or hosting behavior unless explicitly requested.
- Keep changes small and reversible.
- Test mobile layout when UI changes affect core flows.

## Dirty File Isolation

- Run `git status --short` first.
- Report dirty files before editing.
- Do not overwrite unrelated dirty files.
- Do not stage unrelated files.
- Stop if dirty state makes the task unsafe.

## Documentation Update Rule

- Update current-state or handoff docs after meaningful completed work if the
  repo has them.
- Update roadmap or next-step docs after changing priorities.
- Update commands/deployment docs if commands or hosting behavior change.
- Update verification docs if test, build, or smoke checks change.
- Add to lessons learned only for repeated failure patterns.

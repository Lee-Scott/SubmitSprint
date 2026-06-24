# AGENTS

Instructions for Codex:

- Read `docs/WORKFLOW.md` before implementation work.
- Read `docs/VERIFICATION.md` before final reporting.
- Read `docs/SUBMITSPRINT_PROJECT_PACKET.md` for project context.
- Use GOAL / CHAT / MODEL / PROMPT / SMOKE TEST / COMMIT MESSAGE for
  coding-agent prompts.
- Use WHAT IT DID / WHAT LOOKS GOOD / CONCERNS / MISSING ITEMS /
  RECOMMENDATION for review output.
- Run `git status --short` before edits.
- Preserve unrelated dirty files.
- Do not commit unless explicitly requested.
- Keep SubmitSprint local-first.
- Do not modify public directory dataset files unless explicitly required.
- Do not break localStorage, sprint-session state, or backup import/export
  compatibility without an explicit migration plan.
- Do not introduce backend dependencies unless explicitly approved.
- Do not modify deployment config unless explicitly requested.

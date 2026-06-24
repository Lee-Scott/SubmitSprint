# Lessons Learned

## Dirty File Isolation

Problem:
Unrelated dirty files can cause accidental overwrite, staging, or mixed commits.

Rule:
Run `git status --short` first. Preserve unrelated dirty files. Stop when dirty
state makes the task unsafe.

Verifier:
Final reports must include `git status --short` and dirty-file notes.

## Prompt Scope Creep

Problem:
Large prompts can cause broad diffs, invented architecture, or mixed concerns.

Rule:
Use small controlled batches with one clear goal.

Verifier:
Final reports must list changed files and confirm unrelated areas were not
modified.

## Dataset And LocalStorage Safety

Problem:
SubmitSprint relies on directory dataset files, browser state, status changes,
notes, sprint-session state, and backup import/export behavior.

Rule:
Do not change dataset structure, localStorage meaning, or backup import/export
semantics without an explicit migration plan.

Verifier:
Final reports must state dataset, localStorage, and backup compatibility impact.

## Virtualized UI And Mobile Layout

Problem:
Directory table/list virtualization and mobile spacing can regress while tests
still pass.

Rule:
Manually smoke table/list behavior, spacing, and scrolling after UI changes.

Verifier:
Final reports must include mobile/table smoke notes when affected.

## Documentation Drift

Problem:
Future Codex prompts get worse when current-state, roadmap, command, or
workflow docs are stale.

Rule:
Update relevant docs after meaningful feature slices.

Verifier:
Final reports must state whether docs were updated or why not.

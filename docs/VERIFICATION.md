# SubmitSprint Verification

## Standard Repo Checks

Run from the repo root:

```bash
cd "/Users/lee/Programing Projects/SubmitSprint"
git diff --check
git status --short
```

## Frontend / Vite Checks

Use the supported package scripts from `package.json`:

```bash
npm test
npm run build
npm run lint
```

For docs-only changes, `git diff --check` and `git status --short` are usually
enough unless product code, tests, commands, generated files, dataset files, or
deployment behavior changed.

## Runtime Smoke

Start the local app with:

```bash
npm run dev
```

Then smoke the relevant workflow:

- Open the app locally.
- Test smart views.
- Test directory search/filter behavior.
- Test status update flow.
- Test notes.
- Test the sprint session panel.
- Test JSON backup export.
- Test JSON backup import/merge only with a safe test backup.
- Test mobile width for table/list changes.
- Test one nearby unrelated workflow.

## SubmitSprint Safety Checks

- No directory dataset files changed unless explicitly required.
- No localStorage schema change without a migration plan.
- No backup import/export compatibility change without a migration plan.
- No backend dependency introduced unless approved.
- No deployment config modified unless required.
- No generated artifacts committed accidentally.

## Final Report Requirements

Include:

- Files changed
- Files created
- Product code touched yes/no
- Docs touched yes/no
- Tests run
- Build/lint/typecheck result
- `git diff --check` result
- `git status --short` result
- Dirty-file notes
- Side effects
- Dataset impact
- LocalStorage/backup impact
- Deployment impact
- Remaining risks
- Safe-to-commit recommendation
- Suggested commit message

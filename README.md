# SubmitSprint

SubmitSprint is a static React app for tracking startup directory submissions, copying startup profile assets, and keeping launch progress out of spreadsheets.

## Local setup

```bash
npm install
npm run import:data
npm run dev
```

## Dataset refresh

The app loads only `public/data/master_directories.json` at runtime.

```bash
npm run import:data
```

To refresh from a new export, replace `data/source/saas-directory.csv` and rerun the import script. The importer also accepts an optional local file path or published CSV URL.

## Browser storage and backups

SubmitSprint stores only user-owned state in browser storage:

- `submitsprint.progress.v1`
- `submitsprint.profile.v1`
- `submitsprint.settings.v1`
- `submitsprint.backupMeta.v1`

The master directory dataset is never stored in `localStorage`.

Export a backup JSON before clearing browser data, switching browsers, or doing a hard refresh on a machine you care about.

## Deployment

Cloudflare Pages:
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: leave default unless the build fails, then set `22`
- Environment variables: none

Vercel:
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none

## Smoke test checklist

- `npm run build` completes successfully.
- `public/data/master_directories.json` contains 1,057 records.
- The deployed app loads the directory table without network errors.
- Search, smart views, and status updates work after a page reload.
- Backup export produces JSON and backup import restores saved progress.

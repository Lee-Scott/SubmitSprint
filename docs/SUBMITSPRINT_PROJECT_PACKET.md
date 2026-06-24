# SubmitSprint Project Packet

## 1. Product Purpose

SubmitSprint is a static React app for tracking startup directory submissions, copying reusable startup profile assets, and keeping launch/submission progress out of spreadsheets. It helps startup operators or founders work through a directory list, open submission targets, copy profile text, mark statuses, track follow-ups, and preserve browser-saved progress with JSON backups.

## 2. Current Architecture

SubmitSprint is a client-side/static Vite React app. No application backend was found.

At runtime, `src/App.tsx` fetches `/data/master_directories.json`, which is served from `public/data/master_directories.json` in development/build output. User-owned state is stored in browser `localStorage`; the master directory dataset is not stored in `localStorage`. State is loaded during React state initialization, persisted through debounced/effect-based writes, and flushed on `pagehide`/`beforeunload`.

Deployment is static. README documents Cloudflare Pages and Vercel with `npm run build` and `dist`; `wrangler.jsonc` also points Cloudflare Workers static assets at `./dist` with SPA fallback handling.

## 3. Tech Stack

- Framework/build tool: Vite `^8.0.12` with `@vitejs/plugin-react` `^6.0.1`.
- React: `react` and `react-dom` `^19.2.6`.
- TypeScript: `typescript` `~6.0.2`; build runs `tsc -b && vite build`.
- Styling: Tailwind CSS `^4.3.0` through `@tailwindcss/vite` `^4.3.0`; styles are in `src/index.css` and Tailwind utility classes.
- Test runner: Vitest `^4.1.8`, configured with `environment: 'node'` in `vite.config.ts`.
- Linting: ESLint `^10.3.0`, `typescript-eslint`, React Hooks and React Refresh plugins.
- Runtime validation: Zod `^4.4.3` in `src/lib/schemas.ts` for localStorage hydration, dataset payloads, progress records, settings, and sprint-session state.
- Optional account-mode foundation: `@supabase/supabase-js` with Vite env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Missing env vars fall back to guest mode without creating a Supabase client.
- Table/virtualization: `@tanstack/react-virtual` `^3.14.2` in `src/components/DirectoryTable.tsx`.
- Data/import tooling: Node script `scripts/import-saas-directory.mjs`, using built-in `fs/promises`, `path`, `url`, `crypto`, and global `fetch` for optional remote CSV input.
- Package manager: npm, inferred from `package-lock.json` lockfile version 3 and CI using `npm ci`.
- Node version: `.node-version` and `.nvmrc` both specify `22`.
- Deployment assumptions: static `dist` output, Cloudflare Pages/Vercel supported. Supabase env vars are optional and only needed to enable account mode.

## 4. App Structure

- `src/main.tsx`: React entrypoint.
- `src/App.tsx`: top-level app state and orchestration. Fetches and validates the dataset, owns profile/progress/settings/backup metadata/sprint-session state, wires backup import/export, search, smart views, sprint mode, reset, orphan cleanup, account panel rendering, and persistence.
- `src/types.ts`: shared TypeScript types for directory records, progress records, startup profile, backup payload, smart views, and dataset/audit payloads.
- `src/lib/storage.ts`: localStorage keys, Zod-backed JSON hydration helpers, persistence functions, clipboard helper, and local reset helper.
- `src/lib/backup.ts`: backup creation/export and backup import validation/sanitization.
- `src/lib/cloud-storage.ts`: pure mapping helpers between SubmitSprint state and Supabase table rows, plus local-to-cloud progress merge logic for the upcoming migration flow.
- `src/lib/directory.ts`: directory status helpers, smart view filtering/counting, search, sorting, URL validation, follow-up logic, progress merging, and orphan progress helpers.
- `src/lib/feedback.ts`: mailto helpers for contact/report/suggest flows.
- `src/lib/schemas.ts`: Zod schemas for progress, settings, dataset payloads, directory records, and sprint sessions.
- `src/lib/sessions.ts`: submission sprint session queue, navigation, completion, pruning, and summary helpers.
- `src/lib/supabase.ts`: optional Supabase runtime config and browser client creation.
- `src/components/AuthPanel.tsx`: compact account/guest-mode panel with Supabase Auth sign up, sign in, sign out, and missing-env fallback.
- `src/components/Header.tsx`: top summary/header controls.
- `src/components/SmartViews.tsx`: smart view navigation.
- `src/components/DirectoryTable.tsx`: virtualized directory list, status actions, open/report links, live URL and notes inputs.
- `src/components/DirectoryDetailDrawer.tsx`: per-directory workspace drawer with copy, status, metadata, and notes controls.
- `src/components/SprintSessionPanel.tsx`: focused submission sprint session workflow.
- `src/components/ProfilePanel.tsx`: startup profile form and copy actions.
- `src/components/BackupControls.tsx`: backup export/import/reset UI.
- `src/components/PrivacyTerms.tsx`: footer privacy/terms copy.
- `src/test/`: Vitest tests for backup, cloud mapping, directory helpers, feedback helpers, importer, schemas, sessions, storage, and Supabase config. Top-level `test/` and `tests/` folders were absent.
- `supabase/migrations/0001_initial_submitsprint_schema.sql`: initial account-mode schema with RLS policies for user-owned rows.
- `docs/`: local workflow, verification, architecture, Supabase setup, v2 roadmap, and project packet docs.

## 5. Runtime Data Model

`public/data/master_directories.json` is an object with:

- `appName`: `"SubmitSprint"`.
- `dataVersion`: current inspected value `dataset-4044e4dc6fd3`.
- `generatedAt`: current inspected value `2026-06-19T04:03:20.865Z`.
- `totalRecords`: `1057`.
- `records`: array of directory records.
- `audit`: import summary.

Observed directory record fields:

- Required in current dataset: `id`, `name`, `url`, `domain`, `domainRating`, `category`, `source`, `homepageUrl`, `sourceRowNumber`, `bestFirst`, `linkStatus`, `dataVersion`.
- Optional/present on some records: `tags`, `priceModel`, `dofollow`, `usecase`, `importerWarnings`.
- Type-only optional fields not observed in current generated JSON but supported by `DirectoryRecord`: `submissionUrl`, `lastVerifiedAt`, `linkReviewedAt`.

Example first record:

```json
{
  "id": "reddit-com__root__reddit",
  "name": "Reddit",
  "url": "https://www.reddit.com/",
  "domain": "reddit.com",
  "domainRating": 95,
  "category": "reddit",
  "tags": ["niche-community-reach", "community"],
  "source": "saas-directory.csv",
  "homepageUrl": "https://www.reddit.com/",
  "sourceRowNumber": 2,
  "priceModel": "free",
  "dofollow": "no",
  "usecase": "Niche community reach",
  "bestFirst": false,
  "linkStatus": "untested",
  "dataVersion": "dataset-4044e4dc6fd3"
}
```

Observed data quality notes:

- Audit reports `1057` imported records and `0` skipped records.
- Audit reports `3` duplicate domains, with inspected examples/counts: `reddit.com` 55, `discord.gg` 9, `linkedin.com` 5.
- Audit reports `4` suspicious links and `4` `domain_url_mismatch` warnings, all inspected examples were `discord.gg` domain rows whose URLs use `https://discord.com/invite/...`.
- Current dataset has no duplicate URLs and no missing names, URLs, domains, categories, or domain ratings according to the inspected generated JSON.
- Categories include non-English/transliterated values such as `generales`, `ia`, `comunidades`, `diseno`, and `resenas`; this may be intentional but is a UI/data consistency consideration.

## 6. Local Storage State

All keys are defined in `src/lib/storage.ts` and used through `src/App.tsx`.

- `submitsprint.progress.v1`
  - Stores progress by directory id.
  - Expected shape: `Record<string, DirectoryProgress>`.
  - Record fields include `directoryId`, `status`, optional timestamps (`openedAt`, `submittedAt`, `publishedAt`, `skippedAt`, `followUpDueAt`, `lastActionAt`), optional text fields (`liveUrl`, `notes`, `skipReason`, `lastActionType`), and required `lastUpdatedAt`.
  - Read by `loadProgress`; written by `saveProgress`; reset by `resetProgressState`.
  - Current guardrail: malformed JSON and wrong-shaped records are skipped through `DirectoryProgressSchema`.

- `submitsprint.profile.v1`
  - Stores `StartupProfile`.
  - Expected fields: `startupName`, `websiteUrl`, `tagline`, `shortDescription`, `longDescription`, `founderName`, `contactEmail`, `logoUrl`, `category`, `keywords`, `xUrl`, `linkedinUrl`, `demoUrl`, `pricingSummary`, `updatedAt`.
  - Read by `loadProfile`; written by `saveProfile`; reset by `resetProgressState`.
  - Current guardrail: wrong-shaped fields fall back to empty profile defaults, URL-like fields must be valid `http(s)` URLs, and invalid dates are cleared.

- `submitsprint.settings.v1`
  - Stores settings.
  - Expected shape: `{ activeView: SmartViewId }`.
  - Read by `loadSettings`; written by `saveSettings`; reset by `resetProgressState`.
  - Current guardrail: invalid active views fall back to `start_here` through `SettingsStateSchema`.

- `submitsprint.backupMeta.v1`
  - Stores backup metadata.
  - Expected shape: `{ lastExportedAt?: string; meaningfulChangesSinceExport: number }`.
  - Read by `loadBackupMeta`; written by `saveBackupMeta`; reset by `resetProgressState`.
  - Current guardrail: invalid dates are cleared and malformed change counts fall back to `0`.

- `submitsprint.sprintSession.v1`
  - Stores the current local submission sprint session.
  - Expected shape: `SubmissionSprintSession`.
  - Read by `loadSprintSession`; written by `saveSprintSession`; reset by `resetProgressState`.
  - Current guardrail: malformed session JSON is rejected through `SubmissionSprintSessionSchema`.

All keys use a `.v1` suffix. No key-version migration layer was found beyond changing key names/version suffixes.

## 7. Backup / Import / Export Behavior

Files/components involved:

- `src/components/BackupControls.tsx`: export, import file picker, and reset controls.
- `src/App.tsx`: handlers `handleExport`, `handleImport`, `handleReset`, `handlePruneOrphans`.
- `src/lib/backup.ts`: backup payload construction, export file download, JSON parsing, validation, sanitization, and import merging.
- `src/lib/directory.ts`: `mergeProgressRecords`, `getOrphanProgressRecords`, and `pruneOrphanProgress`.
- `src/test/backup.test.ts`: tests for backup validation/import sanitization.

Exported payload shape from `SubmitSprintBackup`:

```ts
{
  appName: 'SubmitSprint';
  schemaVersion: 1;
  exportedAt: string;
  datasetVersion?: string;
  startupProfile: StartupProfile;
  progressRecords: DirectoryProgress[];
  settings?: Record<string, unknown>;
}
```

Export behavior:

- `createBackup` emits the current profile, `Object.values(progressMap)`, current settings, optional dataset version, schema version `1`, and `exportedAt`.
- `exportBackup` downloads `submitsprint-backup-YYYY-MM-DD.json`.
- Successful export updates backup metadata: `lastExportedAt` becomes now and `meaningfulChangesSinceExport` resets to `0`.

Import validation and sanitization:

- `importBackupText` catches invalid JSON and returns `{ ok: false, message: 'Backup import failed' }`.
- `validateBackup` requires object payload, `appName === 'SubmitSprint'`, `schemaVersion === 1`, array `progressRecords`, and object `startupProfile`.
- `sanitizeProgressRecord` requires object records with valid `directoryId` and a status in `directoryStatuses`; invalid records are counted and skipped.
- Profile fields are sanitized to strings with length caps; empty imported profiles do not overwrite a useful current profile.
- Progress text/date/url-like fields are length-limited; date fields must parse as valid dates and URL-like fields must be valid `http(s)` URLs.
- Safe unknown progress fields are preserved if the key matches a conservative identifier regex and the value is string/number/boolean.
- Settings import validates `activeView` against `SmartViewIdSchema` and falls back to current settings when invalid.
- Orphaned progress records are counted when `validDirectoryIds` is provided, but they are still merged into progress.

Failure handling:

- Bad JSON, wrong app, or unsupported schema return user-facing failure messages.
- Partial import of valid progress records continues when some progress records are invalid.
- `App.tsx` displays the import result message and clears undo on success.

Remaining risks from malformed backup JSON:

- Large files are read with `file.text()`; no explicit file size limit was found.
- Imported orphan progress remains saved until the user chooses orphan cleanup.

## 8. Static Data Import Pipeline

File: `scripts/import-saas-directory.mjs`.

- Default input source: `data/source/saas-directory.csv`.
- Optional input source: first CLI argument, either a local path resolved from repo root or an `http(s)` CSV URL fetched with `fetch`.
- Output file: `public/data/master_directories.json`.
- Audit output: `reports/directory-link-audit.json`.

Transformation steps:

- Parses CSV with a custom quoted-field parser.
- Reads headers from the first CSV line.
- Maps rows to records using `Name`, URL header candidates, `Domain`, `Category`, `DR`, `Dofollow/Nofollow`, `Price model`, `Usecase`, and `bf`.
- Normalizes URLs by adding `https://` when no protocol is present, requiring `http:` or `https:`, stripping default ports, and preserving path/query/hash.
- Derives `domain` from CSV `Domain` or URL hostname, lowercasing and stripping protocol, `www.`, and paths.
- Lowercases `category`.
- Parses `DR` as a number.
- Builds tags from `Tags`/`tags`, `Usecase`/`usecase`, and `bf`/`BF` by splitting on common separators and slugifying.
- Maps homepage/submission URL candidates if present; otherwise mirrors `homepageUrl` to `url`.
- Builds stable ids from domain, URL path, and name; collisions get content fingerprints and occurrence suffixes.
- Adds `dataVersion` from a SHA-256 hash of normalized records.
- Builds an audit summary and report.

Validation currently present:

- Missing `Name` rows are skipped as `missing_name`.
- Missing URL rows are skipped as `missing_url`.
- Invalid/unsupported URLs are skipped as `invalid_url`.
- Missing category, missing DR, and CSV domain versus URL domain mismatch are recorded as warnings, not hard failures.
- Duplicate URLs and duplicate IDs attach warnings and set `linkStatus` to `needs_review` unless already `suspicious`.
- Duplicate domains are counted in audit only; duplicate-domain warnings are not attached to records.
- `expectedHeaders` is defined and included in the audit report, but the importer does not appear to fail when headers differ.
- Runtime app loading validates the fetched dataset with `DatasetPayloadSchema` before using records.

Warnings/errors emitted:

- Successful CLI run logs written record count, data version, imported/source row counts, records with warnings, and audit report path.
- CLI fetch/read/import failures are printed to stderr and set `process.exitCode = 1`.
- Current inspected dataset audit reports `4` `domain_url_mismatch` warnings and no skipped records.

Pipeline risks:

- Custom CSV parser may not cover every CSV edge case.
- Header drift is audited but not blocked.
- Generated JSON structure is validated by the app after fetch, but importer-side schema enforcement can still be improved.
- URL syntax is normalized, but link reachability is not tested.
- Duplicate domains can be legitimate directory subcommunities but can also hide duplicate or low-quality paths.

## 9. Known Risks / Upgrade Opportunities

- Account-mode cloud sync: Supabase Auth/config, schema, RLS, and mapping helpers now exist, but profile/progress/settings/session data does not yet persist to Supabase.
- Local-to-cloud migration: merge logic has pure tests, but the signed-in migration prompt and cloud write path are not implemented.
- LocalStorage migration/versioning: keys have `.v1`, but there is no key-version migration layer beyond changing key names/version suffixes.
- Backup validation: backup import has useful schema gating and sanitization, but file size and orphan policy could be stricter.
- Generated dataset validation: runtime loading validates the fetched JSON, but importer-side schema enforcement could still be improved.
- URL/link quality: importer validates URL syntax, not reachability, redirects, submission-page intent, or broken links.
- Duplicate domains/paths: duplicate URLs/IDs are handled with warnings; duplicate domains are audit-only and may need review rules.
- Test coverage: tests exist for backup, cloud mapping, storage hydration, schemas, importer, directory helpers, sessions, and feedback; no browser/component/e2e tests were found for auth UI, local-to-cloud migration UI, backup import UI, or dataset fetch failures.
- UI/data consistency: category values are lowercased source values and include mixed language/transliteration; smart views depend on keyword matching against category/tags.
- Deployment/static asset risks: the runtime depends on `/data/master_directories.json` being present in the deployed static output; deploy config must preserve the `dist/data` asset. Account mode additionally requires public Supabase Vite env vars.

## 10. Test and Build Commands

Install command inferred from lockfile/CI:

```bash
npm ci
```

Available package scripts:

```bash
npm run dev
npm run import:data
npm run build
npm run lint
npm test
npm run preview
```

Script details from `package.json`:

- `dev`: `vite`
- `import:data`: `node ./scripts/import-saas-directory.mjs`
- `build`: `tsc -b && vite build`
- `lint`: `eslint .`
- `test`: `vitest run`
- `preview`: `vite preview`

## 11. Recommended Next Technical Batches

1. Add cloud data service functions around Supabase.
   - Likely files: `src/lib/cloud-storage.ts`, new `src/lib/cloud-service.ts`, `src/test/`.
   - Validate with: `npm test`.

2. Add sign-in bootstrap and local-to-cloud migration prompt.
   - Likely files: `src/App.tsx`, `src/components/AuthPanel.tsx`, new migration component/helper tests.
   - Validate with: `npm test`, `npm run build`, and guest-mode browser smoke.

3. Add debounced account-mode saves with visible sync status.
   - Likely files: `src/App.tsx`, cloud service helpers, account UI.
   - Validate with mocked Supabase tests and manual Supabase smoke when env vars are available.

4. Add importer-side structural validation.
   - Likely files: `scripts/import-saas-directory.mjs`, `src/test/importer.test.ts`.
   - Validate with: `npm test` and `npm run import:data`.

5. Add URL/link-quality checks.
   - Likely files: `scripts/import-saas-directory.mjs`, possibly `reports/directory-link-audit.json`, `src/test/importer.test.ts`.
   - Validate with: `npm test` and `npm run import:data`.

## 12. Repo-Local Workflow Docs

Durable Codex workflow guidance now lives in:

- `docs/WORKFLOW.md`
- `docs/VERIFICATION.md`
- `docs/LESSONS_LEARNED.md`
- `AGENTS.md`

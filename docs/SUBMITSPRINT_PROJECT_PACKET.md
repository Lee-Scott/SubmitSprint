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
- Table/virtualization: `@tanstack/react-virtual` `^3.14.2` in `src/components/DirectoryTable.tsx`.
- Data/import tooling: Node script `scripts/import-saas-directory.mjs`, using built-in `fs/promises`, `path`, `url`, `crypto`, and global `fetch` for optional remote CSV input.
- Package manager: npm, inferred from `package-lock.json` lockfile version 3 and CI using `npm ci`.
- Node version: `.node-version` and `.nvmrc` both specify `22`.
- Deployment assumptions: static `dist` output, no environment variables per README, Cloudflare Pages/Vercel supported; `.env.example` was absent.

## 4. App Structure

- `src/main.tsx`: React entrypoint.
- `src/App.tsx`: top-level app state and orchestration. Fetches the dataset, owns profile/progress/settings/backup metadata state, wires backup import/export, search, smart views, sprint mode, reset, orphan cleanup, and persistence.
- `src/types.ts`: shared TypeScript types for directory records, progress records, startup profile, backup payload, smart views, and dataset/audit payloads.
- `src/lib/storage.ts`: localStorage keys, JSON read/write helpers, persistence functions, clipboard helper, and local reset helper.
- `src/lib/backup.ts`: backup creation/export and backup import validation/sanitization.
- `src/lib/directory.ts`: directory status helpers, smart view filtering/counting, search, sorting, URL validation, follow-up logic, progress merging, and orphan progress helpers.
- `src/lib/feedback.ts`: mailto helpers for contact/report/suggest flows.
- `src/components/Header.tsx`: top summary/header controls.
- `src/components/SmartViews.tsx`: smart view navigation.
- `src/components/DirectoryTable.tsx`: virtualized directory list, status actions, open/report links, live URL and notes inputs.
- `src/components/SprintPanel.tsx`: focused Fast 25 sprint workflow.
- `src/components/ProfilePanel.tsx`: startup profile form and copy actions.
- `src/components/BackupControls.tsx`: backup export/import/reset UI.
- `src/components/PrivacyTerms.tsx`: footer privacy/terms copy.
- `src/test/`: Vitest tests for backup, directory helpers, feedback helpers, and the importer. Top-level `test/` and `tests/` folders were absent.
- `docs/`: folder was absent before this packet was created.

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
  - Risk: malformed JSON falls back to `{}`, but valid JSON with the wrong structure is trusted and can produce invalid statuses or UI/count inconsistencies.

- `submitsprint.profile.v1`
  - Stores `StartupProfile`.
  - Expected fields: `startupName`, `websiteUrl`, `tagline`, `shortDescription`, `longDescription`, `founderName`, `contactEmail`, `logoUrl`, `category`, `keywords`, `xUrl`, `linkedinUrl`, `demoUrl`, `pricingSummary`, `updatedAt`.
  - Read by `loadProfile`; written by `saveProfile`; reset by `resetProgressState`.
  - Risk: valid but structurally wrong JSON is not hydrated through the stricter backup sanitizers.

- `submitsprint.settings.v1`
  - Stores settings.
  - Expected shape: `{ activeView: SmartViewId }`.
  - Read by `loadSettings`; written by `saveSettings`; reset by `resetProgressState`.
  - Risk: an invalid `activeView` string is trusted during hydration and may fall through smart-view logic.

- `submitsprint.backupMeta.v1`
  - Stores backup metadata.
  - Expected shape: `{ lastExportedAt?: string; meaningfulChangesSinceExport: number }`.
  - Read by `loadBackupMeta`; written by `saveBackupMeta`; reset by `resetProgressState`.
  - Risk: stale or malformed-but-parseable values can misstate backup recommendations or labels.

All four keys use a `.v1` suffix. No migration layer was found beyond changing key names/version suffixes.

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
- Progress text/date/url-like fields are truncated by length, but date and URL strings are not semantically validated during backup import.
- Safe unknown progress fields are preserved if the key matches a conservative identifier regex and the value is string/number/boolean.
- Settings import only checks that `activeView` is a string; it does not verify the value is a valid `SmartViewId`.
- Orphaned progress records are counted when `validDirectoryIds` is provided, but they are still merged into progress.

Failure handling:

- Bad JSON, wrong app, or unsupported schema return user-facing failure messages.
- Partial import of valid progress records continues when some progress records are invalid.
- `App.tsx` displays the import result message and clears undo on success.

Risks from malformed backup JSON:

- Large files are read with `file.text()`; no explicit file size limit was found.
- Dates and URL-like fields are length-limited but not date/URL validated.
- Imported orphan progress remains saved until the user chooses orphan cleanup.
- Imported settings can carry an invalid active view string.

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
- No runtime schema validation of the final JSON file was found in the app loader.

Warnings/errors emitted:

- Successful CLI run logs written record count, data version, imported/source row counts, records with warnings, and audit report path.
- CLI fetch/read/import failures are printed to stderr and set `process.exitCode = 1`.
- Current inspected dataset audit reports `4` `domain_url_mismatch` warnings and no skipped records.

Pipeline risks:

- Custom CSV parser may not cover every CSV edge case.
- Header drift is audited but not blocked.
- Generated JSON structure is trusted by the app after fetch.
- URL syntax is normalized, but link reachability is not tested.
- Duplicate domains can be legitimate directory subcommunities but can also hide duplicate or low-quality paths.

## 9. Known Risks / Upgrade Opportunities

- LocalStorage migration/versioning: keys have `.v1`, but there is no migration or structural validation for parseable stale state.
- Backup validation: backup import has useful schema gating and sanitization, but active view, dates, URL fields, file size, and orphan policy could be stricter.
- Generated JSON validation: `App.tsx` casts fetched JSON to `DatasetPayload`; malformed generated JSON could lead to runtime UI issues.
- URL/link quality: importer validates URL syntax, not reachability, redirects, submission-page intent, or broken links.
- Duplicate domains/paths: duplicate URLs/IDs are handled with warnings; duplicate domains are audit-only and may need review rules.
- Test coverage: tests exist for backup, importer, directory helpers, and feedback; no browser/component/e2e tests were found for localStorage hydration, UI import flow, or dataset fetch failures.
- UI/data consistency: category values are lowercased source values and include mixed language/transliteration; smart views depend on keyword matching against category/tags.
- Deployment/static asset risks: the runtime depends on `/data/master_directories.json` being present in the deployed static output; CI verifies 1,057 records in both `public` and `dist`, but deploy config must preserve the `dist/data` asset.

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

## 11. Recommended First Technical Batches

1. Add schema validation for backup import.
   - Likely files: `src/lib/backup.ts`, `src/test/backup.test.ts`.
   - Validate with: `npm test`.

2. Validate localStorage hydration.
   - Likely files: `src/lib/storage.ts`, new or existing storage-focused tests under `src/test/`.
   - Validate with: `npm test`.

3. Add structural validation to `import-saas-directory.mjs`.
   - Likely files: `scripts/import-saas-directory.mjs`, `src/test/importer.test.ts`.
   - Validate with: `npm test` and `npm run import:data`.

4. Add URL/link-quality checks.
   - Likely files: `scripts/import-saas-directory.mjs`, possibly `reports/directory-link-audit.json`, `src/test/importer.test.ts`.
   - Validate with: `npm test` and `npm run import:data`.

5. Add tests for malformed imports and generated directory records.
   - Likely files: `src/test/backup.test.ts`, `src/test/importer.test.ts`, possibly a new dataset validation test under `src/test/`.
   - Validate with: `npm test`.

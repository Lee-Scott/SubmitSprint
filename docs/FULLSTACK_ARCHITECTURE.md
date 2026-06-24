# SubmitSprint Full-Stack Architecture

## Current v2 Foundation

SubmitSprint remains a Vite React app that can run entirely in guest mode with
browser `localStorage`. The v2 foundation adds optional Supabase Auth wiring and
database schema planning without removing or weakening the local-first flow.

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are absent, the account UI
shows guest mode and the app does not create a Supabase client. Build and local
use must continue to work without backend environment variables.

## Modes

- Guest mode: profile, progress, settings, backup metadata, and sprint-session
  state use existing browser storage.
- Account mode foundation: Supabase Auth can create sessions when env vars are
  configured.
- Cloud sync: planned next. This first slice adds typed mapping helpers and SQL
  schema but does not yet persist app data to Supabase.

## Supabase Client

Client setup lives in `src/lib/supabase.ts`.

Required public Vite env vars:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

These are public browser values. Do not commit service role keys or private
database credentials.

## Data Model

The initial migration is in
`supabase/migrations/0001_initial_submitsprint_schema.sql`.

Tables:

- `profiles`: one row per authenticated user for startup profile fields.
- `directory_progress`: one row per user and directory id.
- `user_settings`: account-scoped app settings.
- `sprint_sessions`: current sprint-session JSON.
- `backup_export_metadata`: account-scoped backup reminder state.

Every user-owned table has RLS enabled. Policies restrict access to rows where
`auth.uid()` matches the row owner.

## Mapping Layer

Pure mappers live in `src/lib/cloud-storage.ts`:

- profile to/from `profiles`
- progress to/from `directory_progress`
- settings to/from `user_settings`
- sprint session to/from `sprint_sessions`
- local-to-cloud progress merge logic

The mapping layer is intentionally pure so it can be tested without live
Supabase calls.

## Compatibility Rules

- Guest/local mode must keep working with no Supabase project.
- Existing `localStorage` keys remain unchanged.
- Existing backup schema version `1` remains importable/exportable.
- Sprint-session state remains recoverable from local browser storage.
- Cloud sync must never silently erase local or cloud data.

## Next Implementation Batches

1. Add cloud read/write service functions using the existing mappers.
2. Load account data after sign-in without destroying local guest data.
3. Add a migration prompt with merge counts.
4. Debounce cloud saves for profile, settings, sprint sessions, and progress.
5. Add integration-style tests with mocked Supabase calls.

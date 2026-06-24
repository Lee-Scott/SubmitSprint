# Supabase Setup

## Environment

Copy `.env.example` to `.env.local` and fill in the public project values:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Only use the anon key in Vite/browser code. Never commit service role keys.

## Migration

Apply the SQL in:

```bash
supabase/migrations/0001_initial_submitsprint_schema.sql
```

The migration creates user-owned tables for profile, directory progress,
settings, sprint sessions, and backup metadata. Row-level security is enabled on
each table, with policies that allow authenticated users to read and write only
their own rows.

## Auth

The app uses Supabase Auth through `@supabase/supabase-js`.

Current foundation behavior:

- Missing env vars: guest-only mode, no Supabase client created.
- Configured env vars: compact account panel supports sign up, sign in, and
  sign out.
- App data still persists locally until the cloud sync batch is implemented.

## Local Development

```bash
npm install
npm run dev
```

Without `.env.local`, the app should still load in guest mode.

## Deployment

Configure the same public Vite environment variables in the static hosting
provider when account mode should be enabled. The production build must still
succeed without these values.

# SubmitSprint v2 Roadmap

## Goal

Transform SubmitSprint from a local-only static tracker into a hybrid app:
guest mode stays fully local, while account mode can sync user-owned state to
Supabase.

## Implemented Foundation

- Optional Supabase browser client configuration.
- Compact auth/account panel.
- Guest-mode fallback when Supabase env vars are missing.
- Initial Supabase SQL migration with RLS.
- Pure cloud mapping helpers for future sync work.
- Tests for environment detection, mapping, and local-to-cloud merge behavior.

## Remaining v2 Batches

1. Cloud data service layer for loading/saving profile, progress, settings,
   sprint session, and backup metadata.
2. Sign-in bootstrap that loads cloud data into the app state.
3. Local-to-cloud migration prompt with merge counts and no silent overwrite.
4. Debounced account-mode saves with visible sync status.
5. Account data export through the existing backup format.
6. Mocked Supabase service tests and manual account-mode smoke tests.
7. README and verification updates once cloud sync is fully functional.

## Non-Goals For The Foundation Slice

- No custom password authentication.
- No service role keys or private secrets.
- No backend routes or Cloudflare Worker API.
- No removal of localStorage or backup import/export.
- No live-network Supabase tests.

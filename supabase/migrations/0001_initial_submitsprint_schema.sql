create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  startup_name text not null default '',
  website_url text not null default '',
  tagline text not null default '',
  short_description text not null default '',
  long_description text not null default '',
  founder_name text not null default '',
  contact_email text not null default '',
  logo_url text not null default '',
  category text not null default '',
  keywords text not null default '',
  social_urls jsonb not null default '{}'::jsonb,
  pricing_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.directory_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  directory_id text not null,
  status text not null check (status in ('todo', 'opened', 'submitted', 'published', 'follow_up', 'skipped', 'broken')),
  opened_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  skipped_at timestamptz,
  live_url text,
  notes text,
  skip_reason text,
  last_action_at timestamptz,
  last_action_type text,
  follow_up_at timestamptz,
  quality_flags jsonb not null default '{}'::jsonb,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, directory_id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_view text not null default 'start_here',
  other_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sprint_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_export_metadata (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_exported_at timestamptz,
  meaningful_changes_since_export integer not null default 0 check (meaningful_changes_since_export >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists directory_progress_user_id_idx on public.directory_progress (user_id);
create index if not exists directory_progress_directory_id_idx on public.directory_progress (directory_id);
create index if not exists directory_progress_user_status_idx on public.directory_progress (user_id, status);
create index if not exists directory_progress_user_follow_up_idx on public.directory_progress (user_id, follow_up_at);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists directory_progress_set_updated_at on public.directory_progress;
create trigger directory_progress_set_updated_at
before update on public.directory_progress
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists sprint_sessions_set_updated_at on public.sprint_sessions;
create trigger sprint_sessions_set_updated_at
before update on public.sprint_sessions
for each row execute function public.set_updated_at();

drop trigger if exists backup_export_metadata_set_updated_at on public.backup_export_metadata;
create trigger backup_export_metadata_set_updated_at
before update on public.backup_export_metadata
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.directory_progress enable row level security;
alter table public.user_settings enable row level security;
alter table public.sprint_sessions enable row level security;
alter table public.backup_export_metadata enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can delete their profile" on public.profiles;
create policy "Users can delete their profile"
on public.profiles for delete
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can read their directory progress" on public.directory_progress;
create policy "Users can read their directory progress"
on public.directory_progress for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their directory progress" on public.directory_progress;
create policy "Users can insert their directory progress"
on public.directory_progress for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their directory progress" on public.directory_progress;
create policy "Users can update their directory progress"
on public.directory_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their directory progress" on public.directory_progress;
create policy "Users can delete their directory progress"
on public.directory_progress for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their settings" on public.user_settings;
create policy "Users can read their settings"
on public.user_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can write their settings" on public.user_settings;
create policy "Users can write their settings"
on public.user_settings for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their sprint session" on public.sprint_sessions;
create policy "Users can read their sprint session"
on public.sprint_sessions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can write their sprint session" on public.sprint_sessions;
create policy "Users can write their sprint session"
on public.sprint_sessions for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their backup metadata" on public.backup_export_metadata;
create policy "Users can read their backup metadata"
on public.backup_export_metadata for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can write their backup metadata" on public.backup_export_metadata;
create policy "Users can write their backup metadata"
on public.backup_export_metadata for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

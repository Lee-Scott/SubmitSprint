import { SmartViewIdSchema, SubmissionSprintSessionSchema } from './schemas';
import type { DirectoryProgress, SmartViewId, StartupProfile, SubmissionSprintSession } from '../types';
import type { SettingsState } from './storage';

type NullableString = string | null;

export type CloudProfileRow = {
  id: string;
  startup_name: string;
  website_url: string;
  tagline: string;
  short_description: string;
  long_description: string;
  founder_name: string;
  contact_email: string;
  logo_url: string;
  category: string;
  keywords: string;
  social_urls: {
    x_url?: string;
    linkedin_url?: string;
    demo_url?: string;
  };
  pricing_summary: string;
  updated_at: string;
};

export type CloudDirectoryProgressRow = {
  user_id: string;
  directory_id: string;
  status: DirectoryProgress['status'];
  opened_at: NullableString;
  submitted_at: NullableString;
  published_at: NullableString;
  skipped_at: NullableString;
  live_url: NullableString;
  notes: NullableString;
  skip_reason: NullableString;
  last_action_at: NullableString;
  last_action_type: NullableString;
  follow_up_at: NullableString;
  last_updated_at: string;
};

export type CloudSettingsRow = {
  user_id: string;
  active_view: SmartViewId;
  other_settings: Record<string, unknown>;
  updated_at: string;
};

export type CloudSprintSessionRow = {
  user_id: string;
  session: SubmissionSprintSession;
  updated_at: string;
};

function nullable(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function dateValue(value?: string) {
  return value || null;
}

function newestProgress(left: DirectoryProgress, right: DirectoryProgress) {
  return new Date(left.lastUpdatedAt).getTime() >= new Date(right.lastUpdatedAt).getTime() ? left : right;
}

export function profileToCloudRow(profile: StartupProfile, userId: string): CloudProfileRow {
  return {
    id: userId,
    startup_name: profile.startupName,
    website_url: profile.websiteUrl,
    tagline: profile.tagline,
    short_description: profile.shortDescription,
    long_description: profile.longDescription,
    founder_name: profile.founderName,
    contact_email: profile.contactEmail,
    logo_url: profile.logoUrl,
    category: profile.category,
    keywords: profile.keywords,
    social_urls: {
      x_url: profile.xUrl || undefined,
      linkedin_url: profile.linkedinUrl || undefined,
      demo_url: profile.demoUrl || undefined,
    },
    pricing_summary: profile.pricingSummary,
    updated_at: profile.updatedAt || new Date().toISOString(),
  };
}

export function cloudRowToProfile(row: CloudProfileRow): StartupProfile {
  return {
    startupName: row.startup_name,
    websiteUrl: row.website_url,
    tagline: row.tagline,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    founderName: row.founder_name,
    contactEmail: row.contact_email,
    logoUrl: row.logo_url,
    category: row.category,
    keywords: row.keywords,
    xUrl: row.social_urls.x_url ?? '',
    linkedinUrl: row.social_urls.linkedin_url ?? '',
    demoUrl: row.social_urls.demo_url ?? '',
    pricingSummary: row.pricing_summary,
    updatedAt: row.updated_at,
  };
}

export function progressToCloudRow(progress: DirectoryProgress, userId: string): CloudDirectoryProgressRow {
  return {
    user_id: userId,
    directory_id: progress.directoryId,
    status: progress.status,
    opened_at: dateValue(progress.openedAt),
    submitted_at: dateValue(progress.submittedAt),
    published_at: dateValue(progress.publishedAt),
    skipped_at: dateValue(progress.skippedAt),
    live_url: nullable(progress.liveUrl),
    notes: nullable(progress.notes),
    skip_reason: nullable(progress.skipReason),
    last_action_at: dateValue(progress.lastActionAt),
    last_action_type: nullable(progress.lastActionType),
    follow_up_at: dateValue(progress.followUpDueAt),
    last_updated_at: progress.lastUpdatedAt,
  };
}

export function cloudRowToProgress(row: CloudDirectoryProgressRow): DirectoryProgress {
  const progress: DirectoryProgress = {
    directoryId: row.directory_id,
    status: row.status,
    lastUpdatedAt: row.last_updated_at,
  };

  if (row.opened_at) progress.openedAt = row.opened_at;
  if (row.submitted_at) progress.submittedAt = row.submitted_at;
  if (row.published_at) progress.publishedAt = row.published_at;
  if (row.skipped_at) progress.skippedAt = row.skipped_at;
  if (row.live_url) progress.liveUrl = row.live_url;
  if (row.notes) progress.notes = row.notes;
  if (row.skip_reason) progress.skipReason = row.skip_reason;
  if (row.last_action_at) progress.lastActionAt = row.last_action_at;
  if (row.last_action_type) progress.lastActionType = row.last_action_type;
  if (row.follow_up_at) progress.followUpDueAt = row.follow_up_at;

  return progress;
}

export function settingsToCloudRow(settings: SettingsState, userId: string, now = new Date()): CloudSettingsRow {
  return {
    user_id: userId,
    active_view: settings.activeView,
    other_settings: {},
    updated_at: now.toISOString(),
  };
}

export function cloudRowToSettings(row: CloudSettingsRow, fallback: SettingsState): SettingsState {
  const activeView = SmartViewIdSchema.safeParse(row.active_view);
  return activeView.success ? { activeView: activeView.data } : fallback;
}

export function sprintSessionToCloudRow(session: SubmissionSprintSession, userId: string, now = new Date()): CloudSprintSessionRow {
  return {
    user_id: userId,
    session,
    updated_at: now.toISOString(),
  };
}

export function cloudRowToSprintSession(row: CloudSprintSessionRow) {
  const result = SubmissionSprintSessionSchema.safeParse(row.session);
  return result.success ? result.data : undefined;
}

export function progressRowsToMap(rows: CloudDirectoryProgressRow[]) {
  return Object.fromEntries(rows.map((row) => {
    const progress = cloudRowToProgress(row);
    return [progress.directoryId, progress];
  }));
}

export function mergeLocalProgressForCloud(
  localProgress: Record<string, DirectoryProgress>,
  cloudProgress: Record<string, DirectoryProgress>,
) {
  const merged = { ...cloudProgress };
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const [directoryId, localRecord] of Object.entries(localProgress)) {
    const cloudRecord = merged[directoryId];

    if (!cloudRecord) {
      merged[directoryId] = localRecord;
      imported += 1;
      continue;
    }

    const winner = newestProgress(localRecord, cloudRecord);

    if (winner === localRecord) {
      merged[directoryId] = localRecord;
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { merged, imported, updated, skipped };
}

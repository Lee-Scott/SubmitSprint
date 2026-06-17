import { createEmptyProfile, directoryStatuses, mergeProgressRecords } from './directory';
import type { DirectoryProgress, StartupProfile, SubmitSprintBackup } from '../types';
import type { SettingsState } from './storage';

const maxProfileFieldLength = 5000;
const maxProgressTextLength = 5000;
const maxUrlLength = 2048;
const maxDateLength = 80;
const maxDirectoryIdLength = 300;
const validStatuses = new Set(directoryStatuses);
const safeUnknownKey = /^[a-zA-Z][a-zA-Z0-9_]{0,50}$/;

type ImportOptions = {
  currentProfile: StartupProfile;
  currentProgress: Record<string, DirectoryProgress>;
  currentSettings: SettingsState;
  validDirectoryIds?: Set<string>;
};

type ImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  invalid: number;
  orphaned: number;
  profileImported: boolean;
  profileSkipped: boolean;
};

export function createBackup(args: {
  datasetVersion?: string;
  profile: StartupProfile;
  progressMap: Record<string, DirectoryProgress>;
  settings: SettingsState;
}): SubmitSprintBackup {
  return {
    appName: 'SubmitSprint',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    datasetVersion: args.datasetVersion,
    startupProfile: args.profile,
    progressRecords: Object.values(args.progressMap),
    settings: args.settings,
  };
}

export function exportBackup(args: {
  datasetVersion?: string;
  profile: StartupProfile;
  progressMap: Record<string, DirectoryProgress>;
  settings: SettingsState;
}) {
  const backup = createBackup(args);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `submitsprint-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.URL.revokeObjectURL(url);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.slice(0, maxLength);
}

function sanitizeDateString(value: unknown) {
  return sanitizeString(value, maxDateLength);
}

function sanitizeProfile(candidate: unknown) {
  const emptyProfile = createEmptyProfile();

  if (!isObject(candidate)) {
    return { profile: emptyProfile, isEmpty: true };
  }

  const profile: StartupProfile = {
    startupName: sanitizeString(candidate.startupName, maxProfileFieldLength) ?? '',
    websiteUrl: sanitizeString(candidate.websiteUrl, maxUrlLength) ?? '',
    tagline: sanitizeString(candidate.tagline, maxProfileFieldLength) ?? '',
    shortDescription: sanitizeString(candidate.shortDescription, maxProfileFieldLength) ?? '',
    longDescription: sanitizeString(candidate.longDescription, maxProfileFieldLength) ?? '',
    founderName: sanitizeString(candidate.founderName, maxProfileFieldLength) ?? '',
    contactEmail: sanitizeString(candidate.contactEmail, maxProfileFieldLength) ?? '',
    logoUrl: sanitizeString(candidate.logoUrl, maxUrlLength) ?? '',
    category: sanitizeString(candidate.category, maxProfileFieldLength) ?? '',
    keywords: sanitizeString(candidate.keywords, maxProfileFieldLength) ?? '',
    xUrl: sanitizeString(candidate.xUrl, maxUrlLength) ?? '',
    linkedinUrl: sanitizeString(candidate.linkedinUrl, maxUrlLength) ?? '',
    demoUrl: sanitizeString(candidate.demoUrl, maxUrlLength) ?? '',
    pricingSummary: sanitizeString(candidate.pricingSummary, maxProfileFieldLength) ?? '',
    updatedAt: sanitizeDateString(candidate.updatedAt) ?? '',
  };

  return { profile, isEmpty: isProfileEmpty(profile) };
}

export function isProfileEmpty(profile: StartupProfile) {
  return Object.entries(profile).every(([key, value]) => key === 'updatedAt' || !String(value).trim());
}

function sanitizeSettings(candidate: unknown, fallback: SettingsState) {
  if (!isObject(candidate)) {
    return fallback;
  }

  if (typeof candidate.activeView === 'string') {
    return { activeView: candidate.activeView as SettingsState['activeView'] };
  }

  return fallback;
}

function preserveSafeUnknownFields(candidate: Record<string, unknown>, knownKeys: Set<string>) {
  const safeFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(candidate)) {
    if (knownKeys.has(key) || !safeUnknownKey.test(key)) {
      continue;
    }

    if (typeof value === 'string') {
      safeFields[key] = sanitizeString(value, maxProgressTextLength);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      safeFields[key] = value;
    } else if (typeof value === 'boolean') {
      safeFields[key] = value;
    }
  }

  return safeFields;
}

export function sanitizeProgressRecord(candidate: unknown) {
  if (!isObject(candidate)) {
    return { ok: false as const };
  }

  const directoryId = sanitizeString(candidate.directoryId, maxDirectoryIdLength);
  const status = sanitizeString(candidate.status, 40);

  if (!directoryId || !status || !validStatuses.has(status as DirectoryProgress['status'])) {
    return { ok: false as const };
  }

  const knownKeys = new Set([
    'directoryId',
    'status',
    'openedAt',
    'submittedAt',
    'publishedAt',
    'skippedAt',
    'liveUrl',
    'notes',
    'skipReason',
    'lastActionAt',
    'lastActionType',
    'followUpDueAt',
    'lastUpdatedAt',
  ]);

  const record: DirectoryProgress = {
    ...preserveSafeUnknownFields(candidate, knownKeys),
    directoryId,
    status: status as DirectoryProgress['status'],
    lastUpdatedAt: sanitizeDateString(candidate.lastUpdatedAt) ?? new Date().toISOString(),
  };

  const openedAt = sanitizeDateString(candidate.openedAt);
  const submittedAt = sanitizeDateString(candidate.submittedAt);
  const publishedAt = sanitizeDateString(candidate.publishedAt);
  const skippedAt = sanitizeDateString(candidate.skippedAt);
  const liveUrl = sanitizeString(candidate.liveUrl, maxUrlLength);
  const notes = sanitizeString(candidate.notes, maxProgressTextLength);
  const skipReason = sanitizeString(candidate.skipReason, maxProgressTextLength);
  const lastActionAt = sanitizeDateString(candidate.lastActionAt);
  const lastActionType = sanitizeString(candidate.lastActionType, 80);
  const followUpDueAt = sanitizeDateString(candidate.followUpDueAt);

  if (openedAt) record.openedAt = openedAt;
  if (submittedAt) record.submittedAt = submittedAt;
  if (publishedAt) record.publishedAt = publishedAt;
  if (skippedAt) record.skippedAt = skippedAt;
  if (liveUrl) record.liveUrl = liveUrl;
  if (notes) record.notes = notes;
  if (skipReason) record.skipReason = skipReason;
  if (lastActionAt) record.lastActionAt = lastActionAt;
  if (lastActionType) record.lastActionType = lastActionType;
  if (followUpDueAt) record.followUpDueAt = followUpDueAt;

  return { ok: true as const, record };
}

export function validateBackup(candidate: unknown): candidate is SubmitSprintBackup {
  if (!isObject(candidate)) {
    return false;
  }

  return (
    candidate.appName === 'SubmitSprint' &&
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.progressRecords) &&
    isObject(candidate.startupProfile)
  );
}

function buildImportMessage(summary: ImportSummary) {
  const profileMessage = summary.profileImported ? 'profile imported' : 'profile skipped';
  return `Imported ${summary.imported}, updated ${summary.updated}, skipped ${summary.skipped}, invalid ${summary.invalid}, orphaned ${summary.orphaned}; ${profileMessage}`;
}

export function importBackupData(candidate: unknown, options: ImportOptions) {
  if (!validateBackup(candidate)) {
    return { ok: false as const, message: 'Backup file is invalid or unsupported' };
  }

  const sanitizedProgress: DirectoryProgress[] = [];
  let invalid = 0;
  let orphaned = 0;

  for (const candidateRecord of candidate.progressRecords) {
    const result = sanitizeProgressRecord(candidateRecord);

    if (!result.ok) {
      invalid += 1;
      continue;
    }

    if (options.validDirectoryIds && !options.validDirectoryIds.has(result.record.directoryId)) {
      orphaned += 1;
    }

    sanitizedProgress.push(result.record);
  }

  const { merged, importedCount, updatedCount, skippedCount } = mergeProgressRecords(
    options.currentProgress,
    sanitizedProgress,
  );
  const profileResult = sanitizeProfile(candidate.startupProfile);
  const shouldImportProfile = !profileResult.isEmpty;
  const summary: ImportSummary = {
    imported: importedCount,
    updated: updatedCount,
    skipped: skippedCount,
    invalid,
    orphaned,
    profileImported: shouldImportProfile,
    profileSkipped: !shouldImportProfile,
  };

  return {
    ok: true as const,
    profile: shouldImportProfile ? profileResult.profile : options.currentProfile,
    progressMap: merged,
    settings: sanitizeSettings(candidate.settings, options.currentSettings),
    summary,
    message: buildImportMessage(summary),
  };
}

export function importBackupText(raw: string, options: ImportOptions) {
  try {
    return importBackupData(JSON.parse(raw) as unknown, options);
  } catch {
    return { ok: false as const, message: 'Backup import failed' };
  }
}

export async function importBackupFile(file: File, options: ImportOptions) {
  try {
    return importBackupText(await file.text(), options);
  } catch {
    return { ok: false as const, message: 'Backup import failed' };
  }
}

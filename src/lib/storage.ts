import { createEmptyProfile, isValidHttpUrl } from './directory';
import { BackupMetaSchema, DirectoryProgressSchema, SettingsStateSchema, StartupProfileSchema, SubmissionSprintSessionSchema } from './schemas';
import type { DirectoryProgress, SmartViewId, StartupProfile, SubmissionSprintSession } from '../types';

const storageKeys = {
  progress: 'submitsprint.progress.v1',
  profile: 'submitsprint.profile.v1',
  settings: 'submitsprint.settings.v1',
  backupMeta: 'submitsprint.backupMeta.v1',
  sprintSession: 'submitsprint.sprintSession.v1',
} as const;

export type SettingsState = {
  activeView: SmartViewId;
};

export type BackupMeta = {
  lastExportedAt?: string;
  meaningfulChangesSinceExport: number;
};

const defaultSettings: SettingsState = {
  activeView: 'start_here',
};

const defaultBackupMeta: BackupMeta = {
  lastExportedAt: undefined,
  meaningfulChangesSinceExport: 0,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidDateString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function sanitizeStoredUrl(value: unknown) {
  return typeof value === 'string' && isValidHttpUrl(value) ? value : '';
}

function readJson(key: string): unknown {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadProgress() {
  const candidate = readJson(storageKeys.progress);

  if (!isObject(candidate)) {
    return {};
  }

  const progressEntries = Object.values(candidate)
    .map((value) => DirectoryProgressSchema.safeParse(value))
    .filter((result) => result.success)
    .map((result) => result.data);

  return Object.fromEntries(progressEntries.map((record) => [record.directoryId, record]));
}

export function saveProgress(progress: Record<string, DirectoryProgress>) {
  writeJson(storageKeys.progress, progress);
}

export function loadProfile(): StartupProfile {
  const candidate = readJson(storageKeys.profile);
  const emptyProfile = createEmptyProfile();

  if (!isObject(candidate)) {
    return emptyProfile;
  }

  const profileCandidate = {
    startupName: typeof candidate.startupName === 'string' ? candidate.startupName : emptyProfile.startupName,
    websiteUrl: sanitizeStoredUrl(candidate.websiteUrl),
    tagline: typeof candidate.tagline === 'string' ? candidate.tagline : emptyProfile.tagline,
    shortDescription: typeof candidate.shortDescription === 'string' ? candidate.shortDescription : emptyProfile.shortDescription,
    longDescription: typeof candidate.longDescription === 'string' ? candidate.longDescription : emptyProfile.longDescription,
    founderName: typeof candidate.founderName === 'string' ? candidate.founderName : emptyProfile.founderName,
    contactEmail: typeof candidate.contactEmail === 'string' ? candidate.contactEmail : emptyProfile.contactEmail,
    logoUrl: sanitizeStoredUrl(candidate.logoUrl),
    category: typeof candidate.category === 'string' ? candidate.category : emptyProfile.category,
    keywords: typeof candidate.keywords === 'string' ? candidate.keywords : emptyProfile.keywords,
    xUrl: sanitizeStoredUrl(candidate.xUrl),
    linkedinUrl: sanitizeStoredUrl(candidate.linkedinUrl),
    demoUrl: sanitizeStoredUrl(candidate.demoUrl),
    pricingSummary: typeof candidate.pricingSummary === 'string' ? candidate.pricingSummary : emptyProfile.pricingSummary,
    updatedAt: typeof candidate.updatedAt === 'string' && isValidDateString(candidate.updatedAt) ? candidate.updatedAt : '',
  };

  return StartupProfileSchema.parse(profileCandidate);
}

export function saveProfile(profile: StartupProfile) {
  writeJson(storageKeys.profile, profile);
}

export function loadSettings() {
  const result = SettingsStateSchema.safeParse(readJson(storageKeys.settings));
  return result.success ? result.data : defaultSettings;
}

export function saveSettings(settings: SettingsState) {
  writeJson(storageKeys.settings, settings);
}

export function loadBackupMeta() {
  const candidate = readJson(storageKeys.backupMeta);

  if (!isObject(candidate)) {
    return defaultBackupMeta;
  }

  const result = BackupMetaSchema.safeParse({
    lastExportedAt:
      typeof candidate.lastExportedAt === 'string' && isValidDateString(candidate.lastExportedAt)
        ? candidate.lastExportedAt
        : undefined,
    meaningfulChangesSinceExport:
      typeof candidate.meaningfulChangesSinceExport === 'number' && Number.isFinite(candidate.meaningfulChangesSinceExport)
        ? Math.max(0, Math.trunc(candidate.meaningfulChangesSinceExport))
        : 0,
  });

  return result.success ? result.data : defaultBackupMeta;
}

export function saveBackupMeta(meta: BackupMeta) {
  writeJson(storageKeys.backupMeta, meta);
}

export function loadSprintSession() {
  const result = SubmissionSprintSessionSchema.safeParse(readJson(storageKeys.sprintSession));
  return result.success ? result.data : undefined;
}

export function saveSprintSession(session?: SubmissionSprintSession) {
  if (!session) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKeys.sprintSession);
    }
    return;
  }

  // Sprint sessions are intentionally local-only UI workflow state and are not included in backup files.
  writeJson(storageKeys.sprintSession, session);
}

export async function copyText(value: string) {
  if (!value) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to legacy copy.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

export function resetProgressState() {
  if (typeof window === 'undefined') {
    return;
  }

  for (const key of Object.values(storageKeys)) {
    window.localStorage.removeItem(key);
  }
}

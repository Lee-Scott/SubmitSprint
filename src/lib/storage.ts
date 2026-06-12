import { createEmptyProfile } from './directory';
import type { DirectoryProgress, SmartViewId, StartupProfile } from '../types';

const storageKeys = {
  progress: 'submitsprint.progress.v1',
  profile: 'submitsprint.profile.v1',
  settings: 'submitsprint.settings.v1',
  backupMeta: 'submitsprint.backupMeta.v1',
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

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadProgress() {
  return readJson<Record<string, DirectoryProgress>>(storageKeys.progress, {});
}

export function saveProgress(progress: Record<string, DirectoryProgress>) {
  writeJson(storageKeys.progress, progress);
}

export function loadProfile(): StartupProfile {
  return readJson<StartupProfile>(storageKeys.profile, createEmptyProfile());
}

export function saveProfile(profile: StartupProfile) {
  writeJson(storageKeys.profile, profile);
}

export function loadSettings() {
  return readJson<SettingsState>(storageKeys.settings, defaultSettings);
}

export function saveSettings(settings: SettingsState) {
  writeJson(storageKeys.settings, settings);
}

export function loadBackupMeta() {
  return readJson<BackupMeta>(storageKeys.backupMeta, defaultBackupMeta);
}

export function saveBackupMeta(meta: BackupMeta) {
  writeJson(storageKeys.backupMeta, meta);
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

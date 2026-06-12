import { createEmptyProfile, mergeProgressRecords } from './directory';
import type { DirectoryProgress, StartupProfile, SubmitSprintBackup } from '../types';
import type { SettingsState } from './storage';

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

export function validateBackup(candidate: unknown): candidate is SubmitSprintBackup {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const backup = candidate as SubmitSprintBackup;
  return (
    backup.appName === 'SubmitSprint' &&
    backup.schemaVersion === 1 &&
    Array.isArray(backup.progressRecords) &&
    typeof backup.startupProfile === 'object' &&
    backup.startupProfile !== null
  );
}

export async function importBackupFile(
  file: File,
  options: {
    currentProfile: StartupProfile;
    currentProgress: Record<string, DirectoryProgress>;
    currentSettings: SettingsState;
  },
) {
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as unknown;

    if (!validateBackup(parsed)) {
      return { ok: false as const, message: 'Backup file is invalid or unsupported' };
    }

    const { merged, importedCount, updatedCount, skippedCount } = mergeProgressRecords(
      options.currentProgress,
      parsed.progressRecords,
    );

    return {
      ok: true as const,
      profile: parsed.startupProfile ?? createEmptyProfile(),
      progressMap: merged,
      settings: (parsed.settings as SettingsState | undefined) ?? options.currentSettings,
      message: `Imported ${importedCount}, updated ${updatedCount}, skipped ${skippedCount}`,
    };
  } catch {
    return { ok: false as const, message: 'Backup import failed' };
  }
}

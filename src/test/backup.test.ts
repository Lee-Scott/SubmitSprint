import { describe, expect, it } from 'vitest';

import { createBackup, importBackupData, importBackupText, sanitizeProgressRecord, validateBackup } from '../lib/backup';
import { createEmptyProfile } from '../lib/directory';
import type { DirectoryProgress, StartupProfile } from '../types';

const currentProfile: StartupProfile = {
  ...createEmptyProfile(),
  startupName: 'Current Startup',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const options = {
  currentProfile,
  currentProgress: {
    existing: { directoryId: 'existing', status: 'opened' as const, lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
  },
  currentSettings: { activeView: 'start_here' as const },
  validDirectoryIds: new Set(['existing', 'new']),
};

function backup(overrides: Partial<ReturnType<typeof createBackup>> = {}) {
  return {
    appName: 'SubmitSprint',
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    startupProfile: { ...createEmptyProfile(), startupName: 'Imported Startup' },
    progressRecords: [],
    ...overrides,
  };
}

describe('validateBackup', () => {
  it('accepts a valid backup payload', () => {
    expect(validateBackup(backup())).toBe(true);
  });

  it('rejects invalid backup payloads', () => {
    expect(validateBackup({ appName: 'Other', schemaVersion: 1, startupProfile: {}, progressRecords: [] })).toBe(false);
    expect(validateBackup(backup({ schemaVersion: 99 }))).toBe(false);
  });
});

describe('importBackupText', () => {
  it('rejects corrupt JSON', () => {
    expect(importBackupText('{nope', options)).toEqual({ ok: false, message: 'Backup import failed' });
  });

  it('rejects wrong appName and unsupported schema', () => {
    expect(importBackupData(backup({ appName: 'Other' as 'SubmitSprint' }), options).ok).toBe(false);
    expect(importBackupData(backup({ schemaVersion: 2 }), options).ok).toBe(false);
  });
});

describe('importBackupData', () => {
  it('imports a valid current backup and preserves unrelated progress', () => {
    const result = importBackupData(
      backup({
        progressRecords: [
          { directoryId: 'new', status: 'submitted', lastUpdatedAt: '2026-02-01T00:00:00.000Z' },
          { directoryId: 'existing', status: 'published', lastUpdatedAt: '2026-02-01T00:00:00.000Z' },
        ],
      }),
      options,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.progressMap.new.status).toBe('submitted');
    expect(result.progressMap.existing.status).toBe('published');
    expect(result.summary.imported).toBe(1);
    expect(result.summary.updated).toBe(1);
    expect(result.summary.profileImported).toBe(true);
  });

  it('does not overwrite a useful profile with an empty imported profile', () => {
    const result = importBackupData(
      backup({
        startupProfile: createEmptyProfile(),
        progressRecords: [{ directoryId: 'new', status: 'submitted', lastUpdatedAt: '2026-02-01T00:00:00.000Z' }],
      }),
      options,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.startupName).toBe('Current Startup');
    expect(result.summary.profileImported).toBe(false);
    expect(result.summary.profileSkipped).toBe(true);
  });

  it('rejects invalid status values while importing valid records', () => {
    const result = importBackupData(
      backup({
        progressRecords: [
          { directoryId: 'new', status: 'submitted', lastUpdatedAt: '2026-02-01T00:00:00.000Z' },
          { directoryId: 'bad', status: 'done', lastUpdatedAt: '2026-02-01T00:00:00.000Z' } as unknown as DirectoryProgress,
        ],
      }),
      options,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.progressMap.new.status).toBe('submitted');
    expect(result.progressMap.bad).toBeUndefined();
    expect(result.summary.invalid).toBe(1);
  });

  it('counts orphaned progress records without deleting them', () => {
    const result = importBackupData(
      backup({
        progressRecords: [{ directoryId: 'orphan', status: 'submitted', lastUpdatedAt: '2026-02-01T00:00:00.000Z' }],
      }),
      options,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.progressMap.orphan.status).toBe('submitted');
    expect(result.summary.orphaned).toBe(1);
  });
});

describe('sanitizeProgressRecord', () => {
  it('preserves safe future fields and truncates oversized strings', () => {
    const result = sanitizeProgressRecord({
      directoryId: 'new',
      status: 'submitted',
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
      futureFlag: true,
      futureNote: 'x'.repeat(6000),
      notes: 'n'.repeat(6000),
      '<bad>': 'nope',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.record as DirectoryProgress & { futureFlag?: boolean }).futureFlag).toBe(true);
    expect((result.record as DirectoryProgress & { futureNote?: string }).futureNote).toHaveLength(5000);
    expect(result.record.notes).toHaveLength(5000);
    expect((result.record as DirectoryProgress & { '<bad>'?: string })['<bad>']).toBeUndefined();
  });
});

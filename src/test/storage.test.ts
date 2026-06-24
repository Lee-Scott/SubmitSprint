import { afterEach, describe, expect, it } from 'vitest';

import { createEmptyProfile } from '../lib/directory';
import { loadBackupMeta, loadProfile, loadProgress, loadSettings, loadSprintSession } from '../lib/storage';

const storageKeys = {
  progress: 'submitsprint.progress.v1',
  profile: 'submitsprint.profile.v1',
  settings: 'submitsprint.settings.v1',
  backupMeta: 'submitsprint.backupMeta.v1',
  sprintSession: 'submitsprint.sprintSession.v1',
} as const;

function installWindow() {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          return storage.has(key) ? storage.get(key)! : null;
        },
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
        removeItem(key: string) {
          storage.delete(key);
        },
        clear() {
          storage.clear();
        },
      },
    },
  });

  return storage;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

describe('storage hydration', () => {
  it('skips invalid progress records and keeps valid ones', () => {
    const storage = installWindow();
    storage.set(
      storageKeys.progress,
      JSON.stringify({
        good: { directoryId: 'good', status: 'opened', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
        badStatus: { directoryId: 'bad-status', status: 'done', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
        badDate: { directoryId: 'bad-date', status: 'todo', lastUpdatedAt: 'not-a-date' },
        badShape: 'nope',
      }),
    );

    expect(loadProgress()).toEqual({
      good: { directoryId: 'good', status: 'opened', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
    });
  });

  it('falls back to the default view when activeView is invalid', () => {
    const storage = installWindow();
    storage.set(storageKeys.settings, JSON.stringify({ activeView: 'not-real' }));

    expect(loadSettings()).toEqual({ activeView: 'start_here' });
  });

  it('returns safe defaults for malformed or wrong-shaped profile and backup metadata', () => {
    const storage = installWindow();
    const emptyProfile = createEmptyProfile();

    storage.set(
      storageKeys.profile,
      JSON.stringify({
        startupName: 123,
        websiteUrl: 'https://valid.test',
        updatedAt: 'not-a-date',
      }),
    );
    storage.set(
      storageKeys.backupMeta,
      JSON.stringify({
        lastExportedAt: 'not-a-date',
        meaningfulChangesSinceExport: 'a lot',
      }),
    );

    expect(loadProfile()).toEqual({
      ...emptyProfile,
      websiteUrl: 'https://valid.test',
    });
    expect(loadBackupMeta()).toEqual({
      lastExportedAt: undefined,
      meaningfulChangesSinceExport: 0,
    });
  });

  it('falls back safely on malformed JSON', () => {
    const storage = installWindow();
    storage.set(storageKeys.profile, '{');
    storage.set(storageKeys.backupMeta, '{');

    expect(loadProfile()).toEqual(createEmptyProfile());
    expect(loadBackupMeta()).toEqual({
      lastExportedAt: undefined,
      meaningfulChangesSinceExport: 0,
    });
  });

  it('loads valid sprint session state and rejects malformed sessions', () => {
    const storage = installWindow();
    storage.set(
      storageKeys.sprintSession,
      JSON.stringify({
        id: 'session-1',
        startedAt: '2026-01-01T00:00:00.000Z',
        queueType: 'fast_25',
        queueName: 'Fast 25',
        directoryIds: ['one', 'two'],
        currentDirectoryId: 'one',
        currentIndex: 0,
        initialCount: 2,
        sessionNotes: 'Good sprint',
        state: 'active',
      }),
    );

    expect(loadSprintSession()?.directoryIds).toEqual(['one', 'two']);

    storage.set(
      storageKeys.sprintSession,
      JSON.stringify({
        id: 'bad',
        startedAt: 'not-a-date',
        queueType: 'fast_25',
        queueName: 'Fast 25',
        directoryIds: ['one'],
        currentIndex: 0,
        initialCount: 1,
        state: 'active',
      }),
    );

    expect(loadSprintSession()).toBeUndefined();
  });
});

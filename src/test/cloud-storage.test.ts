import { describe, expect, it } from 'vitest';

import {
  cloudRowToProfile,
  cloudRowToProgress,
  cloudRowToSettings,
  cloudRowToSprintSession,
  mergeLocalProgressForCloud,
  profileToCloudRow,
  progressRowsToMap,
  progressToCloudRow,
  settingsToCloudRow,
  sprintSessionToCloudRow,
} from '../lib/cloud-storage';
import { createEmptyProfile } from '../lib/directory';
import { createSprintSession } from '../lib/sessions';
import type { DirectoryProgress } from '../types';

describe('cloud storage mapping', () => {
  it('round-trips startup profiles through cloud row shape', () => {
    const profile = {
      ...createEmptyProfile(),
      startupName: 'SubmitSprint',
      websiteUrl: 'https://submitsprint.test',
      xUrl: 'https://x.com/submitsprint',
      linkedinUrl: 'https://linkedin.com/company/submitsprint',
      demoUrl: 'https://submitsprint.test/demo',
      updatedAt: '2026-06-24T12:00:00.000Z',
    };

    const row = profileToCloudRow(profile, 'user-1');

    expect(row.id).toBe('user-1');
    expect(row.startup_name).toBe('SubmitSprint');
    expect(row.social_urls).toEqual({
      x_url: 'https://x.com/submitsprint',
      linkedin_url: 'https://linkedin.com/company/submitsprint',
      demo_url: 'https://submitsprint.test/demo',
    });
    expect(cloudRowToProfile(row)).toEqual(profile);
  });

  it('round-trips progress records through cloud row shape', () => {
    const progress: DirectoryProgress = {
      directoryId: 'dir-1',
      status: 'submitted',
      submittedAt: '2026-06-20T12:00:00.000Z',
      followUpDueAt: '2026-07-04T12:00:00.000Z',
      liveUrl: 'https://example.test/listing',
      notes: 'Submitted with founder profile',
      lastUpdatedAt: '2026-06-20T12:00:00.000Z',
    };

    const row = progressToCloudRow(progress, 'user-1');

    expect(row.user_id).toBe('user-1');
    expect(row.directory_id).toBe('dir-1');
    expect(row.follow_up_at).toBe('2026-07-04T12:00:00.000Z');
    expect(cloudRowToProgress(row)).toEqual(progress);
    expect(progressRowsToMap([row])).toEqual({ 'dir-1': progress });
  });

  it('maps settings and rejects invalid cloud active views', () => {
    const row = settingsToCloudRow({ activeView: 'fast_25' }, 'user-1', new Date('2026-06-24T12:00:00.000Z'));

    expect(row).toEqual({
      user_id: 'user-1',
      active_view: 'fast_25',
      other_settings: {},
      updated_at: '2026-06-24T12:00:00.000Z',
    });
    expect(cloudRowToSettings(row, { activeView: 'start_here' })).toEqual({ activeView: 'fast_25' });
    expect(cloudRowToSettings({ ...row, active_view: 'bad-view' as 'fast_25' }, { activeView: 'start_here' })).toEqual({
      activeView: 'start_here',
    });
  });

  it('maps sprint sessions and rejects malformed cloud session JSON', () => {
    const session = createSprintSession(
      'fast_25',
      [
        {
          record: { id: 'dir-1', name: 'Directory', url: 'https://directory.test', domain: 'directory.test' },
          progress: { directoryId: 'dir-1', status: 'todo', lastUpdatedAt: '2026-06-24T12:00:00.000Z' },
        },
      ],
      new Date('2026-06-24T12:00:00.000Z'),
    );
    const row = sprintSessionToCloudRow(session, 'user-1', new Date('2026-06-24T12:05:00.000Z'));

    expect(row.updated_at).toBe('2026-06-24T12:05:00.000Z');
    expect(cloudRowToSprintSession(row)).toEqual(session);
    expect(cloudRowToSprintSession({ ...row, session: { nope: true } as typeof session })).toBeUndefined();
  });

  it('merges local progress into cloud progress without deleting cloud-only records', () => {
    const localProgress = {
      newer: { directoryId: 'newer', status: 'published' as const, lastUpdatedAt: '2026-06-24T12:00:00.000Z' },
      older: { directoryId: 'older', status: 'opened' as const, lastUpdatedAt: '2026-06-20T12:00:00.000Z' },
      localOnly: { directoryId: 'localOnly', status: 'submitted' as const, lastUpdatedAt: '2026-06-24T12:00:00.000Z' },
    };
    const cloudProgress = {
      newer: { directoryId: 'newer', status: 'submitted' as const, lastUpdatedAt: '2026-06-20T12:00:00.000Z' },
      older: { directoryId: 'older', status: 'submitted' as const, lastUpdatedAt: '2026-06-24T12:00:00.000Z' },
      cloudOnly: { directoryId: 'cloudOnly', status: 'follow_up' as const, lastUpdatedAt: '2026-06-24T12:00:00.000Z' },
    };

    const result = mergeLocalProgressForCloud(localProgress, cloudProgress);

    expect(result.imported).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.merged.newer.status).toBe('published');
    expect(result.merged.older.status).toBe('submitted');
    expect(result.merged.localOnly.status).toBe('submitted');
    expect(result.merged.cloudOnly.status).toBe('follow_up');
  });
});

import { describe, expect, it } from 'vitest';

import { validateBackup } from '../lib/backup';

describe('validateBackup', () => {
  it('accepts a valid backup payload', () => {
    expect(
      validateBackup({
        appName: 'SubmitSprint',
        schemaVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        startupProfile: {},
        progressRecords: [],
      }),
    ).toBe(true);
  });

  it('rejects invalid backup payloads', () => {
    expect(validateBackup({ appName: 'Other', schemaVersion: 1, startupProfile: {}, progressRecords: [] })).toBe(false);
  });
});

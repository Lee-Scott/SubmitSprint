import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateDatasetPayload } from '../lib/schemas';

describe('dataset validation', () => {
  it('accepts the current generated dataset', () => {
    const raw = readFileSync(new URL('../../public/data/master_directories.json', import.meta.url), 'utf8');
    const payload = JSON.parse(raw) as unknown;
    const result = validateDatasetPayload(payload);

    expect(result.success).toBe(true);
  });

  it('rejects malformed dataset payloads', () => {
    const result = validateDatasetPayload({
      appName: 'SubmitSprint',
      dataVersion: 'dataset-test',
      generatedAt: '2026-06-19T04:03:20.865Z',
      totalRecords: 1,
      records: [{ name: 'Missing Id', url: 'not-a-url', domain: 'example.com' }],
    });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { applySmartView, countSmartViews, getCompletionPercentage, getFast25Queue, mergeProgressRecords } from '../lib/directory';
import type { DirectoryProgress, DirectoryRecord } from '../types';

const records: DirectoryRecord[] = [
  { id: '1', name: 'Alpha AI', url: 'https://alpha.ai/', domain: 'alpha.ai', domainRating: 90, category: 'ia', tags: ['artificial-intelligence'] },
  { id: '2', name: 'Beta SaaS', url: 'https://beta.io/list', domain: 'beta.io', domainRating: 80, category: 'general', tags: ['startup'] },
  { id: '3', name: 'Gamma', url: 'https://gamma.io/', domain: 'gamma.io', domainRating: 70, category: 'other' },
];

const progressMap: Record<string, DirectoryProgress> = {
  '2': { directoryId: '2', status: 'submitted', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
  '3': { directoryId: '3', status: 'opened', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
};

const merged = records.map((record) => ({
  record,
  progress: progressMap[record.id] ?? { directoryId: record.id, status: 'todo', lastUpdatedAt: '1970-01-01T00:00:00.000Z' },
}));

describe('smart views', () => {
  it('filters fast 25 to todo and opened only', () => {
    const result = applySmartView(merged, 'fast_25');
    expect(result.map((entry) => entry.record.id)).toEqual(['1', '3']);
  });

  it('builds the Fast 25 queue from actionable entries only', () => {
    const queue = getFast25Queue([
      { record: { id: '4', name: 'Broken', url: 'https://broken.test', domain: 'broken.test', domainRating: 95 }, progress: { directoryId: '4', status: 'broken', lastUpdatedAt: '2026-01-01T00:00:00.000Z' } },
      { record: { id: '5', name: 'Follow Up', url: 'https://follow-up.test', domain: 'follow-up.test', domainRating: 85 }, progress: { directoryId: '5', status: 'follow_up', lastUpdatedAt: '2026-01-01T00:00:00.000Z' } },
      ...merged,
    ]);

    expect(queue.map((entry) => entry.record.id)).toEqual(['1', '3']);
  });

  it('sorts the Fast 25 queue by DR descending and caps it at 25', () => {
    const queue = getFast25Queue(
      Array.from({ length: 30 }, (_, index) => ({
        record: {
          id: `dir-${index}`,
          name: `Directory ${index.toString().padStart(2, '0')}`,
          url: `https://example-${index}.test`,
          domain: `example-${index}.test`,
          domainRating: index,
        },
        progress: {
          directoryId: `dir-${index}`,
          status: 'todo' as const,
          lastUpdatedAt: '2026-01-01T00:00:00.000Z',
        },
      })),
    );

    expect(queue).toHaveLength(25);
    expect(queue[0].record.domainRating).toBe(29);
    expect(queue.at(-1)?.record.domainRating).toBe(5);
  });

  it('matches AI and SaaS views by category and tags', () => {
    expect(applySmartView(merged, 'ai_directories').map((entry) => entry.record.id)).toEqual(['1']);
    expect(applySmartView(merged, 'saas_directories').map((entry) => entry.record.id)).toEqual(['2']);
  });

  it('counts curated and status views', () => {
    expect(countSmartViews(merged)).toEqual({
      start_here: 2,
      fast_25: 2,
      elite_50: 3,
      ai_directories: 1,
      saas_directories: 1,
      todo: 1,
      opened: 1,
      submitted: 1,
      published: 0,
      follow_up: 0,
      skipped: 0,
    });
  });
});

describe('completion percentage', () => {
  it('uses submitted and published over total', () => {
    expect(getCompletionPercentage({ total: 10, submitted: 2, published: 1 })).toBe(30);
    expect(getCompletionPercentage({ total: 0, submitted: 0, published: 0 })).toBe(0);
  });
});

describe('mergeProgressRecords', () => {
  it('merges imported progress and preserves unrelated current progress', () => {
    const result = mergeProgressRecords(
      { '1': { directoryId: '1', status: 'opened', lastUpdatedAt: '2026-01-01T00:00:00.000Z' } },
      [
        { directoryId: '1', status: 'published', lastUpdatedAt: '2026-02-01T00:00:00.000Z' },
        { directoryId: '2', status: 'submitted', lastUpdatedAt: '2026-02-01T00:00:00.000Z' },
      ],
    );

    expect(result.updatedCount).toBe(1);
    expect(result.importedCount).toBe(1);
    expect(result.merged['1'].status).toBe('published');
    expect(result.merged['2'].status).toBe('submitted');
  });
});

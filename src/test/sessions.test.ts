import { describe, expect, it } from 'vitest';

import {
  completeSprintSession,
  createSprintSession,
  getSessionEntries,
  getSessionQueue,
  getSprintSessionSummary,
  moveSession,
  moveSessionToNextActionable,
  pruneSessionDirectoryIds,
} from '../lib/sessions';
import type { DirectoryWithProgress } from '../lib/directory';

const entries: DirectoryWithProgress[] = [
  {
    record: { id: 'a', name: 'Alpha', url: 'https://alpha.test', domain: 'alpha.test', domainRating: 90 },
    progress: { directoryId: 'a', status: 'todo', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
  },
  {
    record: { id: 'b', name: 'Beta', url: 'https://beta.test', domain: 'beta.test', domainRating: 80 },
    progress: { directoryId: 'b', status: 'opened', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
  },
  {
    record: { id: 'c', name: 'Gamma', url: 'https://gamma.test', domain: 'gamma.test', domainRating: 70 },
    progress: { directoryId: 'c', status: 'published', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
  },
];

describe('sprint sessions', () => {
  it('creates a stable queue snapshot from a chosen session type', () => {
    const queue = getSessionQueue('fast_25', entries, 'start_here');
    const session = createSprintSession('fast_25', queue, new Date('2026-01-01T00:00:00.000Z'));

    expect(session.queueName).toBe('Fast 25');
    expect(session.directoryIds).toEqual(['a', 'b']);
    expect(session.currentDirectoryId).toBe('a');
    expect(session.initialCount).toBe(2);
    expect(session.state).toBe('active');
  });

  it('summarizes session outcomes from current progress', () => {
    const summary = getSprintSessionSummary([
      { ...entries[0], progress: { ...entries[0].progress, status: 'submitted' } },
      { ...entries[1], progress: { ...entries[1].progress, status: 'broken' } },
      { ...entries[2], progress: { ...entries[2].progress, status: 'follow_up' } },
    ]);

    expect(summary).toEqual({
      attempted: 3,
      completed: 3,
      submitted: 1,
      published: 0,
      skipped: 0,
      broken: 1,
      followUp: 1,
      remaining: 0,
    });
  });

  it('moves through queue entries and skips terminal items for next actionable', () => {
    const session = createSprintSession('elite_50', entries, new Date('2026-01-01T00:00:00.000Z'));
    const moved = moveSession(session, 1);
    const nextActionable = moveSessionToNextActionable(moved, entries, 'b');

    expect(moved.currentDirectoryId).toBe('b');
    expect(nextActionable.currentDirectoryId).toBe('a');
  });

  it('prunes stale directory ids without discarding the session', () => {
    const session = {
      ...createSprintSession('elite_50', entries, new Date('2026-01-01T00:00:00.000Z')),
      directoryIds: ['missing', 'b'],
      currentDirectoryId: 'missing',
    };
    const pruned = pruneSessionDirectoryIds(session, entries);

    expect(pruned.directoryIds).toEqual(['b']);
    expect(pruned.currentDirectoryId).toBe('b');
    expect(getSessionEntries(pruned, entries).map(({ record }) => record.id)).toEqual(['b']);
  });

  it('marks a session complete without changing the queue', () => {
    const session = createSprintSession('start_here', entries, new Date('2026-01-01T00:00:00.000Z'));
    const completed = completeSprintSession(session, new Date('2026-01-02T00:00:00.000Z'));

    expect(completed.state).toBe('completed');
    expect(completed.completedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(completed.directoryIds).toEqual(session.directoryIds);
  });
});

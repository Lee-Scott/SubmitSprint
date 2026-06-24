import {
  applySmartView,
  getFast25Queue,
  isSprintActionableStatus,
  sortDirectoriesByDr,
  type DirectoryWithProgress,
} from './directory';
import type {
  DirectoryProgress,
  SmartViewId,
  SprintSessionSummary,
  SprintSessionType,
  SubmissionSprintSession,
} from '../types';

export const sessionTerminalStatuses = new Set<DirectoryProgress['status']>([
  'submitted',
  'published',
  'skipped',
  'broken',
  'follow_up',
]);

export const sessionQueueLabels: Record<SprintSessionType, string> = {
  fast_25: 'Fast 25',
  elite_50: 'Elite 50',
  start_here: 'Start Here',
  continue_unfinished: 'Continue unfinished',
  current_smart_view: 'Current smart view',
};

export const sessionQueueTypes: SprintSessionType[] = [
  'fast_25',
  'elite_50',
  'start_here',
  'continue_unfinished',
  'current_smart_view',
];

export function getSessionQueue(
  type: SprintSessionType,
  directories: DirectoryWithProgress[],
  _activeView: SmartViewId,
  currentViewDirectories: DirectoryWithProgress[] = directories,
) {
  switch (type) {
    case 'fast_25':
      return getFast25Queue(directories);
    case 'elite_50':
      return sortDirectoriesByDr(directories).slice(0, 50);
    case 'start_here':
      return applySmartView(directories, 'start_here');
    case 'continue_unfinished':
      return sortDirectoriesByDr(directories).filter(({ progress }) => isSprintActionableStatus(progress.status));
    case 'current_smart_view':
      return currentViewDirectories;
    default:
      return [];
  }
}

export function createSprintSession(
  type: SprintSessionType,
  queue: DirectoryWithProgress[],
  now = new Date(),
): SubmissionSprintSession {
  const directoryIds = queue.map(({ record }) => record.id);

  return {
    id: `session-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: now.toISOString(),
    queueType: type,
    queueName: sessionQueueLabels[type],
    directoryIds,
    currentDirectoryId: directoryIds[0],
    currentIndex: 0,
    initialCount: directoryIds.length,
    sessionNotes: '',
    state: 'active',
  };
}

export function getSessionEntries(session: SubmissionSprintSession, directories: DirectoryWithProgress[]) {
  const byId = new Map(directories.map((entry) => [entry.record.id, entry]));
  return session.directoryIds.map((directoryId) => byId.get(directoryId)).filter((entry): entry is DirectoryWithProgress => Boolean(entry));
}

export function pruneSessionDirectoryIds(session: SubmissionSprintSession, directories: DirectoryWithProgress[]) {
  const validIds = new Set(directories.map(({ record }) => record.id));
  const directoryIds = session.directoryIds.filter((directoryId) => validIds.has(directoryId));
  const currentDirectoryId = session.currentDirectoryId && validIds.has(session.currentDirectoryId)
    ? session.currentDirectoryId
    : directoryIds[0];
  const currentIndex = Math.max(0, currentDirectoryId ? directoryIds.indexOf(currentDirectoryId) : 0);

  return {
    ...session,
    directoryIds,
    currentDirectoryId,
    currentIndex,
  };
}

export function getCurrentSessionEntry(session: SubmissionSprintSession, directories: DirectoryWithProgress[]) {
  const entries = getSessionEntries(session, directories);
  return entries.find(({ record }) => record.id === session.currentDirectoryId) ?? entries[session.currentIndex] ?? entries[0];
}

export function moveSession(session: SubmissionSprintSession, direction: 1 | -1) {
  if (!session.directoryIds.length) {
    return session;
  }

  const currentIndex = Math.min(
    session.directoryIds.length - 1,
    Math.max(0, session.currentIndex + direction),
  );

  return {
    ...session,
    currentIndex,
    currentDirectoryId: session.directoryIds[currentIndex],
  };
}

export function moveSessionToNextActionable(
  session: SubmissionSprintSession,
  directories: DirectoryWithProgress[],
  fromId?: string,
) {
  if (!session.directoryIds.length) {
    return session;
  }

  const entries = getSessionEntries(session, directories);
  const currentIndex = fromId
    ? Math.max(0, entries.findIndex(({ record }) => record.id === fromId))
    : session.currentIndex;

  const nextEntry =
    entries.slice(currentIndex + 1).find(({ progress }) => !sessionTerminalStatuses.has(progress.status)) ??
    entries.slice(0, currentIndex + 1).find(({ progress }) => !sessionTerminalStatuses.has(progress.status)) ??
    entries[Math.min(currentIndex + 1, entries.length - 1)] ??
    entries[0];

  if (!nextEntry) {
    return session;
  }

  return {
    ...session,
    currentDirectoryId: nextEntry.record.id,
    currentIndex: session.directoryIds.indexOf(nextEntry.record.id),
  };
}

export function completeSprintSession(session: SubmissionSprintSession, now = new Date()) {
  return {
    ...session,
    completedAt: session.completedAt ?? now.toISOString(),
    state: 'completed' as const,
  };
}

export function resumeSprintSession(session: SubmissionSprintSession) {
  return {
    ...session,
    completedAt: undefined,
    state: 'active' as const,
  };
}

export function getSprintSessionSummary(entries: DirectoryWithProgress[]): SprintSessionSummary {
  const summary: SprintSessionSummary = {
    attempted: 0,
    completed: 0,
    submitted: 0,
    published: 0,
    skipped: 0,
    broken: 0,
    followUp: 0,
    remaining: 0,
  };

  for (const { progress } of entries) {
    if (progress.status !== 'todo') {
      summary.attempted += 1;
    }

    if (sessionTerminalStatuses.has(progress.status)) {
      summary.completed += 1;
    }

    if (progress.status === 'submitted') summary.submitted += 1;
    if (progress.status === 'published') summary.published += 1;
    if (progress.status === 'skipped') summary.skipped += 1;
    if (progress.status === 'broken') summary.broken += 1;
    if (progress.status === 'follow_up') summary.followUp += 1;
  }

  summary.remaining = Math.max(0, entries.length - summary.completed);
  return summary;
}

export function isSprintSessionComplete(entries: DirectoryWithProgress[]) {
  return entries.length > 0 && entries.every(({ progress }) => sessionTerminalStatuses.has(progress.status));
}

import type {
  DirectoryProgress,
  DirectoryRecord,
  DirectoryStatus,
  SmartViewId,
  StartupProfile,
} from '../types';

export const defaultSmartView: SmartViewId = 'start_here';
export const followUpDelayDays = 14;

export const directoryStatuses: DirectoryStatus[] = ['todo', 'opened', 'submitted', 'published', 'follow_up', 'skipped', 'broken'];

export type DirectoryWithProgress = {
  record: DirectoryRecord;
  progress: DirectoryProgress;
};

export type ProgressActionType = 'open' | 'status' | 'field' | 'orphan_cleanup' | 'import';

export function createEmptyProfile(): StartupProfile {
  return {
    startupName: '',
    websiteUrl: '',
    tagline: '',
    shortDescription: '',
    longDescription: '',
    founderName: '',
    contactEmail: '',
    logoUrl: '',
    category: '',
    keywords: '',
    xUrl: '',
    linkedinUrl: '',
    demoUrl: '',
    pricingSummary: '',
    updatedAt: '',
  };
}

export function createEmptyProgress(directoryId: string): DirectoryProgress {
  return {
    directoryId,
    status: 'todo',
    lastUpdatedAt: new Date(0).toISOString(),
  };
}

export function getDirectoryProgress(progressMap: Record<string, DirectoryProgress>, directoryId: string): DirectoryProgress {
  return progressMap[directoryId] ?? createEmptyProgress(directoryId);
}

function score(record: DirectoryRecord) {
  return record.domainRating ?? -1;
}

function normalizeSearchParts(record: DirectoryRecord) {
  return [record.name, record.domain, record.category, record.linkStatus, ...(record.tags ?? []), ...(record.importerWarnings ?? [])].join(' ').toLowerCase();
}

export function sortDirectoriesByDr(directories: DirectoryWithProgress[]) {
  return [...directories].sort((left, right) => score(right.record) - score(left.record) || left.record.name.localeCompare(right.record.name));
}

export function searchDirectories(directories: DirectoryWithProgress[], query: string) {
  if (!query) {
    return directories;
  }

  const normalized = query.toLowerCase();
  return directories.filter(({ record }) => normalizeSearchParts(record).includes(normalized));
}

function includesKeyword(record: DirectoryRecord, keywords: string[]) {
  const haystack = [record.category ?? '', ...(record.tags ?? [])].join(' ').toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function isTodoOrOpened(status: DirectoryStatus) {
  return status === 'todo' || status === 'opened';
}

export function isSprintActionableStatus(status: DirectoryStatus) {
  return status === 'todo' || status === 'opened';
}

export function getFast25Queue(directories: DirectoryWithProgress[]) {
  return sortDirectoriesByDr(directories).filter(({ progress }) => isTodoOrOpened(progress.status)).slice(0, 25);
}

export function getFollowUpDueDate(submittedAt: string, delayDays = followUpDelayDays) {
  const submittedDate = new Date(submittedAt);

  if (Number.isNaN(submittedDate.getTime())) {
    return undefined;
  }

  submittedDate.setDate(submittedDate.getDate() + delayDays);
  return submittedDate.toISOString();
}

export function isFollowUpDue(progress: DirectoryProgress, now = new Date()) {
  if (progress.status === 'published') {
    return false;
  }

  if (progress.status === 'follow_up') {
    return true;
  }

  if (progress.status !== 'submitted' || !progress.followUpDueAt) {
    return false;
  }

  const dueDate = new Date(progress.followUpDueAt);
  return !Number.isNaN(dueDate.getTime()) && dueDate <= now;
}

export function formatDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function applySmartView(directories: DirectoryWithProgress[], view: SmartViewId) {
  const sorted = sortDirectoriesByDr(directories);

  switch (view) {
    case 'start_here':
      return sorted.filter(({ progress }) => isTodoOrOpened(progress.status)).slice(0, 40);
    case 'fast_25':
      return getFast25Queue(directories);
    case 'elite_50':
      return sorted.slice(0, 50);
    case 'ai_directories':
      return sorted.filter(({ record }) => includesKeyword(record, ['ai', 'ia', 'artificial intelligence']));
    case 'saas_directories':
      return sorted.filter(({ record }) => includesKeyword(record, ['saas', 'software', 'startup']));
    case 'todo':
      return sorted.filter(({ progress }) => progress.status === 'todo');
    case 'opened':
    case 'submitted':
    case 'published':
    case 'skipped':
      return sorted.filter(({ progress }) => progress.status === view);
    case 'follow_up':
      return sorted.filter(({ progress }) => isFollowUpDue(progress));
    default:
      return sorted;
  }
}

export function countStatuses(records: DirectoryRecord[], progressMap: Record<string, DirectoryProgress>) {
  const counts = {
    total: records.length,
    todo: 0,
    opened: 0,
    submitted: 0,
    published: 0,
    follow_up: 0,
    skipped: 0,
    broken: 0,
  };

  for (const record of records) {
    const status = getDirectoryProgress(progressMap, record.id).status;
    counts[status] += 1;
  }

  return counts;
}

export function countSmartViews(directories: DirectoryWithProgress[]) {
  return {
    start_here: applySmartView(directories, 'start_here').length,
    fast_25: applySmartView(directories, 'fast_25').length,
    elite_50: applySmartView(directories, 'elite_50').length,
    ai_directories: applySmartView(directories, 'ai_directories').length,
    saas_directories: applySmartView(directories, 'saas_directories').length,
    todo: applySmartView(directories, 'todo').length,
    opened: applySmartView(directories, 'opened').length,
    submitted: applySmartView(directories, 'submitted').length,
    published: applySmartView(directories, 'published').length,
    follow_up: applySmartView(directories, 'follow_up').length,
    skipped: applySmartView(directories, 'skipped').length,
  };
}

export function getCompletionPercentage(counts: {
  total: number;
  submitted: number;
  published: number;
}) {
  if (!counts.total) {
    return 0;
  }

  return Math.round(((counts.submitted + counts.published) / counts.total) * 100);
}

export function getBackupRecommendation(meaningfulChangesSinceExport: number) {
  return meaningfulChangesSinceExport >= 20 ? 'Export recommended' : 'Saved in this browser';
}

export function getLastBackupLabel(lastExportedAt?: string) {
  if (!lastExportedAt) {
    return 'Never';
  }

  return new Date(lastExportedAt).toLocaleString();
}

export function getDirectoryOpenUrl(record: DirectoryRecord) {
  return record.submissionUrl || record.url;
}

export function isValidHttpUrl(value?: string) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getNextActionableDirectoryId(queue: DirectoryWithProgress[], fromId?: string) {
  const actionableIds = queue.filter(({ progress }) => isSprintActionableStatus(progress.status)).map(({ record }) => record.id);

  if (!actionableIds.length) {
    return undefined;
  }

  if (!fromId) {
    return actionableIds[0];
  }

  const currentIndex = actionableIds.indexOf(fromId);

  if (currentIndex === -1) {
    return actionableIds[0];
  }

  return actionableIds[(currentIndex + 1) % actionableIds.length];
}

export function buildStatusProgress(current: DirectoryProgress, status: DirectoryStatus, now = new Date(), actionType: ProgressActionType = 'status') {
  const timestamp = now.toISOString();
  const next: DirectoryProgress = {
    ...current,
    status,
    lastUpdatedAt: timestamp,
    lastActionAt: timestamp,
    lastActionType: actionType,
  };

  if (status === 'todo') {
    delete next.openedAt;
    delete next.submittedAt;
    delete next.publishedAt;
    delete next.skippedAt;
    delete next.followUpDueAt;
  }

  if (status === 'opened') {
    next.openedAt = current.openedAt ?? timestamp;
  }

  if (status === 'submitted') {
    next.submittedAt = timestamp;
    next.followUpDueAt = getFollowUpDueDate(timestamp);
    delete next.publishedAt;
    delete next.skippedAt;
  }

  if (status === 'published') {
    next.publishedAt = timestamp;
    delete next.followUpDueAt;
  }

  if (status === 'follow_up') {
    next.followUpDueAt = current.followUpDueAt ?? timestamp;
  }

  if (status === 'skipped') {
    next.skippedAt = timestamp;
  }

  return next;
}

export function clearFollowUp(progress: DirectoryProgress, now = new Date()) {
  const timestamp = now.toISOString();
  const next: DirectoryProgress = {
    ...progress,
    status: progress.status === 'follow_up' ? 'submitted' : progress.status,
    lastUpdatedAt: timestamp,
    lastActionAt: timestamp,
    lastActionType: 'status',
  };

  delete next.followUpDueAt;
  return next;
}

export function mergeProgressRecords(
  current: Record<string, DirectoryProgress>,
  imported: DirectoryProgress[],
) {
  const merged = { ...current };
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const record of imported) {
    if (!record.directoryId || !record.status) {
      skippedCount += 1;
      continue;
    }

    const exists = Boolean(merged[record.directoryId]);
    merged[record.directoryId] = record;

    if (exists) {
      updatedCount += 1;
    } else {
      importedCount += 1;
    }
  }

  return { merged, importedCount, updatedCount, skippedCount };
}

export function getOrphanProgressRecords(progressMap: Record<string, DirectoryProgress>, records: DirectoryRecord[]) {
  const validIds = new Set(records.map((record) => record.id));
  return Object.values(progressMap).filter((progress) => !validIds.has(progress.directoryId));
}

export function pruneOrphanProgress(progressMap: Record<string, DirectoryProgress>, records: DirectoryRecord[]) {
  const validIds = new Set(records.map((record) => record.id));
  return Object.fromEntries(Object.entries(progressMap).filter(([directoryId]) => validIds.has(directoryId)));
}

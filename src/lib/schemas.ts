import { z } from 'zod';

import type { DirectoryStatus, LinkStatus, SmartViewId, SprintSessionState, SprintSessionType } from '../types';

const directoryStatusValues = ['todo', 'opened', 'submitted', 'published', 'follow_up', 'skipped', 'broken'] as const satisfies readonly DirectoryStatus[];
const smartViewIdValues = [
  'start_here',
  'fast_25',
  'elite_50',
  'ai_directories',
  'saas_directories',
  'todo',
  'opened',
  'submitted',
  'published',
  'follow_up',
  'skipped',
] as const satisfies readonly SmartViewId[];
const linkStatusValues = ['untested', 'reviewed', 'suspicious', 'broken', 'needs_review'] as const satisfies readonly LinkStatus[];
const sprintSessionTypeValues = [
  'fast_25',
  'elite_50',
  'start_here',
  'continue_unfinished',
  'current_smart_view',
] as const satisfies readonly SprintSessionType[];
const sprintSessionStateValues = ['active', 'completed'] as const satisfies readonly SprintSessionState[];

function isValidDateString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function isValidHttpUrlString(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const dateStringSchema = z.string().refine(isValidDateString, 'Expected a valid date string');
const httpUrlStringSchema = z.string().refine(isValidHttpUrlString, 'Expected an http(s) URL');

export const DirectoryStatusSchema = z.enum(directoryStatusValues);
export const SmartViewIdSchema = z.enum(smartViewIdValues);
export const LinkStatusSchema = z.enum(linkStatusValues);
export const SprintSessionTypeSchema = z.enum(sprintSessionTypeValues);
export const SprintSessionStateSchema = z.enum(sprintSessionStateValues);

export const SettingsStateSchema = z.object({
  activeView: SmartViewIdSchema,
});

export const DirectoryProgressSchema = z
  .object({
    directoryId: z.string().min(1),
    status: DirectoryStatusSchema,
    openedAt: dateStringSchema.optional(),
    submittedAt: dateStringSchema.optional(),
    publishedAt: dateStringSchema.optional(),
    skippedAt: dateStringSchema.optional(),
    liveUrl: httpUrlStringSchema.optional(),
    notes: z.string().optional(),
    skipReason: z.string().optional(),
    lastActionAt: dateStringSchema.optional(),
    lastActionType: z.string().optional(),
    followUpDueAt: dateStringSchema.optional(),
    lastUpdatedAt: dateStringSchema,
  })
  .passthrough();

export const StartupProfileSchema = z.object({
  startupName: z.string(),
  websiteUrl: z.string(),
  tagline: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
  founderName: z.string(),
  contactEmail: z.string(),
  logoUrl: z.string(),
  category: z.string(),
  keywords: z.string(),
  xUrl: z.string(),
  linkedinUrl: z.string(),
  demoUrl: z.string(),
  pricingSummary: z.string(),
  updatedAt: z.string(),
});

export const BackupMetaSchema = z.object({
  lastExportedAt: dateStringSchema.optional(),
  meaningfulChangesSinceExport: z.number().int().nonnegative(),
});

export const SubmissionSprintSessionSchema = z.object({
  id: z.string().min(1).max(120),
  startedAt: dateStringSchema,
  completedAt: dateStringSchema.optional(),
  queueType: SprintSessionTypeSchema,
  queueName: z.string().min(1).max(120),
  directoryIds: z.array(z.string().min(1).max(300)).max(5000),
  currentDirectoryId: z.string().min(1).max(300).optional(),
  currentIndex: z.number().int().nonnegative(),
  initialCount: z.number().int().nonnegative(),
  sessionNotes: z.string().max(5000).optional(),
  state: SprintSessionStateSchema,
});

export const DirectoryRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: httpUrlStringSchema,
  domain: z.string().min(1),
  domainRating: z.number().finite().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  lastVerifiedAt: dateStringSchema.optional(),
  dataVersion: z.string().optional(),
  homepageUrl: httpUrlStringSchema.optional(),
  submissionUrl: httpUrlStringSchema.optional(),
  sourceRowNumber: z.number().int().positive().optional(),
  priceModel: z.string().optional(),
  dofollow: z.string().optional(),
  usecase: z.string().optional(),
  bestFirst: z.boolean().optional(),
  linkStatus: LinkStatusSchema.optional(),
  linkReviewedAt: dateStringSchema.optional(),
  importerWarnings: z.array(z.string()).optional(),
});

export const DirectoryLinkAuditSummarySchema = z
  .object({
    totalSourceRows: z.number().int().nonnegative().optional(),
    importedRecords: z.number().int().nonnegative().optional(),
    skippedRecords: z.number().int().nonnegative().optional(),
    invalidUrls: z.number().int().nonnegative().optional(),
    missingNames: z.number().int().nonnegative().optional(),
    missingUrls: z.number().int().nonnegative().optional(),
    missingCategories: z.number().int().nonnegative().optional(),
    missingDr: z.number().int().nonnegative().optional(),
    duplicateIds: z.number().int().nonnegative().optional(),
    duplicateUrls: z.number().int().nonnegative().optional(),
    duplicateDomains: z.number().int().nonnegative().optional(),
    suspiciousLinks: z.number().int().nonnegative().optional(),
    domainUrlMismatches: z.number().int().nonnegative().optional(),
    recordsWithWarnings: z.number().int().nonnegative().optional(),
    topWarnings: z
      .array(
        z.object({
          warning: z.string(),
          count: z.number().int().nonnegative(),
        }),
      )
      .optional(),
  })
  .passthrough();

export const DatasetPayloadSchema = z
  .object({
    appName: z.literal('SubmitSprint'),
    dataVersion: z.string().min(1),
    generatedAt: dateStringSchema,
    totalRecords: z.number().int().nonnegative(),
    records: z.array(DirectoryRecordSchema),
    audit: DirectoryLinkAuditSummarySchema.optional(),
  })
  .passthrough();

export function validateDatasetPayload(candidate: unknown) {
  return DatasetPayloadSchema.safeParse(candidate);
}

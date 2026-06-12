export type DirectoryRecord = {
  id: string;
  name: string;
  url: string;
  domain: string;
  domainRating?: number;
  category?: string;
  tags?: string[];
  source?: string;
  lastVerifiedAt?: string;
  dataVersion?: string;
};

export type DirectoryStatus =
  | 'todo'
  | 'opened'
  | 'submitted'
  | 'published'
  | 'follow_up'
  | 'skipped'
  | 'broken';

export type DirectoryProgress = {
  directoryId: string;
  status: DirectoryStatus;
  openedAt?: string;
  submittedAt?: string;
  publishedAt?: string;
  skippedAt?: string;
  liveUrl?: string;
  notes?: string;
  skipReason?: string;
  lastUpdatedAt: string;
};

export type StartupProfile = {
  startupName: string;
  websiteUrl: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  founderName: string;
  contactEmail: string;
  logoUrl: string;
  category: string;
  keywords: string;
  xUrl: string;
  linkedinUrl: string;
  demoUrl: string;
  pricingSummary: string;
  updatedAt: string;
};

export type SubmitSprintBackup = {
  appName: 'SubmitSprint';
  schemaVersion: 1;
  exportedAt: string;
  datasetVersion?: string;
  startupProfile: StartupProfile;
  progressRecords: DirectoryProgress[];
  settings?: Record<string, unknown>;
};

export type SmartViewId =
  | 'start_here'
  | 'fast_25'
  | 'elite_50'
  | 'ai_directories'
  | 'saas_directories'
  | 'todo'
  | 'opened'
  | 'submitted'
  | 'published'
  | 'follow_up'
  | 'skipped';

export type DatasetPayload = {
  appName: 'SubmitSprint';
  dataVersion: string;
  generatedAt: string;
  totalRecords: number;
  records: DirectoryRecord[];
};

import { getDirectoryOpenUrl } from './directory';
import type { DirectoryProgress, DirectoryRecord } from '../types';

export const feedbackConfig = {
  contactEmail: 'replace-before-launch@example.com',
} as const;

type MailtoArgs = {
  to?: string;
  subject: string;
  body: string;
};

export function createMailtoLink({ to = feedbackConfig.contactEmail, subject, body }: MailtoArgs) {
  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

export function createDirectoryReportMailto(record: DirectoryRecord, progress: DirectoryProgress) {
  const openUrl = getDirectoryOpenUrl(record);
  return createMailtoLink({
    subject: `SubmitSprint directory issue: ${record.name}`,
    body: [
      'Issue type: [wrong link / broken link / paid / duplicate / other]',
      'Expected correct URL:',
      'Notes:',
      '',
      `Directory name: ${record.name}`,
      `Directory ID: ${record.id}`,
      `Domain: ${record.domain}`,
      `Category: ${record.category ?? 'uncategorized'}`,
      `URL: ${record.url}`,
      `Submission URL: ${record.submissionUrl ?? 'not set'}`,
      `Open target: ${openUrl}`,
      `Current status: ${progress.status}`,
    ].join('\n'),
  });
}

export function createSuggestDirectoryMailto() {
  return createMailtoLink({
    subject: 'SubmitSprint directory suggestion',
    body: [
      'Directory name:',
      'Homepage URL:',
      'Submission URL:',
      'Category:',
      'Domain rating if known:',
      'Why it belongs in SubmitSprint:',
    ].join('\n'),
  });
}

export function createGeneralIssueMailto() {
  return createMailtoLink({
    subject: 'SubmitSprint issue report',
    body: ['Issue summary:', 'Steps to reproduce:', 'Browser/device:', 'Notes:'].join('\n'),
  });
}

export function createContactMailto() {
  return createMailtoLink({
    subject: 'SubmitSprint contact',
    body: 'Message:',
  });
}

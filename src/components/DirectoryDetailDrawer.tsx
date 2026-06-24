import { useEffect, type ReactNode } from 'react';

import { directoryStatuses, formatDate, getDirectoryOpenUrl, isFollowUpDue, isValidHttpUrl } from '../lib/directory';
import type { DirectoryWithProgress } from '../lib/directory';
import { createDirectoryReportMailto } from '../lib/feedback';
import type { DirectoryStatus, StartupProfile } from '../types';

type DirectoryDetailDrawerProps = {
  entry?: DirectoryWithProgress;
  profile: StartupProfile;
  onClearFollowUp: (directoryId: string) => void;
  onClose: () => void;
  onCopy: (label: string, value: string) => void;
  onFieldChange: (directoryId: string, field: 'liveUrl' | 'notes', value: string) => void;
  onFieldCommit: () => void;
  onOpen: (record: DirectoryWithProgress['record']) => void;
  onStatusChange: (directoryId: string, status: DirectoryStatus) => void;
};

const profileCopyFields: Array<{ label: string; getValue: (profile: StartupProfile) => string }> = [
  { label: 'Startup name', getValue: (profile) => profile.startupName },
  { label: 'Website', getValue: (profile) => profile.websiteUrl },
  { label: 'Tagline', getValue: (profile) => profile.tagline },
  { label: 'Short description', getValue: (profile) => profile.shortDescription },
  { label: 'Long description', getValue: (profile) => profile.longDescription },
  { label: 'Keywords', getValue: (profile) => profile.keywords },
  { label: 'Contact email', getValue: (profile) => profile.contactEmail },
  { label: 'Pricing', getValue: (profile) => profile.pricingSummary },
  { label: 'Full profile', getValue: (profile) => JSON.stringify(profile, null, 2) },
];

export function DirectoryDetailDrawer({
  entry,
  profile,
  onClearFollowUp,
  onClose,
  onCopy,
  onFieldChange,
  onFieldCommit,
  onOpen,
  onStatusChange,
}: DirectoryDetailDrawerProps) {
  useEffect(() => {
    if (!entry) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entry, onClose]);

  if (!entry) {
    return null;
  }

  const { record, progress } = entry;
  const openUrl = getDirectoryOpenUrl(record);
  const canOpen = isValidHttpUrl(openUrl);
  const followUpLabel = formatDate(progress.followUpDueAt);
  const needsFollowUp = isFollowUpDue(progress);
  const hasLiveUrlReadyForPublish = Boolean(progress.liveUrl?.trim()) && ['todo', 'opened'].includes(progress.status);
  const metadata = [
    ['Domain', record.domain],
    ['Homepage', record.homepageUrl],
    ['Submission URL', record.submissionUrl],
    ['Category', record.category],
    ['DR', record.domainRating === undefined ? undefined : String(record.domainRating)],
    ['Price', record.priceModel],
    ['Link type', record.dofollow],
    ['Link status', record.linkStatus?.replace('_', ' ')],
    ['Source', record.source],
    ['Source row', record.sourceRowNumber === undefined ? undefined : String(record.sourceRowNumber)],
    ['Data version', record.dataVersion],
    ['Verified', formatDate(record.lastVerifiedAt)],
    ['Reviewed', formatDate(record.linkReviewedAt)],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 px-2 py-2 sm:px-4 lg:items-stretch lg:justify-end lg:p-3" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={`${record.name} directory workspace`}
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_28px_80px_rgba(28,25,23,0.24)] lg:h-full lg:max-h-none lg:max-w-[460px]"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-200 bg-stone-50/90 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Submission command center</div>
              <h2 className="mt-1 break-words font-display text-2xl leading-tight text-stone-950">{record.name}</h2>
              <div className="mt-1 break-all text-sm font-medium text-stone-600">{record.domain}</div>
            </div>
            <button
              className="shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={statusTone(progress.status)}>Status {formatStatus(progress.status)}</Badge>
            {followUpLabel ? <Badge tone={needsFollowUp ? 'amber' : 'stone'}>{needsFollowUp ? 'Follow-up due' : 'Follow-up'} {followUpLabel}</Badge> : null}
            {record.bestFirst ? <Badge tone="amber">Best first</Badge> : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                disabled={!canOpen}
                onClick={() => onOpen(record)}
                title={canOpen ? openUrl : 'Invalid URL'}
                type="button"
              >
                Open
              </button>
              <a
                className="rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
                href={createDirectoryReportMailto(record, progress)}
              >
                Report broken link
              </a>
            </div>
            <a className="mt-2 block break-all text-xs font-medium text-amber-800 underline decoration-amber-300 underline-offset-2" href={openUrl} rel="noopener noreferrer" target="_blank">
              {openUrl}
            </a>
          </section>

          <Section title="Next action">
            <p className="text-sm text-stone-600">{nextActionLabel(progress.status, Boolean(progress.liveUrl?.trim()))}</p>
          </Section>

          <Section title="Directory details">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {metadata.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</dt>
                  <dd className="mt-0.5 break-words text-stone-900">{value}</dd>
                </div>
              ))}
            </dl>
            {record.usecase ? <p className="mt-3 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">{record.usecase}</p> : null}
            {record.tags?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{record.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div> : null}
            {record.importerWarnings?.length ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                Needs review: {record.importerWarnings.join(', ')}
              </div>
            ) : null}
          </Section>

          <Section title="Status">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {directoryStatuses.map((status) => (
                <button
                  key={status}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition hover:border-stone-400 ${
                    status === progress.status ? 'border-stone-500 bg-stone-900 text-stone-50' : 'border-stone-200 bg-white text-stone-700'
                  }`}
                  onClick={() => onStatusChange(record.id, status)}
                  type="button"
                >
                  {formatStatus(status)}
                </button>
              ))}
            </div>
            {(progress.followUpDueAt || progress.status === 'follow_up') && (
              <button
                className="mt-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                onClick={() => onClearFollowUp(record.id)}
                type="button"
              >
                Clear follow-up
              </button>
            )}
          </Section>

          <Section title="Submission notes">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Live URL</span>
              <input
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
                placeholder="https://live-link"
                value={progress.liveUrl ?? ''}
                onChange={(event) => onFieldChange(record.id, 'liveUrl', event.target.value)}
                onBlur={onFieldCommit}
              />
            </label>
            {hasLiveUrlReadyForPublish ? (
              <button
                className="mt-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                onClick={() => onStatusChange(record.id, 'published')}
                type="button"
              >
                Mark published
              </button>
            ) : null}
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Notes</span>
              <textarea
                className="min-h-32 w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
                placeholder="Notes or submission details"
                value={progress.notes ?? ''}
                onChange={(event) => onFieldChange(record.id, 'notes', event.target.value)}
                onBlur={onFieldCommit}
              />
            </label>
          </Section>

          <Section title="Copy startup profile">
            <div className="grid grid-cols-2 gap-2">
              {profileCopyFields.map((field) => (
                <button
                  key={field.label}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-left text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-400"
                  disabled={!field.getValue(profile)}
                  onClick={() => onCopy(field.label, field.getValue(profile))}
                  type="button"
                >
                  Copy {field.label}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{title}</h3>
      {children}
    </section>
  );
}

function Badge({ children, tone = 'stone' }: { children: ReactNode; tone?: 'amber' | 'emerald' | 'rose' | 'sky' | 'stone' | 'violet' }) {
  const classes = {
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
    emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    rose: 'bg-rose-50 text-rose-800 ring-rose-200',
    sky: 'bg-sky-50 text-sky-800 ring-sky-200',
    stone: 'bg-stone-50 text-stone-700 ring-stone-200',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${classes[tone]}`}>{children}</span>;
}

function statusTone(status: DirectoryStatus) {
  switch (status) {
    case 'opened':
      return 'sky';
    case 'submitted':
      return 'amber';
    case 'published':
      return 'emerald';
    case 'follow_up':
      return 'violet';
    case 'broken':
      return 'rose';
    default:
      return 'stone';
  }
}

function formatStatus(status: string) {
  return status.replace('_', ' ');
}

function nextActionLabel(status: DirectoryStatus, hasLiveUrl: boolean) {
  if (hasLiveUrl && (status === 'todo' || status === 'opened')) {
    return 'A live URL is saved. Confirm the listing is visible, then mark it published.';
  }

  switch (status) {
    case 'todo':
      return 'Open the directory, review the submission page, and paste your startup profile.';
    case 'opened':
      return 'Finish the submission and mark it submitted, or save notes for anything blocking you.';
    case 'submitted':
      return 'Watch for approval and follow up when the due date arrives.';
    case 'published':
      return 'Listing is published. Keep the live URL and any notes here for your backup.';
    case 'follow_up':
      return 'Follow up with the directory owner or check the submission status.';
    case 'skipped':
      return 'Skipped for now. Add a note if this should be revisited later.';
    case 'broken':
      return 'Report the issue or keep notes about the broken submission path.';
    default:
      return 'Review the directory and choose the next status.';
  }
}

import type { ReactNode } from 'react';

import { formatDate, getDirectoryOpenUrl, isFollowUpDue, isSprintActionableStatus, isValidHttpUrl } from '../lib/directory';
import type { DirectoryWithProgress } from '../lib/directory';
import { createDirectoryReportMailto } from '../lib/feedback';

type SprintPanelProps = {
  currentEntry?: DirectoryWithProgress;
  totalCount: number;
  completedCount: number;
  isComplete: boolean;
  onClearFollowUp: () => void;
  onExport: () => void;
  onExit: () => void;
  onFieldCommit: () => void;
  onFollowUp: () => void;
  onNext: () => void;
  onOpen: () => void;
  onSkip: () => void;
  onSubmitted: () => void;
  onPublished: () => void;
  onFieldChange: (field: 'liveUrl' | 'notes', value: string) => void;
};

export function SprintPanel({
  currentEntry,
  totalCount,
  completedCount,
  isComplete,
  onClearFollowUp,
  onExport,
  onExit,
  onFieldCommit,
  onFollowUp,
  onNext,
  onOpen,
  onSkip,
  onSubmitted,
  onPublished,
  onFieldChange,
}: SprintPanelProps) {
  if (!totalCount) {
    return (
      <section className="mb-4 rounded-[26px] border border-stone-200 bg-stone-50/90 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Fast 25 Sprint</div>
        <h3 className="mt-2 font-display text-2xl text-stone-900">No actionable directories right now</h3>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          The current Fast 25 queue is empty because everything in that slice is already worked or filtered out.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100"
            onClick={onExit}
            type="button"
          >
            Back to table
          </button>
        </div>
      </section>
    );
  }

  if (isComplete || !currentEntry) {
    return (
      <section className="mb-4 rounded-[26px] border border-amber-200 bg-[linear-gradient(180deg,_rgba(251,243,219,0.95),_rgba(255,251,244,0.98))] p-5 shadow-[0_18px_45px_rgba(82,53,20,0.08)]">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Fast 25 Sprint</div>
        <h3 className="mt-2 font-display text-3xl tracking-tight text-stone-900">Sprint complete</h3>
        <p className="mt-2 text-sm text-stone-700">
          You cleared {completedCount} of {totalCount} directories in this sprint.
        </p>
        <p className="mt-3 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-sm font-medium text-amber-900">
          Export a backup so this browser-saved progress is safe.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800"
            onClick={onExport}
            type="button"
          >
            Export backup
          </button>
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100"
            onClick={onExit}
            type="button"
          >
            Back to table
          </button>
        </div>
      </section>
    );
  }

  const { record, progress } = currentEntry;
  const openUrl = getDirectoryOpenUrl(record);
  const canOpen = isValidHttpUrl(openUrl);
  const followUpLabel = formatDate(progress.followUpDueAt);
  const needsFollowUp = isFollowUpDue(progress);
  const hasLiveUrlReadyForPublish = Boolean(progress.liveUrl?.trim()) && isSprintActionableStatus(progress.status);

  return (
    <section className="mb-4 rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,_rgba(255,251,244,0.98),_rgba(249,244,235,0.96))] p-5 shadow-[0_18px_45px_rgba(82,53,20,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Fast 25 Sprint</div>
          <h3 className="mt-2 font-display text-3xl tracking-tight text-stone-900">{record.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-stone-700">
            <Badge>Progress {completedCount} / {totalCount} complete</Badge>
            <Badge>DR {record.domainRating ?? '—'}</Badge>
            <Badge>{record.category ?? 'Uncategorized'}</Badge>
            <Badge>Status {formatStatus(progress.status)}</Badge>
            {followUpLabel ? <Badge>{needsFollowUp ? 'Follow-up due' : 'Follow-up'} {followUpLabel}</Badge> : null}
          </div>
          <div className="mt-4 space-y-1 text-sm text-stone-600">
            <div className="font-medium text-stone-900">{record.domain}</div>
            <a className="break-all text-amber-800 underline decoration-amber-300 underline-offset-3" href={openUrl} rel="noopener noreferrer" target="_blank">
              {openUrl}
            </a>
          </div>
          {record.importerWarnings?.length ? (
            <div className="mt-3 text-xs font-medium text-amber-800">Needs review: {record.importerWarnings.join(', ')}</div>
          ) : null}
          {record.tags?.length ? <div className="mt-3 text-xs text-stone-500">{record.tags.join(' · ')}</div> : null}
        </div>

        <button
          className="self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100"
          onClick={onExit}
          type="button"
        >
          Exit Sprint
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
          disabled={!canOpen}
          onClick={onOpen}
          title={canOpen ? openUrl : 'Invalid URL'}
          type="button"
        >
          Open
        </button>
        <button
          className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800"
          onClick={onSubmitted}
          type="button"
        >
          Submitted
        </button>
        <button
          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
          onClick={onPublished}
          type="button"
        >
          Published
        </button>
        <button
          className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 transition hover:bg-violet-100"
          onClick={onFollowUp}
          type="button"
        >
          Mark Follow-Up
        </button>
        {(progress.followUpDueAt || progress.status === 'follow_up') && (
          <button
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            onClick={onClearFollowUp}
            type="button"
          >
            Clear Follow-Up
          </button>
        )}
        <button
          className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100"
          onClick={onSkip}
          type="button"
        >
          Skip
        </button>
        <button
          className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100"
          onClick={onNext}
          type="button"
        >
          Next
        </button>
        <a
          className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-100"
          href={createDirectoryReportMailto(record, progress)}
        >
          Report
        </a>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Live URL</label>
          <input
            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
            placeholder="https://live-link"
            value={progress.liveUrl ?? ''}
            onChange={(event) => onFieldChange('liveUrl', event.target.value)}
            onBlur={onFieldCommit}
          />
          {hasLiveUrlReadyForPublish ? (
            <button
              className="mt-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-900 transition hover:bg-emerald-100"
              onClick={onPublished}
              type="button"
            >
              Mark published
            </button>
          ) : null}
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Notes</label>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
            placeholder="Notes or submission details"
            value={progress.notes ?? ''}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            onBlur={onFieldCommit}
          />
        </div>
      </div>
    </section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/85 px-3 py-1 ring-1 ring-stone-200">{children}</span>;
}

function formatStatus(status: string) {
  return status.replace('_', ' ');
}

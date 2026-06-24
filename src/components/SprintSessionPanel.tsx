import type { ReactNode } from 'react';

import { formatDate, getDirectoryOpenUrl, isValidHttpUrl } from '../lib/directory';
import type { DirectoryWithProgress } from '../lib/directory';
import { createDirectoryReportMailto } from '../lib/feedback';
import { sessionQueueLabels, sessionQueueTypes } from '../lib/sessions';
import type { DirectoryStatus, SprintSessionSummary, SprintSessionType, SubmissionSprintSession } from '../types';

type SprintSessionPanelProps = {
  currentEntry?: DirectoryWithProgress;
  queueCounts: Record<SprintSessionType, number>;
  session?: SubmissionSprintSession;
  summary?: SprintSessionSummary;
  onClearFollowUp: () => void;
  onEnd: () => void;
  onExport: () => void;
  onFieldChange: (field: 'liveUrl' | 'notes', value: string) => void;
  onFieldCommit: () => void;
  onNext: () => void;
  onOpen: () => void;
  onOpenDetails: () => void;
  onPrevious: () => void;
  onStart: (type: SprintSessionType) => void;
  onStatusChange: (status: DirectoryStatus) => void;
  onUpdateNotes: (value: string) => void;
};

export function SprintSessionPanel({
  currentEntry,
  queueCounts,
  session,
  summary,
  onClearFollowUp,
  onEnd,
  onExport,
  onFieldChange,
  onFieldCommit,
  onNext,
  onOpen,
  onOpenDetails,
  onPrevious,
  onStart,
  onStatusChange,
  onUpdateNotes,
}: SprintSessionPanelProps) {
  if (!session) {
    return (
      <section className="mb-3 rounded-3xl border border-stone-200 bg-[linear-gradient(180deg,_rgba(255,251,244,0.98),_rgba(249,244,235,0.96))] p-4 shadow-[0_16px_38px_rgba(82,53,20,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Submission sprint session</div>
            <h3 className="mt-1.5 font-display text-2xl tracking-tight text-stone-900">Start a focused sprint</h3>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">
              Choose a queue, work one directory at a time, and keep the board compact while you move.
            </p>
          </div>
          <div className="text-xs font-medium text-stone-500">Session state saves in this browser only.</div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {sessionQueueTypes.map((type) => (
            <button
              key={type}
              className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
              disabled={!queueCounts[type]}
              onClick={() => onStart(type)}
              type="button"
            >
              <span className="block text-sm font-semibold text-stone-900">{sessionQueueLabels[type]}</span>
              <span className="mt-0.5 block text-xs text-stone-500">{queueCounts[type]} director{queueCounts[type] === 1 ? 'y' : 'ies'}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (session.state === 'completed' || !currentEntry) {
    return (
      <section className="mb-3 rounded-3xl border border-amber-200 bg-[linear-gradient(180deg,_rgba(251,243,219,0.95),_rgba(255,251,244,0.98))] p-4 shadow-[0_16px_38px_rgba(82,53,20,0.08)]">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Session summary</div>
        <h3 className="mt-1.5 font-display text-2xl tracking-tight text-stone-900">{session.queueName}</h3>
        <p className="mt-1 text-sm text-stone-700">
          Started {formatDate(session.startedAt) ?? 'recently'}{session.completedAt ? ` · ended ${formatDate(session.completedAt) ?? 'recently'}` : ''}
        </p>

        <SummaryGrid summary={summary} />

        {session.sessionNotes ? (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white/80 px-3 py-2 text-sm text-stone-700">{session.sessionNotes}</div>
        ) : null}

        <p className="mt-4 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-sm font-medium text-amber-900">
          Export a backup so progress, notes, and live URLs are safe. Session workflow state itself is local to this browser.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800" onClick={onExport} type="button">
            Export backup
          </button>
          <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100" onClick={() => onStart('fast_25')} type="button">
            Start Fast 25
          </button>
          <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100" onClick={onEnd} type="button">
            Return to board
          </button>
        </div>
      </section>
    );
  }

  const { record, progress } = currentEntry;
  const canOpen = isValidHttpUrl(getDirectoryOpenUrl(record));
  const hasLiveUrl = Boolean(progress.liveUrl?.trim());
  const currentPosition = Math.min(session.currentIndex + 1, session.directoryIds.length);

  return (
    <section className="mb-3 rounded-3xl border border-stone-200 bg-[linear-gradient(180deg,_rgba(255,251,244,0.98),_rgba(249,244,235,0.96))] p-4 shadow-[0_16px_38px_rgba(82,53,20,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">{session.queueName}</div>
          <h3 className="mt-1.5 break-words font-display text-2xl tracking-tight text-stone-900 sm:text-3xl">{record.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-stone-700">
            <Badge>{currentPosition} of {session.directoryIds.length}</Badge>
            <Badge>DR {record.domainRating ?? '-'}</Badge>
            <Badge>{record.category ?? 'Uncategorized'}</Badge>
            {record.priceModel ? <Badge>{record.priceModel}</Badge> : null}
            {record.dofollow ? <Badge>{record.dofollow}</Badge> : null}
            {record.linkStatus ? <Badge>{record.linkStatus.replace('_', ' ')}</Badge> : null}
            <Badge>Status {progress.status.replace('_', ' ')}</Badge>
          </div>
          <div className="mt-3 break-all text-sm font-medium text-stone-700">{record.domain}</div>
        </div>

        <button className="self-start rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100" onClick={onEnd} type="button">
          End session
        </button>
      </div>

      <SummaryGrid summary={summary} compact />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
          disabled={!canOpen}
          onClick={onOpen}
          type="button"
        >
          Open
        </button>
        <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100" onClick={onOpenDetails} type="button">
          Work details
        </button>
        <button className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800" onClick={() => onStatusChange('submitted')} type="button">
          Submitted
        </button>
        {hasLiveUrl ? (
          <button className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100" onClick={() => onStatusChange('published')} type="button">
            Published
          </button>
        ) : null}
        <button className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 transition hover:bg-violet-100" onClick={() => onStatusChange('follow_up')} type="button">
          Follow-up
        </button>
        <button className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100" onClick={() => onStatusChange('skipped')} type="button">
          Skip
        </button>
        <button className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-100" onClick={() => onStatusChange('broken')} type="button">
          Broken
        </button>
        <a className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-100" href={createDirectoryReportMailto(record, progress)}>
          Report
        </a>
        {(progress.followUpDueAt || progress.status === 'follow_up') && (
          <button className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100" onClick={onClearFollowUp} type="button">
            Clear follow-up
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Live URL</span>
          <input
            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
            placeholder="https://live-link"
            value={progress.liveUrl ?? ''}
            onChange={(event) => onFieldChange('liveUrl', event.target.value)}
            onBlur={onFieldCommit}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Notes</span>
          <textarea
            className="min-h-20 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
            placeholder="Notes or submission details"
            value={progress.notes ?? ''}
            onChange={(event) => onFieldChange('notes', event.target.value)}
            onBlur={onFieldCommit}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Session notes</span>
        <textarea
          className="min-h-16 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
          placeholder="Session-level notes"
          value={session.sessionNotes ?? ''}
          onChange={(event) => onUpdateNotes(event.target.value)}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100" onClick={onPrevious} type="button">
          Previous
        </button>
        <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100" onClick={onNext} type="button">
          Next
        </button>
      </div>
    </section>
  );
}

function SummaryGrid({ summary, compact = false }: { summary?: SprintSessionSummary; compact?: boolean }) {
  if (!summary) {
    return null;
  }

  const metrics = [
    ['Attempted', summary.attempted],
    ['Submitted', summary.submitted],
    ['Published', summary.published],
    ['Skipped', summary.skipped],
    ['Broken', summary.broken],
    ['Follow-up', summary.followUp],
    ['Remaining', summary.remaining],
  ];

  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${compact ? 'mt-4' : 'mt-5'}`}>
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-stone-200 bg-white/80 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</div>
          <div className="mt-0.5 text-lg font-semibold text-stone-900">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/85 px-3 py-1 ring-1 ring-stone-200">{children}</span>;
}

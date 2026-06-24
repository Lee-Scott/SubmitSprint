/* eslint-disable react-hooks/incompatible-library */
import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { DirectoryStatus } from '../types';
import { formatDate, getDirectoryOpenUrl, isFollowUpDue, isValidHttpUrl } from '../lib/directory';
import type { DirectoryWithProgress } from '../lib/directory';
import { createDirectoryReportMailto } from '../lib/feedback';

const statusActions: DirectoryStatus[] = ['todo', 'opened', 'submitted', 'published', 'follow_up', 'skipped', 'broken'];

type DirectoryTableProps = {
  directories: DirectoryWithProgress[];
  onClearFollowUp: (directoryId: string) => void;
  onFieldCommit: () => void;
  onOpen: (record: DirectoryWithProgress['record']) => void;
  onSelectDirectory: (directoryId: string) => void;
  onStatusChange: (directoryId: string, status: DirectoryStatus) => void;
  onFieldChange: (directoryId: string, field: 'liveUrl' | 'notes' | 'skipReason', value: string) => void;
};

export function DirectoryTable({
  directories,
  onClearFollowUp,
  onFieldChange,
  onFieldCommit,
  onOpen,
  onSelectDirectory,
  onStatusChange,
}: DirectoryTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [isDesktopBoard, setIsDesktopBoard] = useState(false);

  useEffect(() => {
    const element = parentRef.current;

    if (!element) {
      return;
    }

    const updateBoardSize = () => {
      setIsDesktopBoard(element.getBoundingClientRect().width >= 1024);
    };

    updateBoardSize();

    const observer = new ResizeObserver(updateBoardSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: directories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isDesktopBoard ? 78 : 220),
    measureElement: (element) => Math.ceil(element.getBoundingClientRect().height),
    overscan: 8,
    useAnimationFrameWithResizeObserver: true,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [isDesktopBoard, virtualizer]);

  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <div className="hidden grid-cols-[96px_1.55fr_170px_70px_160px_minmax(160px,0.9fr)] gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500 lg:grid">
        <div>Status</div>
        <div>Name</div>
        <div>Signals</div>
        <div>Open</div>
        <div>Live URL</div>
        <div>Notes</div>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {items.map((item) => {
            const entry = directories[item.index];
            const statusTone = statusColor(entry.progress.status);
            const openUrl = getDirectoryOpenUrl(entry.record);
            const canOpen = isValidHttpUrl(openUrl);
            const followUpLabel = formatDate(entry.progress.followUpDueAt);
            const needsFollowUp = isFollowUpDue(entry.progress);
            const hasLiveUrlReadyForPublish = Boolean(entry.progress.liveUrl?.trim()) && ['todo', 'opened'].includes(entry.progress.status);
            const linkWarning = entry.record.importerWarnings?.length
              ? `Needs review: ${entry.record.importerWarnings.join(', ')}`
              : entry.record.linkStatus && !['untested', 'reviewed'].includes(entry.record.linkStatus)
                ? `Link ${entry.record.linkStatus.replace('_', ' ')}`
                : undefined;

            return (
              <div
                key={entry.record.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full border-b border-stone-200 px-2 py-2 sm:px-3 lg:px-4 lg:py-1"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <div className="rounded-2xl bg-stone-50/70 p-2 ring-1 ring-stone-100 lg:rounded-none lg:bg-transparent lg:p-0 lg:ring-0">
                  <div className="grid gap-2 lg:grid-cols-[96px_1.55fr_170px_70px_160px_minmax(160px,0.9fr)] lg:items-start lg:gap-2">
                    <div className="order-2 lg:order-none">
                      <div className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone}`}>
                        {formatStatus(entry.progress.status)}
                      </div>
                      <details className="group relative mt-1">
                        <summary className="inline-flex cursor-pointer list-none rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50">
                          Change
                        </summary>
                        <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-white p-1.5 shadow-sm lg:absolute lg:left-0 lg:z-20 lg:w-44 lg:shadow-lg">
                          {statusActions.map((status) => (
                            <button
                              key={status}
                              className={`rounded-full border px-2 py-1 text-[10px] transition hover:border-stone-400 ${
                                status === entry.progress.status
                                  ? 'border-stone-400 bg-stone-100 font-semibold text-stone-900'
                                  : 'border-stone-200 bg-white text-stone-700'
                              }`}
                              onClick={() => onStatusChange(entry.record.id, status)}
                              type="button"
                            >
                              {formatStatus(status)}
                            </button>
                          ))}
                          {(entry.progress.followUpDueAt || entry.progress.status === 'follow_up') && (
                            <button
                              className="col-span-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900 transition hover:bg-amber-100"
                              onClick={() => onClearFollowUp(entry.record.id)}
                              type="button"
                            >
                              Clear follow-up
                            </button>
                          )}
                        </div>
                      </details>
                      {followUpLabel ? (
                        <div className={`mt-1 text-[10px] font-medium ${needsFollowUp ? 'text-amber-800' : 'text-stone-500'}`}>
                          {needsFollowUp ? 'Follow-up due' : 'Follow-up'} {followUpLabel}
                        </div>
                      ) : null}
                    </div>

                    <div className="order-1 lg:order-none">
                      <div className="flex flex-wrap items-start justify-between gap-2 lg:block">
                        <div className="min-w-0">
                          <div className="break-words text-[15px] font-semibold leading-snug text-stone-950 lg:text-sm">{entry.record.name}</div>
                          <div className="mt-0.5 break-all text-sm text-stone-600 lg:text-xs">{entry.record.domain}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 lg:hidden">
                          <ScoreBadge value={entry.record.domainRating} />
                          <CategoryChip value={entry.record.category} />
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 lg:hidden">
                        {entry.record.priceModel ? <MetaChip>{entry.record.priceModel}</MetaChip> : null}
                        {entry.record.dofollow ? <MetaChip>{entry.record.dofollow}</MetaChip> : null}
                        {entry.record.linkStatus ? <MetaChip>{entry.record.linkStatus.replace('_', ' ')}</MetaChip> : null}
                      </div>
                      {entry.record.tags?.length ? <div className="mt-1 line-clamp-1 text-xs leading-5 text-stone-500 lg:hidden">{entry.record.tags.join(' · ')}</div> : null}
                      {linkWarning ? <div className="mt-1 text-xs font-medium text-amber-800">{linkWarning}</div> : null}
                    </div>

                    <div className="order-3 hidden flex-wrap gap-1 lg:order-none lg:flex">
                      <ScoreBadge value={entry.record.domainRating} />
                      <CategoryChip value={entry.record.category} />
                      {entry.record.priceModel ? <MetaChip>{entry.record.priceModel}</MetaChip> : null}
                      {entry.record.dofollow ? <MetaChip>{entry.record.dofollow}</MetaChip> : null}
                      {entry.record.linkStatus ? <MetaChip>{entry.record.linkStatus.replace('_', ' ')}</MetaChip> : null}
                    </div>
                    <div className="order-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 lg:order-none lg:block">
                      <button
                        className="w-full rounded-full bg-amber-400 px-3 py-1.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 lg:py-1"
                        disabled={!canOpen}
                        onClick={() => onOpen(entry.record)}
                        title={canOpen ? openUrl : 'Invalid URL'}
                        type="button"
                      >
                        Open
                      </button>
                      <div className="flex justify-center gap-2 lg:mt-1">
                        <button
                          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-[11px] lg:underline lg:decoration-stone-300 lg:underline-offset-2 lg:hover:bg-transparent lg:hover:text-stone-900"
                          onClick={() => onSelectDirectory(entry.record.id)}
                          type="button"
                        >
                          Work
                        </button>
                        <a
                          className="block rounded-full border border-stone-200 bg-white px-3 py-1.5 text-center text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-[11px] lg:underline lg:decoration-stone-300 lg:underline-offset-2 lg:hover:bg-transparent lg:hover:text-stone-800"
                          href={createDirectoryReportMailto(entry.record, entry.progress)}
                        >
                          Report
                        </a>
                      </div>
                    </div>
                    <div className="order-5 lg:order-none">
                      <input
                        aria-label={`${entry.record.name} live URL`}
                        className="h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-amber-400 lg:h-8 lg:bg-stone-50 lg:text-xs"
                        placeholder="https://live-link"
                        value={entry.progress.liveUrl ?? ''}
                        onChange={(event) => onFieldChange(entry.record.id, 'liveUrl', event.target.value)}
                        onBlur={onFieldCommit}
                      />
                      {hasLiveUrlReadyForPublish ? (
                        <button
                          className="mt-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-900 transition hover:bg-emerald-100"
                          onClick={() => onStatusChange(entry.record.id, 'published')}
                          type="button"
                        >
                          Publish
                        </button>
                      ) : null}
                    </div>
                    <div className="order-6 lg:order-none">
                      <textarea
                        aria-label={`${entry.record.name} notes`}
                        className="min-h-9 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-amber-400 lg:h-8 lg:min-h-8 lg:py-1.5 lg:text-xs lg:bg-stone-50"
                        placeholder="Notes or skip reason"
                        value={entry.progress.notes ?? ''}
                        onChange={(event) => onFieldChange(entry.record.id, 'notes', event.target.value)}
                        onBlur={onFieldCommit}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function statusColor(status: DirectoryStatus) {
  switch (status) {
    case 'opened':
      return 'bg-sky-100 text-sky-800';
    case 'submitted':
      return 'bg-amber-100 text-amber-900';
    case 'published':
      return 'bg-emerald-100 text-emerald-800';
    case 'follow_up':
      return 'bg-violet-100 text-violet-800';
    case 'skipped':
      return 'bg-stone-200 text-stone-700';
    case 'broken':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-stone-100 text-stone-700';
  }
}

function formatStatus(status: DirectoryStatus) {
  return status.replace('_', ' ');
}

function ScoreBadge({ value }: { value?: number }) {
  return <div className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">DR {value ?? '—'}</div>;
}

function CategoryChip({ value }: { value?: string }) {
  return <div className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">{value ?? 'Uncategorized'}</div>;
}

function MetaChip({ children }: { children: string }) {
  return <div className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200">{children}</div>;
}

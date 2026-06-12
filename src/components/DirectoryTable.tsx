/* eslint-disable react-hooks/incompatible-library */
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { DirectoryStatus } from '../types';
import type { DirectoryWithProgress } from '../lib/directory';

const statusActions: DirectoryStatus[] = ['submitted', 'published', 'follow_up', 'skipped', 'broken'];

type DirectoryTableProps = {
  directories: DirectoryWithProgress[];
  onOpen: (record: DirectoryWithProgress['record']) => void;
  onStatusChange: (directoryId: string, status: DirectoryStatus) => void;
  onFieldChange: (directoryId: string, field: 'liveUrl' | 'notes' | 'skipReason', value: string) => void;
};

export function DirectoryTable({ directories, onFieldChange, onOpen, onStatusChange }: DirectoryTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: directories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260,
    overscan: 8,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-stone-200 bg-white">
      <div className="hidden grid-cols-[110px_1.6fr_72px_110px_92px_150px_1.1fr] gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 lg:grid">
        <div>Status</div>
        <div>Name</div>
        <div>DR</div>
        <div>Category</div>
        <div>Open</div>
        <div>Live URL</div>
        <div>Notes</div>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {items.map((item) => {
            const entry = directories[item.index];
            const statusTone = statusColor(entry.progress.status);

            return (
              <div
                key={entry.record.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full border-b border-stone-200 px-3 py-3 sm:px-4"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <div className="rounded-[22px] bg-white lg:rounded-none lg:bg-transparent">
                  <div className="grid gap-3 lg:grid-cols-[110px_1.6fr_72px_110px_92px_150px_1.1fr]">
                    <div className="order-2 lg:order-none">
                      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>
                        {formatStatus(entry.progress.status)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {statusActions.map((status) => (
                          <button
                            key={status}
                            className="rounded-full border border-stone-200 px-2.5 py-1 text-[11px] text-stone-700 transition hover:border-stone-400"
                            onClick={() => onStatusChange(entry.record.id, status)}
                            type="button"
                          >
                            {formatStatus(status)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="order-1 lg:order-none">
                      <div className="flex flex-wrap items-start justify-between gap-2 lg:block">
                        <div>
                          <div className="font-semibold text-stone-900">{entry.record.name}</div>
                          <div className="mt-1 text-sm text-stone-600">{entry.record.domain}</div>
                        </div>
                        <div className="flex items-center gap-2 lg:hidden">
                          <ScoreBadge value={entry.record.domainRating} />
                          <CategoryChip value={entry.record.category} />
                        </div>
                      </div>
                      {entry.record.tags?.length ? <div className="mt-2 text-xs text-stone-500">{entry.record.tags.join(' · ')}</div> : null}
                    </div>

                    <div className="hidden lg:block">
                      <ScoreBadge value={entry.record.domainRating} />
                    </div>
                    <div className="hidden lg:block">
                      <CategoryChip value={entry.record.category} />
                    </div>
                    <div>
                      <button
                        className="w-full rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300"
                        onClick={() => onOpen(entry.record)}
                        type="button"
                      >
                        Open
                      </button>
                    </div>
                    <div>
                      <input
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-amber-400"
                        placeholder="https://live-link"
                        value={entry.progress.liveUrl ?? ''}
                        onChange={(event) => onFieldChange(entry.record.id, 'liveUrl', event.target.value)}
                      />
                    </div>
                    <div>
                      <textarea
                        className="min-h-20 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-amber-400"
                        placeholder="Notes or skip reason"
                        value={entry.progress.notes ?? ''}
                        onChange={(event) => onFieldChange(entry.record.id, 'notes', event.target.value)}
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

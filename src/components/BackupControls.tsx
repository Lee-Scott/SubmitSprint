import { useRef } from 'react';

type BackupControlsProps = {
  meaningfulChanges: number;
  lastBackupLabel: string;
  exportRecommendation: string;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onReset: () => void;
};

export function BackupControls({
  meaningfulChanges,
  lastBackupLabel,
  exportRecommendation,
  onExport,
  onImport,
  onReset,
}: BackupControlsProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="rounded-3xl border border-stone-200 bg-white/90 p-3 shadow-[0_18px_42px_rgba(87,53,13,0.06)] backdrop-blur sm:p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Backups</div>
      <h2 className="font-display text-[1.45rem] text-stone-900 sm:text-2xl">Protect progress</h2>

      <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
        <div className="font-medium text-stone-900">Progress is saved only in this browser.</div>
        <div className="mt-1">Export a JSON backup before clearing data, switching browsers, or changing devices.</div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200">
            <dt className="font-semibold uppercase tracking-[0.12em] text-stone-500">Last backup</dt>
            <dd className="mt-0.5 text-stone-900">{lastBackupLabel}</dd>
          </div>
          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200">
            <dt className="font-semibold uppercase tracking-[0.12em] text-stone-500">Changes</dt>
            <dd className="mt-0.5 text-stone-900">{meaningfulChanges}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-3 grid gap-2">
        <button className="rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800" onClick={onExport} type="button">
          Export backup
        </button>
        <button className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50" onClick={() => fileRef.current?.click()} type="button">
          Import backup
        </button>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          {exportRecommendation}
        </div>
        <button className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" onClick={onReset} type="button">
          Reset progress
        </button>
      </div>

      <input
        ref={fileRef}
        accept="application/json"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void onImport(file);
          }
          event.currentTarget.value = '';
        }}
      />
    </section>
  );
}

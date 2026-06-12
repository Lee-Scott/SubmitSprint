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
    <section className="rounded-[28px] border border-stone-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(87,53,13,0.06)] backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Backup controls</div>
      <h2 className="font-display text-2xl text-stone-900">Protect your sprint state</h2>

      <div className="mt-4 space-y-2 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
        <div className="font-medium text-stone-900">Saved in this browser</div>
        <div>Last backup: {lastBackupLabel}</div>
        <div>{exportRecommendation}</div>
        <div>Changes since export: {meaningfulChanges}</div>
      </div>

      <div className="mt-4 grid gap-2">
        <button className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800" onClick={onExport} type="button">
          Export backup
        </button>
        <button className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50" onClick={() => fileRef.current?.click()} type="button">
          Import backup
        </button>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Export is recommended after enough changes so you do not lose local progress.
        </div>
        <button className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" onClick={onReset} type="button">
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

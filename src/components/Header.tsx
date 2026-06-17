type HeaderProps = {
  counts: {
    total: number;
    todo: number;
    opened: number;
    submitted: number;
    published: number;
    follow_up: number;
    skipped: number;
    broken: number;
  };
  completion: number;
  datasetVersion?: string;
  exportRecommendation: string;
  lastBackupLabel: string;
  message: string;
  copyState: string;
  onExport: () => void;
  onStartFast25: () => void;
  onUndo?: () => void;
  undoLabel?: string;
};

export function Header({
  counts,
  completion,
  datasetVersion,
  exportRecommendation,
  lastBackupLabel,
  message,
  copyState,
  onExport,
  onStartFast25,
  onUndo,
  undoLabel,
}: HeaderProps) {
  return (
    <header className="rounded-[30px] border border-stone-200 bg-white/92 px-4 py-4 shadow-[0_22px_50px_rgba(71,52,24,0.08)] sm:px-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">SubmitSprint</div>
            <h1 className="mt-2 font-display text-[2rem] leading-[0.96] tracking-tight text-stone-900 sm:text-[2.8rem]">
              Speed-run startup directory submissions.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-[15px]">
              Track SaaS directories, copy your startup assets, mark submissions, and save your progress no login
              required.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800"
                  onClick={onStartFast25}
                  type="button"
                >
                  Start with Fast 25
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100"
                  onClick={onExport}
                  type="button"
                >
                  Export backup
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-400"
                  disabled={!onUndo}
                  onClick={onUndo}
                  type="button"
                >
                  {undoLabel ?? 'Undo last action'}
                </button>
              </div>
              <div className="text-xs font-medium text-stone-500">Free · No login · Saves in this browser</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-stone-600 xl:max-w-md xl:justify-end">
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-stone-700 ring-1 ring-amber-100">
              Dataset {datasetVersion ?? 'pending'}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-700">{message}</span>
            <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-700">Last backup {lastBackupLabel}</span>
            {copyState ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">{copyState}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Total directories" value={String(counts.total)} />
          <Metric label="Todo" value={String(counts.todo)} />
          <Metric label="Submitted" value={String(counts.submitted)} />
          <Metric label="Published" value={String(counts.published)} />
          <Metric label="Follow-Up / Skipped" value={`${counts.follow_up} / ${counts.skipped}`} />
          <Metric label="Completion" value={`${completion}%`} emphasis />
        </div>

        <div className="text-xs text-stone-500">{exportRecommendation}</div>
      </div>
    </header>
  );
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${emphasis ? 'border-amber-200 bg-amber-50/70' : 'border-stone-200 bg-stone-50/80'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

import type { SmartViewId } from '../types';

const smartViews: Array<{ id: SmartViewId; label: string }> = [
  { id: 'start_here', label: 'Start Here' },
  { id: 'fast_25', label: 'Fast 25' },
  { id: 'elite_50', label: 'Elite 50' },
  { id: 'ai_directories', label: 'AI Directories' },
  { id: 'saas_directories', label: 'SaaS Directories' },
  { id: 'todo', label: 'Todo' },
  { id: 'opened', label: 'Opened' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'published', label: 'Published' },
  { id: 'follow_up', label: 'Follow-Up' },
  { id: 'skipped', label: 'Skipped' },
];

type SmartViewsProps = {
  activeView: SmartViewId;
  counts: Record<SmartViewId, number>;
  onChange: (view: SmartViewId) => void;
};

export function SmartViews({ activeView, counts, onChange }: SmartViewsProps) {
  return (
    <aside className="rounded-3xl border border-stone-200 bg-white/88 p-3 shadow-[0_18px_42px_rgba(87,53,13,0.06)] backdrop-blur xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
      <div className="mb-2 px-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Smart views</div>
        <p className="mt-1 text-sm text-stone-600 xl:block">Best directories first, then status.</p>
      </div>

      <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:block xl:space-y-1">
        {smartViews.map((view) => {
          const active = view.id === activeView;

          return (
            <button
              key={view.id}
              className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                active ? 'bg-stone-900 text-stone-50 shadow-[0_16px_30px_rgba(28,25,23,0.14)]' : 'bg-transparent text-stone-700 hover:bg-stone-100'
              }`}
              onClick={() => onChange(view.id)}
              type="button"
            >
              <span className="font-medium">{view.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-stone-50/10 text-stone-100' : 'bg-stone-200 text-stone-700'}`}>
                {counts[view.id]}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

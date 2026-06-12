import type { StartupProfile } from '../types';

const fields: Array<{ key: keyof StartupProfile; label: string; rows?: number }> = [
  { key: 'startupName', label: 'Startup name' },
  { key: 'websiteUrl', label: 'Website URL' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'shortDescription', label: 'Short description', rows: 3 },
  { key: 'longDescription', label: 'Long description', rows: 5 },
  { key: 'founderName', label: 'Founder name' },
  { key: 'contactEmail', label: 'Contact email' },
  { key: 'logoUrl', label: 'Logo URL' },
  { key: 'category', label: 'Category' },
  { key: 'keywords', label: 'Keywords', rows: 3 },
  { key: 'xUrl', label: 'X/Twitter URL' },
  { key: 'linkedinUrl', label: 'LinkedIn URL' },
  { key: 'demoUrl', label: 'Demo URL' },
  { key: 'pricingSummary', label: 'Pricing summary', rows: 3 },
];

type ProfilePanelProps = {
  profile: StartupProfile;
  onChange: (field: keyof StartupProfile, value: string) => void;
  onCopy: (label: string, value: string) => void;
};

export function ProfilePanel({ profile, onChange, onCopy }: ProfilePanelProps) {
  const shortSubmission = [profile.startupName, profile.websiteUrl, profile.tagline, profile.shortDescription].filter(Boolean).join('\n');
  const longSubmission = [
    profile.startupName,
    profile.websiteUrl,
    profile.tagline,
    profile.longDescription,
    `Founder: ${profile.founderName}`,
    `Contact: ${profile.contactEmail}`,
    `Pricing: ${profile.pricingSummary}`,
  ]
    .filter(Boolean)
    .join('\n');
  const fullProfile = JSON.stringify(profile, null, 2);

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(87,53,13,0.06)] backdrop-blur">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Startup profile</div>
        <h2 className="font-display text-2xl text-stone-900">Copy your startup assets</h2>
        <p className="mt-2 text-sm text-stone-600">Fill this once, then copy/paste into every directory.</p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <ActionButton label="Short submission" onClick={() => onCopy('Short submission', shortSubmission)} />
        <ActionButton label="Long submission" onClick={() => onCopy('Long submission', longSubmission)} />
        <ActionButton label="Tags" onClick={() => onCopy('Tags', profile.keywords)} />
        <ActionButton label="Full profile" onClick={() => onCopy('Full profile', fullProfile)} />
      </div>

      <div className="space-y-2.5">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <div className="mb-1 flex items-center justify-between text-sm font-medium text-stone-700">
              <span>{field.label}</span>
              <button className="text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-700" onClick={() => onCopy(field.label, profile[field.key])} type="button">
                Copy
              </button>
            </div>
            {field.rows ? (
              <textarea
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-amber-400"
                rows={field.rows}
                value={profile[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : (
              <input
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-amber-400"
                value={profile[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-left text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-100"
      onClick={onClick}
      type="button"
    >
      Copy {label}
    </button>
  );
}

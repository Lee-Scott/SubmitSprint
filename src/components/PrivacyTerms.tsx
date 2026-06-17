export function PrivacyTerms() {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <details id="privacy" className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">Privacy</summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
          <p>SubmitSprint has no account system, server database, analytics scripts, ads, or server-side user storage.</p>
          <p>Your startup profile, directory progress, notes, live URLs, settings, and backup metadata are stored in this browser.</p>
          <p>Backup files are downloaded JSON files controlled by you. They may contain private startup, founder, contact, notes, and submission data.</p>
          <p>If analytics, ads, accounts, or cloud sync are added later, this disclosure must be updated before launch.</p>
        </div>
      </details>

      <details id="terms" className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">Terms / Disclaimer</summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
          <p>Directory data may be incomplete, outdated, or imperfect. Verify links, submission requirements, pricing, and listing rules before relying on them.</p>
          <p>SubmitSprint does not guarantee approvals, backlinks, SEO performance, traffic, revenue, or directory availability.</p>
          <p>Use the tracker and dataset at your own risk. Export backups regularly if the progress matters to you.</p>
        </div>
      </details>
    </div>
  );
}

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { BackupControls } from './components/BackupControls';
import { DirectoryTable } from './components/DirectoryTable';
import { Header } from './components/Header';
import { ProfilePanel } from './components/ProfilePanel';
import { SmartViews } from './components/SmartViews';
import { exportBackup, importBackupFile } from './lib/backup';
import {
  applySmartView,
  countSmartViews,
  countStatuses,
  createEmptyProfile,
  defaultSmartView,
  getBackupRecommendation,
  getCompletionPercentage,
  getDirectoryProgress,
  getLastBackupLabel,
  searchDirectories,
  sortDirectoriesByDr,
  type DirectoryWithProgress,
} from './lib/directory';
import {
  copyText,
  loadBackupMeta,
  loadProfile,
  loadProgress,
  loadSettings,
  resetProgressState,
  saveBackupMeta,
  saveProfile,
  saveProgress,
  saveSettings,
  type BackupMeta,
  type SettingsState,
} from './lib/storage';
import type {
  DatasetPayload,
  DirectoryProgress,
  DirectoryRecord,
  DirectoryStatus,
  StartupProfile,
  SmartViewId,
} from './types';

function App() {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [datasetVersion, setDatasetVersion] = useState<string>();
  const [profile, setProfile] = useState<StartupProfile>(() => loadProfile());
  const [progressMap, setProgressMap] = useState<Record<string, DirectoryProgress>>(() => loadProgress());
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const [backupMeta, setBackupMeta] = useState<BackupMeta>(() => loadBackupMeta());
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string>('Loading directories...');
  const [loadError, setLoadError] = useState<string>();
  const [copyState, setCopyState] = useState<string>('');

  useEffect(() => {
    let active = true;

    async function loadDataset() {
      try {
        const response = await fetch('/data/master_directories.json');

        if (!response.ok) {
          throw new Error(`Failed to load directory dataset (${response.status})`);
        }

        const payload = (await response.json()) as DatasetPayload;

        if (!active) {
          return;
        }

        setRecords(payload.records ?? []);
        setDatasetVersion(payload.dataVersion);
        setMessage(`Loaded ${payload.records.length} directories`);
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Failed to load directories');
        setMessage('Directory dataset unavailable');
      }
    }

    void loadDataset();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    saveProgress(progressMap);
  }, [progressMap]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveBackupMeta(backupMeta);
  }, [backupMeta]);

  useEffect(() => {
    if (!copyState) {
      return;
    }

    const timer = window.setTimeout(() => setCopyState(''), 1800);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const deferredSearch = useDeferredValue(search.trim());

  const mergedDirectories = useMemo<DirectoryWithProgress[]>(
    () =>
      records.map((record) => ({
        record,
        progress: getDirectoryProgress(progressMap, record.id),
      })),
    [progressMap, records],
  );

  const directories = useMemo<DirectoryWithProgress[]>(() => {
    const filteredByView = applySmartView(mergedDirectories, settings.activeView);
    const filteredBySearch = searchDirectories(filteredByView, deferredSearch);

    return sortDirectoriesByDr(filteredBySearch);
  }, [deferredSearch, mergedDirectories, settings.activeView]);

  const statusCounts = useMemo(() => countStatuses(records, progressMap), [records, progressMap]);
  const smartViewCounts = useMemo(() => countSmartViews(mergedDirectories), [mergedDirectories]);
  const completion = useMemo(() => getCompletionPercentage(statusCounts), [statusCounts]);
  const exportRecommendation = getBackupRecommendation(backupMeta.meaningfulChangesSinceExport);
  const lastBackupLabel = getLastBackupLabel(backupMeta.lastExportedAt);

  function focusWorkspace() {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => workspaceRef.current?.focus(), 150);
  }

  function updateProgress(directoryId: string, updater: (current: DirectoryProgress) => DirectoryProgress) {
    setProgressMap((current) => {
      const nextEntry = updater(getDirectoryProgress(current, directoryId));
      return {
        ...current,
        [directoryId]: nextEntry,
      };
    });

    setBackupMeta((current) => ({
      ...current,
      meaningfulChangesSinceExport: current.meaningfulChangesSinceExport + 1,
    }));
  }

  function handleOpen(record: DirectoryRecord) {
    const progress = getDirectoryProgress(progressMap, record.id);

    if (progress.status === 'todo') {
      updateProgress(record.id, (current) => ({
        ...current,
        status: 'opened',
        openedAt: current.openedAt ?? new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      }));
    }

    window.open(record.url, '_blank', 'noopener,noreferrer');
  }

  function handleStatusChange(directoryId: string, status: DirectoryStatus) {
    updateProgress(directoryId, (current) => {
      const now = new Date().toISOString();
      const next = {
        ...current,
        status,
        lastUpdatedAt: now,
      };

      if (status === 'opened') next.openedAt = current.openedAt ?? now;
      if (status === 'submitted') next.submittedAt = now;
      if (status === 'published') next.publishedAt = now;
      if (status === 'skipped') next.skippedAt = now;

      return next;
    });
  }

  function handleFieldChange(directoryId: string, field: 'liveUrl' | 'notes' | 'skipReason', value: string) {
    updateProgress(directoryId, (current) => ({
      ...current,
      [field]: value,
      lastUpdatedAt: new Date().toISOString(),
    }));
  }

  function handleProfileChange(field: keyof StartupProfile, value: string) {
    setProfile((current) => ({
      ...current,
      [field]: value,
      updatedAt: new Date().toISOString(),
    }));

    setBackupMeta((current) => ({
      ...current,
      meaningfulChangesSinceExport: current.meaningfulChangesSinceExport + 1,
    }));
  }

  async function handleCopy(label: string, value: string) {
    const result = await copyText(value);
    setCopyState(result ? `${label} copied` : `${label} copy failed`);
  }

  function handleExport() {
    exportBackup({
      datasetVersion,
      profile,
      progressMap,
      settings,
    });

    setBackupMeta({
      lastExportedAt: new Date().toISOString(),
      meaningfulChangesSinceExport: 0,
    });
  }

  async function handleImport(file: File) {
    const result = await importBackupFile(file, {
      currentProfile: profile,
      currentProgress: progressMap,
      currentSettings: settings,
    });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setProfile(result.profile);
    setProgressMap(result.progressMap);
    setSettings(result.settings);
    setBackupMeta({
      lastExportedAt: backupMeta.lastExportedAt,
      meaningfulChangesSinceExport: 0,
    });
    setMessage(result.message);
  }

  function handleReset() {
    const confirmed = window.confirm('Reset all saved progress and restore the startup profile to empty values?');

    if (!confirmed) {
      return;
    }

    resetProgressState();
    setProfile(createEmptyProfile());
    setProgressMap({});
    setSettings({ activeView: defaultSmartView });
    setBackupMeta({ lastExportedAt: undefined, meaningfulChangesSinceExport: 0 });
    setMessage('Local progress reset');
  }

  function handleStartFast25() {
    setSettings({ activeView: 'fast_25' });
    focusWorkspace();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(247,196,103,0.16),_transparent_28%),linear-gradient(180deg,_#f8f4ec_0%,_#f4efe6_42%,_#efe7da_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-[1580px] flex-col px-4 py-4 sm:px-6">
        <Header
          completion={completion}
          counts={statusCounts}
          copyState={copyState}
          datasetVersion={datasetVersion}
          exportRecommendation={exportRecommendation}
          lastBackupLabel={lastBackupLabel}
          message={loadError ?? message}
          onExport={handleExport}
          onStartFast25={handleStartFast25}
        />

        <div className="mt-4 grid flex-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_340px]">
          <SmartViews
            activeView={settings.activeView}
            counts={smartViewCounts}
            onChange={(activeView: SmartViewId) => setSettings({ activeView })}
          />

          <main
            ref={workspaceRef}
            className="flex min-h-[70vh] flex-col rounded-[28px] border border-stone-200 bg-white/90 p-4 shadow-[0_20px_55px_rgba(82,53,20,0.07)] backdrop-blur focus:outline-none"
            tabIndex={-1}
          >
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-2xl tracking-tight text-stone-900">Directory sprint board</h2>
                <p className="text-sm text-stone-600">Pick a view, open a listing, copy your profile, then mark progress.</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Search</span>
                <input
                  className="w-full min-w-0 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm outline-none transition focus:border-amber-400 sm:w-72"
                  placeholder="Name, domain, category"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <DirectoryTable
              directories={directories}
              onFieldChange={handleFieldChange}
              onOpen={handleOpen}
              onStatusChange={handleStatusChange}
            />
          </main>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto xl:pr-1">
            <ProfilePanel profile={profile} onChange={handleProfileChange} onCopy={handleCopy} />
            <BackupControls
              exportRecommendation={exportRecommendation}
              lastBackupLabel={lastBackupLabel}
              meaningfulChanges={backupMeta.meaningfulChangesSinceExport}
              onExport={handleExport}
              onImport={handleImport}
              onReset={handleReset}
            />
          </aside>
        </div>

        <footer className="mt-4 rounded-[28px] border border-stone-200 bg-white/88 px-4 py-5 text-sm text-stone-600 shadow-[0_18px_45px_rgba(82,53,20,0.05)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-stone-900">SubmitSprint</div>
              <div>Free startup directory submission tracker</div>
              <div>No login. Export your backup anytime.</div>
            </div>
            <div className="flex gap-4 text-sm text-stone-500">
              <a href="#privacy">Privacy</a>
              <a href="#terms">Terms</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;

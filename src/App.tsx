import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { BackupControls } from './components/BackupControls';
import { DirectoryTable } from './components/DirectoryTable';
import { Header } from './components/Header';
import { ProfilePanel } from './components/ProfilePanel';
import { PrivacyTerms } from './components/PrivacyTerms';
import { SmartViews } from './components/SmartViews';
import { SprintPanel } from './components/SprintPanel';
import { exportBackup, importBackupFile } from './lib/backup';
import {
  applySmartView,
  buildStatusProgress,
  clearFollowUp,
  countSmartViews,
  countStatuses,
  createEmptyProfile,
  defaultSmartView,
  getDirectoryOpenUrl,
  getFast25Queue,
  getBackupRecommendation,
  getCompletionPercentage,
  getDirectoryProgress,
  getLastBackupLabel,
  getNextActionableDirectoryId,
  getOrphanProgressRecords,
  isSprintActionableStatus,
  isValidHttpUrl,
  pruneOrphanProgress,
  searchDirectories,
  sortDirectoriesByDr,
  type DirectoryWithProgress,
} from './lib/directory';
import { createContactMailto, createGeneralIssueMailto, createSuggestDirectoryMailto } from './lib/feedback';
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

const sprintTerminalStatuses = new Set<DirectoryStatus>(['submitted', 'published', 'skipped']);

function App() {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const sprintPanelRef = useRef<HTMLDivElement | null>(null);
  const sprintActionLockRef = useRef(false);
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
  const [sprintModeActive, setSprintModeActive] = useState(false);
  const [sprintQueueIds, setSprintQueueIds] = useState<string[]>([]);
  const [sprintCurrentId, setSprintCurrentId] = useState<string>();
  const [lastUndo, setLastUndo] = useState<{ directoryId: string; previous: DirectoryProgress; label: string }>();

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
    const timer = window.setTimeout(() => saveProfile(profile), 350);
    return () => window.clearTimeout(timer);
  }, [profile]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveProgress(progressMap), 350);
    return () => window.clearTimeout(timer);
  }, [progressMap]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveBackupMeta(backupMeta);
  }, [backupMeta]);

  useEffect(() => {
    function flushBeforeExit() {
      saveProfile(profile);
      saveProgress(progressMap);
      saveSettings(settings);
      saveBackupMeta(backupMeta);
    }

    window.addEventListener('pagehide', flushBeforeExit);
    window.addEventListener('beforeunload', flushBeforeExit);
    return () => {
      window.removeEventListener('pagehide', flushBeforeExit);
      window.removeEventListener('beforeunload', flushBeforeExit);
    };
  }, [backupMeta, profile, progressMap, settings]);

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
  const sprintQueue = useMemo(
    () =>
      sprintQueueIds
        .map((directoryId) => mergedDirectories.find(({ record }) => record.id === directoryId))
        .filter((entry): entry is DirectoryWithProgress => Boolean(entry)),
    [mergedDirectories, sprintQueueIds],
  );
  const sprintActionableEntries = sprintQueue.filter(({ progress }) => isSprintActionableStatus(progress.status));
  const sprintCompletedCount = sprintQueue.filter(({ progress }) => sprintTerminalStatuses.has(progress.status)).length;
  const sprintCurrentEntry =
    sprintActionableEntries.find(({ record }) => record.id === sprintCurrentId) ??
    sprintActionableEntries[0];
  const sprintComplete = sprintModeActive && sprintQueue.length > 0 && sprintActionableEntries.length === 0;
  const orphanProgressRecords = useMemo(() => getOrphanProgressRecords(progressMap, records), [progressMap, records]);

  function focusWorkspace() {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => workspaceRef.current?.focus(), 150);
  }

  function focusSprintPanel() {
    sprintPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => sprintPanelRef.current?.focus(), 150);
  }

  function flushLocalState() {
    saveProfile(profile);
    saveProgress(progressMap);
    saveSettings(settings);
    saveBackupMeta(backupMeta);
  }

  function updateProgress(
    directoryId: string,
    updater: (current: DirectoryProgress) => DirectoryProgress,
    options: { trackUndo?: boolean; undoLabel?: string; meaningful?: boolean } = {},
  ) {
    setProgressMap((current) => {
      const previousEntry = getDirectoryProgress(current, directoryId);
      const nextEntry = updater(previousEntry);

      if (options.trackUndo) {
        setLastUndo({
          directoryId,
          previous: previousEntry,
          label: options.undoLabel ?? 'last action',
        });
      }

      return {
        ...current,
        [directoryId]: nextEntry,
      };
    });

    if (options.meaningful ?? true) {
      setBackupMeta((current) => ({
        ...current,
        meaningfulChangesSinceExport: current.meaningfulChangesSinceExport + 1,
      }));
    }
  }

  function handleOpen(record: DirectoryRecord) {
    const openUrl = getDirectoryOpenUrl(record);

    if (!isValidHttpUrl(openUrl)) {
      setMessage(`Invalid URL for ${record.name}`);
      return;
    }

    const progress = getDirectoryProgress(progressMap, record.id);

    if (progress.status === 'todo') {
      updateProgress(record.id, (current) => buildStatusProgress(current, 'opened', new Date(), 'open'), {
        trackUndo: true,
        undoLabel: `opening ${record.name}`,
      });
    }

    window.open(openUrl, '_blank', 'noopener,noreferrer');
  }

  function handleStatusChange(directoryId: string, status: DirectoryStatus) {
    updateProgress(directoryId, (current) => buildStatusProgress(current, status), {
      trackUndo: true,
      undoLabel: `marking ${status.replace('_', ' ')}`,
    });
  }

  function getNextSprintActionableId(fromId?: string) {
    return getNextActionableDirectoryId(sprintQueue, fromId);
  }

  function handleFieldChange(directoryId: string, field: 'liveUrl' | 'notes' | 'skipReason', value: string) {
    updateProgress(directoryId, (current) => ({
      ...current,
      [field]: value,
      lastUpdatedAt: new Date().toISOString(),
    }));
  }

  function handleClearFollowUp(directoryId: string) {
    updateProgress(directoryId, (current) => clearFollowUp(current), {
      trackUndo: true,
      undoLabel: 'clearing follow-up',
    });
  }

  function handleUndoLastAction() {
    if (!lastUndo) {
      return;
    }

    setProgressMap((current) => ({
      ...current,
      [lastUndo.directoryId]: {
        ...lastUndo.previous,
        lastUpdatedAt: new Date().toISOString(),
        lastActionAt: new Date().toISOString(),
        lastActionType: 'status',
      },
    }));
    setBackupMeta((current) => ({
      ...current,
      meaningfulChangesSinceExport: current.meaningfulChangesSinceExport + 1,
    }));
    setMessage(`Undid ${lastUndo.label}`);
    setLastUndo(undefined);
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
      validDirectoryIds: new Set(records.map((record) => record.id)),
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
    setLastUndo(undefined);
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
    setSprintModeActive(false);
    setSprintQueueIds([]);
    setSprintCurrentId(undefined);
    setLastUndo(undefined);
  }

  function handlePruneOrphans() {
    if (!orphanProgressRecords.length) {
      return;
    }

    const confirmed = window.confirm('Export a backup, then remove saved progress that no longer matches the current dataset?');

    if (!confirmed) {
      return;
    }

    handleExport();
    setProgressMap((current) => pruneOrphanProgress(current, records));
    setBackupMeta((current) => ({
      ...current,
      meaningfulChangesSinceExport: current.meaningfulChangesSinceExport + 1,
    }));
    setMessage(`Cleaned up ${orphanProgressRecords.length} orphaned progress record${orphanProgressRecords.length === 1 ? '' : 's'}`);
  }

  function handleStartFast25() {
    const queue = getFast25Queue(mergedDirectories).map(({ record }) => record.id);
    setSettings((current) => ({ ...current, activeView: 'fast_25' }));
    sprintActionLockRef.current = false;
    setSprintModeActive(true);
    setSprintQueueIds(queue);
    setSprintCurrentId(queue[0]);
    focusWorkspace();
    window.setTimeout(() => focusSprintPanel(), 180);
  }

  function handleExitSprint() {
    setSprintModeActive(false);
    setSprintQueueIds([]);
    setSprintCurrentId(undefined);
    sprintActionLockRef.current = false;
    focusWorkspace();
  }

  function runSprintAction(action: () => void) {
    if (sprintActionLockRef.current) {
      return;
    }

    sprintActionLockRef.current = true;
    action();
    window.setTimeout(() => {
      sprintActionLockRef.current = false;
    }, 160);
  }

  function handleSprintNext() {
    runSprintAction(() => setSprintCurrentId(getNextSprintActionableId(sprintCurrentId)));
  }

  function handleSprintFieldChange(field: 'liveUrl' | 'notes', value: string) {
    if (!sprintCurrentEntry) {
      return;
    }

    handleFieldChange(sprintCurrentEntry.record.id, field, value);
  }

  function handleSprintOpen() {
    if (!sprintCurrentEntry) {
      return;
    }

    handleOpen(sprintCurrentEntry.record);
  }

  function handleSprintStatusChange(status: DirectoryStatus) {
    if (!sprintCurrentEntry) {
      return;
    }

    runSprintAction(() => {
      const currentId = sprintCurrentEntry.record.id;
      const nextId = sprintTerminalStatuses.has(status) ? getNextSprintActionableId(currentId) : currentId;
      handleStatusChange(currentId, status);
      setSprintCurrentId(nextId);
    });
  }

  function handleSprintClearFollowUp() {
    if (!sprintCurrentEntry) {
      return;
    }

    handleClearFollowUp(sprintCurrentEntry.record.id);
  }

  const handleSprintKeyDown = useEffectEvent((event: KeyboardEvent) => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'escape') {
      event.preventDefault();
      handleExitSprint();
      return;
    }

    if (!sprintCurrentEntry && !sprintComplete) {
      return;
    }

    if (key === 'enter' || key === 'o') {
      event.preventDefault();
      handleSprintOpen();
    } else if (key === 's') {
      event.preventDefault();
      handleSprintStatusChange('submitted');
    } else if (key === 'k' || key === 'x') {
      event.preventDefault();
      handleSprintStatusChange('skipped');
    } else if (key === 'n') {
      event.preventDefault();
      handleSprintNext();
    }
  });

  useEffect(() => {
    if (!sprintModeActive) {
      return;
    }

    function listener(event: KeyboardEvent) {
      handleSprintKeyDown(event);
    }

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [sprintModeActive]);

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
          onUndo={lastUndo ? handleUndoLastAction : undefined}
          undoLabel={lastUndo ? `Undo ${lastUndo.label}` : undefined}
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

            {orphanProgressRecords.length ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <div className="font-semibold">Some saved progress no longer matches the current dataset.</div>
                <div className="mt-1">
                  {orphanProgressRecords.length} saved record{orphanProgressRecords.length === 1 ? '' : 's'} will stay in your backup unless you clean them up.
                </div>
                <button
                  className="mt-3 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                  onClick={handlePruneOrphans}
                  type="button"
                >
                  Export backup and clean up
                </button>
              </div>
            ) : null}

            {sprintModeActive ? (
              <div ref={sprintPanelRef} tabIndex={-1} className="focus:outline-none">
                <SprintPanel
                  completedCount={sprintCompletedCount}
                  currentEntry={sprintCurrentEntry}
                  isComplete={sprintComplete}
                  onClearFollowUp={handleSprintClearFollowUp}
                  onExit={handleExitSprint}
                  onExport={handleExport}
                  onFieldCommit={flushLocalState}
                  onFieldChange={handleSprintFieldChange}
                  onFollowUp={() => handleSprintStatusChange('follow_up')}
                  onNext={handleSprintNext}
                  onOpen={handleSprintOpen}
                  onPublished={() => handleSprintStatusChange('published')}
                  onSkip={() => handleSprintStatusChange('skipped')}
                  onSubmitted={() => handleSprintStatusChange('submitted')}
                  totalCount={sprintQueue.length}
                />
              </div>
            ) : null}

            <DirectoryTable
              directories={directories}
              onClearFollowUp={handleClearFollowUp}
              onFieldCommit={flushLocalState}
              onFieldChange={handleFieldChange}
              onOpen={handleOpen}
              onStatusChange={handleStatusChange}
            />
          </main>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto xl:pr-1">
            <ProfilePanel profile={profile} onChange={handleProfileChange} onCommit={flushLocalState} onCopy={handleCopy} />
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
              <a href={createSuggestDirectoryMailto()}>Suggest a directory</a>
              <a href={createGeneralIssueMailto()}>Report an issue</a>
              <a href={createContactMailto()}>Contact</a>
            </div>
          </div>
          <PrivacyTerms />
        </footer>
      </div>
    </div>
  );
}

export default App;

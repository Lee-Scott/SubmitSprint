import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { BackupControls } from './components/BackupControls';
import { DirectoryDetailDrawer } from './components/DirectoryDetailDrawer';
import { DirectoryTable } from './components/DirectoryTable';
import { Header } from './components/Header';
import { ProfilePanel } from './components/ProfilePanel';
import { PrivacyTerms } from './components/PrivacyTerms';
import { SmartViews } from './components/SmartViews';
import { SprintSessionPanel } from './components/SprintSessionPanel';
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
  getBackupRecommendation,
  getCompletionPercentage,
  getDirectoryProgress,
  getLastBackupLabel,
  getOrphanProgressRecords,
  isValidHttpUrl,
  pruneOrphanProgress,
  searchDirectories,
  sortDirectoriesByDr,
  type DirectoryWithProgress,
} from './lib/directory';
import { createContactMailto, createGeneralIssueMailto, createSuggestDirectoryMailto } from './lib/feedback';
import { validateDatasetPayload } from './lib/schemas';
import {
  completeSprintSession,
  createSprintSession,
  getCurrentSessionEntry,
  getSessionEntries,
  getSessionQueue,
  getSprintSessionSummary,
  isSprintSessionComplete,
  moveSession,
  moveSessionToNextActionable,
  sessionTerminalStatuses,
} from './lib/sessions';
import {
  copyText,
  loadBackupMeta,
  loadProfile,
  loadProgress,
  loadSettings,
  loadSprintSession,
  resetProgressState,
  saveBackupMeta,
  saveProfile,
  saveProgress,
  saveSettings,
  saveSprintSession,
  type BackupMeta,
  type SettingsState,
} from './lib/storage';
import type {
  DirectoryProgress,
  DirectoryRecord,
  DirectoryStatus,
  SprintSessionType,
  StartupProfile,
  SmartViewId,
  SubmissionSprintSession,
} from './types';

function App() {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const sessionPanelRef = useRef<HTMLDivElement | null>(null);
  const sessionActionLockRef = useRef(false);
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [datasetVersion, setDatasetVersion] = useState<string>();
  const [profile, setProfile] = useState<StartupProfile>(() => loadProfile());
  const [progressMap, setProgressMap] = useState<Record<string, DirectoryProgress>>(() => loadProgress());
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
  const [backupMeta, setBackupMeta] = useState<BackupMeta>(() => loadBackupMeta());
  const [sprintSession, setSprintSession] = useState<SubmissionSprintSession | undefined>(() => loadSprintSession());
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string>('Loading directories...');
  const [loadError, setLoadError] = useState<string>();
  const [copyState, setCopyState] = useState<string>('');
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string>();
  const [lastUndo, setLastUndo] = useState<{ directoryId: string; previous: DirectoryProgress; label: string }>();

  useEffect(() => {
    let active = true;

    async function loadDataset() {
      try {
        const response = await fetch('/data/master_directories.json');

        if (!response.ok) {
          throw new Error(`Failed to load directory dataset (${response.status})`);
        }

        const payloadResult = validateDatasetPayload(await response.json());

        if (!payloadResult.success) {
          throw new Error('Directory dataset is invalid');
        }

        const payload = payloadResult.data;

        if (!active) {
          return;
        }

        setRecords(payload.records);
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
    saveSprintSession(sprintSession);
  }, [sprintSession]);

  useEffect(() => {
    function flushBeforeExit() {
      saveProfile(profile);
      saveProgress(progressMap);
      saveSettings(settings);
      saveBackupMeta(backupMeta);
      saveSprintSession(sprintSession);
    }

    window.addEventListener('pagehide', flushBeforeExit);
    window.addEventListener('beforeunload', flushBeforeExit);
    return () => {
      window.removeEventListener('pagehide', flushBeforeExit);
      window.removeEventListener('beforeunload', flushBeforeExit);
    };
  }, [backupMeta, profile, progressMap, settings, sprintSession]);

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
  const orphanProgressRecords = useMemo(() => getOrphanProgressRecords(progressMap, records), [progressMap, records]);
  const selectedDirectoryEntry = useMemo(
    () => mergedDirectories.find(({ record }) => record.id === selectedDirectoryId),
    [mergedDirectories, selectedDirectoryId],
  );
  const sessionEntries = useMemo(
    () => (sprintSession ? getSessionEntries(sprintSession, mergedDirectories) : []),
    [mergedDirectories, sprintSession],
  );
  const sessionCurrentEntry = useMemo(
    () => (sprintSession ? getCurrentSessionEntry(sprintSession, mergedDirectories) : undefined),
    [mergedDirectories, sprintSession],
  );
  const sessionSummary = useMemo(
    () => (sprintSession ? getSprintSessionSummary(sessionEntries) : undefined),
    [sessionEntries, sprintSession],
  );
  const sessionQueueCounts = useMemo(() => ({
    fast_25: getSessionQueue('fast_25', mergedDirectories, settings.activeView, directories).length,
    elite_50: getSessionQueue('elite_50', mergedDirectories, settings.activeView, directories).length,
    start_here: getSessionQueue('start_here', mergedDirectories, settings.activeView, directories).length,
    continue_unfinished: getSessionQueue('continue_unfinished', mergedDirectories, settings.activeView, directories).length,
    current_smart_view: directories.length,
  }), [directories, mergedDirectories, settings.activeView]);

  useEffect(() => {
    if (sprintSession?.state !== 'active' || !isSprintSessionComplete(sessionEntries)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSprintSession((current) => {
        if (!current || current.state !== 'active') {
          return current;
        }

        return completeSprintSession(current);
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [sessionEntries, sprintSession?.state]);

  function focusWorkspace() {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => workspaceRef.current?.focus(), 150);
  }

  function focusSessionPanel() {
    sessionPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => sessionPanelRef.current?.focus(), 150);
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
    setSprintSession(undefined);
    if (selectedDirectoryId && !records.some((record) => record.id === selectedDirectoryId)) {
      setSelectedDirectoryId(undefined);
    }
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
    setSprintSession(undefined);
    setSelectedDirectoryId(undefined);
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

  function handleStartSession(type: SprintSessionType) {
    const queue = getSessionQueue(type, mergedDirectories, settings.activeView, directories);
    const session = createSprintSession(type, queue);
    setSprintSession(session);

    if (type === 'fast_25' || type === 'elite_50' || type === 'start_here') {
      setSettings((current) => ({ ...current, activeView: type }));
    }

    sessionActionLockRef.current = false;
    focusWorkspace();
    window.setTimeout(() => focusSessionPanel(), 180);
  }

  function handleStartFast25() {
    handleStartSession('fast_25');
  }

  function handleEndSession() {
    setSprintSession((current) => {
      if (!current) {
        return undefined;
      }

      return current.state === 'active' ? completeSprintSession(current) : undefined;
    });
    sessionActionLockRef.current = false;
    focusWorkspace();
  }

  function runSessionAction(action: () => void) {
    if (sessionActionLockRef.current) {
      return;
    }

    sessionActionLockRef.current = true;
    action();
    window.setTimeout(() => {
      sessionActionLockRef.current = false;
    }, 160);
  }

  function handleSessionNext() {
    runSessionAction(() => setSprintSession((current) => (current ? moveSession(current, 1) : current)));
  }

  function handleSessionPrevious() {
    runSessionAction(() => setSprintSession((current) => (current ? moveSession(current, -1) : current)));
  }

  function handleSessionFieldChange(field: 'liveUrl' | 'notes', value: string) {
    if (!sessionCurrentEntry) {
      return;
    }

    handleFieldChange(sessionCurrentEntry.record.id, field, value);
  }

  function handleSessionOpen() {
    if (!sessionCurrentEntry) {
      return;
    }

    handleOpen(sessionCurrentEntry.record);
  }

  function handleSessionStatusChange(status: DirectoryStatus) {
    if (!sessionCurrentEntry) {
      return;
    }

    runSessionAction(() => {
      const currentId = sessionCurrentEntry.record.id;
      handleStatusChange(currentId, status);

      if (!sessionTerminalStatuses.has(status)) {
        return;
      }

      const predictedEntries = sessionEntries.map((entry) => ({
        ...entry,
        progress: entry.record.id === currentId ? { ...entry.progress, status } : entry.progress,
      }));

      setSprintSession((current) => {
        if (!current) {
          return current;
        }

        if (isSprintSessionComplete(predictedEntries)) {
          return completeSprintSession(current);
        }

        return moveSessionToNextActionable(current, predictedEntries, currentId);
      });
    });
  }

  function handleSessionClearFollowUp() {
    if (!sessionCurrentEntry) {
      return;
    }

    handleClearFollowUp(sessionCurrentEntry.record.id);
  }

  function handleSessionUpdateNotes(value: string) {
    setSprintSession((current) => current ? { ...current, sessionNotes: value } : current);
  }

  function handleSessionOpenDetails() {
    if (sessionCurrentEntry) {
      setSelectedDirectoryId(sessionCurrentEntry.record.id);
    }
  }

  const handleSessionKeyDown = useEffectEvent((event: KeyboardEvent) => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (selectedDirectoryId) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'escape') {
      event.preventDefault();
      handleEndSession();
      return;
    }

    if (!sessionCurrentEntry || sprintSession?.state !== 'active') {
      return;
    }

    if (key === 'enter' || key === 'o') {
      event.preventDefault();
      handleSessionOpen();
    } else if (key === 's') {
      event.preventDefault();
      handleSessionStatusChange('submitted');
    } else if (key === 'k' || key === 'x') {
      event.preventDefault();
      handleSessionStatusChange('skipped');
    } else if (key === 'n') {
      event.preventDefault();
      handleSessionNext();
    }
  });

  useEffect(() => {
    if (sprintSession?.state !== 'active') {
      return;
    }

    function listener(event: KeyboardEvent) {
      handleSessionKeyDown(event);
    }

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [sprintSession?.state]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(247,196,103,0.16),_transparent_28%),linear-gradient(180deg,_#f8f4ec_0%,_#f4efe6_42%,_#efe7da_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-[1580px] flex-col px-3 py-3 sm:px-5 sm:py-4">
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

        <div className="mt-3 grid flex-1 gap-3 xl:grid-cols-[210px_minmax(0,1fr)_330px]">
          <SmartViews
            activeView={settings.activeView}
            counts={smartViewCounts}
            onChange={(activeView: SmartViewId) => setSettings({ activeView })}
          />

          <main
            ref={workspaceRef}
            className="flex min-h-[68vh] flex-col rounded-3xl border border-stone-200 bg-white/90 p-3 shadow-[0_18px_48px_rgba(82,53,20,0.07)] backdrop-blur focus:outline-none sm:p-4"
            tabIndex={-1}
          >
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-[1.45rem] tracking-tight text-stone-900 sm:text-2xl">Directory sprint board</h2>
                <p className="text-sm text-stone-600">Open, submit, publish, and follow up without leaving the board.</p>
              </div>

              <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Search</span>
                <input
                  className="w-full min-w-0 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm outline-none transition focus:border-amber-400 sm:w-72"
                  placeholder="Name, domain, category"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
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

            <div ref={sessionPanelRef} tabIndex={-1} className="focus:outline-none">
              <SprintSessionPanel
                currentEntry={sessionCurrentEntry}
                queueCounts={sessionQueueCounts}
                session={sprintSession}
                summary={sessionSummary}
                onClearFollowUp={handleSessionClearFollowUp}
                onEnd={handleEndSession}
                onExport={handleExport}
                onFieldChange={handleSessionFieldChange}
                onFieldCommit={flushLocalState}
                onNext={handleSessionNext}
                onOpen={handleSessionOpen}
                onOpenDetails={handleSessionOpenDetails}
                onPrevious={handleSessionPrevious}
                onStart={handleStartSession}
                onStatusChange={handleSessionStatusChange}
                onUpdateNotes={handleSessionUpdateNotes}
              />
            </div>

            <DirectoryTable
              directories={directories}
              onClearFollowUp={handleClearFollowUp}
              onFieldCommit={flushLocalState}
              onFieldChange={handleFieldChange}
              onOpen={handleOpen}
              onSelectDirectory={setSelectedDirectoryId}
              onStatusChange={handleStatusChange}
            />
          </main>

          <aside className="space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto xl:pr-1">
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

        <footer className="mt-3 rounded-3xl border border-stone-200 bg-white/88 px-4 py-4 text-sm text-stone-600 shadow-[0_18px_45px_rgba(82,53,20,0.05)]">
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

      <DirectoryDetailDrawer
        entry={selectedDirectoryEntry}
        profile={profile}
        onClearFollowUp={handleClearFollowUp}
        onClose={() => setSelectedDirectoryId(undefined)}
        onCopy={handleCopy}
        onFieldChange={handleFieldChange}
        onFieldCommit={flushLocalState}
        onOpen={handleOpen}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

export default App;

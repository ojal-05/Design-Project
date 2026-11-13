import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Cpu,
  Flame,
  History,
  LogOut,
  MapPin,
  Menu,
  Package,
  Play,
  Shield,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { AchievementsView } from './components/AchievementsView';
import { CommandCentreHubView } from './components/CommandCentreHubView';
import { LandingScreen } from './components/LandingScreen';
import { LoadoutView } from './components/LoadoutView';
import { MissionMapView } from './components/MissionMapView';
import { MissionRecordsView } from './components/MissionRecordsView';
import { ResponderHomeBaseView } from './components/ResponderHomeBaseView';
import { SimulationCentreView } from './components/SimulationCentreView';
import { SkillTreeView } from './components/SkillTreeView';
import { TrainingChallengesView } from './components/TrainingChallengesView';
import { computePlayerProgression } from './engine/progressionEngine';
import {
  getSavedActiveUserId,
  initializePlatformStorage,
  resetDemoRecordsPreservingUserRecords,
  saveDrills,
  saveNotes,
  saveSettings,
  saveUsers,
  setSavedActiveUserId,
  upsertScenarioWithApi,
  upsertSessionWithApi,
} from './services/storageService';
import type {
  DrillAttemptRecord,
  InstructorNote,
  NavSection,
  PlatformSettings,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from './types/simulation';

const COMMAND_SUBSECTIONS: NavSection[] = [
  'command-centre',
  'scenario-library',
  'scenario-studio',
  'emergency-intelligence',
  'performance-analytics',
  'session-replay',
  'trainee-management',
  'reports',
  'settings',
];

export default function App() {
  const initialStore = useMemo(() => initializePlatformStorage(), []);

  const [users, setUsers] = useState<UserAccount[]>(initialStore.users);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>(
    initialStore.scenarios
  );
  const [sessions, setSessions] = useState<TrainingSession[]>(
    initialStore.sessions
  );
  const [notes, setNotes] = useState<InstructorNote[]>(initialStore.notes);
  const [settings, setSettings] = useState<PlatformSettings>(
    initialStore.settings
  );
  const [drills, setDrills] = useState<DrillAttemptRecord[]>(
    initialStore.drills
  );

  const [activeUserId, setActiveUserId] = useState<string | null>(() =>
    getSavedActiveUserId()
  );
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    initialStore.scenarios[0]?.id || 'scen_cardiac_01'
  );
  const [studioScenarioId, setStudioScenarioId] = useState<string | null>(
    initialStore.scenarios[0]?.id || null
  );
  const [replaySessionId, setReplaySessionId] = useState<string | null>(
    initialStore.sessions[0]?.id || null
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [immersiveSimActive, setImmersiveSimActive] = useState(false);
  const [instructorPreviewHomeBase, setInstructorPreviewHomeBase] =
    useState(false);

  const currentUser = useMemo(
    () => users.find((u) => u.id === activeUserId) || null,
    [users, activeUserId]
  );

  useEffect(() => {
    setSavedActiveUserId(activeUserId);
    setInstructorPreviewHomeBase(false);
  }, [activeUserId]);

  const gameNavItems = useMemo(
    () => [
      { id: 'overview' as NavSection, label: 'Home Base', icon: Shield },
      { id: 'missions' as NavSection, label: 'Missions', icon: MapPin },
      { id: 'training' as NavSection, label: 'Training', icon: Target },
      { id: 'loadout' as NavSection, label: 'Loadout', icon: Package },
      { id: 'skill-tree' as NavSection, label: 'Skill Tree', icon: Zap },
      { id: 'achievements' as NavSection, label: 'Achievements', icon: Award },
      {
        id: 'mission-records' as NavSection,
        label: 'Mission Records',
        icon: History,
      },
      {
        id: 'command-centre' as NavSection,
        label: 'Command Centre',
        icon: Cpu,
      },
    ],
    []
  );

  const playerProgression = useMemo(() => {
    if (!currentUser) return null;
    return computePlayerProgression(currentUser, sessions, scenarios, drills);
  }, [currentUser, sessions, scenarios, drills]);

  const handleEnterWithUser = (user: UserAccount) => {
    setActiveUserId(user.id);
    setActiveNav(user.role === 'trainee' ? 'overview' : 'command-centre');
  };

  const handleCreateTraineeAndEnter = (name: string, cohort: string) => {
    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@iri-training.edu`,
      role: 'trainee',
      cohort,
      department: 'Emergency Response Training',
      assignedScenarioIds: ['scen_cardiac_01', 'scen_triage_01'],
      active: true,
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
    const nextUsers = [newUser, ...users];
    setUsers(nextUsers);
    saveUsers(nextUsers);
    setActiveUserId(newUser.id);
    setActiveNav('overview');
  };

  const handleLaunchScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setActiveNav('simulation-centre');
    setMobileMenuOpen(false);
  };

  const handleNavigate = (section: NavSection, maybeSessionId?: string) => {
    if (maybeSessionId) {
      setReplaySessionId(maybeSessionId);
    }
    if (section !== 'simulation-centre') {
      setImmersiveSimActive(false);
    }
    setActiveNav(section);
    setMobileMenuOpen(false);
  };

  const handleSaveSession = (session: TrainingSession) => {
    setSessions((prev) => upsertSessionWithApi(prev, session));
    setReplaySessionId(session.id);
  };

  const handleSaveScenario = (scenario: ScenarioDefinition) => {
    setScenarios((prev) => upsertScenarioWithApi(prev, scenario));
    setStudioScenarioId(scenario.id);
  };

  const handleRecordDrill = (drill: DrillAttemptRecord) => {
    setDrills((prev) => {
      const next = [drill, ...prev];
      saveDrills(next);
      return next;
    });
  };

  const handleAddUser = (user: UserAccount) => {
    const next = [user, ...users];
    setUsers(next);
    saveUsers(next);
  };

  const handleUpdateUser = (updated: UserAccount) => {
    const next = users.map((u) => (u.id === updated.id ? updated : u));
    setUsers(next);
    saveUsers(next);
  };

  const handleAddNote = (note: InstructorNote) => {
    const next = [note, ...notes];
    setNotes(next);
    saveNotes(next);
  };

  const handleUpdateSettings = (nextSettings: PlatformSettings) => {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  const handleResetDemoData = () => {
    const restored = resetDemoRecordsPreservingUserRecords();
    setUsers(restored.users);
    setScenarios(restored.scenarios);
    setSessions(restored.sessions);
    setNotes(restored.notes);
    setDrills(restored.drills);
  };

  if (!currentUser) {
    return (
      <LandingScreen
        users={users}
        onEnterWithUser={handleEnterWithUser}
        onCreateTraineeAndEnter={handleCreateTraineeAndEnter}
      />
    );
  }

  const isCommandSubRoute = COMMAND_SUBSECTIONS.includes(activeNav);
  const highlightedNavId: NavSection = isCommandSubRoute
    ? 'command-centre'
    : activeNav === 'simulation-centre'
    ? 'missions'
    : activeNav;

  const currentNavMeta =
    gameNavItems.find((n) => n.id === highlightedNavId) || gameNavItems[0];

  const hideShellChrome =
    activeNav === 'simulation-centre' && immersiveSimActive;

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex">
      {/* Interactive Game Navigation Rail (Auto-hidden during active 3D gameplay) */}
      {!hideShellChrome && (
        <aside className="hidden lg:flex lg:flex-col w-60 bg-[#0B1220] border-r border-slate-800/90 shrink-0">
          <div className="h-16 px-4 flex items-center gap-2.5 border-b border-slate-800/90">
            <Activity className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold tracking-tight text-slate-100 truncate">
                IMMERSIVE RESPONSE
              </div>
              <div className="text-[10px] font-mono text-cyan-400 truncate">
                {playerProgression
                  ? `${playerProgression.responderProfile.callsign} · LVL ${playerProgression.level}`
                  : 'COMMAND CONSOLE'}
              </div>
            </div>
          </div>

          {/* Responder XP Bar Mini Widget */}
          {playerProgression && (
            <div className="px-4 py-3 border-b border-slate-800/80 bg-[#080E1A] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <span className="text-slate-200 font-semibold">
                  LVL {playerProgression.level}
                </span>
                <span className="text-cyan-300">
                  {playerProgression.totalXp} XP
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#070B14] overflow-hidden">
                <div
                  className="h-full bg-cyan-400 origin-left transition-transform duration-200"
                  style={{
                    transform: `scaleX(${Math.max(
                      0.05,
                      playerProgression.levelProgressPct / 100
                    )})`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Flame className="w-3 h-3" />
                  {playerProgression.activeDayStreak}d
                </span>
                <span>{playerProgression.rankTitle}</span>
              </div>
            </div>
          )}

          {/* 8 Game Sections */}
          <nav
            className="flex-1 p-3 space-y-1 overflow-y-auto"
            aria-label="Game Navigation"
          >
            {gameNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = highlightedNavId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/18 text-cyan-200 border border-cyan-400/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/55 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-cyan-400' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Compact Operator Role Switcher & Exit */}
          <div className="p-3 border-t border-slate-800/90 space-y-2 bg-[#080E1A]">
            <select
              id="sidebar-user-switcher"
              aria-label="Switch Operator"
              value={currentUser.id}
              onChange={(e) => setActiveUserId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-200 truncate"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setActiveUserId(null)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Title Screen
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Game Navigation Drawer */}
      {mobileMenuOpen && !hideShellChrome && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-68 max-w-[85vw] bg-[#0B1220] border-r border-slate-800 flex flex-col z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-bold text-slate-100">
                IMMERSIVE RESPONSE
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {gameNavItems.map((item) => {
                const Icon = item.icon;
                const active = highlightedNavId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                      active
                        ? 'bg-cyan-500/18 text-cyan-200 border border-cyan-400/60'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Game Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {!hideShellChrome && (
          <header className="h-16 px-5 lg:px-8 bg-[#0B1220] border-b border-slate-800/90 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
                <span className="font-bold text-slate-100 truncate">
                  {activeNav === 'simulation-centre'
                    ? 'Active Mission'
                    : currentNavMeta.label}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-400 truncate">
                  {currentUser.name}
                </span>
                {playerProgression && (
                  <>
                    <span className="text-slate-600 hidden md:inline">·</span>
                    <span className="text-xs font-mono text-cyan-300 hidden md:inline">
                      LVL {playerProgression.level} ({playerProgression.totalXp}{' '}
                      XP)
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {activeNav === 'overview' && currentUser.role !== 'trainee' && (
                <button
                  type="button"
                  onClick={() =>
                    setInstructorPreviewHomeBase((prev) => !prev)
                  }
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap"
                >
                  {instructorPreviewHomeBase
                    ? 'Command Overview'
                    : 'Responder Home Base'}
                </button>
              )}

              {activeNav !== 'simulation-centre' && (
                <button
                  type="button"
                  onClick={() => handleNavigate('simulation-centre')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Enter Mission
                </button>
              )}
            </div>
          </header>
        )}

        {/* Active View Router */}
        <main className="flex-1 overflow-y-auto">
          {activeNav === 'overview' &&
            (currentUser.role === 'trainee' || instructorPreviewHomeBase ? (
              <ResponderHomeBaseView
                currentUser={currentUser}
                scenarios={scenarios}
                sessions={sessions}
                drills={drills}
                settings={settings}
                onLaunchScenario={handleLaunchScenario}
                onNavigate={handleNavigate}
                onUpdateUser={handleUpdateUser}
              />
            ) : (
              <CommandCentreHubView
                initialSection="command-centre"
                currentUser={currentUser}
                users={users}
                scenarios={scenarios}
                sessions={sessions}
                notes={notes}
                settings={settings}
                studioScenarioId={studioScenarioId}
                replaySessionId={replaySessionId}
                onSelectStudioScenarioId={setStudioScenarioId}
                onSelectReplaySessionId={setReplaySessionId}
                onLaunchScenario={handleLaunchScenario}
                onSaveScenario={handleSaveScenario}
                onSaveSession={handleSaveSession}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onAddNote={handleAddNote}
                onUpdateSettings={handleUpdateSettings}
                onResetDemoData={handleResetDemoData}
                onNavigate={handleNavigate}
              />
            ))}

          {activeNav === 'missions' && (
            <MissionMapView
              scenarios={scenarios}
              sessions={sessions}
              drills={drills}
              currentUser={currentUser}
              onLaunchScenario={handleLaunchScenario}
              onEditScenarioInStudio={(scenId) => {
                setStudioScenarioId(scenId);
                setActiveNav('scenario-studio');
              }}
              onNavigate={handleNavigate}
            />
          )}

          {activeNav === 'training' && (
            <TrainingChallengesView
              currentUser={currentUser}
              scenarios={scenarios}
              drills={drills}
              settings={settings}
              onRecordDrill={handleRecordDrill}
              onNavigate={handleNavigate}
            />
          )}

          {activeNav === 'loadout' && (
            <LoadoutView
              currentUser={currentUser}
              scenarios={scenarios}
              sessions={sessions}
              drills={drills}
              settings={settings}
              onUpdateUser={handleUpdateUser}
              onLaunchScenario={handleLaunchScenario}
              onNavigate={handleNavigate}
            />
          )}

          {activeNav === 'skill-tree' && (
            <SkillTreeView
              currentUser={currentUser}
              scenarios={scenarios}
              sessions={sessions}
              drills={drills}
              onNavigate={handleNavigate}
              onLaunchScenario={handleLaunchScenario}
            />
          )}

          {activeNav === 'achievements' && (
            <AchievementsView
              currentUser={currentUser}
              users={users}
              scenarios={scenarios}
              sessions={sessions}
              drills={drills}
              onNavigate={handleNavigate}
            />
          )}

          {activeNav === 'mission-records' && (
            <MissionRecordsView
              currentUser={currentUser}
              users={users}
              scenarios={scenarios}
              sessions={sessions}
              settings={settings}
              replaySessionId={replaySessionId}
              onSelectReplaySessionId={setReplaySessionId}
              onSaveSession={handleSaveSession}
              onLaunchScenario={handleLaunchScenario}
              onNavigate={handleNavigate}
            />
          )}

          {isCommandSubRoute && (
            <CommandCentreHubView
              initialSection={activeNav}
              currentUser={currentUser}
              users={users}
              scenarios={scenarios}
              sessions={sessions}
              notes={notes}
              settings={settings}
              studioScenarioId={studioScenarioId}
              replaySessionId={replaySessionId}
              onSelectStudioScenarioId={setStudioScenarioId}
              onSelectReplaySessionId={setReplaySessionId}
              onLaunchScenario={handleLaunchScenario}
              onSaveScenario={handleSaveScenario}
              onSaveSession={handleSaveSession}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onAddNote={handleAddNote}
              onUpdateSettings={handleUpdateSettings}
              onResetDemoData={handleResetDemoData}
              onNavigate={handleNavigate}
            />
          )}

          {activeNav === 'simulation-centre' && (
            <SimulationCentreView
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              currentUser={currentUser}
              existingSessions={sessions}
              drills={drills}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onSelectScenarioId={setActiveScenarioId}
              onSaveSession={handleSaveSession}
              onNavigate={handleNavigate}
              onImmersiveModeChange={setImmersiveSimActive}
            />
          )}
        </main>
      </div>
    </div>
  );
}

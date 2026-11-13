import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Cpu,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Sliders,
  Users,
} from 'lucide-react';
import type {
  InstructorNote,
  NavSection,
  PlatformSettings,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';
import { EmergencyIntelligenceView } from './EmergencyIntelligenceView';
import { OverviewView } from './OverviewView';
import { PerformanceAnalyticsView } from './PerformanceAnalyticsView';
import { ReportsView } from './ReportsView';
import { ScenarioLibraryView } from './ScenarioLibraryView';
import { ScenarioStudioView } from './ScenarioStudioView';
import { SessionReplayView } from './SessionReplayView';
import { SettingsView } from './SettingsView';
import { TraineeManagementView } from './TraineeManagementView';

type CommandTabId =
  | 'command-overview'
  | 'scenario-studio'
  | 'scenario-library'
  | 'emergency-intelligence'
  | 'performance-analytics'
  | 'session-replay'
  | 'trainee-management'
  | 'reports'
  | 'settings';

interface CommandCentreHubViewProps {
  initialSection?: NavSection;
  currentUser: UserAccount;
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  notes: InstructorNote[];
  settings: PlatformSettings;
  studioScenarioId: string | null;
  replaySessionId: string | null;
  onSelectStudioScenarioId: (id: string | null) => void;
  onSelectReplaySessionId: (id: string | null) => void;
  onLaunchScenario: (scenarioId: string) => void;
  onSaveScenario: (scenario: ScenarioDefinition) => void;
  onSaveSession: (session: TrainingSession) => void;
  onAddUser: (user: UserAccount) => void;
  onUpdateUser: (user: UserAccount) => void;
  onAddNote: (note: InstructorNote) => void;
  onUpdateSettings: (settings: PlatformSettings) => void;
  onResetDemoData: () => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
}

const COMMAND_TABS: Array<{
  id: CommandTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'command-overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'scenario-studio', label: 'Design Studio', icon: Sliders },
  { id: 'scenario-library', label: 'Scenario Library', icon: BookOpen },
  { id: 'emergency-intelligence', label: 'Intelligence', icon: Cpu },
  { id: 'performance-analytics', label: 'Cohort Analytics', icon: BarChart3 },
  { id: 'session-replay', label: 'Session Replay', icon: History },
  { id: 'trainee-management', label: 'Roster & Notes', icon: Users },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function resolveInitialTab(section?: NavSection): CommandTabId {
  switch (section) {
    case 'scenario-studio':
    case 'scenario-library':
    case 'emergency-intelligence':
    case 'performance-analytics':
    case 'session-replay':
    case 'trainee-management':
    case 'reports':
    case 'settings':
      return section;
    default:
      return 'command-overview';
  }
}

export const CommandCentreHubView: React.FC<CommandCentreHubViewProps> = ({
  initialSection,
  currentUser,
  users,
  scenarios,
  sessions,
  notes,
  settings,
  studioScenarioId,
  replaySessionId,
  onSelectStudioScenarioId,
  onSelectReplaySessionId,
  onLaunchScenario,
  onSaveScenario,
  onSaveSession,
  onAddUser,
  onUpdateUser,
  onAddNote,
  onUpdateSettings,
  onResetDemoData,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<CommandTabId>(() =>
    resolveInitialTab(initialSection)
  );

  useEffect(() => {
    setActiveTab(resolveInitialTab(initialSection));
  }, [initialSection]);

  const handleInternalNavigate = (section: NavSection, sessionId?: string) => {
    if (sessionId) {
      onSelectReplaySessionId(sessionId);
    }
    if (
      section === 'scenario-studio' ||
      section === 'scenario-library' ||
      section === 'emergency-intelligence' ||
      section === 'performance-analytics' ||
      section === 'session-replay' ||
      section === 'trainee-management' ||
      section === 'reports' ||
      section === 'settings'
    ) {
      setActiveTab(section);
      return;
    }
    onNavigate(section, sessionId);
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Sleek Horizontal Instructor & Admin Command Bar */}
      <div className="bg-[#090F1C] border-b border-slate-800/90 px-5 lg:px-8 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {COMMAND_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preserved Instructor / Admin / Analytics Views */}
      <div className="flex-1">
        {activeTab === 'command-overview' && (
          <OverviewView
            currentUser={currentUser}
            users={users}
            scenarios={scenarios}
            sessions={sessions}
            settings={settings}
            onLaunchScenario={onLaunchScenario}
            onNavigate={handleInternalNavigate}
          />
        )}

        {activeTab === 'scenario-studio' && (
          <ScenarioStudioView
            scenarios={scenarios}
            selectedScenarioId={studioScenarioId}
            users={users}
            currentUser={currentUser}
            onSaveScenario={onSaveScenario}
            onPreviewIn3D={onLaunchScenario}
          />
        )}

        {activeTab === 'scenario-library' && (
          <ScenarioLibraryView
            scenarios={scenarios}
            currentUser={currentUser}
            onLaunchScenario={onLaunchScenario}
            onEditScenarioInStudio={(scenId) => {
              onSelectStudioScenarioId(scenId);
              setActiveTab('scenario-studio');
            }}
            onNavigate={handleInternalNavigate}
          />
        )}

        {activeTab === 'emergency-intelligence' && (
          <EmergencyIntelligenceView
            scenarios={scenarios}
            sessions={sessions}
            onLaunchScenario={onLaunchScenario}
          />
        )}

        {activeTab === 'performance-analytics' && (
          <PerformanceAnalyticsView
            sessions={sessions}
            scenarios={scenarios}
            users={users}
            includeDemoDefault={settings.showDemoDataInAnalytics}
            onNavigateReplay={handleInternalNavigate}
          />
        )}

        {activeTab === 'session-replay' && (
          <SessionReplayView
            sessions={sessions}
            scenarios={scenarios}
            selectedSessionId={replaySessionId}
            currentUser={currentUser}
            onSelectSessionId={onSelectReplaySessionId}
            onUpdateSession={onSaveSession}
          />
        )}

        {activeTab === 'trainee-management' && (
          <TraineeManagementView
            users={users}
            scenarios={scenarios}
            sessions={sessions}
            notes={notes}
            currentUser={currentUser}
            onAddUser={onAddUser}
            onUpdateUser={onUpdateUser}
            onAddNote={onAddNote}
            onNavigate={handleInternalNavigate}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            sessions={sessions}
            scenarios={scenarios}
            users={users}
            institutionName={settings.institutionName}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            currentUser={currentUser}
            users={users}
            scenarios={scenarios}
            sessions={sessions}
            onUpdateSettings={onUpdateSettings}
            onResetDemoData={onResetDemoData}
          />
        )}
      </div>
    </div>
  );
};

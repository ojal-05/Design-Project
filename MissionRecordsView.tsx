import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  History,
  Play,
  RotateCcw,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import { calculateSessionXp } from '../engine/progressionEngine';
import type {
  NavSection,
  PlatformSettings,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';
import { getScenarioVisual } from '../utils/scenarioVisuals';
import { PerformanceAnalyticsView } from './PerformanceAnalyticsView';
import { SessionReplayView } from './SessionReplayView';

interface MissionRecordsViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  settings: PlatformSettings;
  replaySessionId: string | null;
  onSelectReplaySessionId: (id: string | null) => void;
  onSaveSession: (session: TrainingSession) => void;
  onLaunchScenario: (scenarioId: string) => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
}

export const MissionRecordsView: React.FC<MissionRecordsViewProps> = ({
  currentUser,
  users,
  scenarios,
  sessions,
  settings,
  replaySessionId,
  onSelectReplaySessionId,
  onSaveSession,
  onLaunchScenario,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'replay' | 'charts'>(
    'log'
  );
  const [scopeMineOnly, setScopeMineOnly] = useState(
    currentUser.role === 'trainee'
  );

  const visibleSessions = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed');
    const filtered = scopeMineOnly
      ? completed.filter((s) => s.traineeId === currentUser.id)
      : completed;
    return filtered.sort(
      (a, b) =>
        new Date(b.completedAt || b.startedAt).getTime() -
        new Date(a.completedAt || a.startedAt).getTime()
    );
  }, [sessions, scopeMineOnly, currentUser.id]);

  return (
    <div className="space-y-4">
      {/* Compact Game Sub-Header Bar */}
      <div className="px-5 lg:px-8 pt-5 max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            VERIFIED MISSION TELEMETRY &amp; REPLAY ARCHIVE
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Mission Records
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'log' && (
            <button
              type="button"
              onClick={() => setScopeMineOnly((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg bg-[#0B1220] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
            >
              {scopeMineOnly ? 'Showing: My Runs' : 'Showing: All Operators'}
            </button>
          )}

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B1220] border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('log')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'log'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Mission Log
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('replay')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'replay'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Timeline Replay
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('charts')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'charts'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Telemetry Charts
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: VISUAL MISSION LOG CARDS */}
      {activeTab === 'log' && (
        <div className="px-5 lg:px-8 pb-8 max-w-[1400px] mx-auto">
          {visibleSessions.length === 0 ? (
            <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-10 text-center space-y-3">
              <Activity className="w-8 h-8 text-cyan-400 mx-auto" />
              <div className="text-base font-bold text-slate-100">
                No Completed Missions Recorded Yet
              </div>
              <button
                type="button"
                onClick={() => onNavigate('missions')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Open Mission Map
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleSessions.map((sess) => {
                const scen = scenarios.find((s) => s.id === sess.scenarioId);
                const xp = calculateSessionXp(sess);
                const crits = sess.assessment?.criticalErrorsCount ?? 0;

                return (
                  <div
                    key={sess.id}
                    className="rounded-xl bg-[#0B1220] border border-slate-800 hover:border-slate-700 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-28 bg-slate-900 overflow-hidden">
                        <img
                          src={getScenarioVisual(scen || sess.scenarioMode)}
                          alt={sess.scenarioTitle}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-75"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-black/40 to-transparent" />
                        <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-200">
                            {sess.scenarioCode} · #{sess.attemptNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border font-bold ${
                              crits > 0
                                ? 'bg-red-950/90 border-red-500 text-red-200'
                                : xp.rating === 'S' || xp.rating === 'A'
                                ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
                                : 'bg-slate-900/90 border-slate-700 text-slate-200'
                            }`}
                          >
                            {xp.rating === 'CRITICAL_REVIEW'
                              ? 'CRITICAL REVIEW'
                              : `RANK ${xp.rating}`}
                          </span>
                        </div>
                        <div className="absolute bottom-2 left-3 right-3">
                          <div className="text-sm font-bold text-white truncate">
                            {sess.scenarioTitle}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="truncate">{sess.traineeName}</span>
                          <span className="font-mono tabular-nums inline-flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {sess.durationSec}s
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-center">
                          <div className="p-2 rounded-lg bg-[#070B14] border border-slate-800">
                            <div className="text-[10px] font-sans text-slate-400">
                              Score
                            </div>
                            <div className="text-sm font-bold text-white">
                              {sess.assessment?.overallScore ?? 0}/100
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-[#070B14] border border-slate-800">
                            <div className="text-[10px] font-sans text-slate-400">
                              XP
                            </div>
                            <div className="text-sm font-bold text-cyan-300">
                              +{xp.totalXp}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-[#070B14] border border-slate-800">
                            <div className="text-[10px] font-sans text-slate-400">
                              Criticals
                            </div>
                            <div
                              className={`text-sm font-bold ${
                                crits > 0 ? 'text-red-400' : 'text-emerald-400'
                              }`}
                            >
                              {crits}
                            </div>
                          </div>
                        </div>

                        {crits > 0 ? (
                          <div className="text-[11px] text-red-300 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="truncate">
                              {sess.assessment?.criticalErrors[0] ||
                                'Critical safety error logged'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Zero critical safety errors</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectReplaySessionId(sess.id);
                          setActiveTab('replay');
                        }}
                        className="py-2 px-3 rounded-lg bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <History className="w-3.5 h-3.5" />
                        Inspect Replay
                      </button>
                      <button
                        type="button"
                        onClick={() => onLaunchScenario(sess.scenarioId)}
                        className="py-2 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-400 hover:text-slate-950 border border-cyan-500/50 text-xs font-semibold text-cyan-200 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry Mission
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TIMELINE REPLAY */}
      {activeTab === 'replay' && (
        <SessionReplayView
          sessions={sessions}
          scenarios={scenarios}
          selectedSessionId={replaySessionId}
          currentUser={currentUser}
          onSelectSessionId={onSelectReplaySessionId}
          onUpdateSession={onSaveSession}
        />
      )}

      {/* TAB 3: PERFORMANCE ANALYTICS CHARTS */}
      {activeTab === 'charts' && (
        <PerformanceAnalyticsView
          sessions={sessions}
          scenarios={scenarios}
          users={users}
          includeDemoDefault={settings.showDemoDataInAnalytics}
          onNavigateReplay={(section, sessionId) => {
            if (sessionId) {
              onSelectReplaySessionId(sessionId);
              setActiveTab('replay');
            } else {
              onNavigate(section, sessionId);
            }
          }}
        />
      )}
    </div>
  );
};

import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  Layers,
  Play,
  ShieldAlert,
  Sliders,
  Users,
} from 'lucide-react';
import {
  NavSection,
  PlatformSettings,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

interface OverviewViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  settings: PlatformSettings;
  onLaunchScenario: (scenarioId: string) => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentUser,
  users,
  scenarios,
  sessions,
  settings,
  onLaunchScenario,
  onNavigate,
}) => {
  const visibleSessions = useMemo(() => {
    const base = settings.showDemoDataInAnalytics
      ? sessions
      : sessions.filter((s) => !s.isDemo);
    if (currentUser.role === 'trainee') {
      return base.filter((s) => s.traineeId === currentUser.id);
    }
    return base;
  }, [sessions, settings.showDemoDataInAnalytics, currentUser]);

  const completedSessions = useMemo(
    () => visibleSessions.filter((s) => s.status === 'completed' && s.assessment),
    [visibleSessions]
  );

  const metrics = useMemo(() => {
    if (completedSessions.length === 0) {
      return {
        avgScore: 0,
        avgProcedural: 0,
        avgResponseSec: 0,
        totalCriticalErrors: 0,
      };
    }
    const count = completedSessions.length;
    const avgScore = Math.round(
      completedSessions.reduce((acc, s) => acc + (s.assessment?.overallScore || 0), 0) /
        count
    );
    const avgProcedural = Math.round(
      completedSessions.reduce(
        (acc, s) => acc + (s.assessment?.proceduralAccuracy || 0),
        0
      ) / count
    );
    const avgResponseSec = Number(
      (
        completedSessions.reduce(
          (acc, s) => acc + (s.assessment?.avgResponseTimeSec || 0),
          0
        ) / count
      ).toFixed(1)
    );
    const totalCriticalErrors = completedSessions.reduce(
      (acc, s) => acc + (s.assessment?.criticalErrorsCount || 0),
      0
    );
    return { avgScore, avgProcedural, avgResponseSec, totalCriticalErrors };
  }, [completedSessions]);

  const activeScenarios = useMemo(
    () => scenarios.filter((s) => !s.archived),
    [scenarios]
  );

  const traineeCount = useMemo(
    () => users.filter((u) => u.role === 'trainee').length,
    [users]
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-8">
      {/* Command Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-slate-800/90">
        <div className="space-y-1.5">
          <div className="text-xs text-cyan-400 font-medium">
            {settings.institutionName} ·{' '}
            <span className="capitalize">{currentUser.role}</span> Workspace
            {currentUser.isDemo && ' · DEMO DATA PROFILE'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Operations &amp; Readiness Overview
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Launch 3D resuscitation and multi-casualty triage simulations, inspect recorded action timelines, and track protocol accuracy and critical safety errors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onLaunchScenario('scen_cardiac_01')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            Launch Cardiac Arrest 3D
          </button>
          <button
            type="button"
            onClick={() => onLaunchScenario('scen_triage_01')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0D1424] hover:bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            Launch 4-Patient Triage 3D
          </button>
        </div>
      </div>

      {/* 4-Column Telemetry Summary Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Training Score</span>
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold tabular-nums text-white">
            {metrics.avgScore}/100
          </div>
          <div className="text-[11px] text-slate-400">
            Across {completedSessions.length} completed session(s)
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Procedural Accuracy</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold tabular-nums text-emerald-400">
            {metrics.avgProcedural}%
          </div>
          <div className="text-[11px] text-slate-400">
            Expected protocol step coverage
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Action Interval</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-mono font-bold tabular-nums text-sky-300">
            {metrics.avgResponseSec}s
          </div>
          <div className="text-[11px] text-slate-400">
            Average inter-step decision latency
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Critical Safety Errors</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div
            className={`text-2xl font-mono font-bold tabular-nums ${
              metrics.totalCriticalErrors > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {metrics.totalCriticalErrors}
          </div>
          <div className="text-[11px] text-slate-400">
            Tracked separately from composite score
          </div>
        </div>
      </section>

      {/* Primary Scenarios + Role Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">
              Active Simulation Modules ({activeScenarios.length})
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('scenario-library')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              Open Full Scenario Library
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeScenarios.slice(0, 4).map((scen) => (
              <div
                key={scen.id}
                className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-mono">
                    {scen.code} · {scen.difficulty} · {Math.round(scen.durationLimitSec / 60)} min
                    {scen.isDemo && ' · DEMO DATA'}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                    {scen.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {scen.briefing}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {scen.patientCount} Patient(s) · {scen.expectedActions.length} Steps
                  </span>
                  <button
                    type="button"
                    onClick={() => onLaunchScenario(scen.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-xs font-semibold text-cyan-200 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3 h-3" />
                    Start 3D Sim
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role-Specific Command Quick Links */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-base font-semibold text-slate-100">
            Command Navigation
          </h2>
          <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => onNavigate('scenario-studio')}
              className="w-full p-3 rounded-lg bg-[#070B14] hover:bg-slate-900 border border-slate-800 text-left flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Scenario Design Studio
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Configure disruptions, weights &amp; expected sequences
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('emergency-intelligence')}
              className="w-full p-3 rounded-lg bg-[#070B14] hover:bg-slate-900 border border-slate-800 text-left flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Emergency Intelligence &amp; OpenXR API
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Seeded disruption simulator &amp; Unity VR REST contract
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('trainee-management')}
              className="w-full p-3 rounded-lg bg-[#070B14] hover:bg-slate-900 border border-slate-800 text-left flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  Trainee Cohort ({traineeCount} Active)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Assign scenarios, inspect critical errors &amp; log notes
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-800/50 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Educational Training Prototype: All vital signs, patient trajectories, and scores reflect simulated faculty rules, never real patient diagnostics.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Recorded Sessions Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            Recent Training Sessions
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('session-replay')}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
          >
            Inspect Timeline Replay
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-[#0D1424] border border-slate-800 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                <th className="py-3 px-4">Trainee</th>
                <th className="py-3 px-4">Scenario</th>
                <th className="py-3 px-4">Record Type</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 px-4 text-right">Procedural</th>
                <th className="py-3 px-4 text-right">Score</th>
                <th className="py-3 px-4 text-right">Critical Errors</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {completedSessions.slice(0, 6).map((sess) => (
                <tr
                  key={sess.id}
                  className="hover:bg-slate-800/35 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-slate-100">
                    {sess.traineeName}
                    <span className="text-slate-500 font-mono ml-1.5">
                      #{sess.attemptNumber}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {sess.scenarioCode} · {sess.scenarioTitle}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                    {sess.isDemo ? 'DEMO DATA' : 'USER SESSION'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {sess.durationSec}s
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {sess.assessment?.proceduralAccuracy ?? 0}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-cyan-300">
                    {sess.assessment?.overallScore ?? 0}/100
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                      (sess.assessment?.criticalErrorsCount || 0) > 0
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {sess.assessment?.criticalErrorsCount ?? 0}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigate('session-replay', sess.id)}
                      className="text-cyan-400 hover:text-cyan-300 font-medium whitespace-nowrap"
                    >
                      Replay →
                    </button>
                  </td>
                </tr>
              ))}
              {completedSessions.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 px-4 text-center text-slate-400 text-xs"
                  >
                    No completed sessions match current filter. Launch a simulation in the Simulation Centre to generate live session telemetry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

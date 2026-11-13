import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Clock,
  Filter,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  NavSection,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

interface PerformanceAnalyticsViewProps {
  sessions: TrainingSession[];
  scenarios: ScenarioDefinition[];
  users: UserAccount[];
  includeDemoDefault: boolean;
  onNavigateReplay: (section: NavSection, sessionId: string) => void;
}

export const PerformanceAnalyticsView: React.FC<PerformanceAnalyticsViewProps> = ({
  sessions,
  scenarios,
  users,
  includeDemoDefault,
  onNavigateReplay,
}) => {
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('all');
  const [dateWindow, setDateWindow] = useState<'all' | '7d' | '30d'>('all');
  const [includeDemo, setIncludeDemo] = useState<boolean>(includeDemoDefault);

  const trainees = useMemo(
    () => users.filter((u) => u.role === 'trainee'),
    [users]
  );

  const filteredSessions = useMemo(() => {
    const now = Date.now();
    return sessions.filter((s) => {
      if (!includeDemo && s.isDemo) return false;
      if (selectedTraineeId !== 'all' && s.traineeId !== selectedTraineeId) return false;
      if (selectedScenarioId !== 'all' && s.scenarioId !== selectedScenarioId)
        return false;
      if (dateWindow !== 'all') {
        const days = dateWindow === '7d' ? 7 : 30;
        const startMs = new Date(s.startedAt).getTime();
        if (now - startMs > days * 86400 * 1000) return false;
      }
      return true;
    });
  }, [sessions, includeDemo, selectedTraineeId, selectedScenarioId, dateWindow]);

  const completedSessions = useMemo(
    () => filteredSessions.filter((s) => s.status === 'completed' && s.assessment),
    [filteredSessions]
  );

  const hasDemoInView = useMemo(
    () => completedSessions.some((s) => s.isDemo),
    [completedSessions]
  );

  const kpis = useMemo(() => {
    const totalCount = filteredSessions.length;
    const compCount = completedSessions.length;
    const completionRate =
      totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;

    if (compCount === 0) {
      return {
        overallScore: 0,
        avgResponseSec: 0,
        proceduralAcc: 0,
        decisionAcc: 0,
        criticalErrorFreq: 0,
        totalCritical: 0,
        completionRate,
      };
    }

    const overallScore = Math.round(
      completedSessions.reduce((a, s) => a + (s.assessment?.overallScore || 0), 0) /
        compCount
    );
    const proceduralAcc = Math.round(
      completedSessions.reduce(
        (a, s) => a + (s.assessment?.proceduralAccuracy || 0),
        0
      ) / compCount
    );
    const decisionAcc = Math.round(
      completedSessions.reduce(
        (a, s) => a + (s.assessment?.decisionAccuracy || 0),
        0
      ) / compCount
    );
    const avgResponseSec = Number(
      (
        completedSessions.reduce(
          (a, s) => a + (s.assessment?.avgResponseTimeSec || 0),
          0
        ) / compCount
      ).toFixed(1)
    );
    const totalCritical = completedSessions.reduce(
      (a, s) => a + (s.assessment?.criticalErrorsCount || 0),
      0
    );
    const sessionsWithCrit = completedSessions.filter(
      (s) => (s.assessment?.criticalErrorsCount || 0) > 0
    ).length;

    return {
      overallScore,
      avgResponseSec,
      proceduralAcc,
      decisionAcc,
      criticalErrorFreq: Math.round((sessionsWithCrit / compCount) * 100),
      totalCritical,
      completionRate,
    };
  }, [filteredSessions, completedSessions]);

  // Chart 1: Performance by Scenario
  const scenarioChartData = useMemo(() => {
    return scenarios
      .map((scen) => {
        const matching = completedSessions.filter((s) => s.scenarioId === scen.id);
        if (matching.length === 0) return null;
        const n = matching.length;
        return {
          code: scen.code,
          title: scen.title,
          Overall: Math.round(
            matching.reduce((a, s) => a + (s.assessment?.overallScore || 0), 0) / n
          ),
          Procedural: Math.round(
            matching.reduce(
              (a, s) => a + (s.assessment?.proceduralAccuracy || 0),
              0
            ) / n
          ),
          Decision: Math.round(
            matching.reduce(
              (a, s) => a + (s.assessment?.decisionAccuracy || 0),
              0
            ) / n
          ),
          sessions: n,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [scenarios, completedSessions]);

  // Chart 2: Performance & Latency Improvement Across Chronological Sessions / Attempts
  const chronologicalTrendData = useMemo(() => {
    const sorted = [...completedSessions].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    return sorted.map((s, idx) => ({
      indexLabel: `#${idx + 1} (${s.traineeName.split(' ')[0]})`,
      Score: s.assessment?.overallScore || 0,
      Sequence: s.assessment?.sequenceAccuracy || 0,
      ResponseSec: s.assessment?.avgResponseTimeSec || 0,
      CriticalErrors: s.assessment?.criticalErrorsCount || 0,
    }));
  }, [completedSessions]);

  // Trainee Comparison Matrix
  const traineeComparison = useMemo(() => {
    return trainees
      .map((t) => {
        const list = completedSessions.filter((s) => s.traineeId === t.id);
        if (list.length === 0) return null;
        const n = list.length;
        const sorted = [...list].sort(
          (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        );
        const firstScore = sorted[0]?.assessment?.overallScore || 0;
        const latestScore = sorted[sorted.length - 1]?.assessment?.overallScore || 0;

        return {
          traineeId: t.id,
          name: t.name,
          cohort: t.cohort,
          isDemo: t.isDemo,
          sessionsCount: n,
          avgScore: Math.round(
            list.reduce((a, s) => a + (s.assessment?.overallScore || 0), 0) / n
          ),
          avgProcedural: Math.round(
            list.reduce((a, s) => a + (s.assessment?.proceduralAccuracy || 0), 0) / n
          ),
          avgDecision: Math.round(
            list.reduce((a, s) => a + (s.assessment?.decisionAccuracy || 0), 0) / n
          ),
          avgResponseSec: Number(
            (
              list.reduce(
                (a, s) => a + (s.assessment?.avgResponseTimeSec || 0),
                0
              ) / n
            ).toFixed(1)
          ),
          totalCritical: list.reduce(
            (a, s) => a + (s.assessment?.criticalErrorsCount || 0),
            0
          ),
          improvementDelta: latestScore - firstScore,
          latestSessionId: sorted[sorted.length - 1].id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [trainees, completedSessions]);

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800/90">
        <div>
          <div className="text-xs font-medium text-cyan-400">
            Session Evidence Telemetry
            {hasDemoInView && ' · INCLUDES DEMO DATA'}
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Performance Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Evaluate procedural accuracy, decision precision, action latency, improvement trajectories, and critical error frequency across recorded sessions.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filters:</span>
          </div>

          <select
            value={selectedTraineeId}
            onChange={(e) => setSelectedTraineeId(e.target.value)}
            aria-label="Filter by Trainee"
            className="px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
          >
            <option value="all">All Trainees</option>
            {trainees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isDemo ? '(DEMO)' : ''}
              </option>
            ))}
          </select>

          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            aria-label="Filter by Scenario"
            className="px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100 max-w-xs truncate"
          >
            <option value="all">All Scenarios</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.title}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070B14] border border-slate-800">
            {(
              [
                { id: 'all', label: 'All Dates' },
                { id: '30d', label: 'Last 30d' },
                { id: '7d', label: 'Last 7d' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDateWindow(d.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  dateWindow === d.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeDemo}
            onChange={(e) => setIncludeDemo(e.target.checked)}
            className="accent-cyan-400"
          />
          <span>Include DEMO DATA Sessions</span>
        </label>
      </div>

      {/* 6-Metric KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Overall Score</span>
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-mono font-bold tabular-nums text-white mt-1">
            {kpis.overallScore}/100
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Procedural</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-mono font-bold tabular-nums text-emerald-400 mt-1">
            {kpis.proceduralAcc}%
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Decision Acc</span>
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-mono font-bold tabular-nums text-sky-300 mt-1">
            {kpis.decisionAcc}%
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Avg Response</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-mono font-bold tabular-nums text-amber-300 mt-1">
            {kpis.avgResponseSec}s
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Crit Error Freq</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div
            className={`text-xl font-mono font-bold tabular-nums mt-1 ${
              kpis.totalCritical > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {kpis.criticalErrorFreq}% ({kpis.totalCritical})
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800">
          <div className="text-[11px] text-slate-400">Completion Rate</div>
          <div className="text-xl font-mono font-bold tabular-nums text-slate-100 mt-1">
            {kpis.completionRate}%
          </div>
        </div>
      </div>

      {completedSessions.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#0D1424] border border-slate-800 text-center space-y-2">
          <div className="text-sm font-semibold text-slate-200">
            No Completed Sessions Match Selected Filters
          </div>
          <p className="text-xs text-slate-400">
            Enable &quot;Include DEMO DATA Sessions&quot; above or complete a new simulation in the 3D Simulation Centre.
          </p>
        </div>
      ) : (
        <>
          {/* Interactive Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance by Scenario */}
            <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Performance Breakdown by Scenario
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {hasDemoInView ? 'DEMO + USER DATA' : 'USER DATA ONLY'}
                </span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioChartData} margin={{ top: 10, right: 16, left: -12, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="code" stroke="#94a3b8" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#070B14',
                        borderColor: '#334155',
                        fontSize: '12px',
                        color: '#f1f5f9',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Overall" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Procedural" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Decision" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Progression Across Attempts / Chronological Sessions */}
            <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  Score &amp; Sequence Accuracy Progression Across Attempts
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {completedSessions.length} Sessions
                </span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chronologicalTrendData}
                    margin={{ top: 10, right: 16, left: -12, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="indexLabel" stroke="#94a3b8" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#070B14',
                        borderColor: '#334155',
                        fontSize: '12px',
                        color: '#f1f5f9',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line
                      type="monotone"
                      dataKey="Score"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Sequence"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Trainee Comparison Matrix */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Trainee Cohort Comparison &amp; Critical Error Visibility
            </h2>
            <div className="rounded-xl bg-[#0D1424] border border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                    <th className="py-3 px-4">Trainee</th>
                    <th className="py-3 px-4">Cohort</th>
                    <th className="py-3 px-4 text-right">Attempts</th>
                    <th className="py-3 px-4 text-right">Procedural</th>
                    <th className="py-3 px-4 text-right">Decision</th>
                    <th className="py-3 px-4 text-right">Avg Latency</th>
                    <th className="py-3 px-4 text-right">Mean Score</th>
                    <th className="py-3 px-4 text-right">Trend Delta</th>
                    <th className="py-3 px-4 text-right">Critical Errors</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {traineeComparison.map((row) => (
                    <tr
                      key={row.traineeId}
                      className="hover:bg-slate-800/35 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-100">
                        {row.name}
                        {row.isDemo && (
                          <span className="ml-1.5 text-[10px] font-mono text-amber-300/90">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{row.cohort}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        {row.sessionsCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        {row.avgProcedural}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        {row.avgDecision}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                        {row.avgResponseSec}s
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-cyan-300">
                        {row.avgScore}/100
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums ${
                          row.improvementDelta > 0
                            ? 'text-emerald-400'
                            : row.improvementDelta < 0
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.improvementDelta > 0
                          ? `+${row.improvementDelta}`
                          : row.improvementDelta}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                          row.totalCritical > 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {row.totalCritical}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigateReplay('session-replay', row.latestSessionId)
                          }
                          className="text-cyan-400 hover:text-cyan-300 font-medium whitespace-nowrap"
                        >
                          Latest Replay →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

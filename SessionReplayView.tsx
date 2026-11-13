import React, { useEffect, useMemo, useState } from 'react';
import {
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
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  Play,
  Save,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { generateRuleBasedDebrief } from '../engine/assessmentEngine';
import { requestSessionDebrief } from '../services/storageService';
import {
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

interface SessionReplayViewProps {
  sessions: TrainingSession[];
  scenarios: ScenarioDefinition[];
  selectedSessionId: string | null;
  currentUser: UserAccount;
  onSelectSessionId: (id: string) => void;
  onUpdateSession: (session: TrainingSession) => void;
}

export const SessionReplayView: React.FC<SessionReplayViewProps> = ({
  sessions,
  scenarios,
  selectedSessionId,
  currentUser,
  onSelectSessionId,
  onUpdateSession,
}) => {
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );

  const session = useMemo(
    () =>
      completedSessions.find((s) => s.id === selectedSessionId) ||
      completedSessions[0] ||
      null,
    [completedSessions, selectedSessionId]
  );

  const scenario = useMemo(
    () =>
      scenarios.find((sc) => sc.id === session?.scenarioId) || scenarios[0],
    [scenarios, session]
  );

  const [selectedEventIdx, setSelectedEventIdx] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [selectedPatientChartId, setSelectedPatientChartId] = useState<string>('');
  const [generatingDebrief, setGeneratingDebrief] = useState<boolean>(false);
  const [instructorNoteDraft, setInstructorNoteDraft] = useState<string>('');
  const [noteSavedMsg, setNoteSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedEventIdx(0);
    setAutoPlay(false);
    if (session) {
      setInstructorNoteDraft(session.instructorNotes || '');
      const firstPat = session.finalPatients[0]?.patientId || '';
      setSelectedPatientChartId(firstPat);
    }
  }, [session]);

  useEffect(() => {
    if (!autoPlay || !session || session.events.length === 0) return;
    const id = window.setInterval(() => {
      setSelectedEventIdx((prev) => {
        if (prev + 1 >= session.events.length) {
          setAutoPlay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1400);
    return () => window.clearInterval(id);
  }, [autoPlay, session]);

  if (!session || !scenario) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-2">
        <h1 className="text-xl font-bold text-slate-100">Session Replay</h1>
        <p className="text-xs text-slate-400">
          No completed training sessions available yet. Complete a scenario in the Simulation Centre to inspect its recorded timeline.
        </p>
      </div>
    );
  }

  const activeEvent = session.events[selectedEventIdx] || null;

  const patientChartData = session.vitalTimeline.filter((pt) =>
    selectedPatientChartId ? pt.patientId === selectedPatientChartId : true
  );

  const handleGenerateDebrief = async () => {
    setGeneratingDebrief(true);
    try {
      const debrief = await requestSessionDebrief(session, scenario);
      onUpdateSession({ ...session, debrief });
    } catch {
      const fallback = generateRuleBasedDebrief(session, scenario);
      onUpdateSession({ ...session, debrief: fallback });
    } finally {
      setGeneratingDebrief(false);
    }
  };

  const handleSaveInstructorNote = () => {
    onUpdateSession({
      ...session,
      instructorNotes: instructorNoteDraft,
    });
    setNoteSavedMsg('Saved instructor annotation to session record.');
    setTimeout(() => setNoteSavedMsg(null), 3000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-6">
      {/* Header & Session Selector */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800/90">
        <div>
          <div className="text-xs font-medium text-cyan-400">
            Recorded Event &amp; Telemetry Forensics
            {session.isDemo ? ' · DEMO DATA SESSION' : ' · USER RECORDED SESSION'}
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Session Replay &amp; Evidence Debrief
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Scrub through recorded trainee actions, inspect patient vital trajectories, compare against the reference sequence, and generate structured debriefs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="replay-session-select" className="text-xs text-slate-400">
            Session:
          </label>
          <select
            id="replay-session-select"
            value={session.id}
            onChange={(e) => onSelectSessionId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0D1424] border border-slate-700 text-xs text-slate-100 max-w-md truncate"
          >
            {completedSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.traineeName} · {s.scenarioCode} (Attempt #{s.attemptNumber}) —{' '}
                {s.assessment?.overallScore ?? 0}/100{' '}
                {s.isDemo ? '[DEMO]' : '[LIVE]'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Assessment & Score Calculation Formula Strip */}
      {session.assessment && (
        <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400 font-mono">
                {session.scenarioCode} · Seed {session.seed} · Duration {session.durationSec}s
              </div>
              <div className="text-base font-semibold text-slate-100 mt-0.5">
                {session.assessment.simulatedOutcome}
              </div>
            </div>

            <div className="flex items-center gap-5 font-mono tabular-nums">
              <div className="text-right">
                <div className="text-[11px] font-sans text-slate-400">Overall Score</div>
                <div className="text-xl font-bold text-cyan-300">
                  {session.assessment.overallScore}/100
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-sans text-slate-400">
                  Critical Errors
                </div>
                <div
                  className={`text-xl font-bold ${
                    session.assessment.criticalErrorsCount > 0
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {session.assessment.criticalErrorsCount}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
            {session.assessment.scoreCalculationFormula}
          </div>
        </div>
      )}

      {/* Interactive Timeline Scrubber */}
      <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoPlay((p) => !p)}
              disabled={session.events.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 text-xs font-semibold"
            >
              {autoPlay ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause Playback
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Auto-Step Events
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedEventIdx((i) => Math.max(0, i - 1))}
              disabled={selectedEventIdx <= 0}
              className="p-1.5 rounded-lg bg-[#070B14] border border-slate-800 text-slate-300 disabled:opacity-40"
              title="Previous Event"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedEventIdx((i) =>
                  Math.min(session.events.length - 1, i + 1)
                )
              }
              disabled={selectedEventIdx >= session.events.length - 1}
              className="p-1.5 rounded-lg bg-[#070B14] border border-slate-800 text-slate-300 disabled:opacity-40"
              title="Next Event"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-slate-300 ml-2">
              Event {session.events.length > 0 ? selectedEventIdx + 1 : 0} of{' '}
              {session.events.length}
            </span>
          </div>

          {session.disruptions.filter((d) => d.triggered).length > 0 && (
            <div className="text-xs text-amber-300 font-mono">
              Disruptions Triggered:{' '}
              {session.disruptions
                .filter((d) => d.triggered)
                .map((d) => `${d.title} (@${d.triggerAtSec}s)`)
                .join(' · ')}
            </div>
          )}
        </div>

        {/* Horizontal Event Node Scrubber */}
        {session.events.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {session.events.map((ev, idx) => {
              const active = idx === selectedEventIdx;
              const isCrit = ev.errorSeverity === 'Critical';
              const isCorrect = ev.correctness === 'correct';
              return (
                <button
                  key={ev.eventId}
                  type="button"
                  onClick={() => {
                    setAutoPlay(false);
                    setSelectedEventIdx(idx);
                  }}
                  className={`px-3 py-2 rounded-lg border text-left shrink-0 transition-colors min-w-[148px] ${
                    active
                      ? 'bg-cyan-950/60 border-cyan-400'
                      : isCrit
                      ? 'bg-red-950/35 border-red-700/70 hover:border-red-500'
                      : 'bg-[#070B14] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">#{ev.sequencePosition}</span>
                    <span
                      className={
                        isCrit
                          ? 'text-red-400 font-semibold'
                          : isCorrect
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }
                    >
                      {ev.elapsedSec}s
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-100 truncate mt-0.5">
                    {ev.actionLabel}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-400">
            No action events were recorded during this session.
          </div>
        )}

        {/* Selected Event Detailed Inspector */}
        {activeEvent && (
          <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                {activeEvent.errorSeverity === 'Critical' ? (
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                ) : activeEvent.correctness === 'correct' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-semibold text-slate-100">
                  #{activeEvent.sequencePosition} · {activeEvent.actionLabel}
                </span>
                <span className="text-slate-500">·</span>
                <span className="font-mono text-cyan-300">
                  Target: {activeEvent.targetObject}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activeEvent.feedbackMessage}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 pt-1">
                <span>Timestamp: {activeEvent.elapsedSec}s</span>
                <span>Response Delta: {activeEvent.responseTimeSec}s</span>
                <span>Expected Next: {activeEvent.expectedAction}</span>
                <span>
                  Error: {activeEvent.errorType} ({activeEvent.errorSeverity})
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 p-3 rounded-lg bg-[#0D1424] border border-slate-800/90 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-300">
                Recorded Simulated Patient State ({activeEvent.patientState.patientId})
              </div>
              <div className="grid grid-cols-4 gap-2 font-mono text-xs tabular-nums">
                <div>
                  <span className="text-[10px] text-slate-500 block">HR</span>
                  <span className="text-emerald-400">
                    {activeEvent.patientState.heartRate}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">BP</span>
                  <span className="text-amber-300">
                    {activeEvent.patientState.systolicBP}/
                    {activeEvent.patientState.diastolicBP}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">SpO2</span>
                  <span className="text-sky-400">
                    {activeEvent.patientState.spo2}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Status</span>
                  <span className="text-slate-200">
                    {activeEvent.patientState.conditionStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vital Trajectory Chart + Reference Sequence Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              Simulated Patient Vital Trajectory
            </h2>
            {session.finalPatients.length > 1 && (
              <select
                value={selectedPatientChartId}
                onChange={(e) => setSelectedPatientChartId(e.target.value)}
                aria-label="Select Patient Vital Trajectory"
                className="px-2.5 py-1 rounded bg-[#070B14] border border-slate-700 text-xs text-slate-200"
              >
                {session.finalPatients.map((p) => (
                  <option key={p.patientId} value={p.patientId}>
                    {p.patientId} · {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={patientChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="elapsedSec"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v) => `${v}s`}
                />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#070B14',
                    borderColor: '#334155',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  name="HR (bpm)"
                  stroke="#10b981"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="systolicBP"
                  name="Systolic BP"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="spo2"
                  name="SpO2 (%)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reference Sequence vs Recorded Actions */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Reference Protocol Alignment ({scenario.expectedActions.length} Steps)
          </h2>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {scenario.expectedActions.map((refStep) => {
              const matchedEv = session.events.find(
                (e) =>
                  e.actionType === refStep.actionType &&
                  (!refStep.patientId || e.patientId === refStep.patientId) &&
                  e.correctness !== 'incorrect'
              );
              return (
                <div
                  key={refStep.stepId}
                  className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">
                      {refStep.order}. {refStep.label}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Target &le;{refStep.targetWindowSec}s
                    </div>
                  </div>
                  {matchedEv ? (
                    <span className="font-mono text-[11px] text-emerald-400 shrink-0">
                      LOGGED @{matchedEv.elapsedSec}s
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-red-400 shrink-0">
                      MISSED
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI / Rule-Based Structured Debrief & Instructor Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Evidence-Based Training Debrief
              </h2>
              <div className="text-xs text-slate-400">
                Source:{' '}
                {session.debrief?.source === 'gemini-ai'
                  ? 'Gemini 3.8 Flash Evidence Interpreter (Server-Side)'
                  : 'Deterministic Rule-Based Assessment Engine'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateDebrief}
              disabled={generatingDebrief}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generatingDebrief
                ? 'Analyzing Recorded Events...'
                : 'Generate / Refresh AI Debrief'}
            </button>
          </div>

          {session.debrief && (
            <div className="space-y-4 text-xs">
              <p className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800 text-slate-200 leading-relaxed">
                {session.debrief.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-emerald-400">Strengths</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    {session.debrief.strengths.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-amber-300">
                    Weaknesses &amp; Gaps
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    {session.debrief.weaknesses.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-red-400">
                    Critical Errors &amp; Incorrect Decisions
                  </div>
                  {session.debrief.criticalErrors.length === 0 &&
                  session.debrief.incorrectDecisions.length === 0 ? (
                    <p className="text-slate-400">
                      Zero critical errors or incorrect decisions recorded.
                    </p>
                  ) : (
                    <ul className="list-disc pl-4 space-y-1 text-slate-300">
                      {session.debrief.criticalErrors.map((c, i) => (
                        <li key={`c_${i}`} className="text-red-300">
                          {c}
                        </li>
                      ))}
                      {session.debrief.incorrectDecisions.map((d, i) => (
                        <li key={`d_${i}`}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-cyan-300">
                    Improvement Recommendations
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    {session.debrief.improvementRecommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Instructor Notes Panel */}
        <div className="lg:col-span-4 p-5 rounded-xl bg-[#0D1424] border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              Instructor Session Notes
            </h2>
            <p className="text-xs text-slate-400">
              {currentUser.role === 'trainee'
                ? 'Faculty feedback recorded for this training attempt.'
                : 'Add persistent faculty coaching observations for this session.'}
            </p>
            <textarea
              rows={7}
              value={instructorNoteDraft}
              onChange={(e) => setInstructorNoteDraft(e.target.value)}
              placeholder="Record debrief action items or remediation targets..."
              className="w-full p-3 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            />
            {noteSavedMsg && (
              <div className="text-xs text-emerald-400">{noteSavedMsg}</div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveInstructorNote}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Session Note
          </button>
        </div>
      </div>
    </div>
  );
};

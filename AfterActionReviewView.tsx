import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HeartPulse,
  History,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  calculateSessionXp,
  computePlayerProgression,
} from '../engine/progressionEngine';
import type {
  DrillAttemptRecord,
  NavSection,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';
import { getScenarioVisual } from '../utils/scenarioVisuals';

interface AfterActionReviewViewProps {
  session: TrainingSession;
  scenario: ScenarioDefinition;
  currentUser: UserAccount;
  allSessions: TrainingSession[];
  allScenarios: ScenarioDefinition[];
  drills?: DrillAttemptRecord[];
  generatingDebrief: boolean;
  onGenerateAiDebrief: () => void;
  onRetryMission: () => void;
  onContinueNextMission?: (nextScenarioId: string) => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
}

export const AfterActionReviewView: React.FC<AfterActionReviewViewProps> = ({
  session,
  scenario,
  currentUser,
  allSessions,
  allScenarios,
  drills = [],
  generatingDebrief,
  onGenerateAiDebrief,
  onRetryMission,
  onContinueNextMission,
  onNavigate,
}) => {
  const [expandedAnalysisOpen, setExpandedAnalysisOpen] = useState(false);

  const assessment = session.assessment;
  const xpBreakdown = useMemo(() => calculateSessionXp(session), [session]);

  const mergedSessions = useMemo(() => {
    const exists = allSessions.some((s) => s.id === session.id);
    return exists
      ? allSessions.map((s) => (s.id === session.id ? session : s))
      : [session, ...allSessions];
  }, [allSessions, session]);

  const progression = useMemo(
    () =>
      computePlayerProgression(
        currentUser,
        mergedSessions,
        allScenarios,
        drills
      ),
    [currentUser, mergedSessions, allScenarios, drills]
  );

  const nextScenario = useMemo(() => {
    if (allScenarios.length === 0) return null;
    const idx = allScenarios.findIndex((s) => s.id === scenario.id);
    if (idx === -1) return allScenarios[0];
    return allScenarios[(idx + 1) % allScenarios.length];
  }, [allScenarios, scenario.id]);

  const categorizedEvents = useMemo(() => {
    const correct = session.events.filter((e) => e.correctness === 'correct');
    const delayedOrOutOfSeq = session.events.filter(
      (e) =>
        e.correctness === 'delayed' || e.correctness === 'out_of_sequence'
    );
    const incorrect = session.events.filter(
      (e) => e.correctness === 'incorrect' || e.correctness === 'unnecessary'
    );
    return { correct, delayedOrOutOfSeq, incorrect };
  }, [session.events]);

  if (!assessment) return null;

  const hasCriticals = assessment.criticalErrorsCount > 0;
  const unlockedBadges = progression.achievements.filter((a) => a.unlocked);

  return (
    <div className="min-h-full bg-[#070B14] text-slate-100 p-5 lg:p-8 overflow-y-auto">
      <div className="max-w-[1260px] mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            Home Base
          </button>

          <button
            type="button"
            onClick={() => onNavigate('missions')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
          >
            Sector Mission Map →
          </button>
        </div>

        {/* UNCONCEALED CRITICAL SAFETY BANNER (ALWAYS VISIBLE WHEN > 0) */}
        {hasCriticals && (
          <div className="p-4 sm:p-5 rounded-2xl bg-red-950/60 border border-red-500/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-red-200">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                <span>
                  CRITICAL SAFETY ALERT · {assessment.criticalErrorsCount} Protocol
                  Violation{assessment.criticalErrorsCount > 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-xs font-mono text-red-300">
                Rating Capped at CRITICAL REVIEW · XP Never Certifies Clinical Competence
              </span>
            </div>
            <ul className="space-y-1 text-xs text-red-100 list-disc pl-5">
              {assessment.criticalErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* VISUAL GAME DEBRIEF HERO CARD */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl bg-[#0B1220] border border-slate-800 overflow-hidden"
        >
          {/* Visual Environment Strip */}
          <div className="relative h-36 sm:h-44 bg-slate-900 overflow-hidden">
            <img
              src={getScenarioVisual(scenario)}
              alt={scenario.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-65"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/50 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-cyan-300">
                  MISSION COMPLETE · {scenario.code} · ATTEMPT #{session.attemptNumber}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
                  {scenario.title}
                </h1>
              </div>

              {/* Large Mission Rating Emblem */}
              <div
                className={`px-5 py-3 rounded-2xl border text-center min-w-[128px] ${
                  hasCriticals
                    ? 'bg-red-950/90 border-red-500 text-red-200'
                    : xpBreakdown.rating === 'S' || xpBreakdown.rating === 'A'
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono text-slate-400">
                  MISSION RATING
                </div>
                <div className="text-3xl font-mono font-bold leading-tight">
                  {xpBreakdown.rating === 'CRITICAL_REVIEW'
                    ? 'REVIEW'
                    : xpBreakdown.rating}
                </div>
                <div className="text-[10px] opacity-90">
                  {xpBreakdown.ratingLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Core Visual Reward & Telemetry Tiles */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono tabular-nums">
              <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">
                  XP Earned
                </div>
                <div className="text-2xl font-bold text-cyan-300 mt-0.5">
                  +{xpBreakdown.totalXp}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">
                  Overall Score
                </div>
                <div className="text-2xl font-bold text-white mt-0.5">
                  {assessment.overallScore}/100
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">
                  Clear Time
                </div>
                <div className="text-2xl font-bold text-amber-300 mt-0.5 inline-flex items-center gap-1">
                  <Clock className="w-4 h-4 text-amber-400" />
                  {session.durationSec}s
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">
                  Procedural
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-0.5">
                  {assessment.proceduralAccuracy}%
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">
                  Critical Errors
                </div>
                <div
                  className={`text-2xl font-bold mt-0.5 ${
                    hasCriticals ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {assessment.criticalErrorsCount}
                </div>
              </div>
            </div>

            {/* Responder Level Progress Bar + Unlocked Achievements Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center p-4 rounded-xl bg-[#070B14] border border-slate-800">
              <div className="lg:col-span-6 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="font-sans font-bold text-slate-100">
                    LVL {progression.level} · {progression.rankTitle}
                  </span>
                  <span className="text-cyan-300">
                    {progression.totalXp} / {progression.nextLevelTargetXp} XP
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#0B1220] border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 origin-left transition-transform duration-300"
                    style={{
                      transform: `scaleX(${Math.max(
                        0.04,
                        progression.levelProgressPct / 100
                      )})`,
                    }}
                  />
                </div>
              </div>

              <div className="lg:col-span-6 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold">
                    Unlocked Badges ({unlockedBadges.length}/
                    {progression.achievements.length})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {unlockedBadges.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      title={b.description}
                      className="px-2.5 py-1 rounded-lg bg-[#0B1220] border border-cyan-500/40 text-[11px] font-semibold text-cyan-200 inline-flex items-center gap-1"
                    >
                      <Award className="w-3 h-3 text-cyan-400" />
                      {b.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* PROMINENT GAME ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                {nextScenario && onContinueNextMission && (
                  <button
                    type="button"
                    onClick={() => onContinueNextMission(nextScenario.id)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shadow-lg"
                  >
                    Continue to Next Mission ({nextScenario.code})
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onRetryMission}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm font-semibold text-slate-100 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4 text-cyan-400" />
                  Replay Mission
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('session-replay', session.id)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap"
                >
                  <History className="w-4 h-4 text-cyan-400" />
                  Timeline Scrubber
                </button>
              </div>

              {/* Optional Collapsible Detailed Clinical & AI Analysis */}
              <button
                type="button"
                onClick={() => setExpandedAnalysisOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#070B14] hover:bg-slate-800 border border-cyan-500/40 text-xs font-semibold text-cyan-300 transition-colors whitespace-nowrap"
              >
                {expandedAnalysisOpen ? (
                  <>
                    Hide Expanded Analysis <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Expanded Analysis &amp; AI Debrief{' '}
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.section>

        {/* OPTIONAL EXPANDED CLINICAL TELEMETRY & EVIDENCE DEBRIEF */}
        {expandedAnalysisOpen && (
          <div className="space-y-6">
            {/* Simulated Patient-State Trajectory */}
            <section className="rounded-2xl bg-[#0B1220] border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-cyan-400" />
                  Patient Vitals Trajectory ({session.finalPatients.length})
                </h2>
                <span className="text-[11px] font-mono text-slate-400">
                  {assessment.scoreCalculationFormula}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {session.finalPatients.map((finalPat) => {
                  const initPat = scenario.initialPatients.find(
                    (p) => p.patientId === finalPat.patientId
                  );
                  return (
                    <div
                      key={finalPat.patientId}
                      className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-100">
                          {finalPat.patientId}
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            finalPat.conditionStatus === 'Stable' ||
                            finalPat.conditionStatus === 'Stabilising'
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {initPat ? `${initPat.conditionStatus} → ` : ''}
                          {finalPat.conditionStatus}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono tabular-nums text-slate-300">
                        <div>HR: {finalPat.heartRate} bpm</div>
                        <div>SpO2: {finalPat.spo2}%</div>
                        <div>
                          BP: {finalPat.systolicBP}/{finalPat.diastolicBP}
                        </div>
                        <div>RR: {finalPat.respiratoryRate}/min</div>
                      </div>
                      {scenario.mode === 'multi_patient_triage' && (
                        <div className="pt-1.5 border-t border-slate-800 text-[11px] font-mono flex justify-between">
                          <span className="text-slate-300">
                            Tag: {finalPat.assignedTriage || 'NONE'}
                          </span>
                          <span className="text-cyan-300">
                            Ref: {finalPat.referenceTriage}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Action Breakdown + Gemini / Rule-Based Debrief */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 rounded-2xl bg-[#0B1220] border border-slate-800 p-5 space-y-4">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Action Ledger ({session.events.length} Events)
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      On-Target ({categorizedEvents.correct.length})
                    </div>
                    <ul className="space-y-1 max-h-40 overflow-y-auto text-[11px] text-slate-300">
                      {categorizedEvents.correct.map((ev) => (
                        <li
                          key={ev.eventId}
                          className="flex justify-between gap-2"
                        >
                          <span className="truncate">{ev.actionLabel}</span>
                          <span className="font-mono text-slate-400 shrink-0">
                            {ev.elapsedSec}s
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Delayed / Out-of-Order (
                      {categorizedEvents.delayedOrOutOfSeq.length +
                        categorizedEvents.incorrect.length}
                      )
                    </div>
                    <ul className="space-y-1 max-h-40 overflow-y-auto text-[11px] text-slate-300">
                      {[
                        ...categorizedEvents.incorrect,
                        ...categorizedEvents.delayedOrOutOfSeq,
                      ].map((ev) => (
                        <li
                          key={ev.eventId}
                          className="flex justify-between gap-2"
                        >
                          <span className="truncate">{ev.actionLabel}</span>
                          <span
                            className={`font-mono shrink-0 ${
                              ev.errorSeverity === 'Critical'
                                ? 'text-red-400 font-bold'
                                : 'text-amber-300'
                            }`}
                          >
                            {ev.elapsedSec}s
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {assessment.missedActions.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#070B14] border border-slate-800 space-y-1.5">
                    <div className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      Missed Protocol Steps ({assessment.missedActions.length})
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-300 list-disc pl-4">
                      {assessment.missedActions.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 rounded-2xl bg-[#0B1220] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-100">
                      Instructor &amp; AI Debrief
                    </h2>
                    <span className="text-[11px] font-mono text-cyan-300">
                      {session.debrief?.source === 'gemini-ai'
                        ? 'Gemini AI'
                        : 'Rule Engine'}
                    </span>
                  </div>

                  {session.debrief && (
                    <div className="space-y-2.5 text-xs">
                      <p className="p-3 rounded-xl bg-[#070B14] border border-slate-800 text-slate-300 leading-relaxed">
                        {session.debrief.summary}
                      </p>
                      <ul className="space-y-1 text-[11px] text-slate-300 list-disc pl-4">
                        {session.debrief.improvementRecommendations.map(
                          (rec, i) => (
                            <li key={i}>{rec}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onGenerateAiDebrief}
                  disabled={generatingDebrief}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {generatingDebrief
                    ? 'Synthesizing Telemetry...'
                    : 'Generate Gemini Evidence Debrief'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  MapPin,
  Play,
  ShieldAlert,
  Sliders,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import {
  computePlayerProgression,
  EQUIPMENT_KIT_PRESETS,
} from '../engine/progressionEngine';
import type {
  DrillAttemptRecord,
  NavSection,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';
import { getScenarioVisual } from '../utils/scenarioVisuals';

interface MissionMapViewProps {
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  drills: DrillAttemptRecord[];
  currentUser: UserAccount;
  onLaunchScenario: (scenarioId: string) => void;
  onEditScenarioInStudio: (scenarioId: string) => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
}

const NODE_COORDS: Array<{ xPct: number; yPct: number; sectorLabel: string }> = [
  { xPct: 14, yPct: 68, sectorLabel: 'Sector 01 · Resuscitation Bay A' },
  { xPct: 38, yPct: 30, sectorLabel: 'Sector 02 · Ambulance Surge Ward' },
  { xPct: 63, yPct: 66, sectorLabel: 'Sector 03 · Night Backup Bay' },
  { xPct: 86, yPct: 28, sectorLabel: 'Sector 04 · Critical Trauma Wing' },
];

export const MissionMapView: React.FC<MissionMapViewProps> = ({
  scenarios,
  sessions,
  drills,
  currentUser,
  onLaunchScenario,
  onEditScenarioInStudio,
}) => {
  const activeScenarios = useMemo(
    () => scenarios.filter((s) => !s.archived),
    [scenarios]
  );

  const progression = useMemo(
    () => computePlayerProgression(currentUser, sessions, activeScenarios, drills),
    [currentUser, sessions, activeScenarios, drills]
  );

  const [selectedId, setSelectedId] = useState<string>(
    activeScenarios[0]?.id || 'scen_cardiac_01'
  );
  const [modeFilter, setModeFilter] = useState<
    'all' | 'cardiac_arrest' | 'multi_patient_triage'
  >('all');
  const [showProtocolDetail, setShowProtocolDetail] = useState(false);

  const visibleScenarios = useMemo(
    () =>
      modeFilter === 'all'
        ? activeScenarios
        : activeScenarios.filter((s) => s.mode === modeFilter),
    [activeScenarios, modeFilter]
  );

  const selectedScenario =
    visibleScenarios.find((s) => s.id === selectedId) ||
    visibleScenarios[0] ||
    activeScenarios[0];

  const equippedKit =
    EQUIPMENT_KIT_PRESETS[
      progression.responderProfile.primaryKit || 'aed_rapid'
    ];

  // Dynamic map coordinates for any number of scenarios
  const positionedNodes = useMemo(() => {
    return visibleScenarios.map((scen, idx) => {
      const preset = NODE_COORDS[idx];
      if (preset && visibleScenarios.length <= 4) {
        return { scenario: scen, ...preset, index: idx };
      }
      const step = 76 / Math.max(1, visibleScenarios.length - 1);
      return {
        scenario: scen,
        xPct: Math.round(12 + idx * step),
        yPct: idx % 2 === 0 ? 68 : 30,
        sectorLabel: `Sector 0${idx + 1}`,
        index: idx,
      };
    });
  }, [visibleScenarios]);

  if (!selectedScenario) {
    return (
      <div className="p-8 text-slate-400">
        No active missions available. Open Command Centre to create one.
      </div>
    );
  }

  const selPb = progression.personalBests[selectedScenario.id];
  const selUnlock = progression.missionUnlocks[selectedScenario.id];
  const selLocked = Boolean(selUnlock && !selUnlock.unlocked);

  return (
    <div className="p-5 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Header + Interactive Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-cyan-400 font-medium">
            Emergency Sector Operations · Level {progression.level}{' '}
            {progression.rankTitle}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Tactical Mission Map
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1220] border border-slate-800">
          {(
            [
              { id: 'all', label: 'All Sectors' },
              { id: 'cardiac_arrest', label: 'Cardiac Arrest' },
              { id: 'multi_patient_triage', label: 'Surge Triage' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setModeFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                modeFilter === f.id
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN SPLIT: Left Interactive Progression Map (7 cols) · Right Mission Briefing Drawer (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT: Interactive Connected Sector Map */}
        <div className="lg:col-span-7 rounded-xl bg-[#0B1220] border border-slate-800 flex flex-col justify-between overflow-hidden min-h-[500px] relative">
          {/* Subtle Architectural Grid Backdrop */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* Top Map Legend */}
          <div className="relative z-10 px-5 py-3.5 border-b border-slate-800/90 bg-[#080E1A]/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-200 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Hospital Trauma &amp; Resuscitation Wing
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-emerald-400">Cleared</span>
              <span>·</span>
              <span className="text-cyan-300">Active</span>
              <span>·</span>
              <span className="text-slate-500">Locked</span>
            </div>
          </div>

          {/* Interactive SVG + Node Canvas */}
          <div className="relative flex-1 min-h-[380px] p-6">
            {/* SVG Progression Path Lines */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {positionedNodes.slice(0, -1).map((curr, idx) => {
                const next = positionedNodes[idx + 1];
                const nextUnlocked =
                  progression.missionUnlocks[next.scenario.id]?.unlocked ?? true;
                return (
                  <g key={`${curr.scenario.id}-${next.scenario.id}`}>
                    <line
                      x1={curr.xPct}
                      y1={curr.yPct}
                      x2={next.xPct}
                      y2={next.yPct}
                      stroke={nextUnlocked ? '#06b6d4' : '#1e293b'}
                      strokeWidth="0.7"
                      strokeDasharray={nextUnlocked ? undefined : '2 2'}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Interactive Mission Nodes */}
            {positionedNodes.map((node) => {
              const scen = node.scenario;
              const pb = progression.personalBests[scen.id];
              const unlock = progression.missionUnlocks[scen.id];
              const isLocked = Boolean(unlock && !unlock.unlocked);
              const isSelected = selectedScenario.id === scen.id;
              const isCompleted = Boolean(pb && pb.attempts > 0);
              const hasCrit = pb?.bestRating === 'CRITICAL_REVIEW';

              return (
                <motion.button
                  key={scen.id}
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setSelectedId(scen.id)}
                  style={{
                    left: `${node.xPct}%`,
                    top: `${node.yPct}%`,
                  }}
                  title={`${scen.title} · ${scen.difficulty} · +${
                    unlock?.xpRewardEstimate || 240
                  } XP`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-40 sm:w-44 rounded-xl border text-left overflow-hidden transition-colors shadow-xl ${
                    isSelected
                      ? 'bg-[#0D182C] border-cyan-400 z-20'
                      : isLocked
                      ? 'bg-[#080D18]/90 border-slate-800 opacity-75 z-10'
                      : 'bg-[#091120]/95 border-slate-700 hover:border-cyan-500/70 z-10'
                  }`}
                >
                  <div className="relative h-20 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={getScenarioVisual(scen)}
                      alt={scen.title}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-cover ${
                        isLocked ? 'grayscale opacity-45' : 'opacity-85'
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#091120] via-black/30 to-transparent" />
                    <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-mono tabular-nums">
                      <span className="text-slate-200 font-semibold">
                        0{node.index + 1}
                      </span>
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      ) : isCompleted ? (
                        <span
                          className={
                            hasCrit
                              ? 'text-red-400 font-bold'
                              : 'text-emerald-400 font-bold'
                          }
                        >
                          {hasCrit ? 'REVIEW' : `${pb?.bestRating}-RANK`}
                        </span>
                      ) : (
                        <span className="text-cyan-300">
                          +{unlock?.xpRewardEstimate || 240} XP
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 space-y-1">
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {scen.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {scen.difficulty} · {scen.patientCount} Pt ·{' '}
                      {Math.round(scen.durationLimitSec / 60)}m
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Bottom Sector Quick Selector Strip */}
          <div className="relative z-10 px-5 py-3 border-t border-slate-800/90 bg-[#080E1A] flex items-center justify-between gap-3 text-xs text-slate-400">
            <span className="truncate">
              Selected:{' '}
              <strong className="text-slate-100">{selectedScenario.title}</strong>
            </span>
            <span className="font-mono tabular-nums text-cyan-300 shrink-0">
              {Object.keys(progression.personalBests).length}/
              {activeScenarios.length} Sectors Cleared
            </span>
          </div>
        </div>

        {/* RIGHT: Visual Mission Briefing & Launch Panel */}
        <div className="lg:col-span-5 rounded-xl bg-[#0B1220] border border-slate-800 flex flex-col justify-between overflow-hidden">
          <div>
            {/* Environment Preview Header */}
            <div className="relative h-48 bg-slate-900 overflow-hidden">
              <img
                src={getScenarioVisual(selectedScenario)}
                alt={selectedScenario.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/35 to-transparent" />
              <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-cyan-300">
                    {selectedScenario.code} · {selectedScenario.difficulty}
                  </div>
                  <h2 className="text-xl font-bold text-white truncate mt-0.5">
                    {selectedScenario.title}
                  </h2>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Visual Telemetry Tiles (Zero Paragraphs) */}
              <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
                <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                  <div className="text-[10px] font-sans text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-cyan-400" /> Reward
                  </div>
                  <div className="text-sm font-bold text-cyan-300 mt-0.5">
                    +{selUnlock?.xpRewardEstimate || 240} XP
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                  <div className="text-[10px] font-sans text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Limit
                  </div>
                  <div className="text-sm font-bold text-slate-100 mt-0.5">
                    {Math.round(selectedScenario.durationLimitSec / 60)}m 00s
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                  <div className="text-[10px] font-sans text-slate-400 flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-400" /> Casualties
                  </div>
                  <div className="text-sm font-bold text-slate-100 mt-0.5">
                    {selectedScenario.patientCount} Bay
                    {selectedScenario.patientCount > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Personal Best Record */}
              <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-slate-300">Personal Best</span>
                </div>
                {selPb ? (
                  <div className="font-mono tabular-nums flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {selPb.bestScore}/100
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">
                      {selPb.fastestCompletionSec}s
                    </span>
                    <span className="text-slate-600">·</span>
                    <span
                      className={
                        selPb.bestRating === 'CRITICAL_REVIEW'
                          ? 'text-red-400 font-bold'
                          : 'text-emerald-400 font-bold'
                      }
                    >
                      {selPb.bestRating === 'CRITICAL_REVIEW'
                        ? 'REVIEW'
                        : `${selPb.bestRating}-RANK`}
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-slate-500">Unattempted</span>
                )}
              </div>

              {/* Concise Actionable Objectives */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Mission Objectives</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {selectedScenario.expectedActions.length} Checkpoints
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedScenario.expectedActions.slice(0, 4).map((step, i) => (
                    <div
                      key={step.stepId}
                      className="px-3 py-2 rounded-lg bg-[#070B14] border border-slate-800/90 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-slate-200 truncate">
                        <span className="font-mono text-cyan-400 mr-2">
                          0{i + 1}.
                        </span>
                        {step.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">
                        &le;{step.targetWindowSec}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipped Kit Summary + Expandable Protocol Notes */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>
                  Kit: <strong className="text-slate-200">{equippedKit.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowProtocolDetail((v) => !v)}
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-medium"
                >
                  {showProtocolDetail ? 'Hide Briefing' : 'Dispatch Details'}
                  {showProtocolDetail ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {showProtocolDetail && (
                <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800 space-y-2 text-xs text-slate-300">
                  <p className="leading-relaxed">{selectedScenario.briefing}</p>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300/90 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{selectedScenario.educationalRuleNote}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Primary Launch Bar */}
          <div className="p-5 border-t border-slate-800 bg-[#080E1A] space-y-2.5">
            {selLocked ? (
              <div className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-300 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>{selUnlock?.unlockRequirementText}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onLaunchScenario(selectedScenario.id)}
                className="w-full py-3.5 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Mission
              </button>
            )}

            {currentUser.role !== 'trainee' && (
              <button
                type="button"
                onClick={() => onEditScenarioInStudio(selectedScenario.id)}
                className="w-full py-2 px-4 rounded-lg bg-[#070B14] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Configure in Scenario Studio
              </button>
            )}

            {selPb?.bestRating === 'CRITICAL_REVIEW' && (
              <div className="text-[11px] text-red-300 flex items-center justify-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>Prior run flagged a critical safety violation</span>
              </div>
            )}
            {selPb && selPb.bestRating !== 'CRITICAL_REVIEW' && (
              <div className="text-[11px] text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Cleared with zero critical errors</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

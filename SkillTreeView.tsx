import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  HeartPulse,
  Lock,
  Play,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import {
  computePlayerProgression,
  SkillTreeNode,
} from '../engine/progressionEngine';
import type {
  DrillAttemptRecord,
  NavSection,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

interface SkillTreeViewProps {
  currentUser: UserAccount;
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  drills: DrillAttemptRecord[];
  onNavigate: (section: NavSection) => void;
  onLaunchScenario: (scenarioId: string) => void;
}

const BRANCH_META = [
  {
    id: 'resuscitation' as const,
    title: 'Cardiac Resuscitation',
    icon: HeartPulse,
    accent: 'text-cyan-400',
  },
  {
    id: 'triage' as const,
    title: 'Surge Triage Command',
    icon: Users,
    accent: 'text-amber-400',
  },
  {
    id: 'diagnostics' as const,
    title: 'Rapid Diagnostics',
    icon: Cpu,
    accent: 'text-sky-400',
  },
  {
    id: 'crisis' as const,
    title: 'Crisis Stabilization',
    icon: ShieldCheck,
    accent: 'text-emerald-400',
  },
];

export const SkillTreeView: React.FC<SkillTreeViewProps> = ({
  currentUser,
  scenarios,
  sessions,
  drills,
  onNavigate,
  onLaunchScenario,
}) => {
  const progression = useMemo(
    () => computePlayerProgression(currentUser, sessions, scenarios, drills),
    [currentUser, sessions, scenarios, drills]
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string>('st_resus_1');

  const selectedNode: SkillTreeNode =
    progression.skillTree.find((n) => n.id === selectedNodeId) ||
    progression.skillTree[0];

  const unlockedCount = progression.skillTree.filter((n) => n.unlocked).length;

  return (
    <div className="p-5 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-cyan-400 font-medium">
            Responder Competency Matrix · {unlockedCount}/
            {progression.skillTree.length} Nodes Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Clinical Skill Tree
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300">
          <span>LVL {progression.level}</span>
          <span className="text-slate-600">·</span>
          <span className="text-cyan-300">{progression.totalXp} XP</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400">
            {progression.cleanSafetyStreak} Clean Streak
          </span>
        </div>
      </div>

      {/* Main Split: 4-Branch Connected Node Tree (8 cols) · Selected Node Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {BRANCH_META.map((branch) => {
            const Icon = branch.icon;
            const nodes = progression.skillTree
              .filter((n) => n.branchId === branch.id)
              .sort((a, b) => a.tier - b.tier);
            const trackSummary = progression.skills.find(
              (s) =>
                s.id === branch.id ||
                (branch.id === 'diagnostics' && s.id === 'speed') ||
                (branch.id === 'crisis' && s.id === 'safety')
            );

            return (
              <div
                key={branch.id}
                className="rounded-xl bg-[#0B1220] border border-slate-800 p-4 flex flex-col items-center space-y-3"
              >
                {/* Branch Header */}
                <div className="w-full pb-3 border-b border-slate-800 text-center space-y-1">
                  <Icon className={`w-5 h-5 mx-auto ${branch.accent}`} />
                  <div className="text-xs font-bold text-slate-100">
                    {branch.title}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400">
                    Tier {trackSummary?.level || 1}/5 ·{' '}
                    {trackSummary?.scorePct || 0}%
                  </div>
                </div>

                {/* Connected Vertical Node Chain */}
                <div className="w-full flex flex-col items-center py-2">
                  {nodes.map((node, idx) => {
                    const isSelected = selectedNode.id === node.id;
                    return (
                      <React.Fragment key={node.id}>
                        {idx > 0 && (
                          <div
                            className={`w-0.5 h-7 ${
                              node.unlocked ? 'bg-cyan-400' : 'bg-slate-800'
                            }`}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          title={`${node.title} — ${node.requirementLabel}`}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-[#0D1A30] border-cyan-400 shadow-lg'
                              : node.unlocked
                              ? 'bg-[#070B14] border-cyan-500/45 hover:border-cyan-400'
                              : 'bg-[#070B14]/70 border-slate-800 hover:border-slate-700 opacity-80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                            <span className="text-slate-400">
                              TIER {node.tier}
                            </span>
                            {node.unlocked ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-100 mt-1">
                            {node.title}
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden mt-2">
                            <div
                              className={`h-full transition-transform duration-200 origin-left ${
                                node.unlocked ? 'bg-cyan-400' : 'bg-slate-600'
                              }`}
                              style={{
                                transform: `scaleX(${Math.max(
                                  0.05,
                                  node.progressPct / 100
                                )})`,
                              }}
                            />
                          </div>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Node Inspector */}
        <div className="lg:col-span-4 rounded-xl bg-[#0B1220] border border-slate-800 p-5 space-y-5">
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-cyan-400">
              {selectedNode.branchName.toUpperCase()} · TIER {selectedNode.tier}
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              {selectedNode.title}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedNode.shortDesc}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Unlock Condition</span>
              <span
                className={`font-mono font-bold ${
                  selectedNode.unlocked ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {selectedNode.unlocked
                  ? 'UNLOCKED'
                  : `${selectedNode.progressPct}%`}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-200">
              {selectedNode.requirementLabel}
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full origin-left transition-transform duration-200 ${
                  selectedNode.unlocked ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}
                style={{
                  transform: `scaleX(${Math.max(
                    0.05,
                    selectedNode.progressPct / 100
                  )})`,
                }}
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {selectedNode.practiceTarget === 'training' ? (
              <button
                type="button"
                onClick={() => onNavigate('training')}
                className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Practice in Challenge Arena
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onLaunchScenario(
                    selectedNode.branchId === 'triage'
                      ? scenarios.find((s) => s.mode === 'multi_patient_triage')
                          ?.id || 'scen_triage_01'
                      : scenarios[0]?.id || 'scen_cardiac_01'
                  )
                }
                className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4 fill-current" />
                Deploy Matching 3D Mission
              </button>
            )}

            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Powered strictly by verified mission &amp; drill telemetry</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

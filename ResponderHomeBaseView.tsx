import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Lock,
  MapPin,
  Package,
  Play,
  ShieldAlert,
  Sliders,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  calculateSessionXp,
  computePlayerProgression,
  EQUIPMENT_KIT_PRESETS,
  UNIFORM_PRESETS,
} from '../engine/progressionEngine';
import type {
  DrillAttemptRecord,
  NavSection,
  PlatformSettings,
  ResponderCustomization,
  ResponderUniformId,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';
import { getScenarioVisual } from '../utils/scenarioVisuals';
import { ResponderAvatarCanvas } from './simulation3d/ResponderAvatarCanvas';

interface ResponderHomeBaseViewProps {
  currentUser: UserAccount;
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  drills: DrillAttemptRecord[];
  settings: PlatformSettings;
  onLaunchScenario: (scenarioId: string) => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
  onUpdateUser: (updated: UserAccount) => void;
}

export const ResponderHomeBaseView: React.FC<ResponderHomeBaseViewProps> = ({
  currentUser,
  scenarios,
  sessions,
  drills,
  settings,
  onLaunchScenario,
  onNavigate,
  onUpdateUser,
}) => {
  const activeScenarios = useMemo(
    () => scenarios.filter((s) => !s.archived),
    [scenarios]
  );

  const progression = useMemo(
    () =>
      computePlayerProgression(currentUser, sessions, activeScenarios, drills),
    [currentUser, sessions, activeScenarios, drills]
  );

  const recommendedInitialId = useMemo(() => {
    const nextUnplayed = activeScenarios.find((s) => {
      const u = progression.missionUnlocks[s.id];
      const pb = progression.personalBests[s.id];
      return (!u || u.unlocked) && !pb;
    });
    return nextUnplayed?.id || activeScenarios[0]?.id || 'scen_cardiac_01';
  }, [activeScenarios, progression]);

  const [selectedMissionId, setSelectedMissionId] =
    useState<string>(recommendedInitialId);

  const selectedMission =
    activeScenarios.find((s) => s.id === selectedMissionId) ||
    activeScenarios[0];

  const recentUserSessions = useMemo(
    () =>
      sessions
        .filter(
          (s) => s.traineeId === currentUser.id && s.status === 'completed'
        )
        .sort(
          (a, b) =>
            new Date(b.completedAt || b.startedAt).getTime() -
            new Date(a.completedAt || a.startedAt).getTime()
        )
        .slice(0, 4),
    [sessions, currentUser.id]
  );

  const updateResponderProfile = (patch: Partial<ResponderCustomization>) => {
    onUpdateUser({
      ...currentUser,
      responderProfile: {
        ...progression.responderProfile,
        ...patch,
      },
    });
  };

  const unlockedBadges = progression.achievements.filter((a) => a.unlocked);
  const activeKit =
    EQUIPMENT_KIT_PRESETS[
      progression.responderProfile.primaryKit || 'aed_rapid'
    ];

  return (
    <div className="p-5 lg:p-8 max-w-[1420px] mx-auto space-y-6">
      {/* HERO GAME STAGE: Large 3D Character Showcase + Active Mission + ENTER MISSION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT (5 cols): 3D Responder Showcase + Level/XP + Quick Suit Swatches */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0B1220] border border-slate-800 flex flex-col justify-between overflow-hidden">
          {/* Character Top Strip */}
          <div className="px-5 py-3.5 border-b border-slate-800/90 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-mono text-cyan-400">
                {progression.responderProfile.callsign} · {progression.rankTitle}
              </div>
              <div className="text-base font-bold text-white truncate">
                {currentUser.name}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('loadout')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Sliders className="w-3.5 h-3.5" />
              Loadout Studio
            </button>
          </div>

          {/* Tall Interactive 3D Character Viewport */}
          <div className="relative h-[350px] sm:h-[380px] w-full bg-[#070B14]">
            <ResponderAvatarCanvas
              profile={progression.responderProfile}
              level={progression.level}
              reducedMotion={settings.reducedMotion}
            />

            {/* Floating Level Emblem */}
            <div className="absolute top-3 left-3 bg-[#0B1220]/92 border border-cyan-500/40 rounded-xl px-3 py-2 font-mono tabular-nums pointer-events-none">
              <div className="text-[10px] text-slate-400">LEVEL</div>
              <div className="text-2xl font-bold text-cyan-300 leading-none">
                {progression.level}
              </div>
            </div>

            {/* Active Streaks & Safety Indicator */}
            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none font-mono tabular-nums text-[11px]">
              <div
                className="bg-[#0B1220]/92 border border-slate-800 rounded-lg px-2.5 py-1 text-amber-300 flex items-center gap-1"
                title="Active Training Streak"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                {progression.activeDayStreak}d Streak
              </div>
              <div
                className={`bg-[#0B1220]/92 border rounded-lg px-2.5 py-1 flex items-center gap-1 ${
                  progression.totalCriticalErrors > 0
                    ? 'border-red-500/60 text-red-300'
                    : 'border-emerald-500/50 text-emerald-300'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {progression.totalCriticalErrors} Criticals
              </div>
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] pointer-events-none">
              <span className="bg-[#0B1220]/92 border border-slate-800 px-2.5 py-1 rounded text-slate-200 inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-cyan-400" />
                {activeKit.name}
              </span>
              <span className="bg-[#0B1220]/92 border border-slate-800 px-2.5 py-1 rounded text-slate-400">
                Drag 360°
              </span>
            </div>
          </div>

          {/* XP Bar & Quick Suit Selector Footer */}
          <div className="p-4 bg-[#080E1A] border-t border-slate-800 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-200 font-semibold">
                  {progression.totalXp} / {progression.nextLevelTargetXp} XP
                </span>
                <span className="text-cyan-300">
                  {progression.levelProgressPct}% → LVL {progression.level + 1}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#070B14] border border-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-transform duration-200 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(
                      0.04,
                      progression.levelProgressPct / 100
                    )})`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">Quick Suit:</span>
              <div className="flex items-center gap-1.5">
                {(Object.keys(UNIFORM_PRESETS) as ResponderUniformId[]).map(
                  (uid) => {
                    const u = UNIFORM_PRESETS[uid];
                    const active =
                      progression.responderProfile.uniformId === uid;
                    return (
                      <button
                        key={uid}
                        type="button"
                        title={u.name}
                        onClick={() => updateResponderProfile({ uniformId: uid })}
                        className={`w-6 h-6 rounded-md border transition-transform ${
                          active
                            ? 'border-cyan-300 scale-110'
                            : 'border-slate-700 opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: u.primaryColor }}
                      />
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (7 cols): Current Mission Spotlight + ENTER MISSION + Connected Sector Map + Daily Challenges */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-5">
          {/* Active Mission Launch Card */}
          {selectedMission && (
            <div className="rounded-2xl bg-[#0B1220] border border-slate-800 overflow-hidden grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-5 relative min-h-[210px] bg-slate-900">
                <img
                  src={getScenarioVisual(selectedMission)}
                  alt={selectedMission.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-black/30 to-transparent" />
                <div className="absolute top-3 left-3 text-[11px] font-mono px-2.5 py-1 rounded bg-[#070B14]/90 border border-slate-800 text-cyan-300">
                  {selectedMission.code} · {selectedMission.difficulty}
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-mono text-slate-200">
                  <span>
                    {Math.round(selectedMission.durationLimitSec / 60)}m Limit
                  </span>
                  <span className="text-cyan-300 font-bold">
                    +
                    {progression.missionUnlocks[selectedMission.id]
                      ?.xpRewardEstimate || 240}{' '}
                    XP
                  </span>
                </div>
              </div>

              <div className="md:col-span-7 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-400">SELECTED MISSION</span>
                    <span className="text-slate-300">
                      {progression.personalBests[selectedMission.id]
                        ? `BEST: ${
                            progression.personalBests[selectedMission.id]
                              .bestScore
                          }/100 (${
                            progression.personalBests[selectedMission.id]
                              .bestRating
                          })`
                        : 'NEW SECTOR'}
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {selectedMission.title}
                  </h1>

                  {/* Concise 2-item visual objective tags instead of paragraphs */}
                  <div className="space-y-1 pt-1">
                    {selectedMission.expectedActions.slice(0, 3).map((st) => (
                      <div
                        key={st.stepId}
                        className="text-xs text-slate-300 flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        <span className="truncate">{st.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PROMINENT PRIMARY ACTION: ENTER MISSION */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => onLaunchScenario(selectedMission.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-bold tracking-tight transition-colors whitespace-nowrap shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {progression.missionsCompleted > 0
                      ? 'Enter Mission · Continue Training'
                      : 'Enter Mission'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('training')}
                    className="px-4 py-3.5 rounded-xl bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap"
                  >
                    Skill Drills
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Connected Sector Mission Map Strip */}
          <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
                Sector Mission Progression
              </div>
              <button
                type="button"
                onClick={() => onNavigate('missions')}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                Full Mission Map <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {activeScenarios.slice(0, 4).map((scen, idx) => {
                const pb = progression.personalBests[scen.id];
                const unlock = progression.missionUnlocks[scen.id];
                const locked = unlock && !unlock.unlocked;
                const selected = selectedMission?.id === scen.id;

                return (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => setSelectedMissionId(scen.id)}
                    className={`p-3 rounded-xl border text-left transition-colors relative ${
                      selected
                        ? 'bg-cyan-950/45 border-cyan-400'
                        : locked
                        ? 'bg-[#070B14]/60 border-slate-800 opacity-70'
                        : 'bg-[#070B14] hover:bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-cyan-400 font-bold">0{idx + 1}</span>
                      {locked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      ) : pb ? (
                        <span
                          className={
                            pb.bestRating === 'CRITICAL_REVIEW'
                              ? 'text-red-400 font-bold'
                              : 'text-emerald-400 font-bold'
                          }
                        >
                          {pb.bestRating === 'CRITICAL_REVIEW'
                            ? 'REV'
                            : pb.bestRating}
                        </span>
                      ) : (
                        <span className="text-slate-500">OPEN</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-100 truncate mt-1">
                      {scen.title}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      +{unlock?.xpRewardEstimate || 240} XP
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Training Challenges Strip */}
          <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                Daily Training Challenges
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {
                  progression.dailyChallenges.filter((d) => d.completed)
                    .length
                }
                /{progression.dailyChallenges.length} Complete
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {progression.dailyChallenges.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    if (ch.scenarioId) {
                      onLaunchScenario(ch.scenarioId);
                    } else {
                      onNavigate(ch.actionSection);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors flex flex-col justify-between gap-2 ${
                    ch.completed
                      ? 'bg-emerald-950/30 border-emerald-500/50'
                      : 'bg-[#070B14] hover:border-cyan-400/60 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                      <span className="text-cyan-300 font-bold">
                        +{ch.xpReward} XP
                      </span>
                      {ch.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <span className="text-slate-400">
                          {ch.current}/{ch.target}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-100 mt-1 line-clamp-1">
                      {ch.title}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">
                      {ch.subtitle}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full origin-left transition-transform ${
                        ch.completed ? 'bg-emerald-400' : 'bg-cyan-400'
                      }`}
                      style={{
                        transform: `scaleX(${Math.min(
                          1,
                          Math.max(0.06, ch.current / Math.max(1, ch.target))
                        )})`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM PROGRESSION ROW: Skill Progression · Achievement Showcase · Recent Missions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Skill Progression (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0B1220] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Skill Progression
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('skill-tree')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Skill Tree →
            </button>
          </div>

          <div className="space-y-3">
            {progression.skills.map((sk) => (
              <div key={sk.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{sk.name}</span>
                  <span className="font-mono tabular-nums text-cyan-300">
                    T{sk.level} · {sk.scorePct}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#070B14] border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 origin-left transition-transform"
                    style={{
                      transform: `scaleX(${Math.max(0.05, sk.scorePct / 100)})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievement Showcase (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0B1220] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Achievements ({unlockedBadges.length}/
              {progression.achievements.length})
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('achievements')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              All Badges →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {progression.achievements.slice(0, 4).map((ach) => (
              <button
                key={ach.id}
                type="button"
                title={ach.description}
                onClick={() => onNavigate('achievements')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  ach.unlocked
                    ? 'bg-[#070B14] border-cyan-500/40'
                    : 'bg-[#070B14]/60 border-slate-800 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Award
                    className={`w-4 h-4 ${
                      ach.unlocked ? 'text-cyan-400' : 'text-slate-600'
                    }`}
                  />
                  <span className="text-[10px] font-mono text-cyan-300">
                    {ach.progressText}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-100 truncate mt-1.5">
                  {ach.title}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recently Completed Missions (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0B1220] border border-slate-800 p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Recent Missions
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('mission-records')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Records →
            </button>
          </div>

          {recentUserSessions.length === 0 ? (
            <div className="p-5 rounded-xl bg-[#070B14] border border-slate-800 text-center text-xs text-slate-400">
              Launch your first 3D mission to log ratings &amp; XP.
            </div>
          ) : (
            <div className="space-y-2">
              {recentUserSessions.slice(0, 3).map((sess) => {
                const xp = calculateSessionXp(sess);
                const crits = sess.assessment?.criticalErrorsCount ?? 0;
                return (
                  <button
                    key={sess.id}
                    type="button"
                    onClick={() => onNavigate('mission-records', sess.id)}
                    className="w-full p-2.5 rounded-xl bg-[#070B14] hover:bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {sess.scenarioTitle}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{sess.durationSec}s</span>
                        <span>·</span>
                        <span className="text-cyan-300">+{xp.totalXp} XP</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold shrink-0 ${
                        crits > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {crits > 0 ? `${crits} CRIT` : xp.rating}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

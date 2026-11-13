import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flame,
  Lock,
  Medal,
  ShieldAlert,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  AchievementBadge,
  computePlayerProgression,
  computeResponderLeaderboard,
} from '../engine/progressionEngine';
import type {
  DrillAttemptRecord,
  NavSection,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

interface AchievementsViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  drills: DrillAttemptRecord[];
  onNavigate: (section: NavSection) => void;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  currentUser,
  users,
  scenarios,
  sessions,
  drills,
  onNavigate,
}) => {
  const progression = useMemo(
    () => computePlayerProgression(currentUser, sessions, scenarios, drills),
    [currentUser, sessions, scenarios, drills]
  );

  const leaderboard = useMemo(
    () =>
      computeResponderLeaderboard(
        users,
        sessions,
        scenarios,
        drills,
        currentUser.id
      ),
    [users, sessions, scenarios, drills, currentUser.id]
  );

  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | AchievementBadge['category']
  >('ALL');

  const filteredBadges = useMemo(
    () =>
      categoryFilter === 'ALL'
        ? progression.achievements
        : progression.achievements.filter((a) => a.category === categoryFilter),
    [progression.achievements, categoryFilter]
  );

  const unlockedCount = progression.achievements.filter(
    (a) => a.unlocked
  ).length;

  return (
    <div className="p-5 lg:p-8 max-w-[1440px] mx-auto space-y-8">
      {/* Header & Top Streak/Milestone Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-cyan-400 font-medium">
            Service Commendations &amp; Cohort Standings
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Achievements &amp; Leaderboard
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
            <Trophy className="w-4 h-4" />
            {unlockedCount}/{progression.achievements.length} Unlocked
          </span>
          <span className="text-slate-600">·</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
            <Flame className="w-4 h-4" />
            {progression.cleanSafetyStreak} Zero-Harm Streak
          </span>
        </div>
      </div>

      {/* Progress Milestones Track */}
      <section className="rounded-xl bg-[#0B1220] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-100">
            Responder Career Milestones
          </span>
          <span className="font-mono tabular-nums text-cyan-300">
            {progression.totalXp} Total XP
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {progression.milestones.map((ms, idx) => (
            <div
              key={ms.id}
              className={`p-3.5 rounded-xl border space-y-1.5 ${
                ms.reached
                  ? 'bg-[#082f49]/40 border-cyan-500/50'
                  : 'bg-[#070B14] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <span className="text-slate-400">0{idx + 1}. {ms.targetXp} XP</span>
                {ms.reached ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                )}
              </div>
              <div className="text-xs font-bold text-slate-100">{ms.title}</div>
              <div className="text-[11px] text-cyan-300/90 truncate">
                {ms.rewardLabel}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Split: Collectible Badges (7 cols) · Cohort Responder Leaderboard (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Collectible Achievements */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-100">
              Collectible Badges
            </h2>
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0B1220] border border-slate-800">
              {(
                [
                  'ALL',
                  'Resuscitation',
                  'Triage',
                  'Safety',
                  'Tempo',
                  'Mastery',
                ] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'bg-cyan-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredBadges.map((ach) => {
              const pct = Math.min(
                100,
                Math.round((ach.currentValue / Math.max(1, ach.targetValue)) * 100)
              );
              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-colors ${
                    ach.unlocked
                      ? 'bg-[#0B1220] border-cyan-500/50'
                      : 'bg-[#0B1220]/65 border-slate-800 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                          ach.unlocked
                            ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300'
                            : 'bg-[#070B14] border-slate-800 text-slate-600'
                        }`}
                      >
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate">
                          {ach.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {ach.description}
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-[11px] text-cyan-300 shrink-0">
                      +{ach.xpBonus} XP
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                      <span>{ach.category}</span>
                      <span
                        className={
                          ach.unlocked ? 'text-emerald-400 font-bold' : ''
                        }
                      >
                        {ach.progressText}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#070B14] overflow-hidden">
                      <div
                        className={`h-full origin-left transition-transform duration-200 ${
                          ach.unlocked ? 'bg-emerald-400' : 'bg-cyan-400'
                        }`}
                        style={{
                          transform: `scaleX(${Math.max(0.05, pct / 100)})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Responder Leaderboard (With Unconcealed Critical Error Column) */}
        <div className="lg:col-span-5 rounded-xl bg-[#0B1220] border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-400" />
              Responder Standings
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('training')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5" /> Earn XP
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {leaderboard.map((row, idx) => (
              <div
                key={row.userId}
                className={`px-5 py-3.5 flex items-center justify-between gap-3 ${
                  row.isCurrentUser ? 'bg-[#082f49]/35' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 text-center font-mono text-xs font-bold shrink-0 ${
                      idx === 0
                        ? 'text-amber-300'
                        : idx === 1
                        ? 'text-slate-200'
                        : idx === 2
                        ? 'text-amber-500'
                        : 'text-slate-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {row.name}
                      {row.isCurrentUser && (
                        <span className="ml-1.5 text-[10px] font-mono text-cyan-300">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                      {row.callsign} · LVL {row.level} · Avg {row.avgScore}/100
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-xs font-bold text-cyan-300">
                    {row.totalXp} XP
                  </div>
                  <div className="text-[10px] flex items-center justify-end gap-1 mt-0.5">
                    {row.totalCriticalErrors > 0 ? (
                      <span className="text-red-400 inline-flex items-center gap-0.5">
                        <ShieldAlert className="w-3 h-3" />
                        {row.totalCriticalErrors} Crit
                      </span>
                    ) : (
                      <span className="text-emerald-400">
                        {row.cleanSafetyStreak} Clean
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

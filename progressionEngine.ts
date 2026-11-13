import type {
  DifficultyLevel,
  DrillAttemptRecord,
  MissionRating,
  NavSection,
  ResponderCustomization,
  ResponderEquipmentKitId,
  ResponderUniformId,
  ResponderVisorStyle,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation.ts';

export interface UniformPreset {
  id: ResponderUniformId;
  name: string;
  shortTag: string;
  primaryColor: string;
  secondaryColor: string;
  trimColor: string;
  defaultGloveColor: string;
}

export const UNIFORM_PRESETS: Record<ResponderUniformId, UniformPreset> = {
  trauma_navy: {
    id: 'trauma_navy',
    name: 'Emergency Trauma Scrubs',
    shortTag: 'Navy Resuscitation Scrubs',
    primaryColor: '#1b3b5f',
    secondaryColor: '#12263f',
    trimColor: '#38bdf8',
    defaultGloveColor: '#0ea5e9',
  },
  flight_cyan: {
    id: 'flight_cyan',
    name: 'Surgical Ceil Scrubs',
    shortTag: 'Acute Care Clinical Set',
    primaryColor: '#1f6f8b',
    secondaryColor: '#164e63',
    trimColor: '#e2e8f0',
    defaultGloveColor: '#38bdf8',
  },
  hazmat_amber: {
    id: 'hazmat_amber',
    name: 'Triage Surge Uniform',
    shortTag: 'Scrubs + Reflective Vest',
    primaryColor: '#29394d',
    secondaryColor: '#192434',
    trimColor: '#f59e0b',
    defaultGloveColor: '#22d3ee',
  },
  tactical_slate: {
    id: 'tactical_slate',
    name: 'EMS Field Responder',
    shortTag: 'Pre-Hospital Paramedic Set',
    primaryColor: '#1e2f44',
    secondaryColor: '#111b29',
    trimColor: '#10b981',
    defaultGloveColor: '#cbd5e1',
  },
};

export interface EquipmentKitPreset {
  id: ResponderEquipmentKitId;
  name: string;
  shortBenefit: string;
  bagColor: string;
  accentColor: string;
}

export const EQUIPMENT_KIT_PRESETS: Record<
  ResponderEquipmentKitId,
  EquipmentKitPreset
> = {
  aed_rapid: {
    id: 'aed_rapid',
    name: 'Rapid Defib & Airway Kit',
    shortBenefit: 'AED Pads · BVM · Stethoscope',
    bagColor: '#ea580c',
    accentColor: '#38bdf8',
  },
  hemorrhage_pack: {
    id: 'hemorrhage_pack',
    name: 'Arterial Hemorrhage Pack',
    shortBenefit: 'CAT Tourniquets · Trauma Dressings',
    bagColor: '#b91c1c',
    accentColor: '#f59e0b',
  },
  airway_oxygen: {
    id: 'airway_oxygen',
    name: 'High-Flow Oxygen & Telemetry',
    shortBenefit: 'Portable O2 · Pulse Oximetry',
    bagColor: '#047857',
    accentColor: '#22d3ee',
  },
};

export const SKIN_TONE_SWATCHES = [
  { id: 'tone_1', label: 'Warm Sand', hex: '#f1c6a7' },
  { id: 'tone_2', label: 'Golden Olive', hex: '#e2b093' },
  { id: 'tone_3', label: 'Rich Amber', hex: '#b97c56' },
  { id: 'tone_4', label: 'Deep Espresso', hex: '#6f452c' },
];

export const VISOR_STYLE_PRESETS: Array<{
  id: ResponderVisorStyle;
  name: string;
  subtitle: string;
}> = [
  {
    id: 'safety_glasses',
    name: 'Clinical Safety Glasses',
    subtitle: 'Clear wraparound splash lenses',
  },
  {
    id: 'clear_shield',
    name: 'Anti-Fog Face Shield',
    subtitle: 'Full-width sterile visor',
  },
  {
    id: 'surgical_cap',
    name: 'Sterile Scrub Cap',
    subtitle: 'Fitted clinical bouffant cap',
  },
  {
    id: 'none',
    name: 'Standard Uncovered',
    subtitle: 'No eye shield or scrub cap',
  },
];

export interface XpBreakdown {
  baseScoreXp: number;
  proceduralBonusXp: number;
  speedBonusXp: number;
  zeroCriticalBonusXp: number;
  difficultyMultiplier: number;
  totalXp: number;
  rating: MissionRating;
  ratingLabel: string;
  hasCriticalSafetyAlert: boolean;
}

export interface SkillTrackProgress {
  id: string;
  name: string;
  level: number;
  scorePct: number;
  summary: string;
}

export interface SkillTreeNode {
  id: string;
  branchId: 'resuscitation' | 'triage' | 'diagnostics' | 'crisis';
  branchName: string;
  tier: 1 | 2 | 3;
  title: string;
  shortDesc: string;
  requirementLabel: string;
  progressPct: number;
  unlocked: boolean;
  parentId: string | null;
  practiceTarget: NavSection;
}

export interface AchievementBadge {
  id: string;
  category: 'Resuscitation' | 'Triage' | 'Safety' | 'Tempo' | 'Mastery';
  title: string;
  description: string;
  unlocked: boolean;
  currentValue: number;
  targetValue: number;
  progressText: string;
  xpBonus: number;
}

export interface DailyChallengeItem {
  id: string;
  title: string;
  subtitle: string;
  xpReward: number;
  current: number;
  target: number;
  completed: boolean;
  actionSection: NavSection;
  scenarioId?: string;
}

export interface MilestoneItem {
  id: string;
  title: string;
  targetXp: number;
  reached: boolean;
  rewardLabel: string;
}

export interface ScenarioPersonalBest {
  scenarioId: string;
  attempts: number;
  bestScore: number;
  bestRating: MissionRating;
  fastestCompletionSec: number | null;
  lowestCriticalErrors: number | null;
  lastPlayedAt: string | null;
}

export interface MissionUnlockInfo {
  scenarioId: string;
  unlocked: boolean;
  unlockRequirementText: string;
  recommendedLevel: number;
  xpRewardEstimate: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  callsign: string;
  cohort: string;
  level: number;
  rankTitle: string;
  totalXp: number;
  missionsCompleted: number;
  avgScore: number;
  cleanSafetyStreak: number;
  totalCriticalErrors: number;
  isCurrentUser: boolean;
}

export interface PlayerProgressionSummary {
  responderProfile: ResponderCustomization;
  level: number;
  rankTitle: string;
  totalXp: number;
  missionXp: number;
  drillXp: number;
  currentLevelFloorXp: number;
  nextLevelTargetXp: number;
  levelProgressPct: number;
  missionsCompleted: number;
  drillsCompleted: number;
  cleanSafetyStreak: number;
  activeDayStreak: number;
  totalCriticalErrors: number;
  avgOverallScore: number;
  skills: SkillTrackProgress[];
  skillTree: SkillTreeNode[];
  achievements: AchievementBadge[];
  dailyChallenges: DailyChallengeItem[];
  milestones: MilestoneItem[];
  personalBests: Record<string, ScenarioPersonalBest>;
  missionUnlocks: Record<string, MissionUnlockInfo>;
}

const RANK_THRESHOLDS: Array<{ level: number; minXp: number; title: string }> = [
  { level: 1, minXp: 0, title: 'Junior Responder' },
  { level: 2, minXp: 350, title: 'Acute Care Practitioner' },
  { level: 3, minXp: 850, title: 'Resuscitation Specialist' },
  { level: 4, minXp: 1500, title: 'Trauma Triage Lead' },
  { level: 5, minXp: 2350, title: 'Senior Incident Commander' },
  { level: 6, minXp: 3400, title: 'Chief Flight & Resuscitation Officer' },
];

export function getDefaultResponderProfile(
  user: UserAccount
): ResponderCustomization {
  const initials = (user.name || 'MED')
    .replace(/^Dr\.\s+/i, '')
    .split(/\s+/)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 3);
  const suffix = (user.id || '01').replace(/\D/g, '').slice(-2) || '01';
  const isTriageDept = /triage|trauma|paramedic/i.test(
    `${user.cohort || ''} ${user.department || ''}`
  );

  const fallback: ResponderCustomization = {
    callsign: `${initials || 'MED'}-${suffix.padStart(2, '0')}`,
    uniformId: isTriageDept ? 'flight_cyan' : 'trauma_navy',
    specialization: isTriageDept
      ? 'Field Trauma & Triage'
      : 'Resuscitation Specialist',
    gloveColor: isTriageDept ? '#38bdf8' : '#0ea5e9',
    skinTone: '#e2b093',
    visorStyle: 'safety_glasses',
    primaryKit: isTriageDept ? 'hemorrhage_pack' : 'aed_rapid',
    wearMask: false,
    wearVest: isTriageDept,
    wearGloves: true,
  };

  if (user.responderProfile) {
    return {
      ...fallback,
      ...user.responderProfile,
    };
  }
  return fallback;
}

function getDifficultyMultiplier(difficulty: DifficultyLevel): number {
  if (difficulty === 'High Acuity') return 1.45;
  if (difficulty === 'Intermediate') return 1.2;
  return 1.0;
}

/**
 * Deterministically computes XP and Mission Rating from a recorded TrainingSession.
 * STRICT RULE: Critical errors (`criticalErrorsCount > 0`) are NEVER concealed by XP
 * or high ratings — any session with a critical safety error receives `CRITICAL_REVIEW`.
 */
export function calculateSessionXp(session: TrainingSession): XpBreakdown {
  const assessment = session.assessment;
  if (!assessment || session.status !== 'completed') {
    return {
      baseScoreXp: 0,
      proceduralBonusXp: 0,
      speedBonusXp: 0,
      zeroCriticalBonusXp: 0,
      difficultyMultiplier: 1,
      totalXp: 0,
      rating: 'CRITICAL_REVIEW',
      ratingLabel: 'Incomplete',
      hasCriticalSafetyAlert: false,
    };
  }

  const mult = getDifficultyMultiplier(session.difficulty);
  const baseScoreXp = Math.round(assessment.overallScore * 1.8);
  const proceduralBonusXp = Math.round(assessment.proceduralAccuracy * 0.45);
  const speedBonusXp = Math.round(assessment.responseTimeScore * 0.35);
  const hasCriticalSafetyAlert = assessment.criticalErrorsCount > 0;

  const zeroCriticalBonusXp =
    !hasCriticalSafetyAlert && assessment.overallScore >= 70 ? 65 : 0;

  const rawXp =
    baseScoreXp + proceduralBonusXp + speedBonusXp + zeroCriticalBonusXp;
  const totalXp = Math.max(25, Math.round(rawXp * mult));

  let rating: MissionRating = 'C';
  let ratingLabel = 'Standard Clearance';

  if (hasCriticalSafetyAlert) {
    rating = 'CRITICAL_REVIEW';
    ratingLabel = `Safety Review (${assessment.criticalErrorsCount} Critical)`;
  } else if (assessment.overallScore >= 93) {
    rating = 'S';
    ratingLabel = 'Exemplary Mastery';
  } else if (assessment.overallScore >= 83) {
    rating = 'A';
    ratingLabel = 'High Readiness';
  } else if (assessment.overallScore >= 70) {
    rating = 'B';
    ratingLabel = 'Proficient Response';
  } else {
    rating = 'C';
    ratingLabel = 'Developing Readiness';
  }

  return {
    baseScoreXp,
    proceduralBonusXp,
    speedBonusXp,
    zeroCriticalBonusXp,
    difficultyMultiplier: mult,
    totalXp,
    rating,
    ratingLabel,
    hasCriticalSafetyAlert,
  };
}

export function computePlayerProgression(
  user: UserAccount,
  allSessions: TrainingSession[],
  allScenarios: ScenarioDefinition[],
  allDrills: DrillAttemptRecord[] = []
): PlayerProgressionSummary {
  const responderProfile = getDefaultResponderProfile(user);

  const userCompletedSessions = allSessions
    .filter(
      (s) => s.traineeId === user.id && s.status === 'completed' && s.assessment
    )
    .sort(
      (a, b) =>
        new Date(a.completedAt || a.startedAt).getTime() -
        new Date(b.completedAt || b.startedAt).getTime()
    );

  const userDrills = allDrills
    .filter((d) => d.traineeId === user.id)
    .sort(
      (a, b) =>
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

  let missionXp = 0;
  let cleanSafetyStreak = 0;
  let totalCriticalErrors = 0;

  const personalBests: Record<string, ScenarioPersonalBest> = {};
  const ratingOrder: Record<MissionRating, number> = {
    S: 5,
    A: 4,
    B: 3,
    C: 2,
    CRITICAL_REVIEW: 1,
  };

  userCompletedSessions.forEach((sess) => {
    const xpInfo = calculateSessionXp(sess);
    missionXp += xpInfo.totalXp;

    const critCount = sess.assessment?.criticalErrorsCount ?? 0;
    totalCriticalErrors += critCount;

    if (critCount === 0) {
      cleanSafetyStreak += 1;
    } else {
      cleanSafetyStreak = 0;
    }

    const score = sess.assessment?.overallScore ?? 0;
    const prev = personalBests[sess.scenarioId];
    if (!prev) {
      personalBests[sess.scenarioId] = {
        scenarioId: sess.scenarioId,
        attempts: 1,
        bestScore: score,
        bestRating: xpInfo.rating,
        fastestCompletionSec: sess.durationSec,
        lowestCriticalErrors: critCount,
        lastPlayedAt: sess.completedAt || sess.startedAt,
      };
    } else {
      personalBests[sess.scenarioId] = {
        scenarioId: sess.scenarioId,
        attempts: prev.attempts + 1,
        bestScore: Math.max(prev.bestScore, score),
        bestRating:
          ratingOrder[xpInfo.rating] > ratingOrder[prev.bestRating]
            ? xpInfo.rating
            : prev.bestRating,
        fastestCompletionSec:
          prev.fastestCompletionSec === null
            ? sess.durationSec
            : Math.min(prev.fastestCompletionSec, sess.durationSec),
        lowestCriticalErrors:
          prev.lowestCriticalErrors === null
            ? critCount
            : Math.min(prev.lowestCriticalErrors, critCount),
        lastPlayedAt: sess.completedAt || sess.startedAt,
      };
    }
  });

  const drillXp = userDrills.reduce((sum, d) => sum + d.xpEarned, 0);
  totalCriticalErrors += userDrills.reduce(
    (sum, d) => sum + d.criticalSafetyMistakes,
    0
  );

  // Compute unique activity days for training streak
  const uniqueDays = new Set<string>();
  userCompletedSessions.forEach((s) =>
    uniqueDays.add((s.completedAt || s.startedAt).slice(0, 10))
  );
  userDrills.forEach((d) => uniqueDays.add(d.completedAt.slice(0, 10)));
  const activeDayStreak = Math.max(
    uniqueDays.size > 0 ? 1 : 0,
    Math.min(14, uniqueDays.size)
  );

  const missionsCompleted = userCompletedSessions.length;
  const drillsCompleted = userDrills.length;
  const avgOverallScore =
    missionsCompleted > 0
      ? Math.round(
          userCompletedSessions.reduce(
            (sum, s) => sum + (s.assessment?.overallScore || 0),
            0
          ) / missionsCompleted
        )
      : 0;

  // Compute 4 Skill Tracks (enhanced by verified drills)
  const cardiacSessions = userCompletedSessions.filter(
    (s) => s.scenarioMode === 'cardiac_arrest'
  );
  const triageSessions = userCompletedSessions.filter(
    (s) => s.scenarioMode === 'multi_patient_triage'
  );

  const cardiacDrills = userDrills.filter(
    (d) =>
      d.challengeType === 'protocol_sequence' ||
      d.challengeType === 'rhythm_vital_scan'
  );
  const triageDrills = userDrills.filter(
    (d) => d.challengeType === 'rapid_triage_blitz'
  );

  const cardiacBaseAvg =
    cardiacSessions.length > 0
      ? Math.round(
          cardiacSessions.reduce(
            (acc, s) => acc + (s.assessment?.proceduralAccuracy || 0),
            0
          ) / cardiacSessions.length
        )
      : cardiacDrills.length > 0
      ? Math.round(
          cardiacDrills.reduce((acc, d) => acc + d.scorePct, 0) /
            cardiacDrills.length
        )
      : 0;

  const triageBaseAvg =
    triageSessions.length > 0
      ? Math.round(
          triageSessions.reduce(
            (acc, s) => acc + (s.assessment?.decisionAccuracy || 0),
            0
          ) / triageSessions.length
        )
      : triageDrills.length > 0
      ? Math.round(
          triageDrills.reduce((acc, d) => acc + d.scorePct, 0) /
            triageDrills.length
        )
      : 0;

  const speedAvg =
    missionsCompleted > 0
      ? Math.round(
          userCompletedSessions.reduce(
            (acc, s) => acc + (s.assessment?.responseTimeScore || 0),
            0
          ) / missionsCompleted
        )
      : userDrills.length > 0
      ? Math.round(
          userDrills.reduce((acc, d) => acc + d.scorePct, 0) / userDrills.length
        )
      : 0;

  const sequenceSafetyAvg =
    missionsCompleted > 0
      ? Math.round(
          userCompletedSessions.reduce(
            (acc, s) => acc + (s.assessment?.sequenceAccuracy || 0),
            0
          ) / missionsCompleted
        )
      : 0;

  const skills: SkillTrackProgress[] = [
    {
      id: 'resuscitation',
      name: 'Cardiac Resuscitation',
      level: Math.max(
        1,
        Math.min(
          5,
          Math.floor(cardiacBaseAvg / 20) +
            (cardiacSessions.length + cardiacDrills.length > 0 ? 1 : 0)
        )
      ),
      scorePct: cardiacBaseAvg,
      summary: `${cardiacBaseAvg}% protocol accuracy`,
    },
    {
      id: 'triage',
      name: 'Surge Triage Command',
      level: Math.max(
        1,
        Math.min(
          5,
          Math.floor(triageBaseAvg / 20) +
            (triageSessions.length + triageDrills.length > 0 ? 1 : 0)
        )
      ),
      scorePct: triageBaseAvg,
      summary: `${triageBaseAvg}% tagging accuracy`,
    },
    {
      id: 'speed',
      name: 'Golden-Minute Tempo',
      level: Math.max(
        1,
        Math.min(
          5,
          Math.floor(speedAvg / 20) +
            (missionsCompleted + drillsCompleted > 0 ? 1 : 0)
        )
      ),
      scorePct: speedAvg,
      summary: `${speedAvg}% response speed`,
    },
    {
      id: 'safety',
      name: 'Zero-Harm Discipline',
      level: Math.max(
        1,
        Math.min(
          5,
          Math.floor(sequenceSafetyAvg / 20) + (cleanSafetyStreak >= 2 ? 1 : 0)
        )
      ),
      scorePct: sequenceSafetyAvg,
      summary: `${cleanSafetyStreak} clean run streak`,
    },
  ];

  // Collectible Achievements (10 real unlock conditions)
  const cleanMissionsCount = userCompletedSessions.filter(
    (s) => (s.assessment?.criticalErrorsCount ?? 0) === 0
  ).length;

  const hasRoscZeroCrit = cardiacSessions.some(
    (s) =>
      (s.assessment?.criticalErrorsCount ?? 0) === 0 &&
      (s.assessment?.overallScore ?? 0) >= 80 &&
      s.finalPatients.some((p) => p.shocksDelivered > 0 && p.heartRate > 0)
  );

  const hasTriageMastery = triageSessions.some(
    (s) =>
      (s.assessment?.decisionAccuracy ?? 0) >= 85 &&
      (s.assessment?.criticalErrorsCount ?? 0) === 0
  );

  const hasFastTempo = userCompletedSessions.some(
    (s) =>
      (s.assessment?.avgResponseTimeSec ?? 99) <= 15 &&
      (s.assessment?.overallScore ?? 0) >= 75
  );

  const hasHighAcuityClear = userCompletedSessions.some(
    (s) =>
      s.difficulty === 'High Acuity' &&
      (s.assessment?.overallScore ?? 0) >= 80 &&
      (s.assessment?.criticalErrorsCount ?? 0) === 0
  );

  const hasSRank = userCompletedSessions.some(
    (s) =>
      (s.assessment?.overallScore ?? 0) >= 93 &&
      (s.assessment?.criticalErrorsCount ?? 0) === 0
  );

  const distinctDrillTypes = new Set(userDrills.map((d) => d.challengeType)).size;
  const highDrillCount = userDrills.filter((d) => d.scorePct >= 90).length;

  const achievements: AchievementBadge[] = [
    {
      id: 'first_deploy',
      category: 'Resuscitation',
      title: 'First Responder On Scene',
      description: 'Complete 1 recorded 3D emergency mission.',
      unlocked: missionsCompleted >= 1,
      currentValue: Math.min(1, missionsCompleted),
      targetValue: 1,
      progressText: `${Math.min(1, missionsCompleted)}/1`,
      xpBonus: 40,
    },
    {
      id: 'chain_of_survival',
      category: 'Resuscitation',
      title: 'Chain of Survival',
      description: 'Achieve ROSC in Cardiac Arrest with 0 critical errors.',
      unlocked: hasRoscZeroCrit,
      currentValue: hasRoscZeroCrit ? 1 : 0,
      targetValue: 1,
      progressText: hasRoscZeroCrit ? 'Unlocked' : '0/1',
      xpBonus: 75,
    },
    {
      id: 'triage_commander',
      category: 'Triage',
      title: 'Surge Triage Specialist',
      description: 'Score 85%+ Decision Accuracy in Triage with 0 criticals.',
      unlocked: hasTriageMastery,
      currentValue: Math.min(85, triageBaseAvg),
      targetValue: 85,
      progressText: `${triageBaseAvg}% / 85%`,
      xpBonus: 75,
    },
    {
      id: 'zero_harm_streak',
      category: 'Safety',
      title: 'Zero-Harm Discipline',
      description: 'Complete 3 missions with zero critical safety violations.',
      unlocked: cleanMissionsCount >= 3,
      currentValue: Math.min(3, cleanMissionsCount),
      targetValue: 3,
      progressText: `${Math.min(3, cleanMissionsCount)}/3`,
      xpBonus: 90,
    },
    {
      id: 'rapid_tempo',
      category: 'Tempo',
      title: 'Golden Minute Tempo',
      description: 'Average <= 15s action interval with >= 75 score.',
      unlocked: hasFastTempo,
      currentValue: hasFastTempo ? 1 : 0,
      targetValue: 1,
      progressText: hasFastTempo ? '<=15s' : 'Pending',
      xpBonus: 60,
    },
    {
      id: 'high_acuity_s_rank',
      category: 'Mastery',
      title: 'High-Acuity Clearance',
      description: 'Clear High Acuity (80+, 0 criticals) or earn S-Rank (93+).',
      unlocked: hasHighAcuityClear || hasSRank,
      currentValue: hasHighAcuityClear || hasSRank ? 1 : 0,
      targetValue: 1,
      progressText: hasHighAcuityClear || hasSRank ? 'Cleared' : '0/1',
      xpBonus: 110,
    },
    {
      id: 'drill_initiate',
      category: 'Tempo',
      title: 'Arena Sharpener',
      description: 'Complete 2 interactive Training Challenges.',
      unlocked: drillsCompleted >= 2,
      currentValue: Math.min(2, drillsCompleted),
      targetValue: 2,
      progressText: `${Math.min(2, drillsCompleted)}/2`,
      xpBonus: 45,
    },
    {
      id: 'drill_versatile',
      category: 'Mastery',
      title: 'Cross-Trained Medic',
      description: 'Master 3 distinct Training Challenge modes.',
      unlocked: distinctDrillTypes >= 3,
      currentValue: Math.min(3, distinctDrillTypes),
      targetValue: 3,
      progressText: `${Math.min(3, distinctDrillTypes)}/3`,
      xpBonus: 70,
    },
    {
      id: 'precision_drill',
      category: 'Safety',
      title: 'Clinical Reflex Ace',
      description: 'Score 90%+ in 3 Training Challenges.',
      unlocked: highDrillCount >= 3,
      currentValue: Math.min(3, highDrillCount),
      targetValue: 3,
      progressText: `${Math.min(3, highDrillCount)}/3`,
      xpBonus: 80,
    },
    {
      id: 'veteran_responder',
      category: 'Mastery',
      title: 'Veteran Incident Lead',
      description: 'Complete 5 full 3D emergency missions.',
      unlocked: missionsCompleted >= 5,
      currentValue: Math.min(5, missionsCompleted),
      targetValue: 5,
      progressText: `${Math.min(5, missionsCompleted)}/5`,
      xpBonus: 125,
    },
  ];

  const achievementBonusXp = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.xpBonus, 0);

  const totalXp = missionXp + drillXp + achievementBonusXp;

  // Compute Level & Rank
  let currentRank = RANK_THRESHOLDS[0];
  let nextRank = RANK_THRESHOLDS[1];
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (totalXp >= RANK_THRESHOLDS[i].minXp) {
      currentRank = RANK_THRESHOLDS[i];
      nextRank = RANK_THRESHOLDS[i + 1] || {
        level: RANK_THRESHOLDS[i].level + 1,
        minXp: RANK_THRESHOLDS[i].minXp + 1200,
        title: 'Master Resuscitation Fellow',
      };
    }
  }

  const xpSpan = Math.max(1, nextRank.minXp - currentRank.minXp);
  const levelProgressPct = Math.min(
    100,
    Math.round(((totalXp - currentRank.minXp) / xpSpan) * 100)
  );

  // 12-Node Branching Skill Tree
  const skillTree: SkillTreeNode[] = [
    // Branch 1: Cardiac Resuscitation
    {
      id: 'st_resus_1',
      branchId: 'resuscitation',
      branchName: 'Cardiac Resuscitation',
      tier: 1,
      title: 'Scene & Pulse Recon',
      shortDesc: 'Rapid bedside safety check & pulse verification.',
      requirementLabel: '1 Cardiac Run or Sequence Challenge',
      progressPct:
        cardiacSessions.length + cardiacDrills.length > 0 ? 100 : 35,
      unlocked: cardiacSessions.length + cardiacDrills.length > 0,
      parentId: null,
      practiceTarget: 'missions',
    },
    {
      id: 'st_resus_2',
      branchId: 'resuscitation',
      branchName: 'Cardiac Resuscitation',
      tier: 2,
      title: 'High-Fraction CPR',
      shortDesc: 'Sustained 110/min compressions & airway patency.',
      requirementLabel: '75%+ Cardiac Procedural Accuracy',
      progressPct: Math.min(100, Math.round((cardiacBaseAvg / 75) * 100)),
      unlocked: cardiacBaseAvg >= 75,
      parentId: 'st_resus_1',
      practiceTarget: 'training',
    },
    {
      id: 'st_resus_3',
      branchId: 'resuscitation',
      branchName: 'Cardiac Resuscitation',
      tier: 3,
      title: 'Biphasic Defib Mastery',
      shortDesc: 'Zero-error AED shock delivery & ROSC stabilisation.',
      requirementLabel: 'Clean ROSC Achievement',
      progressPct: hasRoscZeroCrit ? 100 : Math.min(90, cardiacBaseAvg),
      unlocked: hasRoscZeroCrit,
      parentId: 'st_resus_2',
      practiceTarget: 'missions',
    },
    // Branch 2: Triage Command
    {
      id: 'st_tri_1',
      branchId: 'triage',
      branchName: 'Surge Triage Command',
      tier: 1,
      title: 'START Rapid Sweep',
      shortDesc: '30-second multi-bay casualty survey.',
      requirementLabel: '1 Triage Run or Triage Blitz',
      progressPct: triageSessions.length + triageDrills.length > 0 ? 100 : 25,
      unlocked: triageSessions.length + triageDrills.length > 0,
      parentId: null,
      practiceTarget: 'training',
    },
    {
      id: 'st_tri_2',
      branchId: 'triage',
      branchName: 'Surge Triage Command',
      tier: 2,
      title: 'Hemorrhage Priority',
      shortDesc: 'Immediate arterial tourniquet & airway triage.',
      requirementLabel: '75%+ Triage Decision Accuracy',
      progressPct: Math.min(100, Math.round((triageBaseAvg / 75) * 100)),
      unlocked: triageBaseAvg >= 75,
      parentId: 'st_tri_1',
      practiceTarget: 'missions',
    },
    {
      id: 'st_tri_3',
      branchId: 'triage',
      branchName: 'Surge Triage Command',
      tier: 3,
      title: 'Mass-Casualty Commander',
      shortDesc: '85%+ surge accuracy with zero critical errors.',
      requirementLabel: '85%+ Triage & 0 Criticals',
      progressPct: hasTriageMastery
        ? 100
        : Math.min(95, Math.round((triageBaseAvg / 85) * 100)),
      unlocked: hasTriageMastery,
      parentId: 'st_tri_2',
      practiceTarget: 'missions',
    },
    // Branch 3: Rapid Diagnostics
    {
      id: 'st_diag_1',
      branchId: 'diagnostics',
      branchName: 'Rapid Diagnostics',
      tier: 1,
      title: 'Bay Spatial Memory',
      shortDesc: 'Instant 3D location of AED, O2, and crash cart.',
      requirementLabel: 'Complete 1 Mission or 3D Spotter',
      progressPct: missionsCompleted + drillsCompleted > 0 ? 100 : 20,
      unlocked: missionsCompleted + drillsCompleted > 0,
      parentId: null,
      practiceTarget: 'training',
    },
    {
      id: 'st_diag_2',
      branchId: 'diagnostics',
      branchName: 'Rapid Diagnostics',
      tier: 2,
      title: 'Telemetry Waveform Read',
      shortDesc: 'Rapid VFib, Sinus Tachycardia & hypoxia recognition.',
      requirementLabel: '75%+ Tempo Score or Telemetry Drill',
      progressPct: Math.min(100, Math.round((speedAvg / 75) * 100)),
      unlocked:
        speedAvg >= 75 ||
        userDrills.some(
          (d) => d.challengeType === 'rhythm_vital_scan' && d.scorePct >= 80
        ),
      parentId: 'st_diag_1',
      practiceTarget: 'training',
    },
    {
      id: 'st_diag_3',
      branchId: 'diagnostics',
      branchName: 'Rapid Diagnostics',
      tier: 3,
      title: 'Golden-Minute Reflex',
      shortDesc: 'Sub-15s decision cadence under clinical pressure.',
      requirementLabel: '<= 15s Avg Interval & 75+ Score',
      progressPct: hasFastTempo ? 100 : Math.min(90, speedAvg),
      unlocked: hasFastTempo,
      parentId: 'st_diag_2',
      practiceTarget: 'missions',
    },
    // Branch 4: Crisis & Safety Control
    {
      id: 'st_cris_1',
      branchId: 'crisis',
      branchName: 'Crisis Stabilization',
      tier: 1,
      title: 'Clean Protocol Execution',
      shortDesc: 'Complete a mission without critical safety errors.',
      requirementLabel: '1 Zero-Critical Mission',
      progressPct: cleanMissionsCount >= 1 ? 100 : 0,
      unlocked: cleanMissionsCount >= 1,
      parentId: null,
      practiceTarget: 'missions',
    },
    {
      id: 'st_cris_2',
      branchId: 'crisis',
      branchName: 'Crisis Stabilization',
      tier: 2,
      title: 'Disruption Mitigation',
      shortDesc: 'Handle AED faults, dim backup lights & blocked exits.',
      requirementLabel: '2 Clean Runs & 75%+ Sequence',
      progressPct: Math.min(100, Math.round((cleanMissionsCount / 2) * 100)),
      unlocked: cleanMissionsCount >= 2 && sequenceSafetyAvg >= 75,
      parentId: 'st_cris_1',
      practiceTarget: 'missions',
    },
    {
      id: 'st_cris_3',
      branchId: 'crisis',
      branchName: 'Crisis Stabilization',
      tier: 3,
      title: 'Zero-Harm Sentinel',
      shortDesc: '3+ consecutive clean runs or High-Acuity clearance.',
      requirementLabel: '3 Zero-Harm Runs or High Acuity',
      progressPct:
        cleanMissionsCount >= 3 || hasHighAcuityClear
          ? 100
          : Math.min(95, Math.round((cleanMissionsCount / 3) * 100)),
      unlocked: cleanMissionsCount >= 3 || hasHighAcuityClear,
      parentId: 'st_cris_2',
      practiceTarget: 'missions',
    },
  ];

  // Daily Training Challenges (Evaluated against real user progress)
  const todayIsoPrefix = new Date().toISOString().slice(0, 10);
  const todaysCleanSessions = userCompletedSessions.filter(
    (s) =>
      (s.completedAt || s.startedAt).startsWith(todayIsoPrefix) &&
      (s.assessment?.criticalErrorsCount ?? 0) === 0
  ).length;
  const todaysDrills = userDrills.filter((d) =>
    d.completedAt.startsWith(todayIsoPrefix)
  ).length;

  const dailyChallenges: DailyChallengeItem[] = [
    {
      id: 'daily_clean_mission',
      title: 'Zero-Harm Deployment',
      subtitle: 'Clear 1 3D mission today with 0 critical errors',
      xpReward: 75,
      current: Math.min(1, todaysCleanSessions),
      target: 1,
      completed: todaysCleanSessions >= 1,
      actionSection: 'simulation-centre',
      scenarioId: allScenarios[0]?.id || 'scen_cardiac_01',
    },
    {
      id: 'daily_skill_drills',
      title: 'Reflex Sharpener',
      subtitle: 'Complete 2 interactive Training Challenges today',
      xpReward: 50,
      current: Math.min(2, todaysDrills),
      target: 2,
      completed: todaysDrills >= 2,
      actionSection: 'training',
    },
    {
      id: 'daily_high_readiness',
      title: 'A-Rank Protocol Standard',
      subtitle: 'Record an 83+ Overall Score with 0 criticals',
      xpReward: 90,
      current: hasSRank || avgOverallScore >= 83 ? 1 : 0,
      target: 1,
      completed: userCompletedSessions.some(
        (s) =>
          (s.assessment?.overallScore ?? 0) >= 83 &&
          (s.assessment?.criticalErrorsCount ?? 0) === 0
      ),
      actionSection: 'missions',
    },
  ];

  // Progress Milestones
  const milestones: MilestoneItem[] = [
    {
      id: 'ms_1',
      title: 'Bay Orientation',
      targetXp: 350,
      reached: totalXp >= 350,
      rewardLabel: 'Level 2 · Acute Care Practitioner',
    },
    {
      id: 'ms_2',
      title: 'Resuscitation Ready',
      targetXp: 850,
      reached: totalXp >= 850,
      rewardLabel: 'Level 3 · High-Acuity Unlock',
    },
    {
      id: 'ms_3',
      title: 'Surge Incident Lead',
      targetXp: 1500,
      reached: totalXp >= 1500,
      rewardLabel: 'Level 4 · Trauma Triage Lead',
    },
    {
      id: 'ms_4',
      title: 'Command Authority',
      targetXp: 2350,
      reached: totalXp >= 2350,
      rewardLabel: 'Level 5 · Incident Commander',
    },
  ];

  // Mission Unlocks
  const missionUnlocks: Record<string, MissionUnlockInfo> = {};
  allScenarios.forEach((scen, idx) => {
    const isAssigned = user.assignedScenarioIds.includes(scen.id);
    const mult = getDifficultyMultiplier(scen.difficulty);
    const xpRewardEstimate = Math.round(240 * mult);

    if (scen.difficulty === 'High Acuity' && idx >= 2) {
      const unlocked =
        isAssigned ||
        currentRank.level >= 2 ||
        missionsCompleted >= 1 ||
        user.role !== 'trainee';
      missionUnlocks[scen.id] = {
        scenarioId: scen.id,
        unlocked,
        unlockRequirementText: unlocked
          ? 'Unlocked'
          : 'Clear 1 Mission to Unlock',
        recommendedLevel: 2,
        xpRewardEstimate,
      };
    } else {
      missionUnlocks[scen.id] = {
        scenarioId: scen.id,
        unlocked: true,
        unlockRequirementText: 'Available',
        recommendedLevel: 1,
        xpRewardEstimate,
      };
    }
  });

  return {
    responderProfile,
    level: currentRank.level,
    rankTitle: currentRank.title,
    totalXp,
    missionXp,
    drillXp,
    currentLevelFloorXp: currentRank.minXp,
    nextLevelTargetXp: nextRank.minXp,
    levelProgressPct,
    missionsCompleted,
    drillsCompleted,
    cleanSafetyStreak,
    activeDayStreak,
    totalCriticalErrors,
    avgOverallScore,
    skills,
    skillTree,
    achievements,
    dailyChallenges,
    milestones,
    personalBests,
    missionUnlocks,
  };
}

export function computeResponderLeaderboard(
  users: UserAccount[],
  sessions: TrainingSession[],
  scenarios: ScenarioDefinition[],
  drills: DrillAttemptRecord[] = [],
  currentUserId?: string
): LeaderboardEntry[] {
  return users
    .filter((u) => u.role === 'trainee' && u.active)
    .map((u) => {
      const prog = computePlayerProgression(u, sessions, scenarios, drills);
      return {
        userId: u.id,
        name: u.name,
        callsign: prog.responderProfile.callsign,
        cohort: u.cohort,
        level: prog.level,
        rankTitle: prog.rankTitle,
        totalXp: prog.totalXp,
        missionsCompleted: prog.missionsCompleted,
        avgScore: prog.avgOverallScore,
        cleanSafetyStreak: prog.cleanSafetyStreak,
        totalCriticalErrors: prog.totalCriticalErrors,
        isCurrentUser: u.id === currentUserId,
      };
    })
    .sort((a, b) => {
      // Sort by XP, tie-break by fewer critical errors and higher avg score
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      if (a.totalCriticalErrors !== b.totalCriticalErrors) {
        return a.totalCriticalErrors - b.totalCriticalErrors;
      }
      return b.avgScore - a.avgScore;
    });
}

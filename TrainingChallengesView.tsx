import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crosshair,
  Flame,
  HeartPulse,
  ListOrdered,
  Play,
  RotateCcw,
  ShieldAlert,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { getDefaultResponderProfile } from '../engine/progressionEngine';
import type {
  DrillAttemptRecord,
  DrillChallengeType,
  NavSection,
  PlatformSettings,
  ScenarioDefinition,
  TriageCategory,
  UserAccount,
} from '../types/simulation';
import { VISUAL_ASSETS } from '../utils/scenarioVisuals';
import { playSimulationTone } from '../utils/soundEffects';
import {
  EmergencyRoomScene,
  InteractiveTargetId,
} from './simulation3d/EmergencyRoomScene';

interface TrainingChallengesViewProps {
  currentUser: UserAccount;
  scenarios: ScenarioDefinition[];
  drills: DrillAttemptRecord[];
  settings: PlatformSettings;
  onRecordDrill: (drill: DrillAttemptRecord) => void;
  onNavigate: (section: NavSection) => void;
}

interface ChallengeCardMeta {
  id: DrillChallengeType;
  title: string;
  tagline: string;
  durationSec: number;
  maxXp: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const CHALLENGE_CARDS: ChallengeCardMeta[] = [
  {
    id: 'equipment_hunt_3d',
    title: '3D Trauma Bay Spotter',
    tagline: 'Locate 5 emergency stations directly inside the 3D bay',
    durationSec: 45,
    maxXp: 85,
    icon: Crosshair,
    accent: 'text-cyan-400',
  },
  {
    id: 'protocol_sequence',
    title: 'Resuscitation Chain Blitz',
    tagline: 'Lock the 6-step VFib arrest sequence in order',
    durationSec: 40,
    maxXp: 80,
    icon: ListOrdered,
    accent: 'text-sky-400',
  },
  {
    id: 'rhythm_vital_scan',
    title: 'Live Telemetry Crisis Read',
    tagline: 'Read 4 acute bedside waveforms & trigger intervention',
    durationSec: 45,
    maxXp: 85,
    icon: HeartPulse,
    accent: 'text-emerald-400',
  },
  {
    id: 'rapid_triage_blitz',
    title: 'START Surge Tagging Blitz',
    tagline: 'Tag 4 trauma casualties via click or [Z][X][C][B]',
    durationSec: 45,
    maxXp: 90,
    icon: Users,
    accent: 'text-amber-400',
  },
  {
    id: 'golden_minute_reflex',
    title: '60s Golden-Minute Gauntlet',
    tagline: '6 rapid mixed clinical & equipment reflex calls',
    durationSec: 60,
    maxXp: 110,
    icon: Flame,
    accent: 'text-cyan-300',
  },
];

const SPOTTER_PROMPTS: Array<{
  target: InteractiveTargetId;
  prompt: string;
  stationHint: string;
}> = [
  {
    target: 'AED Device',
    prompt: 'Click the Biphasic AED Unit',
    stationHint: 'Wall-mounted / bedside defibrillator',
  },
  {
    target: 'Patient Monitor',
    prompt: 'Click the Bedside Vital Telemetry Monitor',
    stationHint: 'Live ECG & SpO2 display tower',
  },
  {
    target: 'Oxygen Equipment',
    prompt: 'Click the High-Flow Oxygen Cylinder Station',
    stationHint: 'Green/silver medical gas cylinder',
  },
  {
    target: 'Medical Trolley',
    prompt: 'Click the Crash Cart / Medical Trolley',
    stationHint: 'Red resuscitation drawer cart',
  },
  {
    target: 'Emergency Call Panel',
    prompt: 'Click the Code Blue Wall Call Panel',
    stationHint: 'Wall alarm & backup switchboard',
  },
];

const SEQUENCE_STEPS = [
  {
    id: 'scene_safety',
    order: 1,
    label: 'Verify Scene Safety & PPE',
    shortCode: 'SAFE',
  },
  {
    id: 'check_pulse',
    order: 2,
    label: 'Check Responsiveness & Pulse',
    shortCode: 'ASSESS',
  },
  {
    id: 'call_code',
    order: 3,
    label: 'Activate Code Blue Team',
    shortCode: 'CODE',
  },
  {
    id: 'start_cpr',
    order: 4,
    label: 'Start Chest Compressions',
    shortCode: 'CPR',
  },
  {
    id: 'attach_pads',
    order: 5,
    label: 'Power AED & Attach Pads',
    shortCode: 'PADS',
  },
  {
    id: 'analyze_shock',
    order: 6,
    label: 'Clear Bedside, Analyze & Shock',
    shortCode: 'SHOCK',
  },
];

const TELEMETRY_CASES = [
  {
    id: 'vfib',
    rhythmLabel: 'Coarse VFib · Pulseless',
    hr: 0,
    bp: '0/0',
    spo2: 68,
    rr: 0,
    wavePath:
      'M0,22 Q8,4 16,32 T32,12 T48,34 T64,10 T80,30 T96,11 T112,35 T128,14 T144,30 T160,9 T176,33 T192,15 L220,22',
    waveColor: '#ef4444',
    correctId: 'cpr_aed',
    options: [
      { id: 'cpr_aed', label: 'Start CPR & Attach AED Pads', criticalWrong: false },
      { id: 'discharge', label: 'Observe Without Intervention', criticalWrong: true },
      { id: 'wound', label: 'Apply Minor Limb Dressing', criticalWrong: false },
      { id: 'oral_fluids', label: 'Offer Oral Hydration', criticalWrong: true },
    ],
  },
  {
    id: 'hemorrhage',
    rhythmLabel: 'Sinus Tachycardia · Severe Femoral Bleed',
    hr: 142,
    bp: '74/42',
    spo2: 91,
    rr: 32,
    wavePath:
      'M0,24 L16,24 L20,18 L24,24 L30,24 L33,29 L37,5 L41,34 L45,24 L65,24 L69,18 L73,24 L79,24 L82,29 L86,5 L90,34 L94,24 L115,24 L119,18 L123,24 L129,24 L132,29 L136,5 L140,34 L144,24 L220,24',
    waveColor: '#f59e0b',
    correctId: 'tourniquet',
    options: [
      { id: 'tourniquet', label: 'Apply Arterial Hemorrhage Control Kit', criticalWrong: false },
      { id: 'shock_awake', label: 'Deliver 200J Defibrillation Shock', criticalWrong: true },
      { id: 'tag_minor', label: 'Tag MINOR Walking Wounded', criticalWrong: true },
      { id: 'wait_labs', label: 'Defer Care Pending Lab Panel', criticalWrong: false },
    ],
  },
  {
    id: 'hypoxia',
    rhythmLabel: 'Sinus Tachycardia · Airway Obstruction',
    hr: 126,
    bp: '108/68',
    spo2: 79,
    rr: 34,
    wavePath:
      'M0,24 L22,24 L27,18 L32,24 L40,24 L44,28 L49,6 L54,32 L59,24 L92,24 L97,18 L102,24 L110,24 L114,28 L119,6 L124,32 L129,24 L220,24',
    waveColor: '#38bdf8',
    correctId: 'airway_o2',
    options: [
      { id: 'airway_o2', label: 'Open Airway & Apply High-Flow O2 (15L)', criticalWrong: false },
      { id: 'shock_sinus', label: 'Deliver Unsynchronized Shock', criticalWrong: true },
      { id: 'splint_wrist', label: 'Splint Distal Forearm First', criticalWrong: false },
      { id: 'no_o2', label: 'Withhold Supplemental Oxygen', criticalWrong: false },
    ],
  },
  {
    id: 'rosc',
    rhythmLabel: 'Organized Sinus · Post-ROSC Return of Pulse',
    hr: 92,
    bp: '104/66',
    spo2: 94,
    rr: 16,
    wavePath:
      'M0,24 L28,24 L34,19 L40,24 L48,24 L52,28 L58,6 L64,31 L70,24 L128,24 L134,19 L140,24 L148,24 L152,28 L158,6 L164,31 L170,24 L220,24',
    waveColor: '#10b981',
    correctId: 'post_rosc',
    options: [
      { id: 'post_rosc', label: 'Verify Monitor Vitals & Titrate O2', criticalWrong: false },
      { id: 'shock_rosc', label: 'Deliver Repeat Shock on Sinus Rhythm', criticalWrong: true },
      { id: 'power_off', label: 'Remove Monitor Leads Immediately', criticalWrong: false },
      { id: 'tag_expectant', label: 'Reclassify as Expectant', criticalWrong: true },
    ],
  },
];

const TRIAGE_CASUALTIES: Array<{
  id: string;
  bay: string;
  summary: string;
  hr: number;
  rr: number;
  spo2: number;
  mental: string;
  bleeding: string;
  expected: TriageCategory;
}> = [
  {
    id: 'CAS-01',
    bay: 'Bay 01',
    summary: 'Spurting thigh laceration · Pale',
    hr: 138,
    rr: 34,
    spo2: 88,
    mental: 'Pain Only',
    bleeding: 'Severe Arterial',
    expected: 'IMMEDIATE',
  },
  {
    id: 'CAS-02',
    bay: 'Bay 02',
    summary: 'Closed tibia fracture · Non-ambulatory',
    hr: 96,
    rr: 20,
    spo2: 98,
    mental: 'Alert',
    bleeding: 'Controlled',
    expected: 'DELAYED',
  },
  {
    id: 'CAS-03',
    bay: 'Bay 03',
    summary: 'Walking · Superficial forearm abrasion',
    hr: 84,
    rr: 16,
    spo2: 99,
    mental: 'Alert & Walking',
    bleeding: 'Minor',
    expected: 'MINOR',
  },
  {
    id: 'CAS-04',
    bay: 'Bay 04',
    summary: 'Apneic after airway reposition · Pulseless',
    hr: 0,
    rr: 0,
    spo2: 0,
    mental: 'Unresponsive',
    bleeding: 'Catastrophic',
    expected: 'EXPECTANT',
  },
];

const REFLEX_ROUNDS = [
  {
    prompt: 'AED announces "SHOCK ADVISED" — Immediate step before pressing shock?',
    correct: 'Clear all hands from patient & bed',
    options: [
      { label: 'Clear all hands from patient & bed', critical: false },
      { label: 'Continue chest compressions during shock', critical: true },
      { label: 'Power off AED to reset pads', critical: false },
    ],
  },
  {
    prompt: 'Casualty walking toward ambulance bay with minor laceration — START Tag?',
    correct: 'MINOR (Green)',
    options: [
      { label: 'IMMEDIATE (Red)', critical: false },
      { label: 'MINOR (Green)', critical: false },
      { label: 'EXPECTANT (Black)', critical: true },
    ],
  },
  {
    prompt: 'Primary AED reports battery fault mid-arrest — Best immediate response?',
    correct: 'Continue CPR & engage Backup AED module',
    options: [
      { label: 'Continue CPR & engage Backup AED module', critical: false },
      { label: 'Pause CPR until technician arrives', critical: true },
      { label: 'Deliver blind shock without rhythm check', critical: true },
    ],
  },
  {
    prompt: 'RR 36/min, SpO2 81%, gurgling airway — Priority action?',
    correct: 'Head-tilt/jaw-thrust airway & 15L O2',
    options: [
      { label: 'Head-tilt/jaw-thrust airway & 15L O2', critical: false },
      { label: 'Apply ankle splint first', critical: false },
      { label: 'Defibrillate immediately', critical: true },
    ],
  },
  {
    prompt: 'Target compression rate in adult cardiac arrest?',
    correct: '100–120 compressions / min',
    options: [
      { label: '50–60 compressions / min', critical: false },
      { label: '100–120 compressions / min', critical: false },
      { label: '180+ shallow compressions / min', critical: false },
    ],
  },
  {
    prompt: 'Ambulance transfer exit blocked during surge — Action?',
    correct: 'Trigger corridor reroute at Call Panel / Exit',
    options: [
      { label: 'Trigger corridor reroute at Call Panel / Exit', critical: false },
      { label: 'Abandon bedside resuscitation', critical: true },
      { label: 'Ignore transfer obstruction', critical: false },
    ],
  },
];

export const TrainingChallengesView: React.FC<TrainingChallengesViewProps> = ({
  currentUser,
  scenarios,
  drills,
  settings,
  onRecordDrill,
  onNavigate,
}) => {
  const [activeChallenge, setActiveChallenge] =
    useState<DrillChallengeType | null>(null);
  const [remainingSec, setRemainingSec] = useState(45);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [completedSummary, setCompletedSummary] =
    useState<DrillAttemptRecord | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{
    text: string;
    tone: 'ok' | 'warn' | 'crit';
  } | null>(null);

  // Challenge-specific interactive states
  const [spotterIdx, setSpotterIdx] = useState(0);
  const [spotterHits, setSpotterHits] = useState(0);
  const [spotterMisses, setSpotterMisses] = useState(0);
  const [selected3dObj, setSelected3dObj] =
    useState<InteractiveTargetId>('Hospital Bed');

  const [shuffledSteps, setShuffledSteps] = useState(SEQUENCE_STEPS);
  const [lockedStepIds, setLockedStepIds] = useState<string[]>([]);
  const [seqMistakes, setSeqMistakes] = useState(0);
  const [seqCriticals, setSeqCriticals] = useState(0);

  const [telemetryIdx, setTelemetryIdx] = useState(0);
  const [telemetryHits, setTelemetryHits] = useState(0);
  const [telemetryCriticals, setTelemetryCriticals] = useState(0);

  const [triageIdx, setTriageIdx] = useState(0);
  const [triageTags, setTriageTags] = useState<Record<string, TriageCategory>>(
    {}
  );
  const [triageCriticals, setTriageCriticals] = useState(0);

  const [reflexIdx, setReflexIdx] = useState(0);
  const [reflexHits, setReflexHits] = useState(0);
  const [reflexCriticals, setReflexCriticals] = useState(0);

  const responderProfile = useMemo(
    () => getDefaultResponderProfile(currentUser),
    [currentUser]
  );

  const baseCardiacScenario = useMemo(
    () =>
      scenarios.find((s) => s.mode === 'cardiac_arrest') || scenarios[0],
    [scenarios]
  );

  const userDrills = useMemo(
    () =>
      drills
        .filter((d) => d.traineeId === currentUser.id)
        .sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime()
        ),
    [drills, currentUser.id]
  );

  const bestByType = useMemo(() => {
    const map: Partial<Record<DrillChallengeType, DrillAttemptRecord>> = {};
    for (const d of userDrills) {
      const prev = map[d.challengeType];
      if (!prev || d.scorePct > prev.scorePct) {
        map[d.challengeType] = d;
      }
    }
    return map;
  }, [userDrills]);

  const finishChallenge = useCallback(
    (
      type: DrillChallengeType,
      scorePct: number,
      criticalSafetyMistakes: number,
      usedSec: number
    ) => {
      const meta = CHALLENGE_CARDS.find((c) => c.id === type)!;
      const clampedScore = Math.max(0, Math.min(100, Math.round(scorePct)));
      const speedFactor = usedSec <= meta.durationSec * 0.65 ? 1.15 : 1.0;
      const rawXp = Math.round((clampedScore / 100) * meta.maxXp * speedFactor);
      const xpEarned =
        criticalSafetyMistakes > 0 ? Math.min(35, Math.round(rawXp * 0.45)) : rawXp;

      const record: DrillAttemptRecord = {
        id: `drill_${Date.now()}`,
        traineeId: currentUser.id,
        challengeType: type,
        title: meta.title,
        scorePct: clampedScore,
        xpEarned,
        durationSec: Math.max(1, usedSec),
        criticalSafetyMistakes,
        completedAt: new Date().toISOString(),
        isDemo: false,
      };

      playSimulationTone(
        criticalSafetyMistakes > 0 ? 'critical' : 'mission_complete',
        settings.audioFeedbackEnabled
      );
      onRecordDrill(record);
      setCompletedSummary(record);
    },
    [currentUser.id, onRecordDrill, settings.audioFeedbackEnabled]
  );

  const startChallenge = (type: DrillChallengeType) => {
    const meta = CHALLENGE_CARDS.find((c) => c.id === type)!;
    setActiveChallenge(type);
    setCompletedSummary(null);
    setFeedbackToast(null);
    setRemainingSec(meta.durationSec);
    setElapsedSec(0);

    setSpotterIdx(0);
    setSpotterHits(0);
    setSpotterMisses(0);

    const copy = [...SEQUENCE_STEPS].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
    setShuffledSteps(copy);
    setLockedStepIds([]);
    setSeqMistakes(0);
    setSeqCriticals(0);

    setTelemetryIdx(0);
    setTelemetryHits(0);
    setTelemetryCriticals(0);

    setTriageIdx(0);
    setTriageTags({});
    setTriageCriticals(0);

    setReflexIdx(0);
    setReflexHits(0);
    setReflexCriticals(0);

    playSimulationTone('mission_start', settings.audioFeedbackEnabled);
  };

  // Challenge countdown clock
  useEffect(() => {
    if (!activeChallenge || completedSummary) return;
    const id = window.setInterval(() => {
      setElapsedSec((e) => e + 1);
      setRemainingSec((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeChallenge, completedSummary]);

  // Auto-finalize if timer hits 0
  useEffect(() => {
    if (!activeChallenge || completedSummary || remainingSec > 0) return;
    if (activeChallenge === 'equipment_hunt_3d') {
      finishChallenge(
        'equipment_hunt_3d',
        (spotterHits / SPOTTER_PROMPTS.length) * 100,
        0,
        elapsedSec
      );
    } else if (activeChallenge === 'protocol_sequence') {
      finishChallenge(
        'protocol_sequence',
        (lockedStepIds.length / SEQUENCE_STEPS.length) * 100,
        seqCriticals,
        elapsedSec
      );
    } else if (activeChallenge === 'rhythm_vital_scan') {
      finishChallenge(
        'rhythm_vital_scan',
        (telemetryHits / TELEMETRY_CASES.length) * 100,
        telemetryCriticals,
        elapsedSec
      );
    } else if (activeChallenge === 'rapid_triage_blitz') {
      const correctCount = TRIAGE_CASUALTIES.filter(
        (c) => triageTags[c.id] === c.expected
      ).length;
      finishChallenge(
        'rapid_triage_blitz',
        (correctCount / TRIAGE_CASUALTIES.length) * 100,
        triageCriticals,
        elapsedSec
      );
    } else if (activeChallenge === 'golden_minute_reflex') {
      finishChallenge(
        'golden_minute_reflex',
        (reflexHits / REFLEX_ROUNDS.length) * 100,
        reflexCriticals,
        elapsedSec
      );
    }
  }, [
    activeChallenge,
    completedSummary,
    remainingSec,
    spotterHits,
    lockedStepIds.length,
    seqCriticals,
    telemetryHits,
    telemetryCriticals,
    triageTags,
    triageCriticals,
    reflexHits,
    reflexCriticals,
    elapsedSec,
    finishChallenge,
  ]);

  // Keyboard [Z][X][C][B] shortcuts during START Surge Tagging Blitz
  const handleAssignBlitzTag = useCallback(
    (cat: TriageCategory) => {
      if (activeChallenge !== 'rapid_triage_blitz' || completedSummary) return;
      const currentCas = TRIAGE_CASUALTIES[triageIdx];
      if (!currentCas) return;

      const nextTags = { ...triageTags, [currentCas.id]: cat };
      setTriageTags(nextTags);

      let addCrit = 0;
      if (currentCas.expected === 'IMMEDIATE' && cat !== 'IMMEDIATE') {
        addCrit = 1;
        setTriageCriticals((c) => c + 1);
        setFeedbackToast({
          text: `${currentCas.id}: Under-triaging IMMEDIATE arterial bleed is a critical safety error`,
          tone: 'crit',
        });
        playSimulationTone('critical', settings.audioFeedbackEnabled);
      } else if (cat === currentCas.expected) {
        setFeedbackToast({
          text: `${currentCas.id} tagged ${cat} — Exact START match`,
          tone: 'ok',
        });
        playSimulationTone('correct', settings.audioFeedbackEnabled);
      } else {
        setFeedbackToast({
          text: `${currentCas.id} tagged ${cat} (Reference: ${currentCas.expected})`,
          tone: 'warn',
        });
        playSimulationTone('warning', settings.audioFeedbackEnabled);
      }

      if (triageIdx + 1 >= TRIAGE_CASUALTIES.length) {
        const correctCount = TRIAGE_CASUALTIES.filter(
          (c) => nextTags[c.id] === c.expected
        ).length;
        finishChallenge(
          'rapid_triage_blitz',
          (correctCount / TRIAGE_CASUALTIES.length) * 100,
          triageCriticals + addCrit,
          elapsedSec + 1
        );
      } else {
        setTriageIdx((i) => i + 1);
      }
    },
    [
      activeChallenge,
      completedSummary,
      triageIdx,
      triageTags,
      triageCriticals,
      elapsedSec,
      finishChallenge,
      settings.audioFeedbackEnabled,
    ]
  );

  useEffect(() => {
    if (activeChallenge !== 'rapid_triage_blitz' || completedSummary) return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, TriageCategory> = {
        KeyZ: 'IMMEDIATE',
        KeyX: 'DELAYED',
        KeyC: 'MINOR',
        KeyB: 'EXPECTANT',
      };
      const cat = map[e.code];
      if (cat) {
        e.preventDefault();
        handleAssignBlitzTag(cat);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeChallenge, completedSummary, handleAssignBlitzTag]);

  // ---------------------------------------------------------------------------
  // ACTIVE CHALLENGE PLAYFIELD VIEW
  // ---------------------------------------------------------------------------
  if (activeChallenge) {
    const meta = CHALLENGE_CARDS.find((c) => c.id === activeChallenge)!;

    return (
      <div className="p-5 lg:p-8 max-w-[1360px] mx-auto space-y-5">
        {/* Top Challenge HUD Bar */}
        <div className="rounded-xl bg-[#0B1220] border border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveChallenge(null);
                setCompletedSummary(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              Training Arena
            </button>
            <span className="text-slate-700">·</span>
            <span className="text-sm font-bold text-slate-100">
              {meta.title}
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono tabular-nums text-xs">
            <span className="text-cyan-300">Max +{meta.maxXp} XP</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#070B14] border border-slate-800 font-bold ${
                remainingSec <= 10 ? 'text-red-400' : 'text-amber-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {remainingSec}s
            </span>
          </div>
        </div>

        {/* COMPLETED CHALLENGE REWARD SUMMARY */}
        {completedSummary ? (
          <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-6 lg:p-8 max-w-2xl mx-auto space-y-6 text-center">
            {completedSummary.criticalSafetyMistakes > 0 && (
              <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/80 text-left flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-red-200">
                    CRITICAL SAFETY VIOLATION RECORDED ({completedSummary.criticalSafetyMistakes})
                  </div>
                  <div className="text-xs text-red-200/90 mt-0.5">
                    Unsafe clinical decisions reduce XP and never count toward clean safety streaks.
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="text-xs font-mono text-cyan-400">
                CHALLENGE COMPLETE · {completedSummary.durationSec}s
              </div>
              <h2 className="text-2xl font-bold text-white">
                {completedSummary.title}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3 font-mono tabular-nums">
              <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">Accuracy</div>
                <div className="text-2xl font-bold text-white mt-0.5">
                  {completedSummary.scorePct}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">XP Earned</div>
                <div className="text-2xl font-bold text-cyan-300 mt-0.5">
                  +{completedSummary.xpEarned} XP
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#070B14] border border-slate-800">
                <div className="text-[11px] font-sans text-slate-400">Safety Flags</div>
                <div
                  className={`text-2xl font-bold mt-0.5 ${
                    completedSummary.criticalSafetyMistakes > 0
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {completedSummary.criticalSafetyMistakes}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => startChallenge(activeChallenge)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Play Again
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveChallenge(null);
                  setCompletedSummary(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Choose Another Challenge
              </button>
              <button
                type="button"
                onClick={() => onNavigate('missions')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#070B14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-cyan-300 transition-colors"
              >
                Deploy Full 3D Mission →
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Feedback Strip */}
            {feedbackToast && (
              <div
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  feedbackToast.tone === 'crit'
                    ? 'bg-red-950/75 border-red-500 text-red-100'
                    : feedbackToast.tone === 'ok'
                    ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-100'
                    : 'bg-amber-950/60 border-amber-500/70 text-amber-100'
                }`}
              >
                {feedbackToast.tone === 'crit' ? (
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                ) : feedbackToast.tone === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>{feedbackToast.text}</span>
              </div>
            )}

            {/* 1. 3D TRAUMA BAY EQUIPMENT SPOTTER */}
            {activeChallenge === 'equipment_hunt_3d' && baseCardiacScenario && (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#0B1220] border border-cyan-500/50 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono text-cyan-400">
                      TARGET {spotterIdx + 1} OF {SPOTTER_PROMPTS.length} · ORBIT &amp; CLICK IN 3D BAY
                    </div>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {SPOTTER_PROMPTS[spotterIdx]?.prompt}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Hits: <strong className="text-emerald-400">{spotterHits}</strong> · Misses:{' '}
                    <strong className="text-amber-300">{spotterMisses}</strong>
                  </div>
                </div>

                <div className="relative h-[480px] rounded-2xl overflow-hidden border border-slate-800 bg-[#070B14]">
                  <EmergencyRoomScene
                    mode="cardiac_arrest"
                    patients={baseCardiacScenario.initialPatients}
                    selectedPatientId={
                      baseCardiacScenario.initialPatients[0]?.patientId || 'PT-101'
                    }
                    selectedObject={selected3dObj}
                    environment={baseCardiacScenario.environmentConfig}
                    isPaused={false}
                    reducedMotion={settings.reducedMotion}
                    cameraPreset={null}
                    controlMode="orbit"
                    responderProfile={responderProfile}
                    onSelectObject={(target) => {
                      setSelected3dObj(target);
                      const expected = SPOTTER_PROMPTS[spotterIdx]?.target;
                      if (target === expected) {
                        const nextHits = spotterHits + 1;
                        setSpotterHits(nextHits);
                        playSimulationTone('correct', settings.audioFeedbackEnabled);
                        setFeedbackToast({
                          text: `Locked ${target}!`,
                          tone: 'ok',
                        });
                        if (spotterIdx + 1 >= SPOTTER_PROMPTS.length) {
                          const accuracy = Math.max(
                            25,
                            (nextHits / (nextHits + spotterMisses)) * 100
                          );
                          finishChallenge(
                            'equipment_hunt_3d',
                            accuracy,
                            0,
                            elapsedSec + 1
                          );
                        } else {
                          setSpotterIdx((i) => i + 1);
                        }
                      } else {
                        setSpotterMisses((m) => m + 1);
                        playSimulationTone('warning', settings.audioFeedbackEnabled);
                        setFeedbackToast({
                          text: `Clicked ${target} — Look for: ${SPOTTER_PROMPTS[spotterIdx]?.stationHint}`,
                          tone: 'warn',
                        });
                      }
                    }}
                    onClearCameraPreset={() => {}}
                  />
                </div>
              </div>
            )}

            {/* 2. RESUSCITATION SEQUENCE CHAIN BLITZ */}
            {activeChallenge === 'protocol_sequence' && (
              <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-cyan-400">
                      STEP {lockedStepIds.length + 1} OF {SEQUENCE_STEPS.length}
                    </div>
                    <h3 className="text-lg font-bold text-slate-100">
                      Click Each Resuscitation Action in Exact Clinical Sequence
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Mistakes: {seqMistakes}
                  </span>
                </div>

                {/* Progress Chain Slots */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {SEQUENCE_STEPS.map((st, idx) => {
                    const locked = lockedStepIds.includes(st.id);
                    return (
                      <div
                        key={st.id}
                        className={`p-3 rounded-xl border text-center ${
                          locked
                            ? 'bg-emerald-950/50 border-emerald-500/70 text-emerald-200'
                            : idx === lockedStepIds.length
                            ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200'
                            : 'bg-[#070B14] border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="text-[10px] font-mono">0{idx + 1}</div>
                        <div className="text-xs font-bold mt-0.5">
                          {locked ? st.shortCode : '???'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selectable Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shuffledSteps.map((tile) => {
                    const done = lockedStepIds.includes(tile.id);
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        disabled={done}
                        onClick={() => {
                          const expectedStep =
                            SEQUENCE_STEPS[lockedStepIds.length];
                          if (tile.id === expectedStep.id) {
                            const nextLocked = [...lockedStepIds, tile.id];
                            setLockedStepIds(nextLocked);
                            playSimulationTone(
                              'correct',
                              settings.audioFeedbackEnabled
                            );
                            setFeedbackToast({
                              text: `Step 0${tile.order} Confirmed: ${tile.label}`,
                              tone: 'ok',
                            });
                            if (nextLocked.length === SEQUENCE_STEPS.length) {
                              const score = Math.max(
                                20,
                                100 - seqMistakes * 15
                              );
                              finishChallenge(
                                'protocol_sequence',
                                score,
                                seqCriticals,
                                elapsedSec + 1
                              );
                            }
                          } else {
                            const isPrematureShock = tile.id === 'analyze_shock';
                            setSeqMistakes((m) => m + 1);
                            if (isPrematureShock) {
                              setSeqCriticals((c) => c + 1);
                              playSimulationTone(
                                'critical',
                                settings.audioFeedbackEnabled
                              );
                              setFeedbackToast({
                                text: 'CRITICAL SAFETY ERROR: Attempting shock before assessment & pad attachment!',
                                tone: 'crit',
                              });
                            } else {
                              playSimulationTone(
                                'warning',
                                settings.audioFeedbackEnabled
                              );
                              setFeedbackToast({
                                text: `Out of sequence — ${expectedStep.shortCode} comes first`,
                                tone: 'warn',
                              });
                            }
                          }
                        }}
                        className={`p-4 rounded-xl border text-left transition-colors ${
                          done
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 opacity-60'
                            : 'bg-[#070B14] hover:bg-slate-900 border-slate-700 hover:border-cyan-400 text-slate-100'
                        }`}
                      >
                        <div className="text-[11px] font-mono text-cyan-400">
                          {done ? 'LOCKED' : 'SELECT ACTION'}
                        </div>
                        <div className="text-sm font-bold mt-1">{tile.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. LIVE TELEMETRY CRISIS READ */}
            {activeChallenge === 'rhythm_vital_scan' && (
              <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-6 space-y-6">
                {(() => {
                  const cur = TELEMETRY_CASES[telemetryIdx];
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                        <span>
                          MONITOR CASE {telemetryIdx + 1} OF{' '}
                          {TELEMETRY_CASES.length}
                        </span>
                        <span>Hits: {telemetryHits}</span>
                      </div>

                      {/* Simulated Bedside Monitor Screen */}
                      <div className="rounded-xl bg-[#040810] border border-slate-800 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                        <div className="lg:col-span-7 space-y-2">
                          <div className="text-xs font-mono text-slate-300">
                            {cur.rhythmLabel}
                          </div>
                          <svg
                            viewBox="0 0 220 44"
                            className="w-full h-20 bg-[#070B14] rounded-lg border border-slate-800/80 p-2"
                          >
                            <path
                              d={cur.wavePath}
                              fill="none"
                              stroke={cur.waveColor}
                              strokeWidth="2.4"
                            />
                          </svg>
                        </div>

                        <div className="lg:col-span-5 grid grid-cols-2 gap-2.5 font-mono tabular-nums">
                          <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                            <div className="text-[10px] text-slate-400">HR</div>
                            <div className="text-xl font-bold text-emerald-400">
                              {cur.hr} bpm
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                            <div className="text-[10px] text-slate-400">BP</div>
                            <div className="text-xl font-bold text-amber-300">
                              {cur.bp}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                            <div className="text-[10px] text-slate-400">SpO2</div>
                            <div className="text-xl font-bold text-sky-400">
                              {cur.spo2}%
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                            <div className="text-[10px] text-slate-400">RR</div>
                            <div className="text-xl font-bold text-slate-100">
                              {cur.rr}/min
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {cur.options.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              const isCorrect = opt.id === cur.correctId;
                              const nextHits = isCorrect
                                ? telemetryHits + 1
                                : telemetryHits;
                              const nextCrit = opt.criticalWrong
                                ? telemetryCriticals + 1
                                : telemetryCriticals;

                              if (isCorrect) {
                                setTelemetryHits(nextHits);
                                playSimulationTone(
                                  'correct',
                                  settings.audioFeedbackEnabled
                                );
                                setFeedbackToast({
                                  text: `Correct intervention: ${opt.label}`,
                                  tone: 'ok',
                                });
                              } else if (opt.criticalWrong) {
                                setTelemetryCriticals(nextCrit);
                                playSimulationTone(
                                  'critical',
                                  settings.audioFeedbackEnabled
                                );
                                setFeedbackToast({
                                  text: `CRITICAL SAFETY MISTAKE: ${opt.label}`,
                                  tone: 'crit',
                                });
                              } else {
                                playSimulationTone(
                                  'warning',
                                  settings.audioFeedbackEnabled
                                );
                                setFeedbackToast({
                                  text: `Suboptimal priority: ${opt.label}`,
                                  tone: 'warn',
                                });
                              }

                              if (telemetryIdx + 1 >= TELEMETRY_CASES.length) {
                                finishChallenge(
                                  'rhythm_vital_scan',
                                  (nextHits / TELEMETRY_CASES.length) * 100,
                                  nextCrit,
                                  elapsedSec + 1
                                );
                              } else {
                                setTelemetryIdx((i) => i + 1);
                              }
                            }}
                            className="p-4 rounded-xl bg-[#070B14] hover:bg-slate-900 border border-slate-700 hover:border-cyan-400 text-left text-sm font-semibold text-slate-100 transition-colors"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* 4. START SURGE TAGGING BLITZ */}
            {activeChallenge === 'rapid_triage_blitz' && (
              <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TRIAGE_CASUALTIES.map((cas, idx) => {
                    const active = idx === triageIdx;
                    const assigned = triageTags[cas.id];
                    return (
                      <div
                        key={cas.id}
                        className={`p-3.5 rounded-xl border ${
                          active
                            ? 'bg-cyan-950/35 border-cyan-400'
                            : assigned
                            ? 'bg-[#070B14] border-slate-700 opacity-75'
                            : 'bg-[#070B14] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-cyan-300 font-bold">{cas.id}</span>
                          <span className="text-slate-400">
                            {assigned || cas.bay}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100 mt-1">
                          {cas.summary}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {TRIAGE_CASUALTIES[triageIdx] && (
                  <div className="rounded-xl bg-[#070B14] border border-slate-800 p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono text-cyan-400">
                          ACTIVE CASUALTY · {TRIAGE_CASUALTIES[triageIdx].id} (
                          {TRIAGE_CASUALTIES[triageIdx].bay})
                        </div>
                        <h3 className="text-lg font-bold text-white mt-0.5">
                          {TRIAGE_CASUALTIES[triageIdx].summary}
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        Hotkeys: [Z] [X] [C] [B]
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono tabular-nums text-xs">
                      <div className="p-3 rounded-lg bg-[#0B1220] border border-slate-800">
                        <div className="text-[10px] text-slate-400">HR</div>
                        <div className="text-base font-bold text-white">
                          {TRIAGE_CASUALTIES[triageIdx].hr} bpm
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B1220] border border-slate-800">
                        <div className="text-[10px] text-slate-400">RR</div>
                        <div className="text-base font-bold text-cyan-300">
                          {TRIAGE_CASUALTIES[triageIdx].rr}/min
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B1220] border border-slate-800">
                        <div className="text-[10px] text-slate-400">SpO2</div>
                        <div className="text-base font-bold text-sky-300">
                          {TRIAGE_CASUALTIES[triageIdx].spo2}%
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B1220] border border-slate-800">
                        <div className="text-[10px] text-slate-400">Mental</div>
                        <div className="text-xs font-bold text-amber-300 mt-0.5">
                          {TRIAGE_CASUALTIES[triageIdx].mental}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B1220] border border-slate-800">
                        <div className="text-[10px] text-slate-400">Bleeding</div>
                        <div className="text-xs font-bold text-red-300 mt-0.5">
                          {TRIAGE_CASUALTIES[triageIdx].bleeding}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(
                        [
                          {
                            key: 'Z',
                            cat: 'IMMEDIATE',
                            cls: 'border-red-500/70 bg-red-950/35 hover:bg-red-900/50 text-red-100',
                          },
                          {
                            key: 'X',
                            cat: 'DELAYED',
                            cls: 'border-amber-500/70 bg-amber-950/35 hover:bg-amber-900/50 text-amber-100',
                          },
                          {
                            key: 'C',
                            cat: 'MINOR',
                            cls: 'border-emerald-500/70 bg-emerald-950/35 hover:bg-emerald-900/50 text-emerald-100',
                          },
                          {
                            key: 'B',
                            cat: 'EXPECTANT',
                            cls: 'border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-200',
                          },
                        ] as const
                      ).map((btn) => (
                        <button
                          key={btn.cat}
                          type="button"
                          onClick={() => handleAssignBlitzTag(btn.cat)}
                          className={`p-3.5 rounded-xl border font-mono text-xs font-bold transition-colors ${btn.cls}`}
                        >
                          [{btn.key}] {btn.cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. 60S GOLDEN-MINUTE REFLEX GAUNTLET */}
            {activeChallenge === 'golden_minute_reflex' && (
              <div className="rounded-2xl bg-[#0B1220] border border-slate-800 p-6 space-y-6">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                  <span>
                    RAPID CALL {reflexIdx + 1} OF {REFLEX_ROUNDS.length}
                  </span>
                  <span>Streak Hits: {reflexHits}</span>
                </div>

                <h3 className="text-xl font-bold text-white">
                  {REFLEX_ROUNDS[reflexIdx]?.prompt}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {REFLEX_ROUNDS[reflexIdx]?.options.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        const cur = REFLEX_ROUNDS[reflexIdx];
                        const ok = opt.label === cur.correct;
                        const nextHits = ok ? reflexHits + 1 : reflexHits;
                        const nextCrit = opt.critical
                          ? reflexCriticals + 1
                          : reflexCriticals;

                        if (ok) {
                          setReflexHits(nextHits);
                          playSimulationTone(
                            'correct',
                            settings.audioFeedbackEnabled
                          );
                          setFeedbackToast({
                            text: `Confirmed: ${opt.label}`,
                            tone: 'ok',
                          });
                        } else if (opt.critical) {
                          setReflexCriticals(nextCrit);
                          playSimulationTone(
                            'critical',
                            settings.audioFeedbackEnabled
                          );
                          setFeedbackToast({
                            text: `CRITICAL SAFETY ERROR: ${opt.label}`,
                            tone: 'crit',
                          });
                        } else {
                          playSimulationTone(
                            'warning',
                            settings.audioFeedbackEnabled
                          );
                          setFeedbackToast({
                            text: `Missed — Expected: ${cur.correct}`,
                            tone: 'warn',
                          });
                        }

                        if (reflexIdx + 1 >= REFLEX_ROUNDS.length) {
                          finishChallenge(
                            'golden_minute_reflex',
                            (nextHits / REFLEX_ROUNDS.length) * 100,
                            nextCrit,
                            elapsedSec + 1
                          );
                        } else {
                          setReflexIdx((i) => i + 1);
                        }
                      }}
                      className="p-4 rounded-xl bg-[#070B14] hover:bg-slate-900 border border-slate-700 hover:border-cyan-400 text-left text-sm font-semibold text-slate-100 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // TRAINING ARENA HUB (5 INTERACTIVE CHALLENGES)
  // ---------------------------------------------------------------------------
  return (
    <div className="p-5 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Visual Arena Hero Banner */}
      <section className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#0B1220] min-h-[180px] flex items-end">
        <img
          src={VISUAL_ASSETS.trainingArenaBanner}
          alt="Interactive clinical reflex & equipment training arena"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070B14] via-[#070B14]/80 to-transparent" />
        <div className="relative p-6 lg:p-8 w-full flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-cyan-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              INTERACTIVE SKILL DRILLS · LIVE XP &amp; SAFETY TELEMETRY
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Responder Training Arena
            </h1>
            <p className="text-xs text-slate-300">
              3D equipment spotting · Resuscitation sequencing · Live waveform reads · Surge triage blitz
            </p>
          </div>

          <div className="flex items-center gap-4 font-mono tabular-nums text-xs">
            <div className="px-3.5 py-2 rounded-xl bg-[#070B14]/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Drills Logged</div>
              <div className="text-base font-bold text-white">
                {userDrills.length}
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#070B14]/90 border border-slate-800">
              <div className="text-[10px] text-slate-400">Drill XP Earned</div>
              <div className="text-base font-bold text-cyan-300">
                +{userDrills.reduce((s, d) => s + d.xpEarned, 0)} XP
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Playable Challenge Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CHALLENGE_CARDS.map((card) => {
          const Icon = card.icon;
          const pb = bestByType[card.id];
          return (
            <div
              key={card.id}
              className="rounded-xl bg-[#0B1220] border border-slate-800 hover:border-cyan-500/60 p-5 flex flex-col justify-between space-y-5 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800">
                    <Icon className={`w-5 h-5 ${card.accent}`} />
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-300">
                    {card.durationSec}s ·{' '}
                    <span className="text-cyan-300 font-semibold">
                      +{card.maxXp} XP
                    </span>
                  </div>
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    {card.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">{card.tagline}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  {pb ? (
                    <>
                      <span className="text-slate-300 inline-flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        Best {pb.scorePct}% ({pb.durationSec}s)
                      </span>
                      <span className="text-emerald-400">+{pb.xpEarned} XP</span>
                    </>
                  ) : (
                    <span className="text-slate-500">New Challenge</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => startChallenge(card.id)}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start Challenge
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Compact Recent Drill Feed */}
      {userDrills.length > 0 && (
        <section className="rounded-xl bg-[#0B1220] border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Recent Arena Runs
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('skill-tree')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
            >
              Skill Tree Progression →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {userDrills.slice(0, 4).map((d) => (
              <div
                key={d.id}
                className="p-3 rounded-lg bg-[#070B14] border border-slate-800 text-xs space-y-1"
              >
                <div className="font-semibold text-slate-100 truncate">
                  {d.title}
                </div>
                <div className="font-mono tabular-nums text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    {d.scorePct}% · {d.durationSec}s
                  </span>
                  <span className="text-cyan-300 font-semibold">
                    +{d.xpEarned} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

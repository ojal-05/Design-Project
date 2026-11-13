import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  Eye,
  HeartPulse,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Square,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  calculateSessionAssessment,
  generateRuleBasedDebrief,
} from '../engine/assessmentEngine';
import {
  advancePatientsTick,
  executeTraineeAction,
} from '../engine/patientEngine';
import {
  EQUIPMENT_KIT_PRESETS,
  getDefaultResponderProfile,
} from '../engine/progressionEngine';
import {
  applyDisruptionEffect,
  generateDisruptionSchedule,
} from '../engine/worldDisruptionEngine';
import { requestSessionDebrief } from '../services/storageService';
import {
  ActionEventRecord,
  DrillAttemptRecord,
  EnvironmentConfig,
  NavSection,
  PatientState,
  PlatformSettings,
  ScenarioDefinition,
  ScheduledDisruption,
  TriageCategory,
  TrainingSession,
  UserAccount,
  VitalTimelinePoint,
} from '../types/simulation';
import { getScenarioVisual } from '../utils/scenarioVisuals';
import {
  immersiveAudio,
  type ActionSoundKind,
} from '../utils/immersiveAudioEngine';
import { playSimulationTone } from '../utils/soundEffects';
import { AfterActionReviewView } from './AfterActionReviewView';
import {
  CameraPreset,
  EmergencyRoomScene,
  InteractiveTargetId,
} from './simulation3d/EmergencyRoomScene';
import type { ProximityTargetInfo } from './simulation3d/FirstPersonResponderRig';

interface SimulationCentreViewProps {
  scenarios: ScenarioDefinition[];
  activeScenarioId: string;
  currentUser: UserAccount;
  existingSessions: TrainingSession[];
  drills?: DrillAttemptRecord[];
  settings: PlatformSettings;
  onUpdateSettings?: (next: PlatformSettings) => void;
  onSelectScenarioId: (id: string) => void;
  onSaveSession: (session: TrainingSession) => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
  onImmersiveModeChange?: (immersive: boolean) => void;
}

interface ContextualActionOption {
  hotkey: string;
  actionType: string;
  label: string;
  targetOverride: InteractiveTargetId;
  triageCategory?: TriageCategory;
  statusTag?: string;
  highlight?: 'primary' | 'amber' | 'danger' | 'default';
}

function clonePatients(patients: PatientState[]): PatientState[] {
  return patients.map((p) => ({ ...p }));
}

function cloneEnvironment(env: EnvironmentConfig): EnvironmentConfig {
  return {
    ...env,
    resources: { ...env.resources },
  };
}

export const SimulationCentreView: React.FC<SimulationCentreViewProps> = ({
  scenarios,
  activeScenarioId,
  currentUser,
  existingSessions,
  drills = [],
  settings,
  onUpdateSettings,
  onSelectScenarioId,
  onSaveSession,
  onNavigate,
  onImmersiveModeChange,
}) => {
  const availableScenarios = useMemo(
    () => scenarios.filter((s) => !s.archived),
    [scenarios]
  );

  const scenario = useMemo(
    () =>
      availableScenarios.find((s) => s.id === activeScenarioId) ||
      availableScenarios[0],
    [availableScenarios, activeScenarioId]
  );

  const responderProfile = useMemo(
    () => getDefaultResponderProfile(currentUser),
    [currentUser]
  );

  const [simStatus, setSimStatus] = useState<
    'briefing' | 'running' | 'paused' | 'completed'
  >('briefing');
  const [controlMode, setControlMode] = useState<'first_person' | 'orbit'>(
    'first_person'
  );
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [pointerLockReqCount, setPointerLockReqCount] = useState(0);
  const [nearbyInfo, setNearbyInfo] = useState<ProximityTargetInfo | null>(null);
  const [interactionPulse, setInteractionPulse] = useState<{
    seq: number;
    kind: 'reach' | 'cpr' | 'shock';
  }>({ seq: 0, kind: 'reach' });

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(
    scenario?.durationLimitSec || 360
  );
  const [patients, setPatients] = useState<PatientState[]>(() =>
    scenario ? clonePatients(scenario.initialPatients) : []
  );
  const [environment, setEnvironment] = useState<EnvironmentConfig>(() =>
    scenario
      ? cloneEnvironment(scenario.environmentConfig)
      : {
          lightingMode: 'Clinical Standard',
          ambientNoiseLevel: 'Moderate',
          primaryAedOperational: true,
          exitClear: true,
          resources: {
            oxygenCylinders: 2,
            hemorrhageKits: 2,
            woundDressings: 3,
            aedPadsSets: 2,
            backupAedAvailable: true,
          },
        }
  );
  const [disruptions, setDisruptions] = useState<ScheduledDisruption[]>(() =>
    scenario
      ? generateDisruptionSchedule(
          scenario.disruptionsConfig,
          scenario.durationLimitSec
        )
      : []
  );
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    scenario?.initialPatients[0]?.patientId || 'PT-101'
  );
  const [selectedObject, setSelectedObject] =
    useState<InteractiveTargetId>('Virtual Patient');
  const [events, setEvents] = useState<ActionEventRecord[]>([]);
  const [vitalTimeline, setVitalTimeline] = useState<VitalTimelinePoint[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<{
    id: number;
    correctness: ActionEventRecord['correctness'];
    severity: ActionEventRecord['errorSeverity'];
    message: string;
    label: string;
  } | null>(null);
  const [completedSession, setCompletedSession] =
    useState<TrainingSession | null>(null);
  const [generatingDebrief, setGeneratingDebrief] = useState(false);
  const [objectivesExpanded, setObjectivesExpanded] = useState(false);
  const [audioMixerOpen, setAudioMixerOpen] = useState(false);
  const [briefingDetailsExpanded, setBriefingDetailsExpanded] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);
  const [sessionId, setSessionId] = useState<string>(`sess_live_${Date.now()}`);
  const [startedAtIso, setStartedAtIso] = useState<string>(
    new Date().toISOString()
  );
  const [resetSignal, setResetSignal] = useState<string>('init_0');

  const lastActionElapsedRef = useRef<number>(0);
  const completedActionsRef = useRef<Set<string>>(new Set());

  // Notify parent App shell to collapse chrome during active 3D gameplay
  useEffect(() => {
    onImmersiveModeChange?.(simStatus === 'running' || simStatus === 'paused');
    return () => {
      onImmersiveModeChange?.(false);
    };
  }, [simStatus, onImmersiveModeChange]);

  // Auto-sync proximity target into selectedPatientId & selectedObject in First-Person mode
  useEffect(() => {
    if (controlMode === 'first_person' && nearbyInfo) {
      setSelectedObject(nearbyInfo.target);
      if (nearbyInfo.patientId) {
        setSelectedPatientId(nearbyInfo.patientId);
      }
    }
  }, [controlMode, nearbyInfo]);

  // Auto-fade transient HUD feedback toast after 4.5s so viewport stays clean
  useEffect(() => {
    if (!latestFeedback) return;
    const t = window.setTimeout(() => {
      setLatestFeedback((curr) =>
        curr?.id === latestFeedback.id ? null : curr
      );
    }, 4500);
    return () => window.clearTimeout(t);
  }, [latestFeedback]);

  const resetToScenario = useCallback((scen: ScenarioDefinition) => {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    setSimStatus('briefing');
    setElapsedSec(0);
    setRemainingSec(scen.durationLimitSec);
    setPatients(clonePatients(scen.initialPatients));
    setEnvironment(cloneEnvironment(scen.environmentConfig));
    setDisruptions(
      generateDisruptionSchedule(scen.disruptionsConfig, scen.durationLimitSec)
    );
    setSelectedPatientId(scen.initialPatients[0]?.patientId || 'PT-101');
    setSelectedObject('Virtual Patient');
    setNearbyInfo(null);
    setEvents([]);
    setVitalTimeline(
      scen.initialPatients.map((p) => ({
        elapsedSec: 0,
        patientId: p.patientId,
        patientName: p.name,
        heartRate: p.heartRate,
        systolicBP: p.systolicBP,
        respiratoryRate: p.respiratoryRate,
        spo2: p.spo2,
        conditionStatus: p.conditionStatus,
        eventMarker: 'Initial Presentation',
      }))
    );
    setLatestFeedback(null);
    setCompletedSession(null);
    setSessionId(`sess_live_${Date.now()}`);
    setResetSignal(`${scen.id}_${Date.now()}`);
    lastActionElapsedRef.current = 0;
    completedActionsRef.current = new Set();
    setCameraPreset({
      id: 'overview',
      label: 'Overview',
      position:
        scen.mode === 'cardiac_arrest' ? [0, 3.3, 4.4] : [0, 4.4, 6.2],
      target:
        scen.mode === 'cardiac_arrest' ? [0, 0.9, -0.5] : [0, 0.9, -0.4],
    });
  }, []);

  useEffect(() => {
    if (scenario) {
      resetToScenario(scenario);
    }
  }, [scenario, resetToScenario]);

  const activePatient = useMemo(
    () =>
      patients.find((p) => p.patientId === selectedPatientId) || patients[0],
    [patients, selectedPatientId]
  );

  // Sync user audio mixer preferences into ImmersiveAudioEngine
  useEffect(() => {
    immersiveAudio.setPreferences({
      enabled: settings.audioFeedbackEnabled,
      masterVolume: settings.masterVolume ?? 0.78,
      ambienceVolume: settings.ambienceVolume ?? 0.68,
      sfxVolume: settings.sfxVolume ?? 0.85,
      musicEnabled: Boolean(settings.musicEnabled),
    });
  }, [
    settings.audioFeedbackEnabled,
    settings.masterVolume,
    settings.ambienceVolume,
    settings.sfxVolume,
    settings.musicEnabled,
  ]);

  // Sync live 3D Hospital / Disaster Environmental & Spatial Monitor Telemetry Audio
  useEffect(() => {
    if (!scenario || !activePatient || simStatus !== 'running') {
      immersiveAudio.suspendContinuousLayers();
      return;
    }
    const monitorPos: [number, number, number] =
      scenario.mode === 'cardiac_arrest' ? [1.38, 1.46, -1.35] : [0, 1.46, -2.75];
    const ambulancePos: [number, number, number] =
      scenario.mode === 'cardiac_arrest' ? [0, 1.4, 5.25] : [0, 1.5, 5.65];

    immersiveAudio.syncSimulationEnvironment({
      mode: scenario.mode,
      isRunning: true,
      ambientNoiseLevel: environment.ambientNoiseLevel,
      lightingMode: environment.lightingMode,
      heartRate: activePatient.heartRate,
      spo2: activePatient.spo2,
      conditionStatus: activePatient.conditionStatus,
      oxygenApplied: patients.some((p) => p.oxygenApplied),
      cprActive: patients.some((p) => p.cprActive),
      monitorPos,
      ambulancePos,
    });
  }, [
    scenario,
    activePatient,
    patients,
    simStatus,
    environment.ambientNoiseLevel,
    environment.lightingMode,
  ]);

  useEffect(() => {
    return () => {
      immersiveAudio.suspendContinuousLayers();
    };
  }, []);

  const updateAudioSetting = useCallback(
    (patch: Partial<PlatformSettings>) => {
      const merged: PlatformSettings = { ...settings, ...patch };
      immersiveAudio.unlockAndResume();
      immersiveAudio.setPreferences({
        enabled: merged.audioFeedbackEnabled,
        masterVolume: merged.masterVolume ?? 0.78,
        ambienceVolume: merged.ambienceVolume ?? 0.68,
        sfxVolume: merged.sfxVolume ?? 0.85,
        musicEnabled: Boolean(merged.musicEnabled),
      });
      onUpdateSettings?.(merged);
    },
    [settings, onUpdateSettings]
  );

  // Camera presets for Tactical Orbit mode
  const cameraPresets = useMemo((): CameraPreset[] => {
    if (!scenario) return [];
    if (scenario.mode === 'cardiac_arrest') {
      return [
        {
          id: 'overview',
          label: 'Room Overview',
          position: [0, 3.3, 4.4],
          target: [0, 0.9, -0.5],
        },
        {
          id: 'bedside',
          label: 'Bedside',
          position: [0.85, 2.05, 1.45],
          target: [0, 0.95, -0.35],
        },
        {
          id: 'aed_monitor',
          label: 'AED & Monitor',
          position: [-0.2, 1.95, 1.55],
          target: [0.05, 1.15, -0.95],
        },
      ];
    }

    return [
      {
        id: 'overview',
        label: 'Ward Overview',
        position: [0, 4.4, 6.2],
        target: [0, 0.9, -0.4],
      },
      ...patients.map((p, idx) => {
        const count = patients.length;
        const bx = count <= 4 ? -4.2 + idx * 2.8 : -5.2 + idx * 2.6;
        return {
          id: `bay_${p.patientId}`,
          label: `Bay 0${p.bayNumber}`,
          position: [bx, 2.35, 2.1] as [number, number, number],
          target: [bx, 0.95, -0.8] as [number, number, number],
        };
      }),
    ];
  }, [scenario, patients]);

  // Complete mission & run assessment engine
  const handleCompleteSimulation = useCallback(
    (finalElapsed?: number, currentPats?: PatientState[]) => {
      if (!scenario) return;
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      const usedElapsed = finalElapsed ?? elapsedSec;
      const usedPatients = currentPats ?? patients;

      const priorAttempts = existingSessions.filter(
        (s) => s.traineeId === currentUser.id && s.scenarioId === scenario.id
      ).length;

      const assessment = calculateSessionAssessment(
        sessionId,
        scenario,
        events,
        usedPatients,
        Math.max(1, usedElapsed)
      );

      const newSession: TrainingSession = {
        id: sessionId,
        traineeId: currentUser.id,
        traineeName: currentUser.name,
        scenarioId: scenario.id,
        scenarioCode: scenario.code,
        scenarioTitle: scenario.title,
        scenarioMode: scenario.mode,
        difficulty: scenario.difficulty,
        attemptNumber: priorAttempts + 1,
        startedAt: startedAtIso,
        completedAt: new Date().toISOString(),
        durationSec: Math.max(1, usedElapsed),
        status: 'completed',
        seed: scenario.disruptionsConfig.seed,
        isDemo: false,
        events,
        vitalTimeline,
        disruptions,
        finalPatients: usedPatients,
        assessment,
        debrief: null,
        instructorNotes: '',
      };

      newSession.debrief = generateRuleBasedDebrief(newSession, scenario);

      setSimStatus('completed');
      setCompletedSession(newSession);
      onSaveSession(newSession);
      playSimulationTone('mission_complete', settings.audioFeedbackEnabled);
    },
    [
      scenario,
      elapsedSec,
      patients,
      existingSessions,
      currentUser,
      sessionId,
      events,
      startedAtIso,
      vitalTimeline,
      disruptions,
      onSaveSession,
      settings.audioFeedbackEnabled,
    ]
  );

  // 1-second simulation clock, physiological progression, monitor cadence & disruption scheduler
  useEffect(() => {
    if (simStatus !== 'running' || !scenario) return;

    const timer = window.setInterval(() => {
      setElapsedSec((prevElapsed) => {
        const nextElapsed = prevElapsed + 1;

        // Spatial QRS telemetry & clinical alarm cadence are driven in real time by ImmersiveAudioEngine

        setPatients((prevPatients) => {
          let progressed = advancePatientsTick(prevPatients, scenario.mode, 1);

          setDisruptions((prevDisr) => {
            let changed = false;
            const updatedDisr = prevDisr.map((d) => {
              if (!d.triggered && nextElapsed >= d.triggerAtSec) {
                changed = true;
                const applied = applyDisruptionEffect(
                  d,
                  progressed,
                  environment,
                  remainingSec
                );
                progressed = applied.patients;
                setEnvironment(applied.environment);
                setRemainingSec(applied.remainingSec);
                setLatestFeedback({
                  id: Date.now(),
                  correctness: 'delayed',
                  severity: 'Moderate',
                  label: `DISRUPTION: ${d.title}`,
                  message: `${d.description} (${d.mitigationHint})`,
                });
                playSimulationTone('disruption', settings.audioFeedbackEnabled);
                return { ...d, triggered: true };
              }
              return d;
            });
            return changed ? updatedDisr : prevDisr;
          });

          if (nextElapsed % 10 === 0) {
            setVitalTimeline((prevTl) => [
              ...prevTl,
              ...progressed.map((p) => ({
                elapsedSec: nextElapsed,
                patientId: p.patientId,
                patientName: p.name,
                heartRate: p.heartRate,
                systolicBP: p.systolicBP,
                respiratoryRate: p.respiratoryRate,
                spo2: p.spo2,
                conditionStatus: p.conditionStatus,
              })),
            ]);
          }

          return progressed;
        });

        setRemainingSec((prevRem) => {
          const nextRem = prevRem - 1;
          if (nextRem <= 0) {
            window.clearInterval(timer);
            setTimeout(() => handleCompleteSimulation(nextElapsed), 0);
            return 0;
          }
          return nextRem;
        });

        return nextElapsed;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    simStatus,
    scenario,
    environment,
    remainingSec,
    settings.audioFeedbackEnabled,
    handleCompleteSimulation,
  ]);

  const handleDeployMission = () => {
    immersiveAudio.unlockAndResume();
    setStartedAtIso(new Date().toISOString());
    setSimStatus('running');
    playSimulationTone('mission_start', settings.audioFeedbackEnabled);
    if (controlMode === 'first_person') {
      setPointerLockReqCount((c) => c + 1);
    }
  };

  // Perform clinical/environmental action, animate first-person hands & log ActionEventRecord
  const performAction = useCallback(
    (
      actionType: string,
      actionLabel: string,
      targetObjectOverride?: InteractiveTargetId,
      triageSelection?: TriageCategory
    ) => {
      if (!scenario || !activePatient) return;
      if (simStatus === 'briefing') {
        setStartedAtIso(new Date().toISOString());
        setSimStatus('running');
      }
      if (simStatus === 'completed') return;

      const targetObj = targetObjectOverride || selectedObject;
      const responseTimeSec = Math.max(
        1,
        elapsedSec - lastActionElapsedRef.current
      );
      lastActionElapsedRef.current = elapsedSec;

      // Trigger first-person hand animation
      setInteractionPulse((prev) => ({
        seq: prev.seq + 1,
        kind:
          actionType === 'start_cpr'
            ? 'cpr'
            : actionType === 'deliver_shock'
            ? 'shock'
            : 'reach',
      }));

      const nextExpectedStep = scenario.expectedActions.find((step) => {
        const key = step.patientId
          ? `${step.actionType}:${step.patientId}`
          : step.actionType;
        return !completedActionsRef.current.has(key);
      });

      const transition = executeTraineeAction({
        mode: scenario.mode,
        actionType,
        targetObject: targetObj,
        patientId: activePatient.patientId,
        triageSelection,
        patients,
        environment,
        completedActions: completedActionsRef.current,
        elapsedSec,
      });

      setPatients(transition.updatedPatients);
      setEnvironment(transition.updatedEnvironment);

      if (actionType === 'activate_backup_aed') {
        setDisruptions((prev) =>
          prev.map((d) =>
            d.type === 'equipment_unavailable' ? { ...d, resolved: true } : d
          )
        );
      } else if (actionType === 'clear_blocked_exit') {
        setDisruptions((prev) =>
          prev.map((d) =>
            d.type === 'blocked_exit' ? { ...d, resolved: true } : d
          )
        );
      } else if (actionType === 'restore_lighting') {
        setDisruptions((prev) =>
          prev.map((d) =>
            d.type === 'lighting_fluctuation' ? { ...d, resolved: true } : d
          )
        );
      }

      if (
        transition.correctness === 'correct' ||
        transition.correctness === 'delayed' ||
        transition.correctness === 'out_of_sequence'
      ) {
        const key = `${actionType}:${activePatient.patientId}`;
        completedActionsRef.current.add(key);
        completedActionsRef.current.add(actionType);
      }

      const updatedTargetPatient =
        transition.updatedPatients.find(
          (p) => p.patientId === activePatient.patientId
        ) || transition.updatedPatients[0];

      const newEvent: ActionEventRecord = {
        eventId: `${sessionId}_ev_${events.length + 1}`,
        sessionId,
        traineeId: currentUser.id,
        scenarioId: scenario.id,
        timestamp: new Date().toISOString(),
        elapsedSec,
        actionType,
        actionLabel,
        targetObject: targetObj,
        patientId: updatedTargetPatient.patientId,
        expectedAction: nextExpectedStep
          ? nextExpectedStep.label
          : 'Post-Stabilisation Monitoring',
        correctness: transition.correctness,
        responseTimeSec,
        sequencePosition: events.length + 1,
        errorType: transition.errorType,
        errorSeverity: transition.errorSeverity,
        feedbackMessage: transition.feedbackMessage,
        patientState: {
          patientId: updatedTargetPatient.patientId,
          heartRate: updatedTargetPatient.heartRate,
          systolicBP: updatedTargetPatient.systolicBP,
          diastolicBP: updatedTargetPatient.diastolicBP,
          respiratoryRate: updatedTargetPatient.respiratoryRate,
          spo2: updatedTargetPatient.spo2,
          consciousness: updatedTargetPatient.consciousness,
          conditionStatus: updatedTargetPatient.conditionStatus,
          assignedTriage: updatedTargetPatient.assignedTriage,
        },
        scenarioState: {
          remainingSec,
          activeDisruptions: disruptions
            .filter((d) => d.triggered && !d.resolved)
            .map((d) => d.title),
          resourcesRemaining: { ...transition.updatedEnvironment.resources },
        },
      };

      setEvents((prev) => [...prev, newEvent]);
      setVitalTimeline((prev) => [
        ...prev,
        {
          elapsedSec,
          patientId: updatedTargetPatient.patientId,
          patientName: updatedTargetPatient.name,
          heartRate: updatedTargetPatient.heartRate,
          systolicBP: updatedTargetPatient.systolicBP,
          respiratoryRate: updatedTargetPatient.respiratoryRate,
          spo2: updatedTargetPatient.spo2,
          conditionStatus: updatedTargetPatient.conditionStatus,
          eventMarker: actionLabel,
        },
      ]);

      setLatestFeedback({
        id: Date.now(),
        correctness: transition.correctness,
        severity: transition.errorSeverity,
        label: actionLabel,
        message: transition.feedbackMessage,
      });

      if (settings.audioFeedbackEnabled) {
        immersiveAudio.unlockAndResume();
        if (transition.errorSeverity === 'Critical') {
          immersiveAudio.playActionSound('critical');
        } else if (
          transition.correctness === 'incorrect' ||
          transition.correctness === 'out_of_sequence'
        ) {
          immersiveAudio.playActionSound('warning');
        } else {
          const actionSoundMap: Record<string, ActionSoundKind> = {
            check_scene_safety: 'check_scene_safety',
            check_responsiveness: 'check_responsiveness',
            examine_patient: 'check_responsiveness',
            verify_monitor_vitals: 'check_responsiveness',
            open_airway: 'open_airway',
            start_cpr: 'start_cpr',
            power_on_aed: 'power_on_aed',
            attach_aed_pads: 'attach_pads',
            analyze_rhythm: 'analyze_rhythm',
            deliver_shock: 'deliver_shock',
            apply_oxygen: 'apply_oxygen',
            control_bleeding: 'control_bleeding',
            dress_wound: 'apply_dressing',
            call_code_blue: 'call_code_blue',
            activate_backup_aed: 'activate_backup_aed',
            clear_blocked_exit: 'clear_blocked_exit',
            restore_lighting: 'restore_lighting',
            assign_triage: 'assign_triage',
          };
          const mappedSound =
            actionSoundMap[actionType] || 'check_scene_safety';
          immersiveAudio.playActionSound(mappedSound);
        }
      }
    },
    [
      scenario,
      activePatient,
      simStatus,
      selectedObject,
      elapsedSec,
      patients,
      environment,
      sessionId,
      events.length,
      currentUser.id,
      remainingSec,
      disruptions,
      settings.audioFeedbackEnabled,
    ]
  );

  // Build Context-Sensitive Interaction Options for the approached/selected 3D station
  const contextualOptions = useMemo((): ContextualActionOption[] => {
    if (!scenario || !activePatient) return [];

    const activeTarget: InteractiveTargetId =
      controlMode === 'first_person'
        ? nearbyInfo?.target || selectedObject
        : selectedObject;

    if (
      controlMode === 'first_person' &&
      !nearbyInfo
    ) {
      return [];
    }

    if (scenario.mode === 'cardiac_arrest') {
      switch (activeTarget) {
        case 'Hospital Bed':
          return [
            {
              hotkey: '1',
              actionType: 'check_scene_safety',
              label: 'Verify Bay Safety & PPE',
              targetOverride: 'Hospital Bed',
              statusTag: activePatient.sceneChecked ? 'VERIFIED' : 'REQUIRED',
              highlight: !activePatient.sceneChecked ? 'primary' : 'default',
            },
            {
              hotkey: '2',
              actionType: 'check_responsiveness',
              label: 'Assess Responsiveness & Breathing',
              targetOverride: 'Virtual Patient',
              statusTag: activePatient.examined ? 'DONE' : 'NEXT',
            },
          ];

        case 'Virtual Patient':
          return [
            {
              hotkey: '1',
              actionType: 'check_scene_safety',
              label: 'Verify Bay Safety & PPE',
              targetOverride: 'Hospital Bed',
              statusTag: activePatient.sceneChecked ? 'DONE' : 'STEP 1',
              highlight: !activePatient.sceneChecked ? 'primary' : 'default',
            },
            {
              hotkey: '2',
              actionType: 'check_responsiveness',
              label: 'Check Responsiveness & Carotid Pulse',
              targetOverride: 'Virtual Patient',
              statusTag: activePatient.examined ? 'DONE' : 'ASSESS',
              highlight:
                activePatient.sceneChecked && !activePatient.examined
                  ? 'primary'
                  : 'default',
            },
            {
              hotkey: '3',
              actionType: 'open_airway',
              label: 'Head-Tilt Chin-Lift Airway Check',
              targetOverride: 'Virtual Patient',
              statusTag: activePatient.airwayClear ? 'PATENT' : 'OPEN',
              highlight:
                activePatient.examined && !activePatient.airwayClear
                  ? 'primary'
                  : 'default',
            },
            {
              hotkey: '4',
              actionType: 'start_cpr',
              label: activePatient.cprActive
                ? 'Continue Chest Compressions (110/min)'
                : 'Start High-Quality CPR Compressions',
              targetOverride: 'Virtual Patient',
              statusTag: activePatient.cprActive ? 'ACTIVE' : 'START',
              highlight: 'primary',
            },
          ];

        case 'Emergency Call Panel': {
          const opts: ContextualActionOption[] = [
            {
              hotkey: '1',
              actionType: 'call_code_blue',
              label: 'Activate Code Blue Resuscitation Team',
              targetOverride: 'Emergency Call Panel',
              highlight: 'primary',
            },
          ];
          if (!environment.exitClear) {
            opts.push({
              hotkey: '2',
              actionType: 'clear_blocked_exit',
              label: 'Reroute Obstructed Transfer Corridor',
              targetOverride: 'Emergency Call Panel',
              highlight: 'amber',
            });
          }
          if (environment.lightingMode === 'Emergency Backup') {
            opts.push({
              hotkey: String(opts.length + 1),
              actionType: 'restore_lighting',
              label: 'Restore Standard Clinical Lighting',
              targetOverride: 'Emergency Call Panel',
              highlight: 'amber',
            });
          }
          return opts;
        }

        case 'AED Device':
          return [
            {
              hotkey: '1',
              actionType: 'power_on_aed',
              label: 'Power On AED Unit',
              targetOverride: 'AED Device',
              statusTag: activePatient.aedPoweredOn ? 'ON' : 'OFF',
              highlight: !activePatient.aedPoweredOn ? 'primary' : 'default',
            },
            {
              hotkey: '2',
              actionType: 'attach_aed_pads',
              label: 'Attach Anterior-Lateral Chest Pads',
              targetOverride: 'AED Device',
              statusTag: activePatient.padsAttached ? 'ATTACHED' : 'READY',
              highlight:
                activePatient.aedPoweredOn && !activePatient.padsAttached
                  ? 'primary'
                  : 'default',
            },
            {
              hotkey: '3',
              actionType: 'analyze_rhythm',
              label: 'Clear Bedside & Analyze Rhythm',
              targetOverride: 'AED Device',
              statusTag: activePatient.shockAdvised
                ? 'SHOCK ADVISED'
                : activePatient.rhythmAnalyzed
                ? 'ANALYZED'
                : 'ANALYZE',
              highlight:
                activePatient.padsAttached && !activePatient.rhythmAnalyzed
                  ? 'primary'
                  : 'default',
            },
            {
              hotkey: '4',
              actionType: 'deliver_shock',
              label: 'Deliver 200J Biphasic Shock',
              targetOverride: 'AED Device',
              statusTag: `${activePatient.shocksDelivered} DELIVERED`,
              highlight: activePatient.shockAdvised ? 'amber' : 'default',
            },
          ];

        case 'Oxygen Equipment':
          return [
            {
              hotkey: '1',
              actionType: 'apply_oxygen',
              label: 'Administer High-Flow Oxygen (15 L/min)',
              targetOverride: 'Oxygen Equipment',
              statusTag: `${environment.resources.oxygenCylinders} CYL LEFT`,
              highlight: 'primary',
            },
          ];

        case 'Patient Monitor':
          return [
            {
              hotkey: '1',
              actionType: 'verify_monitor_vitals',
              label: 'Verify 12-Lead / Post-ROSC Telemetry',
              targetOverride: 'Patient Monitor',
              statusTag: activePatient.monitorVerified ? 'VERIFIED' : 'INSPECT',
              highlight: 'primary',
            },
          ];

        case 'Medical Trolley':
        case 'Emergency Supplies':
        case 'Bay Exit Doors': {
          const list: ContextualActionOption[] = [];
          if (!environment.primaryAedOperational) {
            list.push({
              hotkey: '1',
              actionType: 'activate_backup_aed',
              label: 'Engage Backup AED Power Module',
              targetOverride: 'Medical Trolley',
              highlight: 'amber',
            });
          }
          if (!environment.exitClear) {
            list.push({
              hotkey: String(list.length + 1),
              actionType: 'clear_blocked_exit',
              label: 'Clear Obstructed Transfer Exit',
              targetOverride: 'Bay Exit Doors',
              highlight: 'amber',
            });
          }
          if (list.length === 0) {
            list.push({
              hotkey: '1',
              actionType: 'check_scene_safety',
              label: 'Confirm Emergency Equipment Readiness',
              targetOverride: 'Hospital Bed',
              statusTag: 'READY',
            });
          }
          return list;
        }
      }
    }

    // MULTI-PATIENT TRIAGE CONTEXTUAL ACTIONS
    if (activeTarget === 'Bay Exit Doors' && !environment.exitClear) {
      return [
        {
          hotkey: '1',
          actionType: 'clear_blocked_exit',
          label: 'Reroute Obstructed Transfer Corridor',
          targetOverride: 'Bay Exit Doors',
          highlight: 'amber',
        },
      ];
    }

    return [
      {
        hotkey: '1',
        actionType: 'examine_patient',
        label: `Examine ${activePatient.patientId} (${activePatient.name.split(' ')[0]})`,
        targetOverride: 'Virtual Patient',
        statusTag: activePatient.examined ? 'EXAMINED' : 'INSPECT',
        highlight: !activePatient.examined ? 'primary' : 'default',
      },
      {
        hotkey: '2',
        actionType: 'open_airway',
        label: `Reposition Airway (${activePatient.patientId})`,
        targetOverride: 'Virtual Patient',
        statusTag: activePatient.airwayClear ? 'PATENT' : 'CLEAR',
      },
      {
        hotkey: '3',
        actionType: 'control_bleeding',
        label: `Apply Hemorrhage Kit (${activePatient.patientId})`,
        targetOverride: 'Emergency Supplies',
        statusTag: `${environment.resources.hemorrhageKits} KITS`,
        highlight:
          activePatient.bleedingSeverity === 'Severe' &&
          !activePatient.bleedingControlled
            ? 'amber'
            : 'default',
      },
      {
        hotkey: '4',
        actionType: 'apply_oxygen',
        label: `Administer Oxygen (${activePatient.patientId})`,
        targetOverride: 'Oxygen Equipment',
        statusTag: `${environment.resources.oxygenCylinders} O2`,
      },
      {
        hotkey: '5',
        actionType: 'dress_wound',
        label: `Apply Sterile Dressing (${activePatient.patientId})`,
        targetOverride: 'Medical Trolley',
        statusTag: `${environment.resources.woundDressings} LEFT`,
      },
    ];
  }, [
    scenario,
    activePatient,
    controlMode,
    nearbyInfo,
    selectedObject,
    environment,
  ]);

  // Smart [E] Primary Action & Number Hotkeys [1]-[5] + Triage Hotkeys [Z][X][C][B] + [V] Camera + [P] Pause + [Tab] Objectives
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Tab' && (simStatus === 'running' || simStatus === 'paused')) {
        e.preventDefault();
        setObjectivesExpanded((prev) => !prev);
        return;
      }

      if (e.code === 'KeyP' && (simStatus === 'running' || simStatus === 'paused')) {
        e.preventDefault();
        if (simStatus === 'running' && document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        setSimStatus((prev) => (prev === 'running' ? 'paused' : 'running'));
        return;
      }

      if (e.code === 'KeyV' && simStatus === 'running') {
        e.preventDefault();
        setControlMode((prev) => {
          const next = prev === 'first_person' ? 'orbit' : 'first_person';
          if (next === 'orbit' && document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          return next;
        });
        return;
      }

      if (simStatus !== 'running') return;

      // Number hotkeys 1-5 trigger contextual options directly
      const digitMatch = e.code.match(/^Digit([1-5])$/);
      if (digitMatch) {
        const idx = Number(digitMatch[1]) - 1;
        const opt = contextualOptions[idx];
        if (opt) {
          e.preventDefault();
          performAction(
            opt.actionType,
            opt.label,
            opt.targetOverride,
            opt.triageCategory
          );
        }
        return;
      }

      // [E] or [F] Smart Quick-Interact with highlighted primary option on nearby station
      if ((e.code === 'KeyE' || e.code === 'KeyF') && contextualOptions.length > 0) {
        e.preventDefault();
        const recommended =
          contextualOptions.find(
            (o) => o.highlight === 'primary' || o.highlight === 'amber'
          ) || contextualOptions[0];
        performAction(
          recommended.actionType,
          recommended.label,
          recommended.targetOverride,
          recommended.triageCategory
        );
        return;
      }

      // Multi-Patient Triage priority tag hotkeys when near a patient
      if (
        scenario?.mode === 'multi_patient_triage' &&
        activePatient &&
        (controlMode === 'orbit' || nearbyInfo?.patientId)
      ) {
        const triageKeyMap: Record<string, TriageCategory> = {
          KeyZ: 'IMMEDIATE',
          KeyX: 'DELAYED',
          KeyC: 'MINOR',
          KeyB: 'EXPECTANT',
        };
        const chosenCat = triageKeyMap[e.code];
        if (chosenCat) {
          e.preventDefault();
          performAction(
            'assign_triage',
            `Tag ${activePatient.patientId} as ${chosenCat}`,
            'Virtual Patient',
            chosenCat
          );
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    simStatus,
    contextualOptions,
    performAction,
    scenario,
    activePatient,
    controlMode,
    nearbyInfo,
  ]);

  const handleGenerateAiDebrief = async () => {
    if (!completedSession || !scenario) return;
    setGeneratingDebrief(true);
    try {
      const debrief = await requestSessionDebrief(completedSession, scenario);
      const updated: TrainingSession = {
        ...completedSession,
        debrief,
      };
      setCompletedSession(updated);
      onSaveSession(updated);
    } catch {
      const fallback = generateRuleBasedDebrief(completedSession, scenario);
      const updated: TrainingSession = {
        ...completedSession,
        debrief: fallback,
      };
      setCompletedSession(updated);
      onSaveSession(updated);
    } finally {
      setGeneratingDebrief(false);
    }
  };

  if (!scenario || !activePatient) {
    return (
      <div className="p-8 text-slate-400">
        No active scenarios available. Open Scenario Design Studio to create one.
      </div>
    );
  }

  // STAGE 3: GAME AFTER-ACTION MISSION DEBRIEF
  if (simStatus === 'completed' && completedSession) {
    return (
      <AfterActionReviewView
        session={completedSession}
        scenario={scenario}
        currentUser={currentUser}
        allSessions={existingSessions}
        allScenarios={availableScenarios}
        drills={drills}
        generatingDebrief={generatingDebrief}
        onGenerateAiDebrief={handleGenerateAiDebrief}
        onRetryMission={() => resetToScenario(scenario)}
        onContinueNextMission={(nextId) => onSelectScenarioId(nextId)}
        onNavigate={onNavigate}
      />
    );
  }

  const formatClock = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const activeTriggeredDisruptions = disruptions.filter(
    (d) => d.triggered && !d.resolved
  );

  // Mission Objective Progress
  const completedStepsCount = scenario.expectedActions.filter((step) => {
    const key = step.patientId
      ? `${step.actionType}:${step.patientId}`
      : step.actionType;
    return (
      completedActionsRef.current.has(key) ||
      (!step.patientId && completedActionsRef.current.has(step.actionType))
    );
  }).length;

  const nextObjective = scenario.expectedActions.find((step) => {
    const key = step.patientId
      ? `${step.actionType}:${step.patientId}`
      : step.actionType;
    return (
      !completedActionsRef.current.has(key) &&
      (step.patientId || !completedActionsRef.current.has(step.actionType))
    );
  });

  const showPatientTelemetry =
    scenario.mode === 'cardiac_arrest' ||
    activePatient.examined ||
    nearbyInfo?.patientId === activePatient.patientId ||
    controlMode === 'orbit';

  return (
    <div className="relative w-full h-screen min-h-[620px] bg-[#070B14] overflow-hidden select-none">
      {/* FULL-SCREEN INTERACTIVE 3D EMERGENCY ROOM / DISASTER TRIAGE ENVIRONMENT */}
      <EmergencyRoomScene
        mode={scenario.mode}
        patients={patients}
        selectedPatientId={selectedPatientId}
        selectedObject={selectedObject}
        environment={environment}
        isPaused={simStatus !== 'running'}
        reducedMotion={settings.reducedMotion}
        cameraPreset={cameraPreset}
        controlMode={simStatus === 'briefing' ? 'orbit' : controlMode}
        responderProfile={responderProfile}
        resetSignal={resetSignal}
        interactionPulse={interactionPulse}
        nearbyKey={controlMode === 'first_person' ? nearbyInfo?.key || null : null}
        requestPointerLockTrigger={pointerLockReqCount}
        audioEnabled={settings.audioFeedbackEnabled}
        onProximityChange={setNearbyInfo}
        onPointerLockChange={setIsPointerLocked}
        onSelectObject={(target, patId) => {
          setSelectedObject(target);
          if (patId) setSelectedPatientId(patId);
          playSimulationTone('interact', settings.audioFeedbackEnabled);
        }}
        onClearCameraPreset={() => setCameraPreset(null)}
      />

      {/* ===================================================================== */}
      {/* STAGE 1: VISUAL LOW-TEXT GAME MISSION BRIEFING                        */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {simStatus === 'briefing' && (
          <motion.div
            key="mission-briefing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-30 bg-[#070B14]/88 flex items-center justify-center p-4 sm:p-8 overflow-y-auto"
          >
            <div className="w-full max-w-[980px] rounded-2xl bg-[#0B1220] border border-slate-800 shadow-2xl overflow-hidden">
              {/* Top Mission Dispatch Bar */}
              <div className="px-5 py-3.5 bg-[#080E1A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('missions')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-cyan-400" />
                    Mission Map
                  </button>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs font-mono text-cyan-400">
                    {responderProfile.callsign} ·{' '}
                    {
                      EQUIPMENT_KIT_PRESETS[
                        responderProfile.primaryKit || 'aed_rapid'
                      ].name
                    }
                  </span>
                </div>

                <select
                  id="briefing-scenario-picker"
                  aria-label="Select Mission"
                  value={scenario.id}
                  onChange={(e) => onSelectScenarioId(e.target.value)}
                  className="bg-[#070B14] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none focus:border-cyan-400 max-w-xs truncate"
                >
                  {availableScenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.title} ({s.difficulty})
                    </option>
                  ))}
                </select>
              </div>

              {/* Visual Briefing Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left Visual Preview & Concise Checkpoints (7 cols) */}
                <div className="lg:col-span-7 p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-800">
                  <div className="relative h-44 rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                    <img
                      src={getScenarioVisual(scenario)}
                      alt={scenario.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-black/35 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <div className="text-xs font-mono text-cyan-300">
                        {scenario.code} · {scenario.difficulty}
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                        {scenario.title}
                      </h1>
                    </div>
                  </div>

                  {/* 3 Visual Mission Stats */}
                  <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums text-center">
                    <div className="p-2.5 rounded-xl bg-[#070B14] border border-slate-800">
                      <div className="text-[10px] font-sans text-slate-400">
                        Time Limit
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {Math.round(scenario.durationLimitSec / 60)}m 00s
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#070B14] border border-slate-800">
                      <div className="text-[10px] font-sans text-slate-400">
                        Casualties
                      </div>
                      <div className="text-sm font-bold text-cyan-300 mt-0.5 inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {scenario.patientCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#070B14] border border-slate-800">
                      <div className="text-[10px] font-sans text-slate-400">
                        Disruptions
                      </div>
                      <div className="text-sm font-bold text-amber-300 mt-0.5">
                        {disruptions.length} Armed
                      </div>
                    </div>
                  </div>

                  {/* Concise Protocol Checkpoints */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-200">
                      Mission Checkpoints
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {scenario.expectedActions.slice(0, 4).map((st, idx) => (
                        <div
                          key={st.stepId}
                          className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800 flex items-center gap-2 text-xs text-slate-200"
                        >
                          <span className="font-mono text-cyan-400 font-bold shrink-0">
                            0{idx + 1}
                          </span>
                          <span className="truncate">{st.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Collapsible Dispatch Narrative & Safety Rule */}
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setBriefingDetailsExpanded((prev) => !prev)
                      }
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                    >
                      {briefingDetailsExpanded ? (
                        <>
                          Hide Dispatch Details <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          Dispatch &amp; Safety Rule{' '}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>

                    {briefingDetailsExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-[#070B14] border border-slate-800 space-y-2 text-xs text-slate-300">
                        <p>{scenario.briefing}</p>
                        <p className="text-[11px] text-amber-200/90">
                          <strong>Safety Rule:</strong>{' '}
                          {scenario.educationalRuleNote}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Controls, Camera & Start Mission CTA (5 cols) */}
                <div className="lg:col-span-5 p-6 bg-[#090F1C] flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-bold text-slate-200 mb-2">
                        Controls
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800">
                          <div className="font-mono font-bold text-cyan-300">
                            W A S D + Shift
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            Move / Sprint
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800">
                          <div className="font-mono font-bold text-cyan-300">
                            Mouse Look
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            1st-Person Camera
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800">
                          <div className="font-mono font-bold text-cyan-300">
                            [E] Interact
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            Or [1–5] Hotkeys
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800">
                          <div className="font-mono font-bold text-cyan-300">
                            [V] · [P] · [Tab]
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            Cam · Pause · Steps
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#070B14] border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs font-mono tabular-nums">
                      <div>
                        <div className="text-[10px] font-sans text-slate-400">
                          O2 Cyl
                        </div>
                        <div className="font-bold text-cyan-300">
                          {environment.resources.oxygenCylinders}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-sans text-slate-400">
                          Bleed Kits
                        </div>
                        <div className="font-bold text-amber-300">
                          {environment.resources.hemorrhageKits}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-sans text-slate-400">
                          Dressings
                        </div>
                        <div className="font-bold text-slate-100">
                          {environment.resources.woundDressings}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-200 mb-1.5">
                        Camera Mode
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#070B14] border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setControlMode('first_person')}
                          className={`py-1.5 px-2.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                            controlMode === 'first_person'
                              ? 'bg-cyan-400 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          1st-Person
                        </button>
                        <button
                          type="button"
                          onClick={() => setControlMode('orbit')}
                          className={`py-1.5 px-2.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                            controlMode === 'orbit'
                              ? 'bg-cyan-400 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Tactical Orbit
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDeployMission}
                    className="w-full py-3.5 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-bold tracking-tight flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Mission
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* STAGE 2: MINIMAL IMMERSIVE GAMEPLAY HUD (RUNNING / PAUSED)            */}
      {/* ===================================================================== */}
      {(simStatus === 'running' || simStatus === 'paused') && (
        <>
          {/* Center First-Person Aim Reticle */}
          {controlMode === 'first_person' && simStatus === 'running' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div
                className={`transition-transform duration-150 ${
                  nearbyInfo ? 'scale-125' : 'scale-100 opacity-60'
                }`}
              >
                <Crosshair
                  className={`w-5 h-5 ${
                    nearbyInfo ? 'text-cyan-400' : 'text-slate-300'
                  }`}
                />
              </div>
            </div>
          )}

          {/* TOP HUD BAR: Left Objectives · Center Timer & Disruptions · Right Patient Vitals & Pause */}
          <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
            {/* TOP-LEFT: Mission Objectives & Progress */}
            <div className="pointer-events-auto bg-[#070B14]/92 border border-slate-800 rounded-xl p-3.5 w-[min(340px,92vw)] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono text-cyan-400">
                  MISSION PROGRESS · {completedStepsCount}/
                  {scenario.expectedActions.length}
                </div>
                <button
                  type="button"
                  onClick={() => setObjectivesExpanded((prev) => !prev)}
                  className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-0.5"
                >
                  {objectivesExpanded ? (
                    <>
                      Hide <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Steps [Tab] <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-transform duration-200 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(
                      0.04,
                      completedStepsCount /
                        Math.max(1, scenario.expectedActions.length)
                    )})`,
                  }}
                />
              </div>

              {nextObjective ? (
                <div className="text-xs text-slate-200">
                  <span className="text-slate-400">Current Objective: </span>
                  <strong className="text-white">{nextObjective.label}</strong>
                  <div className="text-[11px] text-cyan-300/90 mt-0.5">
                    Target Station: {nextObjective.targetObject}
                    {nextObjective.patientId
                      ? ` (${nextObjective.patientId})`
                      : ''}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-emerald-400 font-semibold">
                  All primary protocol steps logged — Complete Mission when ready.
                </div>
              )}

              {objectivesExpanded && (
                <ul className="pt-2 border-t border-slate-800/90 space-y-1 max-h-48 overflow-y-auto text-[11px]">
                  {scenario.expectedActions.map((st) => {
                    const key = st.patientId
                      ? `${st.actionType}:${st.patientId}`
                      : st.actionType;
                    const done =
                      completedActionsRef.current.has(key) ||
                      (!st.patientId &&
                        completedActionsRef.current.has(st.actionType));
                    return (
                      <li
                        key={st.stepId}
                        className={`flex items-center justify-between gap-2 ${
                          done ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        <span className="truncate">
                          {done ? '✓' : `${st.order}.`} {st.label}
                        </span>
                        <span className="font-mono text-[10px] shrink-0">
                          {st.targetWindowSec}s
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* TOP-CENTER: Minimal Timer, Live XP Progress & Pause */}
            <div className="pointer-events-auto flex flex-col items-center gap-2">
              <div className="bg-[#070B14]/94 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-3 text-xs font-mono tabular-nums shadow-lg">
                <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{formatClock(remainingSec)}</span>
                </span>
                <span className="text-slate-700">·</span>
                <span className="text-cyan-300 font-semibold inline-flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  +{completedStepsCount * 40} XP
                </span>
                <span className="text-slate-700">·</span>

                {controlMode === 'first_person' && !isPointerLocked && (
                  <button
                    type="button"
                    onClick={() => setPointerLockReqCount((c) => c + 1)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-[11px] font-sans font-semibold text-cyan-200 whitespace-nowrap"
                  >
                    <MousePointerClick className="w-3 h-3" />
                    Aim
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setControlMode((m) =>
                      m === 'first_person' ? 'orbit' : 'first_person'
                    )
                  }
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-sans text-slate-200 whitespace-nowrap"
                  title="Switch Camera Mode (V)"
                >
                  {controlMode === 'first_person' ? 'Orbit [V]' : '1st-Person [V]'}
                </button>

                {/* Compact Sound Mute + Expandable 3D Audio Mixer */}
                <button
                  type="button"
                  onClick={() =>
                    updateAudioSetting({
                      audioFeedbackEnabled: !settings.audioFeedbackEnabled,
                    })
                  }
                  className={`p-1.5 rounded border transition-colors ${
                    settings.audioFeedbackEnabled
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                  title={
                    settings.audioFeedbackEnabled
                      ? 'Mute Simulation Audio'
                      : 'Unmute Simulation Audio'
                  }
                >
                  {settings.audioFeedbackEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    immersiveAudio.unlockAndResume();
                    setAudioMixerOpen((o) => !o);
                  }}
                  className={`p-1.5 rounded border transition-colors ${
                    audioMixerOpen
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  title="3D Audio Mixer (Master / Ambience / SFX)"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (document.pointerLockElement) {
                      document.exitPointerLock?.();
                    }
                    setSimStatus((s) => (s === 'running' ? 'paused' : 'running'));
                  }}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-sans text-slate-200 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>

                <button
                  type="button"
                  onClick={() => handleCompleteSimulation()}
                  className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-sans font-bold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Square className="w-3 h-3" />
                  Finish
                </button>
              </div>

              {/* Compact Non-Occluding 3D Spatial Audio Mixer Popover */}
              {audioMixerOpen && (
                <div className="bg-[#070B14]/96 border border-slate-700 rounded-xl p-3.5 w-[280px] shadow-2xl space-y-2.5 font-sans text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100">
                      3D Soundscape Mixer
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateAudioSetting({
                          audioFeedbackEnabled: !settings.audioFeedbackEnabled,
                        })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        settings.audioFeedbackEnabled
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {settings.audioFeedbackEnabled ? 'AUDIO ON' : 'MUTED'}
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span>Master</span>
                      <span className="font-mono text-cyan-300">
                        {Math.round((settings.masterVolume ?? 0.78) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((settings.masterVolume ?? 0.78) * 100)}
                      onChange={(e) =>
                        updateAudioSetting({
                          audioFeedbackEnabled: true,
                          masterVolume: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span>
                        {scenario.mode === 'cardiac_arrest'
                          ? 'Hospital Ward Ambience'
                          : 'Surge & EMS Ambience'}
                      </span>
                      <span className="font-mono text-cyan-300">
                        {Math.round((settings.ambienceVolume ?? 0.68) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((settings.ambienceVolume ?? 0.68) * 100)}
                      onChange={(e) =>
                        updateAudioSetting({
                          audioFeedbackEnabled: true,
                          ambienceVolume: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span>Monitor &amp; Equipment SFX</span>
                      <span className="font-mono text-cyan-300">
                        {Math.round((settings.sfxVolume ?? 0.85) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((settings.sfxVolume ?? 0.85) * 100)}
                      onChange={(e) =>
                        updateAudioSetting({
                          audioFeedbackEnabled: true,
                          sfxVolume: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <label className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                    <span>Subtle Tension Pulse</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.musicEnabled)}
                      onChange={(e) =>
                        updateAudioSetting({
                          audioFeedbackEnabled: true,
                          musicEnabled: e.target.checked,
                        })
                      }
                      className="accent-cyan-400"
                    />
                  </label>
                </div>
              )}

              {activeTriggeredDisruptions.length > 0 && (
                <div className="bg-amber-950/95 border border-amber-500/80 rounded-xl px-4 py-2 max-w-md text-center">
                  <div className="text-xs font-bold text-amber-200 flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{activeTriggeredDisruptions[0].title}</span>
                  </div>
                  <div className="text-[11px] text-amber-100/90 mt-0.5">
                    {activeTriggeredDisruptions[0].mitigationHint}
                  </div>
                </div>
              )}
            </div>

            {/* TOP-RIGHT: Compact Relevant Patient Vitals & Equipment Indicators */}
            <div className="pointer-events-auto bg-[#070B14]/92 border border-slate-800 rounded-xl p-3.5 w-[min(320px,92vw)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
                    <HeartPulse className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">
                      {activePatient.patientId} ·{' '}
                      {activePatient.name.replace(' (Simulated)', '')}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    SIMULATED VITALS · BAY 0{activePatient.bayNumber}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    activePatient.conditionStatus === 'Arrest' ||
                    activePatient.conditionStatus === 'Critical'
                      ? 'text-red-400'
                      : activePatient.conditionStatus === 'Stabilising'
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                  }`}
                >
                  {activePatient.conditionStatus.toUpperCase()}
                </span>
              </div>

              {showPatientTelemetry ? (
                <>
                  {/* Compact ECG Trace */}
                  <div className="h-9 w-full bg-[#040810] border border-slate-800/90 rounded px-2 flex items-center justify-between">
                    <svg
                      viewBox="0 0 220 34"
                      className="w-36 h-7 overflow-visible"
                      aria-label="Simulated ECG"
                    >
                      <path
                        d={
                          activePatient.cardiacRhythm === 'VFib'
                            ? 'M0,17 Q8,4 16,22 T32,11 T48,25 T64,9 T80,23 T96,10 T112,25 T128,12 T144,22 T160,9 T176,24 T192,13 L220,17'
                            : activePatient.heartRate > 0
                            ? 'M0,19 L24,19 L30,14 L36,19 L44,19 L48,24 L54,4 L60,29 L66,19 L78,14 L86,19 L124,19 L130,14 L136,19 L144,19 L148,24 L154,4 L160,29 L166,19 L220,19'
                            : 'M0,19 L220,19'
                        }
                        fill="none"
                        stroke={
                          activePatient.conditionStatus === 'Arrest'
                            ? '#ef4444'
                            : '#10b981'
                        }
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="text-[10px] font-mono text-slate-300">
                      {activePatient.cardiacRhythm}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center font-mono tabular-nums">
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <div className="text-[9px] font-sans text-slate-400">HR</div>
                      <div className="text-xs font-bold text-emerald-400">
                        {activePatient.heartRate}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <div className="text-[9px] font-sans text-slate-400">BP</div>
                      <div className="text-[11px] font-bold text-amber-300">
                        {activePatient.systolicBP}/{activePatient.diastolicBP}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <div className="text-[9px] font-sans text-slate-400">SpO2</div>
                      <div
                        className={`text-xs font-bold ${
                          activePatient.spo2 < 90 ? 'text-red-400' : 'text-sky-400'
                        }`}
                      >
                        {activePatient.spo2}%
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <div className="text-[9px] font-sans text-slate-400">RR</div>
                      <div className="text-xs font-bold text-slate-200">
                        {activePatient.respiratoryRate}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
                  Walk up to {activePatient.patientId} (Bay 0
                  {activePatient.bayNumber}) and perform Primary Examination [1] to reveal vital signs.
                </div>
              )}

              {/* Equipment & Resource Status Strip */}
              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>
                  O2:{environment.resources.oxygenCylinders} · Kits:
                  {environment.resources.hemorrhageKits} · Dress:
                  {environment.resources.woundDressings}
                </span>
                {scenario.mode === 'multi_patient_triage' ? (
                  <span className="text-cyan-300">
                    Triaged {patients.filter((p) => p.assignedTriage).length}/
                    {patients.length}
                  </span>
                ) : (
                  <span
                    className={
                      environment.primaryAedOperational
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }
                  >
                    AED {environment.primaryAedOperational ? 'OK' : 'FAULT'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TRANSIENT ACTION FEEDBACK TOAST */}
          <AnimatePresence>
            {latestFeedback && (
              <motion.div
                key={latestFeedback.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-44 left-1/2 -translate-x-1/2 z-20 w-[min(580px,92vw)] pointer-events-none"
              >
                <div
                  className={`px-4 py-2.5 rounded-xl border text-xs flex items-start gap-2.5 shadow-xl ${
                    latestFeedback.severity === 'Critical'
                      ? 'bg-red-950/95 border-red-500 text-red-100'
                      : latestFeedback.correctness === 'correct'
                      ? 'bg-[#082f49]/95 border-cyan-400 text-cyan-50'
                      : 'bg-amber-950/95 border-amber-500 text-amber-100'
                  }`}
                >
                  {latestFeedback.severity === 'Critical' ? (
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : latestFeedback.correctness === 'correct' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold">
                      {latestFeedback.label} ·{' '}
                      {latestFeedback.correctness
                        .replace(/_/g, ' ')
                        .toUpperCase()}
                    </div>
                    <div className="text-[11px] opacity-95 mt-0.5">
                      {latestFeedback.message}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* BOTTOM-CENTER: CONTEXT-SENSITIVE PROXIMITY INTERACTION HUD */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(780px,94vw)] pointer-events-auto">
            {contextualOptions.length > 0 ? (
              <div className="bg-[#070B14]/94 border border-cyan-500/50 rounded-xl p-3.5 shadow-2xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 font-mono font-bold">
                      E — INTERACT
                    </span>
                    <span className="font-mono font-bold text-cyan-300">
                      {controlMode === 'first_person' && nearbyInfo
                        ? `${nearbyInfo.label} (${nearbyInfo.distanceMeters}m)`
                        : selectedObject}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      · [1–{contextualOptions.length}] Select
                    </span>
                  </div>

                  {scenario.mode === 'multi_patient_triage' && (
                    <span className="text-[11px] font-mono text-cyan-300">
                      Tag: {activePatient.assignedTriage || 'UNTAGGED'}
                    </span>
                  )}
                </div>

                {/* Contextual Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {contextualOptions.map((opt) => (
                    <button
                      key={opt.hotkey + opt.actionType}
                      type="button"
                      onClick={() =>
                        performAction(
                          opt.actionType,
                          opt.label,
                          opt.targetOverride,
                          opt.triageCategory
                        )
                      }
                      className={`px-3 py-2 rounded-lg border text-left transition-colors flex flex-col justify-between ${
                        opt.highlight === 'primary'
                          ? 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400 text-cyan-100'
                          : opt.highlight === 'amber'
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400 text-amber-100'
                          : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono">
                        <span className="text-cyan-300 font-bold">
                          [{opt.hotkey}]
                        </span>
                        {opt.statusTag && (
                          <span className="text-slate-400">{opt.statusTag}</span>
                        )}
                      </div>
                      <div className="text-xs font-semibold leading-snug mt-1">
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Triage Priority Tagging Strip When Near Casualty in Multi-Patient Triage */}
                {scenario.mode === 'multi_patient_triage' && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Assign Triage Tag ({activePatient.patientId}):
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          {
                            key: 'Z',
                            cat: 'IMMEDIATE',
                            cls: 'border-red-500/60 text-red-200 hover:bg-red-500/25',
                            active: 'bg-red-500/35 border-red-400 text-white',
                          },
                          {
                            key: 'X',
                            cat: 'DELAYED',
                            cls: 'border-amber-500/60 text-amber-200 hover:bg-amber-500/25',
                            active: 'bg-amber-500/35 border-amber-400 text-white',
                          },
                          {
                            key: 'C',
                            cat: 'MINOR',
                            cls: 'border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/25',
                            active:
                              'bg-emerald-500/35 border-emerald-400 text-white',
                          },
                          {
                            key: 'B',
                            cat: 'EXPECTANT',
                            cls: 'border-slate-600 text-slate-300 hover:bg-slate-700/60',
                            active: 'bg-slate-700 border-slate-300 text-white',
                          },
                        ] as const
                      ).map((t) => {
                        const isAssigned = activePatient.assignedTriage === t.cat;
                        return (
                          <button
                            key={t.cat}
                            type="button"
                            onClick={() =>
                              performAction(
                                'assign_triage',
                                `Tag ${activePatient.patientId} as ${t.cat}`,
                                'Virtual Patient',
                                t.cat
                              )
                            }
                            className={`px-2.5 py-1 rounded border text-[11px] font-mono font-semibold transition-colors whitespace-nowrap ${
                              isAssigned ? t.active : `bg-slate-900 ${t.cls}`
                            }`}
                          >
                            [{t.key}] {t.cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : controlMode === 'first_person' ? (
              /* Minimal 1-line movement prompt when walking between stations */
              <div className="bg-[#070B14]/88 border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between gap-2 text-xs text-slate-300">
                <span className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    <strong>WASD</strong> Move · <strong>Shift</strong> Sprint · <strong>G</strong> Crouch · Approach Bed, AED, Monitor or Oxygen for <strong>[E]</strong>
                  </span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  {isPointerLocked ? 'ESC Unlock' : 'Click Aim'}
                </span>
              </div>
            ) : (
              /* Orbit Camera Preset Bar when user toggles V to Orbit Mode */
              <div className="bg-[#070B14]/92 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1" />
                  {cameraPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCameraPreset(preset);
                        if (preset.id.startsWith('bay_')) {
                          setSelectedPatientId(preset.id.replace('bay_', ''));
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 whitespace-nowrap"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400">
                  Click any 3D object or press [V] for First-Person
                </span>
              </div>
            )}
          </div>

          {/* TACTICAL PAUSE OVERLAY */}
          <AnimatePresence>
            {simStatus === 'paused' && (
              <motion.div
                key="pause-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-30 bg-[#070B14]/82 flex items-center justify-center p-4"
              >
                <div className="w-full max-w-md rounded-2xl bg-[#0B1220] border border-slate-700 p-6 space-y-5 shadow-2xl">
                  <div className="space-y-1 text-center">
                    <div className="text-xs font-mono text-cyan-400">
                      SIMULATION PAUSED
                    </div>
                    <h2 className="text-xl font-bold text-white">
                      {scenario.title}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">
                      Elapsed {formatClock(elapsedSec)} · {events.length} Events
                      Recorded
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSimStatus('running');
                        if (controlMode === 'first_person') {
                          setPointerLockReqCount((c) => c + 1);
                        }
                      }}
                      className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Resume Mission
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCompleteSimulation()}
                      className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/60 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Complete &amp; Open After-Action Debrief
                    </button>

                    <button
                      type="button"
                      onClick={() => resetToScenario(scenario)}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restart Scenario
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('overview')}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
                    >
                      Exit to Home Base
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

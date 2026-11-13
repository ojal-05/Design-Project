export type UserRole = 'trainee' | 'instructor' | 'administrator';

export type NavSection =
  | 'overview'
  | 'missions'
  | 'training'
  | 'loadout'
  | 'skill-tree'
  | 'achievements'
  | 'mission-records'
  | 'command-centre'
  | 'simulation-centre'
  | 'scenario-library'
  | 'scenario-studio'
  | 'emergency-intelligence'
  | 'performance-analytics'
  | 'session-replay'
  | 'trainee-management'
  | 'reports'
  | 'settings';

export type ScenarioMode = 'cardiac_arrest' | 'multi_patient_triage';

export type DifficultyLevel = 'Foundation' | 'Intermediate' | 'High Acuity';

export type TriageCategory = 'IMMEDIATE' | 'DELAYED' | 'MINOR' | 'EXPECTANT';

export type ConsciousnessLevel = 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';

export type BleedingSeverity = 'None' | 'Mild' | 'Moderate' | 'Severe';

export type CardiacRhythm =
  | 'VFib'
  | 'PEA'
  | 'Asystole'
  | 'Sinus Tachycardia'
  | 'Normal Sinus'
  | 'Bradycardia';

export type PatientConditionStatus =
  | 'Arrest'
  | 'Critical'
  | 'Unstable'
  | 'Stabilising'
  | 'Stable';

export type DisruptionType =
  | 'equipment_unavailable'
  | 'blocked_exit'
  | 'additional_casualty'
  | 'resource_shortage'
  | 'patient_deterioration'
  | 'lighting_fluctuation'
  | 'time_pressure';

export type ActionCorrectness =
  | 'correct'
  | 'delayed'
  | 'out_of_sequence'
  | 'incorrect'
  | 'unnecessary';

export type ErrorType =
  | 'None'
  | 'Delayed Intervention'
  | 'Sequence Violation'
  | 'Protocol Omission'
  | 'Incorrect Triage'
  | 'Resource Misallocation'
  | 'Premature Shock'
  | 'Unsafe Action';

export type ErrorSeverity = 'None' | 'Minor' | 'Moderate' | 'Critical';

export type ResponderUniformId =
  | 'trauma_navy'
  | 'flight_cyan'
  | 'hazmat_amber'
  | 'tactical_slate';

export type ResponderSpecialization =
  | 'Resuscitation Specialist'
  | 'Field Trauma & Triage'
  | 'Acute Flight Medic';

export type ResponderVisorStyle =
  | 'none'
  | 'safety_glasses'
  | 'clear_shield'
  | 'tinted_tactical'
  | 'surgical_cap';

export type ResponderEquipmentKitId =
  | 'aed_rapid'
  | 'hemorrhage_pack'
  | 'airway_oxygen';

export interface ResponderCustomization {
  callsign: string;
  uniformId: ResponderUniformId;
  specialization: ResponderSpecialization;
  gloveColor: string;
  skinTone?: string;
  visorStyle?: ResponderVisorStyle;
  primaryKit?: ResponderEquipmentKitId;
  bodyModel?: 'male' | 'female';
  wearMask?: boolean;
  wearVest?: boolean;
  wearGloves?: boolean;
}

export type MissionRating = 'S' | 'A' | 'B' | 'C' | 'CRITICAL_REVIEW';

export type DrillChallengeType =
  | 'equipment_hunt_3d'
  | 'protocol_sequence'
  | 'rhythm_vital_scan'
  | 'rapid_triage_blitz'
  | 'golden_minute_reflex';

export interface DrillAttemptRecord {
  id: string;
  traineeId: string;
  challengeType: DrillChallengeType;
  title: string;
  scorePct: number;
  xpEarned: number;
  durationSec: number;
  criticalSafetyMistakes: number;
  completedAt: string;
  isDemo?: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cohort: string;
  department: string;
  assignedScenarioIds: string[];
  active: boolean;
  isDemo: boolean;
  createdAt: string;
  responderProfile?: ResponderCustomization;
}

export interface PatientState {
  patientId: string;
  bayNumber: number;
  name: string;
  age: number;
  sex: 'M' | 'F';
  presentation: string;
  mechanismSummary: string;
  // Simulated physiological variables
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  respiratoryRate: number;
  spo2: number;
  consciousness: ConsciousnessLevel;
  painLevel: number; // 0 - 10
  bleedingSeverity: BleedingSeverity;
  cardiacRhythm: CardiacRhythm;
  conditionStatus: PatientConditionStatus;
  // Intervention flags
  sceneChecked: boolean;
  examined: boolean;
  airwayClear: boolean;
  cprActive: boolean;
  cprCyclesCompleted: number;
  aedPoweredOn: boolean;
  padsAttached: boolean;
  rhythmAnalyzed: boolean;
  shockAdvised: boolean;
  shocksDelivered: number;
  oxygenApplied: boolean;
  bleedingControlled: boolean;
  woundDressed: boolean;
  monitorVerified: boolean;
  // Triage fields
  assignedTriage: TriageCategory | null;
  referenceTriage: TriageCategory;
  triageRationale: string;
  isSimulated: true;
}

export interface ResourcePool {
  oxygenCylinders: number;
  hemorrhageKits: number;
  woundDressings: number;
  aedPadsSets: number;
  backupAedAvailable: boolean;
}

export interface EnvironmentConfig {
  lightingMode: 'Clinical Standard' | 'Night Shift Dim' | 'Emergency Backup';
  ambientNoiseLevel: 'Low' | 'Moderate' | 'High Surge';
  primaryAedOperational: boolean;
  exitClear: boolean;
  resources: ResourcePool;
}

export interface DisruptionConfig {
  seed: number;
  enabledTypes: DisruptionType[];
  intensity: 'Controlled' | 'Moderate' | 'Severe';
}

export interface ScheduledDisruption {
  id: string;
  type: DisruptionType;
  triggerAtSec: number;
  title: string;
  description: string;
  mitigationHint: string;
  triggered: boolean;
  resolved: boolean;
}

export interface ExpectedActionStep {
  stepId: string;
  order: number;
  actionType: string;
  targetObject: string;
  patientId?: string;
  label: string;
  educationalRule: string;
  targetWindowSec: number;
  isCritical: boolean;
  prerequisites: string[];
}

export interface AssessmentWeights {
  proceduralAccuracy: number; // e.g., 0.30
  decisionAccuracy: number;   // e.g., 0.25
  responseTime: number;       // e.g., 0.20
  sequenceAccuracy: number;   // e.g., 0.25
}

export interface ScenarioDefinition {
  id: string;
  code: string;
  title: string;
  mode: ScenarioMode;
  difficulty: DifficultyLevel;
  durationLimitSec: number;
  patientCount: number;
  briefing: string;
  learningObjectives: string[];
  educationalRuleNote: string;
  environmentConfig: EnvironmentConfig;
  disruptionsConfig: DisruptionConfig;
  initialPatients: PatientState[];
  expectedActions: ExpectedActionStep[];
  assessmentWeights: AssessmentWeights;
  assignedTraineeIds: string[];
  archived: boolean;
  isDemo: boolean;
  createdBy: string;
  updatedAt: string;
}

export interface ActionEventRecord {
  eventId: string;
  sessionId: string;
  traineeId: string;
  scenarioId: string;
  timestamp: string;
  elapsedSec: number;
  actionType: string;
  actionLabel: string;
  targetObject: string;
  patientId: string | null;
  expectedAction: string;
  correctness: ActionCorrectness;
  responseTimeSec: number;
  sequencePosition: number;
  errorType: ErrorType;
  errorSeverity: ErrorSeverity;
  feedbackMessage: string;
  patientState: {
    patientId: string;
    heartRate: number;
    systolicBP: number;
    diastolicBP: number;
    respiratoryRate: number;
    spo2: number;
    consciousness: ConsciousnessLevel;
    conditionStatus: PatientConditionStatus;
    assignedTriage: TriageCategory | null;
  };
  scenarioState: {
    remainingSec: number;
    activeDisruptions: string[];
    resourcesRemaining: ResourcePool;
  };
}

export interface VitalTimelinePoint {
  elapsedSec: number;
  patientId: string;
  patientName: string;
  heartRate: number;
  systolicBP: number;
  respiratoryRate: number;
  spo2: number;
  conditionStatus: PatientConditionStatus;
  eventMarker?: string;
}

export interface SessionAssessment {
  sessionId: string;
  proceduralAccuracy: number;
  decisionAccuracy: number;
  avgResponseTimeSec: number;
  responseTimeScore: number;
  sequenceAccuracy: number;
  overallScore: number;
  weightsUsed: AssessmentWeights;
  scoreCalculationFormula: string;
  criticalErrorsCount: number;
  criticalErrors: string[];
  missedActions: string[];
  repeatedErrorsCount: number;
  delayedActionsCount: number;
  completionTimeSec: number;
  simulatedOutcome: string;
  prototypeDisclaimer: string;
}

export interface DebriefReport {
  sessionId: string;
  generatedAt: string;
  source: 'gemini-ai' | 'rule-based';
  modelUsed?: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  delayedActions: string[];
  missedActions: string[];
  incorrectDecisions: string[];
  criticalErrors: string[];
  improvementRecommendations: string[];
}

export interface InstructorNote {
  id: string;
  sessionId?: string;
  traineeId: string;
  authorName: string;
  createdAt: string;
  content: string;
}

export interface TrainingSession {
  id: string;
  traineeId: string;
  traineeName: string;
  scenarioId: string;
  scenarioCode: string;
  scenarioTitle: string;
  scenarioMode: ScenarioMode;
  difficulty: DifficultyLevel;
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  durationSec: number;
  status: 'in_progress' | 'completed' | 'aborted';
  seed: number;
  isDemo: boolean;
  events: ActionEventRecord[];
  vitalTimeline: VitalTimelinePoint[];
  disruptions: ScheduledDisruption[];
  finalPatients: PatientState[];
  assessment: SessionAssessment | null;
  debrief: DebriefReport | null;
  instructorNotes: string;
}

export interface PlatformSettings {
  defaultWeights: AssessmentWeights;
  showDemoDataInAnalytics: boolean;
  audioFeedbackEnabled: boolean;
  masterVolume?: number;
  ambienceVolume?: number;
  sfxVolume?: number;
  musicEnabled?: boolean;
  highContrastTelemetry: boolean;
  reducedMotion: boolean;
  institutionName: string;
  vrBridgeEndpointUrl: string;
}

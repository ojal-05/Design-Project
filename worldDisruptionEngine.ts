import {
  DisruptionConfig,
  DisruptionType,
  EnvironmentConfig,
  PatientState,
  ScheduledDisruption,
} from '../types/simulation';

/**
 * Deterministic 32-bit PRNG (Mulberry32) so instructors and researchers can
 * replay exact disruption schedules using configurable numerical seeds.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DISRUPTION_CATALOG: Record<
  DisruptionType,
  { title: string; description: string; mitigationHint: string; baseMinSec: number; baseMaxSec: number }
> = {
  equipment_unavailable: {
    title: 'Primary AED Battery Fault',
    description:
      'Simulated device self-test reported low capacitor charge on primary AED unit. Switch to backup defibrillator mode on the Medical Trolley.',
    mitigationHint: 'Interact with the Medical Trolley to activate backup AED power.',
    baseMinSec: 22,
    baseMaxSec: 45,
  },
  blocked_exit: {
    title: 'Transfer Corridor Obstruction',
    description:
      'Simulated stretcher congestion has blocked Bay Exit A. Coordinate alternate transfer clearance via Emergency Call Panel.',
    mitigationHint: 'Use the Emergency Call Panel or Exit Door control to reroute transfer corridor.',
    baseMinSec: 35,
    baseMaxSec: 70,
  },
  additional_casualty: {
    title: 'Unannounced Walk-In Casualty Arrival',
    description:
      'An additional simulated casualty has arrived in the triage zone requiring rapid primary assessment and prioritisation.',
    mitigationHint: 'Select the newly arrived casualty in Bay 5, inspect vitals, and assign a triage category.',
    baseMinSec: 40,
    baseMaxSec: 75,
  },
  resource_shortage: {
    title: 'Oxygen Supply Pressure Drop',
    description:
      'Portable oxygen reserve reduced by 1 cylinder due to adjacent bay demand. Prioritise hypoxic IMMEDIATE casualties.',
    mitigationHint: 'Allocate remaining oxygen cylinders strictly to critically hypoxic patients.',
    baseMinSec: 28,
    baseMaxSec: 55,
  },
  patient_deterioration: {
    title: 'Acute Simulated Decompensation',
    description:
      'Untreated physiological stress triggered accelerated oxygen desaturation and hypotension in the highest-acuity patient.',
    mitigationHint: 'Re-assess vital signs monitor immediately and complete critical airway/perfusion interventions.',
    baseMinSec: 32,
    baseMaxSec: 65,
  },
  lighting_fluctuation: {
    title: 'Auxiliary Generator Lighting Shift',
    description:
      'Facility power switched to emergency clinical backup circuit, altering bay illumination.',
    mitigationHint: 'Continue protocol execution under backup illumination or reset lighting from Wall Panel.',
    baseMinSec: 18,
    baseMaxSec: 50,
  },
  time_pressure: {
    title: 'Accelerated Handover Window',
    description:
      'Receiving ICU / Surgical team requested expedited handover; remaining scenario window compressed by 25 seconds.',
    mitigationHint: 'Prioritise remaining critical assessment and stabilisation steps without skipping safety checks.',
    baseMinSec: 45,
    baseMaxSec: 85,
  },
};

export function generateDisruptionSchedule(
  config: DisruptionConfig,
  durationLimitSec: number
): ScheduledDisruption[] {
  if (!config.enabledTypes || config.enabledTypes.length === 0) {
    return [];
  }

  const rng = createSeededRng(config.seed || 1001);
  const intensityFactor =
    config.intensity === 'Severe' ? 0.75 : config.intensity === 'Moderate' ? 0.9 : 1.05;

  const schedule: ScheduledDisruption[] = config.enabledTypes.map((type, idx) => {
    const meta = DISRUPTION_CATALOG[type];
    const span = meta.baseMaxSec - meta.baseMinSec;
    const rawTrigger = Math.round((meta.baseMinSec + rng() * span) * intensityFactor + idx * 8);
    const clampedTrigger = Math.min(Math.max(12, rawTrigger), Math.max(20, durationLimitSec - 30));

    return {
      id: `disr_${config.seed}_${type}_${idx}`,
      type,
      triggerAtSec: clampedTrigger,
      title: meta.title,
      description: meta.description,
      mitigationHint: meta.mitigationHint,
      triggered: false,
      resolved: false,
    };
  });

  return schedule.sort((a, b) => a.triggerAtSec - b.triggerAtSec);
}

export function applyDisruptionEffect(
  disruption: ScheduledDisruption,
  patients: PatientState[],
  environment: EnvironmentConfig,
  remainingSec: number
): {
  patients: PatientState[];
  environment: EnvironmentConfig;
  remainingSec: number;
} {
  let nextPatients = patients.map((p) => ({ ...p }));
  const nextEnv: EnvironmentConfig = {
    ...environment,
    resources: { ...environment.resources },
  };
  let nextRemaining = remainingSec;

  switch (disruption.type) {
    case 'equipment_unavailable':
      nextEnv.primaryAedOperational = false;
      break;

    case 'blocked_exit':
      nextEnv.exitClear = false;
      break;

    case 'lighting_fluctuation':
      nextEnv.lightingMode = 'Emergency Backup';
      break;

    case 'resource_shortage':
      nextEnv.resources.oxygenCylinders = Math.max(0, nextEnv.resources.oxygenCylinders - 1);
      break;

    case 'time_pressure':
      nextRemaining = Math.max(20, nextRemaining - 25);
      break;

    case 'patient_deterioration': {
      const targetIdx = nextPatients.findIndex(
        (p) => p.conditionStatus === 'Critical' || p.conditionStatus === 'Unstable' || p.conditionStatus === 'Arrest'
      );
      const idx = targetIdx >= 0 ? targetIdx : 0;
      if (nextPatients[idx]) {
        const p = nextPatients[idx];
        nextPatients[idx] = {
          ...p,
          spo2: Math.max(62, p.spo2 - 7),
          systolicBP: p.systolicBP > 0 ? Math.max(64, p.systolicBP - 14) : 0,
          diastolicBP: p.diastolicBP > 0 ? Math.max(38, p.diastolicBP - 10) : 0,
          heartRate: p.heartRate > 0 ? Math.min(158, p.heartRate + 14) : 0,
          conditionStatus: p.conditionStatus === 'Arrest' ? 'Arrest' : 'Critical',
        };
      }
      break;
    }

    case 'additional_casualty': {
      const alreadyAdded = nextPatients.some((p) => p.patientId === 'PT-205');
      if (!alreadyAdded) {
        nextPatients = [
          ...nextPatients,
          {
            patientId: 'PT-205',
            bayNumber: nextPatients.length + 1,
            name: 'Nadia Vance (Surge Arrival)',
            age: 41,
            sex: 'F',
            presentation: 'Smoke inhalation & facial singeing; stridor and progressive hypoxia',
            mechanismSummary: 'Secondary structural flash exposure during evacuation',
            heartRate: 128,
            systolicBP: 102,
            diastolicBP: 66,
            respiratoryRate: 32,
            spo2: 84,
            consciousness: 'Voice',
            painLevel: 7,
            bleedingSeverity: 'None',
            cardiacRhythm: 'Sinus Tachycardia',
            conditionStatus: 'Critical',
            sceneChecked: true,
            examined: false,
            airwayClear: false,
            cprActive: false,
            cprCyclesCompleted: 0,
            aedPoweredOn: false,
            padsAttached: false,
            rhythmAnalyzed: false,
            shockAdvised: false,
            shocksDelivered: 0,
            oxygenApplied: false,
            bleedingControlled: true,
            woundDressed: false,
            monitorVerified: false,
            assignedTriage: null,
            referenceTriage: 'IMMEDIATE',
            triageRationale:
              'Educational Rule: Compromised airway with stridor, RR > 30, and SpO2 < 90% requires IMMEDIATE (Red) priority.',
            isSimulated: true,
          },
        ];
      }
      break;
    }
  }

  return {
    patients: nextPatients,
    environment: nextEnv,
    remainingSec: nextRemaining,
  };
}

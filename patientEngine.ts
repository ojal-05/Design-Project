import {
  ActionCorrectness,
  EnvironmentConfig,
  ErrorSeverity,
  ErrorType,
  PatientState,
  ScenarioMode,
  TriageCategory,
} from '../types/simulation';

export interface ActionTransitionResult {
  updatedPatients: PatientState[];
  updatedEnvironment: EnvironmentConfig;
  correctness: ActionCorrectness;
  errorType: ErrorType;
  errorSeverity: ErrorSeverity;
  feedbackMessage: string;
  matchedStepId?: string;
}

/**
 * Advances simulated physiological variables by `deltaSec` (typically 1 second).
 * Models natural progressive hypoxia/hypotension if critical conditions remain untreated,
 * or steady recovery once airway, hemorrhage, CPR, defibrillation, and oxygen are active.
 */
export function advancePatientsTick(
  patients: PatientState[],
  mode: ScenarioMode,
  deltaSec: number
): PatientState[] {
  return patients.map((p) => {
    const next = { ...p };

    if (mode === 'cardiac_arrest') {
      if (next.conditionStatus === 'Arrest') {
        if (next.cprActive) {
          // High-quality CPR maintains minimal coronary/cerebral perfusion
          next.systolicBP = 68;
          next.diastolicBP = 32;
          next.spo2 = Math.max(76, Math.min(86, next.spo2 + (next.oxygenApplied ? 0.4 : -0.05) * deltaSec));
        } else {
          next.heartRate = 0;
          next.systolicBP = 0;
          next.diastolicBP = 0;
          next.respiratoryRate = 0;
          next.spo2 = Math.max(52, Number((next.spo2 - 0.35 * deltaSec).toFixed(1)));
        }
      } else {
        // Post-ROSC physiological trajectory
        if (next.oxygenApplied && next.airwayClear) {
          next.spo2 = Math.min(98, Number((next.spo2 + 0.45 * deltaSec).toFixed(1)));
          next.systolicBP = Math.min(116, Math.round(next.systolicBP + 0.3 * deltaSec));
          next.diastolicBP = Math.min(74, Math.round(next.diastolicBP + 0.2 * deltaSec));
          next.heartRate = Math.max(88, Math.round(next.heartRate - 0.25 * deltaSec));
          next.respiratoryRate = 16;
          if (next.spo2 >= 94 && next.systolicBP >= 100) {
            next.conditionStatus = 'Stable';
            next.cardiacRhythm = 'Normal Sinus';
            next.consciousness = 'Voice';
          } else {
            next.conditionStatus = 'Stabilising';
          }
        } else {
          // Post-ROSC without supplemental oxygen slowly desaturates
          next.spo2 = Math.max(80, Number((next.spo2 - 0.15 * deltaSec).toFixed(1)));
        }
      }
      next.spo2 = Math.round(next.spo2);
      return next;
    }

    // Multi-patient triage physiological progression
    if (next.bleedingSeverity === 'Severe' && !next.bleedingControlled) {
      next.heartRate = Math.min(156, Math.round(next.heartRate + 0.2 * deltaSec));
      next.systolicBP = Math.max(62, Math.round(next.systolicBP - 0.25 * deltaSec));
      next.diastolicBP = Math.max(36, Math.round(next.diastolicBP - 0.15 * deltaSec));
      next.spo2 = Math.max(78, Math.round(next.spo2 - 0.12 * deltaSec));
      next.conditionStatus = 'Critical';
    } else if (next.bleedingControlled && next.bleedingSeverity !== 'None') {
      next.systolicBP = Math.min(108, Math.round(next.systolicBP + 0.2 * deltaSec));
      next.heartRate = Math.max(96, Math.round(next.heartRate - 0.2 * deltaSec));
      if (next.oxygenApplied || next.spo2 >= 93) {
        next.conditionStatus = next.spo2 >= 94 ? 'Stabilising' : 'Unstable';
      }
    }

    if (!next.airwayClear && next.referenceTriage === 'IMMEDIATE') {
      next.spo2 = Math.max(68, Math.round(next.spo2 - 0.3 * deltaSec));
      next.conditionStatus = 'Critical';
    } else if (next.airwayClear && next.oxygenApplied) {
      next.spo2 = Math.min(98, Math.round(next.spo2 + 0.4 * deltaSec));
      next.respiratoryRate = Math.max(18, Math.round(next.respiratoryRate - 0.15 * deltaSec));
      if (next.spo2 >= 94 && next.bleedingControlled) {
        next.conditionStatus = 'Stabilising';
      }
    }

    return next;
  });
}

/**
 * Processes an interactive trainee action on a target equipment/patient and computes
 * deterministic educational patient-state transitions and immediate feedback.
 */
export function executeTraineeAction(params: {
  mode: ScenarioMode;
  actionType: string;
  targetObject: string;
  patientId: string | null;
  triageSelection?: TriageCategory;
  patients: PatientState[];
  environment: EnvironmentConfig;
  completedActions: Set<string>;
  elapsedSec: number;
}): ActionTransitionResult {
  const {
    mode,
    actionType,
    patientId,
    triageSelection,
    patients,
    environment,
    completedActions,
    elapsedSec,
  } = params;

  const updatedPatients = patients.map((p) => ({ ...p }));
  const updatedEnvironment: EnvironmentConfig = {
    ...environment,
    resources: { ...environment.resources },
  };

  const targetIdx = patientId
    ? updatedPatients.findIndex((p) => p.patientId === patientId)
    : 0;
  const patient = updatedPatients[targetIdx >= 0 ? targetIdx : 0];

  // Environment / Disruption resolution actions
  if (actionType === 'activate_backup_aed') {
    updatedEnvironment.primaryAedOperational = true;
    return {
      updatedPatients,
      updatedEnvironment,
      correctness: 'correct',
      errorType: 'None',
      errorSeverity: 'None',
      feedbackMessage: 'Backup defibrillator capacitor engaged on Medical Trolley. AED ready for use.',
    };
  }

  if (actionType === 'clear_blocked_exit') {
    updatedEnvironment.exitClear = true;
    return {
      updatedPatients,
      updatedEnvironment,
      correctness: 'correct',
      errorType: 'None',
      errorSeverity: 'None',
      feedbackMessage: 'Secondary transfer route cleared with Emergency Operations dispatch.',
    };
  }

  if (actionType === 'restore_lighting') {
    updatedEnvironment.lightingMode = 'Clinical Standard';
    return {
      updatedPatients,
      updatedEnvironment,
      correctness: 'correct',
      errorType: 'None',
      errorSeverity: 'None',
      feedbackMessage: 'Bay illumination restored to Clinical Standard overhead array.',
    };
  }

  // ==================== SCENARIO 1: CARDIAC ARREST, CPR & AED ====================
  if (mode === 'cardiac_arrest' && patient) {
    switch (actionType) {
      case 'check_scene_safety': {
        patient.sceneChecked = true;
        const delayed = elapsedSec > 18;
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: delayed ? 'delayed' : 'correct',
          errorType: delayed ? 'Delayed Intervention' : 'None',
          errorSeverity: delayed ? 'Minor' : 'None',
          feedbackMessage: delayed
            ? 'Scene safety verified, though initial check exceeded recommended 15s window.'
            : 'Resuscitation bay safety & PPE verified. Safe to approach patient.',
          matchedStepId: 'ca_step_1',
        };
      }

      case 'check_responsiveness': {
        patient.examined = true;
        if (!patient.sceneChecked) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'out_of_sequence',
            errorType: 'Sequence Violation',
            errorSeverity: 'Minor',
            feedbackMessage:
              'Patient unresponsive & apneic confirmed, but scene safety was not checked prior to contact.',
            matchedStepId: 'ca_step_2',
          };
        }
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: elapsedSec > 30 ? 'delayed' : 'correct',
          errorType: elapsedSec > 30 ? 'Delayed Intervention' : 'None',
          errorSeverity: elapsedSec > 30 ? 'Minor' : 'None',
          feedbackMessage:
            'Simulated assessment: Unresponsive, absent carotid pulse, agonal/absent respiration.',
          matchedStepId: 'ca_step_2',
        };
      }

      case 'call_code_blue': {
        if (!patient.examined) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'out_of_sequence',
            errorType: 'Sequence Violation',
            errorSeverity: 'Minor',
            feedbackMessage:
              'Code Blue activated before confirming patient unresponsiveness.',
            matchedStepId: 'ca_step_3',
          };
        }
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: elapsedSec > 45 ? 'delayed' : 'correct',
          errorType: elapsedSec > 45 ? 'Delayed Intervention' : 'None',
          errorSeverity: elapsedSec > 45 ? 'Moderate' : 'None',
          feedbackMessage:
            'Code Blue emergency response activated. Resuscitation team notified; timer logged.',
          matchedStepId: 'ca_step_3',
        };
      }

      case 'open_airway': {
        patient.airwayClear = true;
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage: 'Airway positioned via head-tilt chin-lift; oropharynx clear.',
          matchedStepId: 'ca_step_4',
        };
      }

      case 'start_cpr': {
        if (!patient.examined) {
          patient.cprActive = true;
          patient.cprCyclesCompleted += 1;
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'out_of_sequence',
            errorType: 'Sequence Violation',
            errorSeverity: 'Moderate',
            feedbackMessage:
              'Chest compressions started without first verifying unresponsiveness/pulse.',
            matchedStepId: 'ca_step_5',
          };
        }
        patient.cprActive = true;
        patient.cprCyclesCompleted += 1;
        patient.systolicBP = 68;
        patient.diastolicBP = 32;
        const delayed = elapsedSec > 60 && !completedActions.has('start_cpr');
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: delayed ? 'delayed' : 'correct',
          errorType: delayed ? 'Delayed Intervention' : 'None',
          errorSeverity: delayed ? 'Moderate' : 'None',
          feedbackMessage: delayed
            ? 'CPR compressions initiated (>60s from start). Simulated coronary perfusion pressure rising.'
            : 'High-quality chest compressions active (110/min, 5.5cm simulated depth). Perfusion supported.',
          matchedStepId: 'ca_step_5',
        };
      }

      case 'power_on_aed': {
        if (!updatedEnvironment.primaryAedOperational) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Protocol Omission',
            errorSeverity: 'Moderate',
            feedbackMessage:
              'Primary AED indicates capacitor fault! Switch to backup AED power on the Medical Trolley first.',
          };
        }
        patient.aedPoweredOn = true;
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage: 'AED powered on. Audio prompt: "Attach defibrillator pads to patient bare chest."',
          matchedStepId: 'ca_step_6',
        };
      }

      case 'attach_aed_pads': {
        if (!patient.aedPoweredOn) {
          patient.aedPoweredOn = true;
          patient.padsAttached = true;
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'out_of_sequence',
            errorType: 'Sequence Violation',
            errorSeverity: 'Minor',
            feedbackMessage:
              'AED pads placed before powering on AED unit. Auto-powered unit; proceed to rhythm analysis.',
            matchedStepId: 'ca_step_7',
          };
        }
        if (updatedEnvironment.resources.aedPadsSets <= 0) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Moderate',
            feedbackMessage: 'No remaining AED pad sets in primary pouch.',
          };
        }
        updatedEnvironment.resources.aedPadsSets = Math.max(
          0,
          updatedEnvironment.resources.aedPadsSets - 1
        );
        patient.padsAttached = true;
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage:
            'Anterior-lateral defibrillation pads adhered firmly. Ready for rhythm analysis.',
          matchedStepId: 'ca_step_7',
        };
      }

      case 'analyze_rhythm': {
        if (!patient.padsAttached) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Sequence Violation',
            errorSeverity: 'Moderate',
            feedbackMessage:
              'Cannot analyze cardiac rhythm before attaching AED pads to patient chest.',
          };
        }
        patient.rhythmAnalyzed = true;
        patient.cprActive = false; // Brief pause to clear patient during analysis
        patient.shockAdvised = patient.cardiacRhythm === 'VFib';
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage: patient.shockAdvised
            ? 'Patient cleared. Rhythm analyzed: Coarse Ventricular Fibrillation (Simulated) — SHOCK ADVISED.'
            : 'Rhythm analyzed: Non-shockable rhythm. Resume CPR / post-ROSC care.',
          matchedStepId: 'ca_step_8',
        };
      }

      case 'deliver_shock': {
        if (!patient.padsAttached || !patient.rhythmAnalyzed) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Premature Shock',
            errorSeverity: 'Critical',
            feedbackMessage:
              'CRITICAL SAFETY ERROR: Attempted defibrillation discharge before attaching pads and analyzing rhythm!',
          };
        }
        if (!patient.shockAdvised) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Unsafe Action',
            errorSeverity: 'Critical',
            feedbackMessage:
              'CRITICAL SAFETY ERROR: Attempted shock delivery on a non-shockable / post-ROSC rhythm!',
          };
        }

        // Successful simulated defibrillation -> transition to simulated ROSC
        patient.shocksDelivered += 1;
        patient.shockAdvised = false;
        patient.cardiacRhythm = 'Sinus Tachycardia';
        patient.heartRate = 108;
        patient.systolicBP = 96;
        patient.diastolicBP = 62;
        patient.respiratoryRate = 12;
        patient.spo2 = Math.max(88, patient.spo2 + 6);
        patient.conditionStatus = 'Stabilising';
        patient.cprActive = false;

        const delayed = elapsedSec > 130;
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: delayed ? 'delayed' : 'correct',
          errorType: delayed ? 'Delayed Intervention' : 'None',
          errorSeverity: delayed ? 'Moderate' : 'None',
          feedbackMessage:
            '200J Biphasic simulated shock delivered safely. Simulated ROSC achieved: Sinus Tachycardia (HR 108, BP 96/62). Administer supplemental O2 and verify monitor.',
          matchedStepId: 'ca_step_9',
        };
      }

      case 'apply_oxygen': {
        if (updatedEnvironment.resources.oxygenCylinders <= 0) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Moderate',
            feedbackMessage: 'Portable oxygen supply depleted.',
          };
        }
        if (!patient.oxygenApplied) {
          updatedEnvironment.resources.oxygenCylinders -= 1;
        }
        patient.oxygenApplied = true;
        patient.airwayClear = true;
        if (patient.conditionStatus !== 'Arrest') {
          patient.spo2 = Math.min(97, patient.spo2 + 6);
          patient.respiratoryRate = 16;
          patient.conditionStatus = 'Stable';
          patient.cardiacRhythm = 'Normal Sinus';
        } else {
          patient.spo2 = Math.min(88, patient.spo2 + 4);
        }
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage:
            'High-flow BVM / supplemental oxygen connected (15 L/min simulated). Oxygenation rising.',
          matchedStepId: 'ca_step_10',
        };
      }

      case 'verify_monitor_vitals': {
        patient.monitorVerified = true;
        if (patient.conditionStatus === 'Arrest') {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'correct',
            errorType: 'None',
            errorSeverity: 'None',
            feedbackMessage:
              'Bedside monitor verified: Simulated Ventricular Fibrillation, pulseless arrest. Immediate CPR + Defibrillation required.',
          };
        }
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage:
            'Post-resuscitation telemetry verified: Organised rhythm, improving SpO2 & MAP. Ready to complete handover.',
          matchedStepId: 'ca_step_11',
        };
      }
    }
  }

  // ==================== SCENARIO 2: MULTI-PATIENT EMERGENCY TRIAGE ====================
  if (mode === 'multi_patient_triage' && patient) {
    switch (actionType) {
      case 'examine_patient': {
        patient.examined = true;
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage: `Examined ${patient.name} (${patient.patientId}): RR ${patient.respiratoryRate}/min, HR ${patient.heartRate} bpm, SpO2 ${patient.spo2}%, Bleeding: ${patient.bleedingSeverity}, AVPU: ${patient.consciousness}.`,
          matchedStepId: `tr_exam_${patient.patientId}`,
        };
      }

      case 'open_airway': {
        patient.airwayClear = true;
        if (patient.spo2 < 90) {
          patient.spo2 = Math.min(92, patient.spo2 + 5);
        }
        const needed = patient.referenceTriage === 'IMMEDIATE' && patient.spo2 < 92;
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: needed ? 'correct' : 'unnecessary',
          errorType: needed ? 'None' : 'None',
          errorSeverity: 'None',
          feedbackMessage: needed
            ? `Airway repositioned & cleared for ${patient.name}; inspiratory airflow improved.`
            : `Airway verified patent for ${patient.name} (already unobstructed).`,
          matchedStepId: needed ? `tr_airway_${patient.patientId}` : undefined,
        };
      }

      case 'control_bleeding': {
        if (patient.bleedingSeverity === 'None') {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Moderate',
            feedbackMessage: `${patient.name} has no active hemorrhage. Conserve scarce trauma tourniquet kits for severe bleeding!`,
          };
        }
        if (patient.bleedingSeverity === 'Mild') {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'unnecessary',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Minor',
            feedbackMessage: `${patient.name} has only mild laceration oozing — use standard Wound Dressing instead of a scarce arterial Hemorrhage Kit.`,
          };
        }
        if (updatedEnvironment.resources.hemorrhageKits <= 0) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Critical',
            feedbackMessage:
              'CRITICAL SHORTAGE: 0 arterial hemorrhage kits remaining! Unable to apply tourniquet.',
          };
        }

        updatedEnvironment.resources.hemorrhageKits -= 1;
        patient.bleedingControlled = true;
        patient.bleedingSeverity = 'Mild';
        patient.systolicBP = Math.min(104, patient.systolicBP + 14);
        patient.heartRate = Math.max(106, patient.heartRate - 16);
        patient.conditionStatus = 'Stabilising';
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage: `Arterial tourniquet & hemostatic packing applied to ${patient.name}. Active hemorrhage controlled; BP stabilising.`,
          matchedStepId: `tr_bleed_${patient.patientId}`,
        };
      }

      case 'apply_oxygen': {
        if (updatedEnvironment.resources.oxygenCylinders <= 0) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Critical',
            feedbackMessage:
              'CRITICAL SHORTAGE: Portable oxygen cylinders exhausted! Cannot administer O2.',
          };
        }
        if (patient.spo2 >= 96 && patient.referenceTriage !== 'IMMEDIATE') {
          updatedEnvironment.resources.oxygenCylinders -= 1;
          patient.oxygenApplied = true;
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Critical',
            feedbackMessage: `CRITICAL RESOURCE ERROR: Consumed scarce O2 cylinder on ${patient.name} (SpO2 ${patient.spo2}%). Hypoxic IMMEDIATE patients require limited oxygen!`,
          };
        }
        updatedEnvironment.resources.oxygenCylinders -= 1;
        patient.oxygenApplied = true;
        patient.spo2 = Math.min(97, patient.spo2 + 8);
        patient.respiratoryRate = Math.max(20, patient.respiratoryRate - 6);
        if (patient.bleedingControlled || patient.bleedingSeverity === 'None') {
          patient.conditionStatus = 'Stabilising';
        }
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage: `High-flow oxygen initiated for ${patient.name}. Simulated SpO2 improving (${patient.spo2}%).`,
          matchedStepId: `tr_o2_${patient.patientId}`,
        };
      }

      case 'dress_wound': {
        if (updatedEnvironment.resources.woundDressings <= 0) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Resource Misallocation',
            errorSeverity: 'Minor',
            feedbackMessage: 'No sterile wound dressings remaining.',
          };
        }
        updatedEnvironment.resources.woundDressings -= 1;
        patient.woundDressed = true;
        if (patient.bleedingSeverity === 'Mild') {
          patient.bleedingControlled = true;
        }
        patient.painLevel = Math.max(2, patient.painLevel - 2);
        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'correct',
          errorType: 'None',
          errorSeverity: 'None',
          feedbackMessage: `Sterile pressure dressing & splint applied to ${patient.name}.`,
          matchedStepId: `tr_dress_${patient.patientId}`,
        };
      }

      case 'assign_triage': {
        if (!triageSelection) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'incorrect',
            errorType: 'Incorrect Triage',
            errorSeverity: 'Minor',
            feedbackMessage: 'No triage priority category selected.',
          };
        }

        const examinedFirst = patient.examined;
        patient.assignedTriage = triageSelection;
        const matches = triageSelection === patient.referenceTriage;

        if (!examinedFirst) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: matches ? 'out_of_sequence' : 'incorrect',
            errorType: matches ? 'Sequence Violation' : 'Incorrect Triage',
            errorSeverity: matches ? 'Moderate' : 'Critical',
            feedbackMessage: matches
              ? `Assigned ${triageSelection} to ${patient.name}, but without completing primary examination first!`
              : `CRITICAL TRIAGE ERROR: Assigned ${triageSelection} to unexamined patient ${patient.name} (Reference: ${patient.referenceTriage}). ${patient.triageRationale}`,
            matchedStepId: `tr_tag_${patient.patientId}`,
          };
        }

        if (matches) {
          return {
            updatedPatients,
            updatedEnvironment,
            correctness: 'correct',
            errorType: 'None',
            errorSeverity: 'None',
            feedbackMessage: `Correctly prioritised ${patient.name} as ${triageSelection}. ${patient.triageRationale}`,
            matchedStepId: `tr_tag_${patient.patientId}`,
          };
        }

        // Under-triaging an IMMEDIATE patient is a Critical Error
        const isCriticalUnderTriage =
          patient.referenceTriage === 'IMMEDIATE' && triageSelection !== 'IMMEDIATE';

        return {
          updatedPatients,
          updatedEnvironment,
          correctness: 'incorrect',
          errorType: 'Incorrect Triage',
          errorSeverity: isCriticalUnderTriage ? 'Critical' : 'Moderate',
          feedbackMessage: `${isCriticalUnderTriage ? 'CRITICAL UNDER-TRIAGE' : 'TRIAGE MISMATCH'}: Assigned ${triageSelection} to ${patient.name}, expected ${patient.referenceTriage}. ${patient.triageRationale}`,
          matchedStepId: `tr_tag_${patient.patientId}`,
        };
      }
    }
  }

  return {
    updatedPatients,
    updatedEnvironment,
    correctness: 'unnecessary',
    errorType: 'None',
    errorSeverity: 'None',
    feedbackMessage: `Inspected ${params.targetObject}. Select a contextual clinical action to proceed.`,
  };
}

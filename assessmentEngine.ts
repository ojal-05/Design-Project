import type {
  ActionEventRecord,
  DebriefReport,
  PatientState,
  ScenarioDefinition,
  SessionAssessment,
  TrainingSession,
} from '../types/simulation.ts';

/**
 * Evaluates a completed (or ended) training session against the scenario's
 * educator-configured expected actions and assessment weights.
 * Critical errors are strictly surfaced alongside the weighted score.
 */
export function calculateSessionAssessment(
  sessionId: string,
  scenario: ScenarioDefinition,
  events: ActionEventRecord[],
  finalPatients: PatientState[],
  completionTimeSec: number
): SessionAssessment {
  const expected = scenario.expectedActions;
  const weights = scenario.assessmentWeights;

  // 1. Procedural Accuracy: proportion of expected steps completed with 'correct' or 'delayed'
  const completedStepTypes = new Set<string>();
  events.forEach((ev) => {
    if (ev.correctness === 'correct' || ev.correctness === 'delayed' || ev.correctness === 'out_of_sequence') {
      const key = ev.patientId ? `${ev.actionType}:${ev.patientId}` : ev.actionType;
      completedStepTypes.add(key);
      completedStepTypes.add(ev.actionType);
    }
  });

  const missedActions: string[] = [];
  let matchedExpectedCount = 0;

  expected.forEach((step) => {
    const key = step.patientId ? `${step.actionType}:${step.patientId}` : step.actionType;
    const done = completedStepTypes.has(key) || (!step.patientId && completedStepTypes.has(step.actionType));
    if (done) {
      matchedExpectedCount += 1;
    } else {
      missedActions.push(`${step.label} (${step.educationalRule})`);
    }
  });

  // Also check any surge arrival patient triage in multi_patient_triage
  if (scenario.mode === 'multi_patient_triage') {
    finalPatients.forEach((p) => {
      if (!p.assignedTriage) {
        const msg = `Unassigned Triage Priority for ${p.name} (${p.patientId})`;
        if (!missedActions.some((m) => m.includes(p.patientId))) {
          missedActions.push(msg);
        }
      }
    });
  }

  const baseProcedural =
    expected.length > 0 ? (matchedExpectedCount / expected.length) * 100 : 100;

  // 2. Decision Accuracy: ratio of accurate clinical decisions vs total clinical actions
  const meaningfulEvents = events.filter((e) => e.correctness !== 'unnecessary');
  const correctDecisionEvents = meaningfulEvents.filter(
    (e) => e.correctness === 'correct' || e.correctness === 'delayed'
  );

  let triageAccuracyBonus = 100;
  if (scenario.mode === 'multi_patient_triage' && finalPatients.length > 0) {
    const correctTags = finalPatients.filter(
      (p) => p.assignedTriage && p.assignedTriage === p.referenceTriage
    ).length;
    triageAccuracyBonus = (correctTags / finalPatients.length) * 100;
  }

  const rawDecision =
    meaningfulEvents.length > 0
      ? (correctDecisionEvents.length / meaningfulEvents.length) * 100
      : 0;

  const decisionAccuracy = Math.round(
    scenario.mode === 'multi_patient_triage'
      ? rawDecision * 0.5 + triageAccuracyBonus * 0.5
      : rawDecision
  );

  // 3. Response Time Score
  const avgResponseTimeSec =
    events.length > 0
      ? Number(
          (
            events.reduce((acc, ev) => acc + ev.responseTimeSec, 0) / events.length
          ).toFixed(1)
        )
      : completionTimeSec;

  const delayedActionsCount = events.filter((e) => e.correctness === 'delayed').length;
  const targetDuration = scenario.durationLimitSec;
  const paceRatio = Math.min(1.4, completionTimeSec / Math.max(60, targetDuration * 0.75));
  const rawTimeScore = Math.max(
    25,
    Math.min(100, Math.round(105 - (paceRatio - 0.6) * 35 - delayedActionsCount * 8))
  );
  const responseTimeScore = events.length === 0 ? 0 : rawTimeScore;

  // 4. Sequence Accuracy
  const sequenceViolations = events.filter((e) => e.correctness === 'out_of_sequence').length;
  const sequenceAccuracy =
    events.length === 0
      ? 0
      : Math.max(0, Math.round(100 - sequenceViolations * 16 - missedActions.length * 6));

  // 5. Critical Errors & Repeated Errors
  const criticalErrors: string[] = events
    .filter((e) => e.errorSeverity === 'Critical')
    .map((e) => `[${e.elapsedSec}s] ${e.feedbackMessage}`);

  // Missing critical expected steps also registers as a critical protocol omission
  expected.forEach((step) => {
    const key = step.patientId ? `${step.actionType}:${step.patientId}` : step.actionType;
    const done = completedStepTypes.has(key) || (!step.patientId && completedStepTypes.has(step.actionType));
    if (!done && step.isCritical) {
      criticalErrors.push(`Omitted Critical Step: ${step.label}`);
    }
  });

  // Repeated error tracking
  const errorCountsByType: Record<string, number> = {};
  events.forEach((e) => {
    if (e.errorType !== 'None') {
      errorCountsByType[e.errorType] = (errorCountsByType[e.errorType] || 0) + 1;
    }
  });
  const repeatedErrorsCount = Object.values(errorCountsByType).reduce(
    (sum, count) => sum + (count > 1 ? count - 1 : 0),
    0
  );

  const proceduralAccuracy = Math.round(baseProcedural);

  // Normalize weights in case instructor edited custom values
  const totalW =
    weights.proceduralAccuracy +
    weights.decisionAccuracy +
    weights.responseTime +
    weights.sequenceAccuracy || 1;

  const wProc = weights.proceduralAccuracy / totalW;
  const wDec = weights.decisionAccuracy / totalW;
  const wTime = weights.responseTime / totalW;
  const wSeq = weights.sequenceAccuracy / totalW;

  const weightedRaw =
    proceduralAccuracy * wProc +
    decisionAccuracy * wDec +
    responseTimeScore * wTime +
    sequenceAccuracy * wSeq;

  const overallScore = Math.max(0, Math.min(100, Math.round(weightedRaw)));

  const scoreCalculationFormula = `Score = (${proceduralAccuracy}% × ${Math.round(
    wProc * 100
  )}% Procedural) + (${decisionAccuracy}% × ${Math.round(
    wDec * 100
  )}% Decision) + (${responseTimeScore}% × ${Math.round(
    wTime * 100
  )}% Response Speed) + (${sequenceAccuracy}% × ${Math.round(
    wSeq * 100
  )}% Sequence) = ${overallScore}/100 (Critical Errors tracked independently: ${
    criticalErrors.length
  })`;

  // Simulated Outcome based strictly on final simulated patient states
  let simulatedOutcome = '';
  if (scenario.mode === 'cardiac_arrest') {
    const p = finalPatients[0];
    if (p && (p.conditionStatus === 'Stable' || p.conditionStatus === 'Stabilising')) {
      simulatedOutcome =
        p.oxygenApplied && p.monitorVerified
          ? 'Simulated ROSC Achieved & Post-Resuscitation Oxygenation Stabilised'
          : 'Simulated ROSC Achieved; Post-Shock Stabilisation Incomplete';
    } else {
      simulatedOutcome = 'Unresolved Simulated Arrest at Scenario End';
    }
  } else {
    const taggedCount = finalPatients.filter((p) => p.assignedTriage !== null).length;
    const accurateCount = finalPatients.filter(
      (p) => p.assignedTriage === p.referenceTriage
    ).length;
    const stabilisedImmediates = finalPatients.filter(
      (p) => p.referenceTriage === 'IMMEDIATE' && p.conditionStatus === 'Stabilising'
    ).length;
    const totalImmediates = finalPatients.filter(
      (p) => p.referenceTriage === 'IMMEDIATE'
    ).length;

    simulatedOutcome = `Triaged ${taggedCount}/${finalPatients.length} casualties (${accurateCount}/${finalPatients.length} rule-concordant); ${stabilisedImmediates}/${totalImmediates} IMMEDIATE casualties physiologically stabilised.`;
  }

  return {
    sessionId,
    proceduralAccuracy,
    decisionAccuracy,
    avgResponseTimeSec,
    responseTimeScore,
    sequenceAccuracy,
    overallScore,
    weightsUsed: {
      proceduralAccuracy: Number(wProc.toFixed(2)),
      decisionAccuracy: Number(wDec.toFixed(2)),
      responseTime: Number(wTime.toFixed(2)),
      sequenceAccuracy: Number(wSeq.toFixed(2)),
    },
    scoreCalculationFormula,
    criticalErrorsCount: criticalErrors.length,
    criticalErrors,
    missedActions,
    repeatedErrorsCount,
    delayedActionsCount,
    completionTimeSec,
    simulatedOutcome,
    prototypeDisclaimer:
      'EDUCATIONAL PROTOTYPE METRIC: Computed from configured training rules. Not a clinically validated competency certification.',
  };
}

/**
 * Deterministic, rule-based debrief generator used when Gemini API is not configured
 * or offline. Strictly interprets recorded session evidence and training rules.
 */
export function generateRuleBasedDebrief(
  session: TrainingSession,
  scenario: ScenarioDefinition
): DebriefReport {
  const assessment =
    session.assessment ||
    calculateSessionAssessment(
      session.id,
      scenario,
      session.events,
      session.finalPatients,
      session.durationSec
    );

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const correctEvents = session.events.filter((e) => e.correctness === 'correct');
  const delayedEvents = session.events.filter((e) => e.correctness === 'delayed');
  const incorrectEvents = session.events.filter(
    (e) => e.correctness === 'incorrect' || e.correctness === 'out_of_sequence'
  );

  if (assessment.proceduralAccuracy >= 80) {
    strengths.push(
      `High procedural completeness (${assessment.proceduralAccuracy}%) across configured ${scenario.title} steps.`
    );
  }
  if (correctEvents.length > 0) {
    const sampleLabels = correctEvents
      .slice(0, 3)
      .map((e) => `${e.actionLabel} at ${e.elapsedSec}s`)
      .join('; ');
    strengths.push(`Timely execution of key protocol actions: ${sampleLabels}.`);
  }
  if (assessment.criticalErrorsCount === 0) {
    strengths.push('Zero critical safety or under-triage errors recorded during the simulation.');
  }
  if (session.disruptions.some((d) => d.triggered)) {
    strengths.push(
      `Maintained workflow continuity through ${
        session.disruptions.filter((d) => d.triggered).length
      } active environmental/clinical disruption(s).`
    );
  }
  if (strengths.length === 0) {
    strengths.push('Initiated simulation session and logged baseline observational events.');
  }

  if (assessment.proceduralAccuracy < 80) {
    weaknesses.push(
      `Incomplete protocol coverage (${assessment.proceduralAccuracy}% procedural accuracy; ${assessment.missedActions.length} expected step(s) omitted).`
    );
  }
  if (assessment.sequenceAccuracy < 85) {
    weaknesses.push(
      `Sequence ordering deviations lowered sequence score to ${assessment.sequenceAccuracy}%.`
    );
  }
  if (assessment.criticalErrorsCount > 0) {
    weaknesses.push(
      `${assessment.criticalErrorsCount} critical training rule violation(s) recorded that require targeted remediation.`
    );
  }
  if (delayedEvents.length > 0) {
    weaknesses.push(
      `${delayedEvents.length} intervention(s) exceeded target educational time windows.`
    );
  }
  if (weaknesses.length === 0) {
    weaknesses.push('No major structural weaknesses detected in recorded action sequence.');
  }

  const delayedList = delayedEvents.map(
    (e) => `${e.actionLabel} performed at ${e.elapsedSec}s (${e.feedbackMessage})`
  );

  const incorrectList = incorrectEvents.map(
    (e) => `[${e.elapsedSec}s] ${e.actionLabel} — ${e.errorType}: ${e.feedbackMessage}`
  );

  const recommendations: string[] = [];
  if (assessment.criticalErrors.length > 0) {
    recommendations.push(
      'Prioritise remediation of critical safety errors in Session Replay before advancing to High Acuity disruption seeds.'
    );
  }
  if (assessment.missedActions.length > 0) {
    recommendations.push(
      `Review omitted expected steps in Scenario Library (${assessment.missedActions
        .slice(0, 2)
        .join('; ')}).`
    );
  }
  if (delayedEvents.length > 0) {
    recommendations.push(
      'Practise rapid bedside equipment localisation in the 3D Simulation Centre to reduce initial intervention latency.'
    );
  }
  if (scenario.mode === 'multi_patient_triage') {
    recommendations.push(
      'Complete brief primary examination on every casualty prior to committing limited oxygen cylinders or arterial tourniquets.'
    );
  } else {
    recommendations.push(
      'Maintain uninterrupted chest compressions until AED pads are adhered and rhythm analysis explicitly clears the patient.'
    );
  }

  return {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    source: 'rule-based',
    summary: `Rule-based educational debrief for ${session.traineeName} on "${scenario.title}" (${session.durationSec}s duration, Seed ${session.seed}). Overall training score: ${assessment.overallScore}/100 with ${assessment.criticalErrorsCount} critical error(s). Outcome: ${assessment.simulatedOutcome}`,
    strengths,
    weaknesses,
    delayedActions: delayedList,
    missedActions: assessment.missedActions,
    incorrectDecisions: incorrectList,
    criticalErrors: assessment.criticalErrors,
    improvementRecommendations: recommendations,
  };
}

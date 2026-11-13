import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { DEMO_SCENARIOS } from '../data/demoSeedData';
import {
  DifficultyLevel,
  DisruptionType,
  EnvironmentConfig,
  ExpectedActionStep,
  ScenarioDefinition,
  ScenarioMode,
  UserAccount,
} from '../types/simulation';

interface ScenarioStudioViewProps {
  scenarios: ScenarioDefinition[];
  selectedScenarioId: string | null;
  users: UserAccount[];
  currentUser: UserAccount;
  onSaveScenario: (scenario: ScenarioDefinition) => void;
  onPreviewIn3D: (scenarioId: string) => void;
}

const ALL_DISRUPTIONS: Array<{ type: DisruptionType; label: string }> = [
  { type: 'equipment_unavailable', label: 'Primary AED Fault' },
  { type: 'blocked_exit', label: 'Blocked Transfer Exit' },
  { type: 'additional_casualty', label: 'Unexpected Surge Casualty' },
  { type: 'resource_shortage', label: 'Oxygen Supply Drop' },
  { type: 'patient_deterioration', label: 'Acute Patient Deterioration' },
  { type: 'lighting_fluctuation', label: 'Backup Lighting Shift' },
  { type: 'time_pressure', label: 'Compressed Handover Window' },
];

export const ScenarioStudioView: React.FC<ScenarioStudioViewProps> = ({
  scenarios,
  selectedScenarioId,
  users,
  currentUser,
  onSaveScenario,
  onPreviewIn3D,
}) => {
  const trainees = useMemo(
    () => users.filter((u) => u.role === 'trainee'),
    [users]
  );

  const initialScenario = useMemo(
    () =>
      scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0],
    [scenarios, selectedScenarioId]
  );

  const [draft, setDraft] = useState<ScenarioDefinition>(initialScenario);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [newStepLabel, setNewStepLabel] = useState('');
  const [newStepActionType, setNewStepActionType] = useState('verify_monitor_vitals');
  const [newStepTargetSec, setNewStepTargetSec] = useState(120);
  const [newStepCritical, setNewStepCritical] = useState(false);

  useEffect(() => {
    if (selectedScenarioId) {
      const match = scenarios.find((s) => s.id === selectedScenarioId);
      if (match) setDraft(JSON.parse(JSON.stringify(match)));
    }
  }, [selectedScenarioId, scenarios]);

  const selectExistingScenario = (scen: ScenarioDefinition) => {
    setDraft(JSON.parse(JSON.stringify(scen)));
    setSavedBanner(null);
  };

  const handleCreateNew = (mode: ScenarioMode) => {
    const template =
      mode === 'cardiac_arrest' ? DEMO_SCENARIOS[0] : DEMO_SCENARIOS[1];
    const cloned: ScenarioDefinition = JSON.parse(JSON.stringify(template));
    const suffix = Math.floor(100 + Math.random() * 899);
    cloned.id = `scen_custom_${Date.now()}`;
    cloned.code = mode === 'cardiac_arrest' ? `SIM-CA-${suffix}` : `SIM-TR-${suffix}`;
    cloned.title =
      mode === 'cardiac_arrest'
        ? `Custom Resuscitation Protocol #${suffix}`
        : `Custom Multi-Casualty Triage #${suffix}`;
    cloned.isDemo = false;
    cloned.archived = false;
    cloned.createdBy = currentUser.name;
    cloned.updatedAt = new Date().toISOString();
    setDraft(cloned);
    setSavedBanner('Initialized new custom scenario draft. Click Save Scenario to persist.');
  };

  const handleDuplicateCurrent = () => {
    const cloned: ScenarioDefinition = JSON.parse(JSON.stringify(draft));
    const suffix = Math.floor(100 + Math.random() * 899);
    cloned.id = `scen_dup_${Date.now()}`;
    cloned.code = `${draft.code}-COPY`;
    cloned.title = `${draft.title} (Copy ${suffix})`;
    cloned.isDemo = false;
    cloned.archived = false;
    cloned.createdBy = currentUser.name;
    cloned.updatedAt = new Date().toISOString();
    onSaveScenario(cloned);
    setDraft(cloned);
    setSavedBanner(`Duplicated and saved "${cloned.title}".`);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: ScenarioDefinition = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    onSaveScenario(updated);
    setDraft(updated);
    setSavedBanner(`Saved "${updated.title}" (${updated.code}) to persistent repository.`);
  };

  const handleToggleArchive = () => {
    const updated: ScenarioDefinition = {
      ...draft,
      archived: !draft.archived,
      updatedAt: new Date().toISOString(),
    };
    onSaveScenario(updated);
    setDraft(updated);
    setSavedBanner(
      updated.archived
        ? `Archived scenario "${updated.title}".`
        : `Restored scenario "${updated.title}" to active library.`
    );
  };

  const toggleDisruption = (type: DisruptionType) => {
    const exists = draft.disruptionsConfig.enabledTypes.includes(type);
    const nextTypes = exists
      ? draft.disruptionsConfig.enabledTypes.filter((t) => t !== type)
      : [...draft.disruptionsConfig.enabledTypes, type];
    setDraft({
      ...draft,
      disruptionsConfig: {
        ...draft.disruptionsConfig,
        enabledTypes: nextTypes,
      },
    });
  };

  const toggleTraineeAssignment = (traineeId: string) => {
    const exists = draft.assignedTraineeIds.includes(traineeId);
    const nextIds = exists
      ? draft.assignedTraineeIds.filter((id) => id !== traineeId)
      : [...draft.assignedTraineeIds, traineeId];
    setDraft({
      ...draft,
      assignedTraineeIds: nextIds,
    });
  };

  const handlePatientCountChange = (count: number) => {
    const clamped = Math.max(1, Math.min(5, count));
    const templatePool = DEMO_SCENARIOS[1].initialPatients;
    const currentList = [...draft.initialPatients];
    while (currentList.length < clamped) {
      const idx = currentList.length;
      const base = templatePool[idx % templatePool.length];
      currentList.push({
        ...JSON.parse(JSON.stringify(base)),
        patientId: `PT-20${idx + 1}`,
        bayNumber: idx + 1,
        name: `Simulated Casualty #${idx + 1}`,
      });
    }
    const trimmed = currentList.slice(0, clamped);
    setDraft({
      ...draft,
      patientCount: clamped,
      initialPatients: trimmed,
    });
  };

  const handleAddExpectedStep = () => {
    if (!newStepLabel.trim()) return;
    const nextStep: ExpectedActionStep = {
      stepId: `step_custom_${Date.now()}`,
      order: draft.expectedActions.length + 1,
      actionType: newStepActionType,
      targetObject: 'Virtual Patient',
      label: newStepLabel.trim(),
      educationalRule: `Complete within ${newStepTargetSec}s per instructor rubric`,
      targetWindowSec: newStepTargetSec,
      isCritical: newStepCritical,
      prerequisites: [],
    };
    setDraft({
      ...draft,
      expectedActions: [...draft.expectedActions, nextStep],
    });
    setNewStepLabel('');
  };

  const handleRemoveExpectedStep = (stepId: string) => {
    const filtered = draft.expectedActions
      .filter((s) => s.stepId !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setDraft({
      ...draft,
      expectedActions: filtered,
    });
  };

  const weightSumPercent = Math.round(
    (draft.assessmentWeights.proceduralAccuracy +
      draft.assessmentWeights.decisionAccuracy +
      draft.assessmentWeights.responseTime +
      draft.assessmentWeights.sequenceAccuracy) *
      100
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-6">
      {/* Studio Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800/90">
        <div>
          <div className="text-xs text-cyan-400 font-medium">
            Instructor Authoring Environment
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Scenario Design Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create, duplicate, configure disruptions, calibrate assessment weights, assign trainees, and preview scenarios in 3D.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCreateNew('cardiac_arrest')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            New Cardiac Scenario
          </button>
          <button
            type="button"
            onClick={() => handleCreateNew('multi_patient_triage')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            New Triage Scenario
          </button>
          <button
            type="button"
            onClick={handleDuplicateCurrent}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleToggleArchive}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 whitespace-nowrap"
          >
            <Archive className="w-3.5 h-3.5" />
            {draft.archived ? 'Restore' : 'Archive'}
          </button>
          <button
            type="button"
            onClick={() => {
              handleSave();
              onPreviewIn3D(draft.id);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            Save &amp; Preview in 3D
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            Save Scenario
          </button>
        </div>
      </div>

      {savedBanner && (
        <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Scenario Selector List */}
        <div className="lg:col-span-3 space-y-2">
          <div className="text-xs font-semibold text-slate-300 mb-2">
            Repository Scenarios ({scenarios.length})
          </div>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectExistingScenario(s)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                draft.id === s.id
                  ? 'bg-cyan-950/40 border-cyan-400 text-slate-100'
                  : 'bg-[#0D1424] border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="text-[11px] font-mono text-slate-400">
                {s.code} · {s.difficulty}
                {s.archived ? ' · ARCHIVED' : ''}
              </div>
              <div className="text-xs font-semibold mt-0.5 line-clamp-2">
                {s.title}
              </div>
            </button>
          ))}
        </div>

        {/* Main Authoring Workspace */}
        <form onSubmit={handleSave} className="lg:col-span-9 space-y-6">
          {/* 1. Core Identity & Parameters */}
          <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">
              01. Scenario Parameters &amp; Briefing
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Scenario Code
                </label>
                <input
                  type="text"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Difficulty Tier
                </label>
                <select
                  value={draft.difficulty}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      difficulty: e.target.value as DifficultyLevel,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                >
                  <option value="Foundation">Foundation</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="High Acuity">High Acuity</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Time Limit (Seconds): <span className="font-mono">{draft.durationLimitSec}s</span>
                </label>
                <input
                  type="number"
                  min={90}
                  max={900}
                  step={30}
                  value={draft.durationLimitSec}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      durationLimitSec: Number(e.target.value) || 300,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Scenario Title
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Simulated Patient Count ({draft.patientCount})
                </label>
                <input
                  type="number"
                  min={draft.mode === 'cardiac_arrest' ? 1 : 2}
                  max={draft.mode === 'cardiac_arrest' ? 1 : 5}
                  disabled={draft.mode === 'cardiac_arrest'}
                  value={draft.patientCount}
                  onChange={(e) => handlePatientCountChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Trainee Briefing Instructions
              </label>
              <textarea
                rows={3}
                value={draft.briefing}
                onChange={(e) => setDraft({ ...draft, briefing: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
              />
            </div>
          </div>

          {/* 2. Environment & Resource Availability */}
          <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">
              02. Environment &amp; Resource Pool
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Bay Lighting Mode
                </label>
                <select
                  value={draft.environmentConfig.lightingMode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      environmentConfig: {
                        ...draft.environmentConfig,
                        lightingMode: e.target
                          .value as EnvironmentConfig['lightingMode'],
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                >
                  <option value="Clinical Standard">Clinical Standard</option>
                  <option value="Night Shift Dim">Night Shift Dim</option>
                  <option value="Emergency Backup">Emergency Backup</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Oxygen Cylinders
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={draft.environmentConfig.resources.oxygenCylinders}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      environmentConfig: {
                        ...draft.environmentConfig,
                        resources: {
                          ...draft.environmentConfig.resources,
                          oxygenCylinders: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Hemorrhage Kits
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={draft.environmentConfig.resources.hemorrhageKits}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      environmentConfig: {
                        ...draft.environmentConfig,
                        resources: {
                          ...draft.environmentConfig.resources,
                          hemorrhageKits: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Sterile Dressings
                </label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={draft.environmentConfig.resources.woundDressings}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      environmentConfig: {
                        ...draft.environmentConfig,
                        resources: {
                          ...draft.environmentConfig.resources,
                          woundDressings: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* 3. Dynamic Emergency World Disruptions */}
          <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-100">
                03. Dynamic Emergency Disruptions &amp; Reproducible Seed
              </h2>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">PRNG Seed:</label>
                <input
                  type="number"
                  value={draft.disruptionsConfig.seed}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      disruptionsConfig: {
                        ...draft.disruptionsConfig,
                        seed: Number(e.target.value) || 1001,
                      },
                    })
                  }
                  className="w-28 px-2.5 py-1 rounded bg-[#070B14] border border-slate-700 text-xs font-mono text-cyan-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ALL_DISRUPTIONS.map((item) => {
                const enabled = draft.disruptionsConfig.enabledTypes.includes(
                  item.type
                );
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => toggleDisruption(item.type)}
                    className={`p-3 rounded-lg border text-left text-xs font-medium transition-colors flex items-center justify-between ${
                      enabled
                        ? 'bg-amber-950/35 border-amber-500/70 text-amber-100'
                        : 'bg-[#070B14] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="font-mono text-[10px]">
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Expected Actions & Assessment Weights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
              <h2 className="text-sm font-semibold text-slate-100">
                04. Expected Action Sequence ({draft.expectedActions.length})
              </h2>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {draft.expectedActions.map((step) => (
                  <div
                    key={step.stepId}
                    className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-slate-400 mr-1.5">
                        {step.order}.
                      </span>
                      <span className="text-slate-100 font-medium">
                        {step.label}
                      </span>
                      <span className="text-slate-500 font-mono ml-2">
                        (&le;{step.targetWindowSec}s{step.isCritical ? ' · CRIT' : ''})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExpectedStep(step.stepId)}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="Remove Step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Step Label
                  </label>
                  <input
                    type="text"
                    value={newStepLabel}
                    onChange={(e) => setNewStepLabel(e.target.value)}
                    placeholder="e.g., Re-verify Monitor Rhythm"
                    className="w-full px-2.5 py-1.5 rounded bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Action Type
                  </label>
                  <select
                    value={newStepActionType}
                    onChange={(e) => setNewStepActionType(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                  >
                    <option value="check_scene_safety">check_scene_safety</option>
                    <option value="check_responsiveness">check_responsiveness</option>
                    <option value="call_code_blue">call_code_blue</option>
                    <option value="start_cpr">start_cpr</option>
                    <option value="attach_aed_pads">attach_aed_pads</option>
                    <option value="deliver_shock">deliver_shock</option>
                    <option value="apply_oxygen">apply_oxygen</option>
                    <option value="verify_monitor_vitals">verify_monitor_vitals</option>
                    <option value="examine_patient">examine_patient</option>
                    <option value="control_bleeding">control_bleeding</option>
                    <option value="assign_triage">assign_triage</option>
                  </select>
                </div>
                <div className="sm:col-span-3 flex items-center gap-1.5">
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={newStepTargetSec}
                    onChange={(e) => setNewStepTargetSec(Number(e.target.value))}
                    aria-label="Target Window Seconds"
                    className="w-16 px-2 py-1.5 rounded bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100"
                  />
                  <label className="text-[10px] text-slate-400 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={newStepCritical}
                      onChange={(e) => setNewStepCritical(e.target.checked)}
                    />
                    Crit
                  </label>
                  <button
                    type="button"
                    onClick={handleAddExpectedStep}
                    className="px-2.5 py-1.5 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Assessment Weights + Trainee Assignments */}
            <div className="lg:col-span-5 p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">
                  05. Assessment Weights
                </h2>
                <span className="text-xs font-mono text-cyan-300">
                  Sum: {weightSumPercent}% (Auto-normalised)
                </span>
              </div>

              {(
                [
                  { key: 'proceduralAccuracy', label: 'Procedural Accuracy' },
                  { key: 'decisionAccuracy', label: 'Decision Accuracy' },
                  { key: 'responseTime', label: 'Response Time' },
                  { key: 'sequenceAccuracy', label: 'Sequence Accuracy' },
                ] as const
              ).map((w) => {
                const pct = Math.round(draft.assessmentWeights[w.key] * 100);
                return (
                  <div key={w.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{w.label}</span>
                      <span className="font-mono text-slate-100">{pct}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={pct}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          assessmentWeights: {
                            ...draft.assessmentWeights,
                            [w.key]: Number(e.target.value) / 100,
                          },
                        })
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-200">
                  Assign to Trainees ({draft.assignedTraineeIds.length})
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {trainees.map((t) => {
                    const checked = draft.assignedTraineeIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded bg-[#070B14] border border-slate-800 text-xs cursor-pointer"
                      >
                        <span className="text-slate-200">{t.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTraineeAssignment(t.id)}
                          className="accent-cyan-400"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

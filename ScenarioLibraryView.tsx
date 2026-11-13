import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Edit3,
  Play,
  Search,
  Sliders,
} from 'lucide-react';
import {
  DifficultyLevel,
  NavSection,
  ScenarioDefinition,
  ScenarioMode,
  UserAccount,
} from '../types/simulation';
import { getScenarioVisual } from '../utils/scenarioVisuals';

interface ScenarioLibraryViewProps {
  scenarios: ScenarioDefinition[];
  currentUser: UserAccount;
  onLaunchScenario: (scenarioId: string) => void;
  onEditScenarioInStudio: (scenarioId: string) => void;
  onNavigate: (section: NavSection) => void;
}

export const ScenarioLibraryView: React.FC<ScenarioLibraryViewProps> = ({
  scenarios,
  currentUser,
  onLaunchScenario,
  onEditScenarioInStudio,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | ScenarioMode>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyLevel>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(
    scenarios[0]?.id || null
  );
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const filteredScenarios = useMemo(() => {
    return scenarios.filter((s) => {
      if (!showArchived && s.archived) return false;
      if (modeFilter !== 'all' && s.mode !== modeFilter) return false;
      if (difficultyFilter !== 'all' && s.difficulty !== difficultyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.briefing.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scenarios, showArchived, modeFilter, difficultyFilter, searchQuery]);

  const inspectedScenario = useMemo(
    () =>
      filteredScenarios.find((s) => s.id === inspectedId) ||
      filteredScenarios[0] ||
      null,
    [filteredScenarios, inspectedId]
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800/90">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Scenario Library
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect approved educational protocols, resource constraints, seeded disruptions, and launch 3D emergency simulations.
          </p>
        </div>

        {(currentUser.role === 'instructor' || currentUser.role === 'administrator') && (
          <button
            type="button"
            onClick={() => onNavigate('scenario-studio')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5" />
            Create Scenario in Studio
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1424] p-3.5 rounded-xl border border-slate-800">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, title, or clinical focus..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070B14] border border-slate-800">
            {(
              [
                { id: 'all', label: 'All Modes' },
                { id: 'cardiac_arrest', label: 'Cardiac Arrest' },
                { id: 'multi_patient_triage', label: 'Multi-Patient Triage' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModeFilter(m.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  modeFilter === m.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <select
            value={difficultyFilter}
            onChange={(e) =>
              setDifficultyFilter(e.target.value as 'all' | DifficultyLevel)
            }
            aria-label="Filter by Difficulty"
            className="px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="all">All Difficulties</option>
            <option value="Foundation">Foundation</option>
            <option value="Intermediate">Intermediate</option>
            <option value="High Acuity">High Acuity</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none ml-1">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-700 bg-[#070B14]"
            />
            Show Archived
          </label>
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 grid grid-cols-1 gap-4">
          {filteredScenarios.map((scen) => {
            const isSelected = inspectedScenario?.id === scen.id;
            const visualSrc = getScenarioVisual(scen.mode);
            const imgBroken = Boolean(brokenImages[scen.id]);

            return (
              <div
                key={scen.id}
                onClick={() => setInspectedId(scen.id)}
                className={`rounded-xl bg-[#0D1424] border overflow-hidden cursor-pointer transition-colors flex flex-col sm:flex-row ${
                  isSelected
                    ? 'border-cyan-400'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="sm:w-48 h-36 sm:h-auto relative bg-[#070B14] shrink-0">
                  {!imgBroken ? (
                    <img
                      src={visualSrc}
                      alt={scen.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [scen.id]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                      <Activity className="w-7 h-7 text-cyan-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070B14]/85 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2.5 text-[11px] font-mono text-cyan-200">
                    {scen.code}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] text-slate-400">
                      <span>{scen.difficulty}</span>
                      <span className="mx-1.5">·</span>
                      <span>{scen.patientCount} Simulated Patient(s)</span>
                      <span className="mx-1.5">·</span>
                      <span className="font-mono">
                        {Math.round(scen.durationLimitSec / 60)} min
                      </span>
                      {scen.isDemo && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono text-amber-300/90">DEMO DATA</span>
                        </>
                      )}
                      {scen.archived && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono text-red-400">ARCHIVED</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-slate-100 mt-1">
                      {scen.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {scen.briefing}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Disruptions: {scen.disruptionsConfig.enabledTypes.length} · Seed{' '}
                      {scen.disruptionsConfig.seed}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditScenarioInStudio(scen.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium whitespace-nowrap"
                      >
                        <Edit3 className="w-3 h-3" />
                        Studio
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchScenario(scen.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold whitespace-nowrap"
                      >
                        <Play className="w-3 h-3" />
                        Launch 3D
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredScenarios.length === 0 && (
            <div className="p-10 rounded-xl bg-[#0D1424] border border-slate-800 text-center text-xs text-slate-400">
              No scenarios match your current filter criteria.
            </div>
          )}
        </div>

        {/* Right Scenario Protocol & Rubric Inspector */}
        {inspectedScenario && (
          <div className="lg:col-span-5 p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-5">
            <div className="space-y-1.5 pb-4 border-b border-slate-800">
              <div className="text-xs font-mono text-cyan-400">
                {inspectedScenario.code} · {inspectedScenario.difficulty}
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                {inspectedScenario.title}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {inspectedScenario.briefing}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Learning Objectives
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {inspectedScenario.learningObjectives.map((obj, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-200">
                Reference Expected Sequence ({inspectedScenario.expectedActions.length} Steps)
              </h3>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {inspectedScenario.expectedActions.map((step) => (
                  <div
                    key={step.stepId}
                    className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800/90 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium text-slate-200">
                        {step.order}. {step.label}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {step.educationalRule}
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] shrink-0">
                      <div className="text-slate-300">&le;{step.targetWindowSec}s</div>
                      {step.isCritical && (
                        <div className="text-red-400 font-semibold">CRITICAL</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center font-mono text-xs tabular-nums">
              <div className="p-2 rounded bg-[#070B14] border border-slate-800">
                <div className="text-[10px] font-sans text-slate-400">Procedural</div>
                <div className="text-slate-100 font-semibold">
                  {Math.round(inspectedScenario.assessmentWeights.proceduralAccuracy * 100)}%
                </div>
              </div>
              <div className="p-2 rounded bg-[#070B14] border border-slate-800">
                <div className="text-[10px] font-sans text-slate-400">Decision</div>
                <div className="text-slate-100 font-semibold">
                  {Math.round(inspectedScenario.assessmentWeights.decisionAccuracy * 100)}%
                </div>
              </div>
              <div className="p-2 rounded bg-[#070B14] border border-slate-800">
                <div className="text-[10px] font-sans text-slate-400">Speed</div>
                <div className="text-slate-100 font-semibold">
                  {Math.round(inspectedScenario.assessmentWeights.responseTime * 100)}%
                </div>
              </div>
              <div className="p-2 rounded bg-[#070B14] border border-slate-800">
                <div className="text-[10px] font-sans text-slate-400">Sequence</div>
                <div className="text-slate-100 font-semibold">
                  {Math.round(inspectedScenario.assessmentWeights.sequenceAccuracy * 100)}%
                </div>
              </div>
            </div>

            <div className="text-[11px] text-amber-200/85 bg-amber-950/20 border border-amber-800/40 rounded-lg p-3">
              {inspectedScenario.educationalRuleNote}
            </div>

            <button
              type="button"
              onClick={() => onLaunchScenario(inspectedScenario.id)}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Launch Scenario in 3D Simulation Centre
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

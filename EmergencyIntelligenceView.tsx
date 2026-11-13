import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Play,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { generateDisruptionSchedule } from '../engine/worldDisruptionEngine';
import {
  DisruptionType,
  ScenarioDefinition,
  TrainingSession,
} from '../types/simulation';

interface EmergencyIntelligenceViewProps {
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  onLaunchScenario: (scenarioId: string) => void;
}

const API_ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/sessions',
    purpose: 'Initialize or upsert a WebGL or Unity OpenXR VR training session.',
  },
  {
    method: 'GET',
    path: '/api/sessions/{sessionId}',
    purpose: 'Retrieve full session record, recorded events, and patient states.',
  },
  {
    method: 'POST',
    path: '/api/sessions/{sessionId}/events',
    purpose: 'Stream timestamped controller/hand-tracked equipment actions from VR.',
  },
  {
    method: 'POST',
    path: '/api/sessions/{sessionId}/patient-state',
    purpose: 'Record simulated physiological telemetry snapshot at elapsed timestamp.',
  },
  {
    method: 'POST',
    path: '/api/sessions/{sessionId}/complete',
    purpose: 'Complete session and trigger weighted server-side assessment calculation.',
  },
  {
    method: 'GET',
    path: '/api/sessions/{sessionId}/assessment',
    purpose: 'Fetch weighted score calculation formula and isolated critical errors.',
  },
  {
    method: 'GET',
    path: '/api/scenarios',
    purpose: 'List active scenario definitions, seeds, and resource configurations.',
  },
  {
    method: 'GET',
    path: '/api/scenarios/{scenarioId}',
    purpose: 'Fetch single scenario blueprint for Unity scene instantiation.',
  },
  {
    method: 'POST',
    path: '/api/scenarios',
    purpose: 'Create or update educator-configured scenario blueprint.',
  },
  {
    method: 'GET',
    path: '/api/trainees/{traineeId}/analytics',
    purpose: 'Retrieve aggregated trainee readiness, response latency, and error totals.',
  },
  {
    method: 'POST',
    path: '/api/sessions/{sessionId}/debrief',
    purpose: 'Generate Gemini 3.8 Flash evidence debrief (or rule-based fallback).',
  },
];

export const EmergencyIntelligenceView: React.FC<EmergencyIntelligenceViewProps> = ({
  scenarios,
  sessions,
  onLaunchScenario,
}) => {
  const [testSeed, setTestSeed] = useState<number>(4092);
  const [testIntensity, setTestIntensity] = useState<
    'Controlled' | 'Moderate' | 'Severe'
  >('Moderate');
  const [selectedDisruptions, setSelectedDisruptions] = useState<DisruptionType[]>([
    'equipment_unavailable',
    'patient_deterioration',
    'blocked_exit',
    'resource_shortage',
  ]);
  const [apiProbeResult, setApiProbeResult] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  const previewSchedule = useMemo(
    () =>
      generateDisruptionSchedule(
        {
          seed: testSeed,
          enabledTypes: selectedDisruptions,
          intensity: testIntensity,
        },
        360
      ),
    [testSeed, selectedDisruptions, testIntensity]
  );

  const disruptionImpactStats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed' && s.assessment);
    const withDisr = completed.filter(
      (s) => s.disruptions.filter((d) => d.triggered).length > 0
    );
    const avgScoreDisr =
      withDisr.length > 0
        ? Math.round(
            withDisr.reduce((a, s) => a + (s.assessment?.overallScore || 0), 0) /
              withDisr.length
          )
        : 0;
    const avgLatencyDisr =
      withDisr.length > 0
        ? Number(
            (
              withDisr.reduce(
                (a, s) => a + (s.assessment?.avgResponseTimeSec || 0),
                0
              ) / withDisr.length
            ).toFixed(1)
          )
        : 0;

    return {
      disruptedSessionsCount: withDisr.length,
      avgScoreDisr,
      avgLatencyDisr,
    };
  }, [sessions]);

  const toggleDisr = (t: DisruptionType) => {
    setSelectedDisruptions((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleProbeRestApi = async () => {
    setProbing(true);
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      setApiProbeResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setApiProbeResult(
        JSON.stringify(
          {
            status: 'browser_persistence_mode',
            detail: err instanceof Error ? err.message : 'Offline fallback active',
          },
          null,
          2
        )
      );
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-8">
      <div className="pb-5 border-b border-slate-800/90">
        <div className="text-xs font-medium text-cyan-400">
          Dynamic World Disruption Engine &amp; OpenXR Telemetry Bridge
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-0.5">
          Emergency Intelligence &amp; VR API Architecture
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Inspect deterministic Mulberry32 disruption schedules for reproducible stressor research, review resilience metrics, and test the live REST API contract prepared for Unity C# and OpenXR headsets.
        </p>
      </div>

      {/* Disruption Resilience Metrics + Deterministic Seed Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Deterministic Disruption Seed Simulator
            </h2>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Seed:</label>
              <input
                type="number"
                value={testSeed}
                onChange={(e) => setTestSeed(Number(e.target.value) || 1001)}
                className="w-24 px-2.5 py-1 rounded bg-[#070B14] border border-slate-700 text-xs font-mono text-cyan-300"
              />
              <select
                value={testIntensity}
                onChange={(e) =>
                  setTestIntensity(
                    e.target.value as 'Controlled' | 'Moderate' | 'Severe'
                  )
                }
                aria-label="Disruption Intensity"
                className="px-2.5 py-1 rounded bg-[#070B14] border border-slate-700 text-xs text-slate-200"
              >
                <option value="Controlled">Controlled</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                'equipment_unavailable',
                'blocked_exit',
                'additional_casualty',
                'resource_shortage',
                'patient_deterioration',
                'lighting_fluctuation',
                'time_pressure',
              ] as DisruptionType[]
            ).map((t) => {
              const active = selectedDisruptions.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleDisr(t)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    active
                      ? 'bg-amber-500/25 border border-amber-500/70 text-amber-200'
                      : 'bg-[#070B14] border border-slate-800 text-slate-400'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-medium text-slate-300">
              Reproducible Event Sequence for Seed <span className="font-mono text-cyan-300">{testSeed}</span>:
            </div>
            {previewSchedule.map((d) => (
              <div
                key={d.id}
                className="p-3 rounded-lg bg-[#070B14] border border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-100">{d.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {d.description}
                  </div>
                </div>
                <span className="font-mono text-amber-300 shrink-0">
                  @{d.triggerAtSec}s
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* High-Acuity Scenario Quick Launch & Resilience Summary */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-[#0D1424] border border-slate-800 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Operational Stressor Telemetry
            </h2>

            <div className="grid grid-cols-3 gap-2.5 text-center font-mono tabular-nums">
              <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                <div className="text-[10px] font-sans text-slate-400">
                  Disrupted Runs
                </div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">
                  {disruptionImpactStats.disruptedSessionsCount}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                <div className="text-[10px] font-sans text-slate-400">
                  Mean Score
                </div>
                <div className="text-lg font-bold text-cyan-300 mt-0.5">
                  {disruptionImpactStats.avgScoreDisr}/100
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                <div className="text-[10px] font-sans text-slate-400">
                  Mean Latency
                </div>
                <div className="text-lg font-bold text-amber-300 mt-0.5">
                  {disruptionImpactStats.avgLatencyDisr}s
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-300">
                Launch High-Disruption Stress Scenarios:
              </div>
              {scenarios.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">
                      {s.code} · {s.title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Seed {s.disruptionsConfig.seed} ·{' '}
                      {s.disruptionsConfig.enabledTypes.length} Disruption(s)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLaunchScenario(s.id)}
                    className="px-2.5 py-1.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-cyan-200 font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <Play className="w-3 h-3" />
                    Test
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Documented Unity / C# / OpenXR REST API Contract & Live Endpoint Tester */}
      <section className="p-6 rounded-xl bg-[#0D1424] border border-slate-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Unity / C# / OpenXR REST API Integration Specification
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              All 11 endpoints below are active on this Express server so an external Unity OpenXR headset build can stream action events and retrieve assessments using identical JSON schemas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleProbeRestApi}
            disabled={probing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            Verify Live REST Bridge
          </button>
        </div>

        {apiProbeResult && (
          <div className="p-3.5 rounded-lg bg-[#070B14] border border-emerald-500/50 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Live Express REST API Response (`GET /api/health`)
            </div>
            <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
              {apiProbeResult}
            </pre>
          </div>
        )}

        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#070B14] text-[11px] font-medium text-slate-400">
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4">Endpoint Path</th>
                <th className="py-2.5 px-4">OpenXR / Web Integration Responsibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {API_ENDPOINTS.map((ep) => (
                <tr key={`${ep.method}_${ep.path}`} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 font-mono font-semibold text-cyan-300">
                    {ep.method}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-200">
                    {ep.path}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">{ep.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

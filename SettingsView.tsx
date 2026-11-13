import React, { useState } from 'react';
import {
  Check,
  Database,
  Download,
  RotateCcw,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  PlatformSettings,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

interface SettingsViewProps {
  settings: PlatformSettings;
  currentUser: UserAccount;
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  onUpdateSettings: (next: PlatformSettings) => void;
  onResetDemoData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  currentUser,
  users,
  scenarios,
  sessions,
  onUpdateSettings,
  onResetDemoData,
}) => {
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const userSessionsCount = sessions.filter((s) => !s.isDemo).length;
  const demoSessionsCount = sessions.filter((s) => s.isDemo).length;
  const userScenariosCount = scenarios.filter((s) => !s.isDemo).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draft);
    setStatusMsg('Saved platform configuration to browser persistence.');
  };

  const handleExportSnapshotJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'Immersive Response Intelligence',
      settings: draft,
      users,
      scenarios,
      sessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iri_platform_backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
      <div className="pb-5 border-b border-slate-800/90">
        <div className="text-xs font-medium text-cyan-400">
          System Governance · Operator: {currentUser.name} ({currentUser.role})
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-0.5">
          Platform Settings &amp; Data Repository
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure simulation audio, accessibility preferences, default rubric weights, and persistent record separation between DEMO DATA and user-created sessions.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-cyan-400" />
            Simulation &amp; Telemetry Preferences
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Institution / Training Facility Label
              </label>
              <input
                type="text"
                value={draft.institutionName}
                onChange={(e) =>
                  setDraft({ ...draft, institutionName: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                OpenXR / REST Bridge Base Path
              </label>
              <input
                type="text"
                value={draft.vrBridgeEndpointUrl}
                onChange={(e) =>
                  setDraft({ ...draft, vrBridgeEndpointUrl: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="p-3 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between text-xs cursor-pointer">
              <span className="text-slate-200">Procedural Audio Cues</span>
              <input
                type="checkbox"
                checked={draft.audioFeedbackEnabled}
                onChange={(e) =>
                  setDraft({ ...draft, audioFeedbackEnabled: e.target.checked })
                }
                className="accent-cyan-400"
              />
            </label>

            <label className="p-3 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between text-xs cursor-pointer">
              <span className="text-slate-200">Show DEMO DATA in Overview</span>
              <input
                type="checkbox"
                checked={draft.showDemoDataInAnalytics}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    showDemoDataInAnalytics: e.target.checked,
                  })
                }
                className="accent-cyan-400"
              />
            </label>

            <label className="p-3 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between text-xs cursor-pointer">
              <span className="text-slate-200">Reduced 3D Camera Motion</span>
              <input
                type="checkbox"
                checked={draft.reducedMotion}
                onChange={(e) =>
                  setDraft({ ...draft, reducedMotion: e.target.checked })
                }
                className="accent-cyan-400"
              />
            </label>
          </div>

          {/* Immersive 3D Audio Mixer Defaults */}
          <div className="p-4 rounded-lg bg-[#070B14] border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                3D Spatial Soundscape &amp; Equipment Mixer
              </span>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <span>Subtle Tension Pulse</span>
                <input
                  type="checkbox"
                  checked={Boolean(draft.musicEnabled)}
                  onChange={(e) =>
                    setDraft({ ...draft, musicEnabled: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Master Volume</span>
                  <span className="font-mono text-cyan-300">
                    {Math.round((draft.masterVolume ?? 0.78) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((draft.masterVolume ?? 0.78) * 100)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      masterVolume: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Hospital / Surge Ambience</span>
                  <span className="font-mono text-cyan-300">
                    {Math.round((draft.ambienceVolume ?? 0.68) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((draft.ambienceVolume ?? 0.68) * 100)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ambienceVolume: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Clinical Equipment SFX</span>
                  <span className="font-mono text-cyan-300">
                    {Math.round((draft.sfxVolume ?? 0.85) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((draft.sfxVolume ?? 0.85) * 100)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sfxVolume: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors"
            >
              Save Platform Preferences
            </button>
          </div>
        </div>
      </form>

      {/* Data Persistence & Separation Summary */}
      <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Persistent Repository Status (LocalStorage + Express API Sync)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs tabular-nums">
          <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800">
            <div className="text-slate-400 font-sans text-[11px]">
              User-Created Sessions
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {userSessionsCount}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800">
            <div className="text-slate-400 font-sans text-[11px]">
              DEMO DATA Sessions
            </div>
            <div className="text-lg font-bold text-amber-300 mt-0.5">
              {demoSessionsCount}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#070B14] border border-slate-800">
            <div className="text-slate-400 font-sans text-[11px]">
              Custom Studio Scenarios
            </div>
            <div className="text-lg font-bold text-cyan-300 mt-0.5">
              {userScenariosCount}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleExportSnapshotJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#070B14] hover:bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export MongoDB-Ready JSON Backup
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Factory DEMO DATA (Keep User Records)
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-300">
                Restore sample DEMO records while keeping your sessions?
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetDemoData();
                  setConfirmReset(false);
                  setStatusMsg(
                    'Factory DEMO DATA restored. All user-created sessions and scenarios preserved.'
                  );
                }}
                className="px-3 py-1.5 rounded bg-amber-500 text-slate-950 text-xs font-semibold"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3D Humanoid & Medical Asset Attribution */}
      <div className="p-4 rounded-xl bg-[#0D1424] border border-slate-800 space-y-1.5 text-xs text-slate-400">
        <div className="font-semibold text-slate-200">
          3D Rigged Humanoid &amp; Clinical Asset Attribution
        </div>
        <p>
          Full-body rigged humanoid skeletal models and motion-capture animation clips (`responder_male_humanoid.glb`, `medic_female_humanoid.glb`, `clinician_humanoid.glb`, `operator_humanoid.glb`, `michelle_humanoid.glb`, and `/models/anims/*.glb`) are open-source distributions from `met4citizen/TalkingHead` (MIT), Avaturn / AvatarSDK sample rigs, Ready Player Me (CC BY 4.0), and Three.js (`mrdoob/three.js`, MIT), documented in <code className="text-cyan-300 font-mono">/models/ATTRIBUTION.md</code>. Multi-part clinical resuscitation equipment, garment PBR textures, spatial 3D soundscapes, and hospital environments are custom Three.js &amp; Web Audio assemblies.
        </p>
      </div>
    </div>
  );
};

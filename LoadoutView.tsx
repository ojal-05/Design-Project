import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Eye,
  Package,
  Play,
  Shield,
  User,
  Zap,
} from 'lucide-react';
import {
  computePlayerProgression,
  EQUIPMENT_KIT_PRESETS,
  SKIN_TONE_SWATCHES,
  UNIFORM_PRESETS,
  VISOR_STYLE_PRESETS,
} from '../engine/progressionEngine';
import type {
  DrillAttemptRecord,
  NavSection,
  PlatformSettings,
  ResponderCustomization,
  ResponderEquipmentKitId,
  ResponderSpecialization,
  ResponderUniformId,
  ResponderVisorStyle,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';
import { ResponderAvatarCanvas } from './simulation3d/ResponderAvatarCanvas';

interface LoadoutViewProps {
  currentUser: UserAccount;
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  drills: DrillAttemptRecord[];
  settings: PlatformSettings;
  onUpdateUser: (updated: UserAccount) => void;
  onLaunchScenario: (scenarioId: string) => void;
  onNavigate: (section: NavSection) => void;
}

const GLOVE_SWATCHES = [
  { label: 'Nitrile Cyan', hex: '#0ea5e9' },
  { label: 'Surgical Ice', hex: '#38bdf8' },
  { label: 'Trauma Cobalt', hex: '#2563eb' },
  { label: 'Sterile Platinum', hex: '#cbd5e1' },
];

const SPECIALIZATIONS: ResponderSpecialization[] = [
  'Resuscitation Specialist',
  'Field Trauma & Triage',
  'Acute Flight Medic',
];

export const LoadoutView: React.FC<LoadoutViewProps> = ({
  currentUser,
  scenarios,
  sessions,
  drills,
  settings,
  onUpdateUser,
  onLaunchScenario,
  onNavigate,
}) => {
  const progression = useMemo(
    () => computePlayerProgression(currentUser, sessions, scenarios, drills),
    [currentUser, sessions, scenarios, drills]
  );

  const profile = progression.responderProfile;
  const [cameraZoom, setCameraZoom] = useState<'full' | 'upper'>('full');
  const [activeTab, setActiveTab] = useState<'uniform' | 'appearance' | 'kit'>(
    'uniform'
  );
  const [callsignDraft, setCallsignDraft] = useState(profile.callsign);
  const [savedToast, setSavedToast] = useState(false);

  const updateProfile = (patch: Partial<ResponderCustomization>) => {
    onUpdateUser({
      ...currentUser,
      responderProfile: {
        ...profile,
        ...patch,
      },
    });
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1400);
  };

  const unlockedBadges = progression.achievements.filter((a) => a.unlocked);

  return (
    <div className="p-5 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-cyan-400 font-medium">
            Responder Ready Room · Level {progression.level}{' '}
            {progression.rankTitle}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Character &amp; Field Loadout
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {savedToast && (
            <span className="text-xs text-emerald-400 font-medium inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Loadout Synced
            </span>
          )}
          <button
            type="button"
            onClick={() =>
              onLaunchScenario(scenarios[0]?.id || 'scen_cardiac_01')
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Deploy With Loadout
          </button>
        </div>
      </div>

      {/* Main Split: 3D Responder Showcase (7 cols) · Visual Swatch Selectors (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT: Large 3D Character Viewport */}
        <div className="lg:col-span-7 rounded-xl bg-[#0B1220] border border-slate-800 flex flex-col overflow-hidden min-h-[500px]">
          <div className="px-5 py-3.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-100">
                {currentUser.name}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-xs text-cyan-300">
                {profile.callsign}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">
                {profile.specialization}
              </span>
            </div>

            {/* Camera Zoom Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070B14] border border-slate-800">
              <button
                type="button"
                onClick={() => setCameraZoom('full')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  cameraZoom === 'full'
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Full Body
              </button>
              <button
                type="button"
                onClick={() => setCameraZoom('upper')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  cameraZoom === 'upper'
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upper Gear
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-[390px]">
            <ResponderAvatarCanvas
              profile={profile}
              level={progression.level}
              reducedMotion={settings.reducedMotion}
              cameraZoom={cameraZoom}
            />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 pointer-events-none">
              <span>Drag 360° · Scroll to Zoom</span>
              <span>Full-Body Rigged Responder</span>
            </div>
          </div>

          {/* Bottom Stats & Active Skills Strip */}
          <div className="p-4 border-t border-slate-800 bg-[#080E1A] grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums text-xs">
            <div>
              <div className="text-[10px] font-sans text-slate-400">Level</div>
              <div className="font-bold text-cyan-300">
                LVL {progression.level} ({progression.totalXp} XP)
              </div>
            </div>
            <div>
              <div className="text-[10px] font-sans text-slate-400">
                Skill Nodes
              </div>
              <button
                type="button"
                onClick={() => onNavigate('skill-tree')}
                className="font-bold text-slate-100 hover:text-cyan-300 transition-colors"
              >
                {progression.skillTree.filter((n) => n.unlocked).length}/
                {progression.skillTree.length} Active →
              </button>
            </div>
            <div>
              <div className="text-[10px] font-sans text-slate-400">
                Commendations
              </div>
              <button
                type="button"
                onClick={() => onNavigate('achievements')}
                className="font-bold text-amber-300 hover:text-amber-200 transition-colors"
              >
                {unlockedBadges.length}/{progression.achievements.length} Earned →
              </button>
            </div>
            <div>
              <div className="text-[10px] font-sans text-slate-400">
                Equipped Kit
              </div>
              <div className="font-bold text-emerald-400 truncate font-sans">
                {EQUIPMENT_KIT_PRESETS[profile.primaryKit || 'aed_rapid'].name}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Interactive Customization Deck */}
        <div className="lg:col-span-5 rounded-xl bg-[#0B1220] border border-slate-800 p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            {/* Category Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#070B14] border border-slate-800">
              {(
                [
                  { id: 'uniform', label: 'Uniform & Gloves', icon: Shield },
                  { id: 'appearance', label: 'Appearance', icon: User },
                  { id: 'kit', label: 'Equipment Kit', icon: Package },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === 'appearance') setCameraZoom('upper');
                      if (tab.id === 'kit') setCameraZoom('full');
                    }}
                    className={`py-2 px-2.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: UNIFORM & GLOVES */}
            {activeTab === 'uniform' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Duty Uniform
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(Object.keys(UNIFORM_PRESETS) as ResponderUniformId[]).map(
                      (uid) => {
                        const u = UNIFORM_PRESETS[uid];
                        const active = profile.uniformId === uid;
                        return (
                          <button
                            key={uid}
                            type="button"
                            onClick={() => updateProfile({ uniformId: uid })}
                            className={`p-3.5 rounded-xl border text-left transition-colors space-y-2 ${
                              active
                                ? 'bg-[#082f49]/50 border-cyan-400'
                                : 'bg-[#070B14] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-4 h-4 rounded-sm border border-white/20"
                                  style={{ backgroundColor: u.primaryColor }}
                                />
                                <span
                                  className="w-2.5 h-4 rounded-sm"
                                  style={{ backgroundColor: u.trimColor }}
                                />
                              </div>
                              {active && (
                                <Check className="w-4 h-4 text-cyan-400" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-100">
                                {u.name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {u.shortTag}
                              </div>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Clinical Procedure Gloves
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateProfile({
                          wearGloves: profile.wearGloves === false,
                        })
                      }
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                        profile.wearGloves !== false
                          ? 'bg-[#082f49] border-cyan-400 text-cyan-200'
                          : 'bg-[#070B14] border-slate-700 text-slate-400'
                      }`}
                    >
                      {profile.wearGloves !== false ? 'Gloves On' : 'Bare Hands'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {GLOVE_SWATCHES.map((sw) => {
                      const active =
                        profile.wearGloves !== false &&
                        profile.gloveColor === sw.hex;
                      return (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() =>
                            updateProfile({
                              wearGloves: true,
                              gloveColor: sw.hex,
                            })
                          }
                          className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 transition-colors ${
                            active
                              ? 'bg-[#082f49]/50 border-cyan-400 text-white font-semibold'
                              : 'bg-[#070B14] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                            style={{ backgroundColor: sw.hex }}
                          />
                          <span className="truncate">{sw.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Protective Scenario PPE
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateProfile({ wearMask: !profile.wearMask })
                      }
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                        profile.wearMask
                          ? 'bg-[#082f49]/50 border-cyan-400 text-white font-semibold'
                          : 'bg-[#070B14] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>Surgical Mask</span>
                      {profile.wearMask && (
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentlyWearing =
                          profile.wearVest !== undefined
                            ? profile.wearVest
                            : profile.uniformId === 'hazmat_amber';
                        updateProfile({ wearVest: !currentlyWearing });
                      }}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                        (
                          profile.wearVest !== undefined
                            ? profile.wearVest
                            : profile.uniformId === 'hazmat_amber'
                        )
                          ? 'bg-[#082f49]/50 border-cyan-400 text-white font-semibold'
                          : 'bg-[#070B14] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>Reflective Vest</span>
                      {(profile.wearVest !== undefined
                        ? profile.wearVest
                        : profile.uniformId === 'hazmat_amber') && (
                        <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Responder Specialization
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {SPECIALIZATIONS.map((sp) => {
                      const active = profile.specialization === sp;
                      return (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => updateProfile({ specialization: sp })}
                          className={`px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                            active
                              ? 'bg-[#082f49]/50 border-cyan-400 text-white font-semibold'
                              : 'bg-[#070B14] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span>{sp}</span>
                          {active && <Zap className="w-3.5 h-3.5 text-cyan-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Full-Body Responder Avatar
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'male', label: 'Responder A (Male)' },
                        { id: 'female', label: 'Responder B (Female)' },
                      ] as const
                    ).map((opt) => {
                      const active = (profile.bodyModel || 'male') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateProfile({ bodyModel: opt.id })}
                          className={`p-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-[#082f49]/55 border-cyan-400 text-white'
                              : 'bg-[#070B14] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="loadout-callsign"
                    className="block text-xs font-semibold text-slate-200"
                  >
                    Tactical Callsign
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="loadout-callsign"
                      type="text"
                      maxLength={10}
                      value={callsignDraft}
                      onChange={(e) =>
                        setCallsignDraft(e.target.value.toUpperCase())
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateProfile({
                          callsign: callsignDraft.trim() || 'MED-01',
                        })
                      }
                      className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold whitespace-nowrap"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Skin Tone
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SKIN_TONE_SWATCHES.map((st) => {
                      const active =
                        (profile.skinTone || '#e2b093') === st.hex;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateProfile({ skinTone: st.hex })}
                          className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 transition-colors ${
                            active
                              ? 'bg-[#082f49]/50 border-cyan-400 text-white font-semibold'
                              : 'bg-[#070B14] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-white/25 shrink-0"
                            style={{ backgroundColor: st.hex }}
                          />
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Eye Protection &amp; Headgear
                  </div>
                  <div className="space-y-2">
                    {VISOR_STYLE_PRESETS.map((vs) => {
                      const active =
                        (profile.visorStyle || 'safety_glasses') === vs.id;
                      return (
                        <button
                          key={vs.id}
                          type="button"
                          onClick={() =>
                            updateProfile({
                              visorStyle: vs.id as ResponderVisorStyle,
                            })
                          }
                          className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors ${
                            active
                              ? 'bg-[#082f49]/50 border-cyan-400'
                              : 'bg-[#070B14] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-100">
                              {vs.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {vs.subtitle}
                            </div>
                          </div>
                          <Eye
                            className={`w-4 h-4 ${
                              active ? 'text-cyan-400' : 'text-slate-600'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: FIELD EQUIPMENT KIT */}
            {activeTab === 'kit' && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-200">
                  Primary Jump Bag &amp; Belt Kit
                </div>
                {(
                  Object.keys(
                    EQUIPMENT_KIT_PRESETS
                  ) as ResponderEquipmentKitId[]
                ).map((kid) => {
                  const k = EQUIPMENT_KIT_PRESETS[kid];
                  const active = (profile.primaryKit || 'aed_rapid') === kid;
                  return (
                    <button
                      key={kid}
                      type="button"
                      onClick={() => updateProfile({ primaryKit: kid })}
                      className={`w-full p-4 rounded-xl border text-left flex items-start justify-between gap-3 transition-colors ${
                        active
                          ? 'bg-[#082f49]/50 border-cyan-400'
                          : 'bg-[#070B14] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="w-4 h-4 rounded-sm mt-0.5 shrink-0 border border-white/25"
                          style={{ backgroundColor: k.bagColor }}
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-100">
                            {k.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {k.shortBenefit}
                          </div>
                        </div>
                      </div>
                      {active && (
                        <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unlocked Badges Showcase Mini Strip */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold">
                Earned Service Badges
              </span>
              <span className="font-mono text-slate-400">
                {unlockedBadges.length}/{progression.achievements.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {progression.achievements.slice(0, 6).map((ach) => (
                <div
                  key={ach.id}
                  title={`${ach.title} — ${ach.description}`}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                    ach.unlocked
                      ? 'bg-[#070B14] border-cyan-500/50 text-cyan-200'
                      : 'bg-[#070B14]/50 border-slate-800 text-slate-500'
                  }`}
                >
                  <Award
                    className={`w-3.5 h-3.5 ${
                      ach.unlocked ? 'text-cyan-400' : 'text-slate-600'
                    }`}
                  />
                  <span className="truncate max-w-[120px]">{ach.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

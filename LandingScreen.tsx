import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  Crosshair,
  Flame,
  MapPin,
  Play,
  Shield,
  UserPlus,
} from 'lucide-react';
import {
  getDefaultResponderProfile,
  UNIFORM_PRESETS,
} from '../engine/progressionEngine';
import type {
  ResponderUniformId,
  UserAccount,
  UserRole,
} from '../types/simulation';
import { VISUAL_ASSETS } from '../utils/scenarioVisuals';
import { ResponderAvatarCanvas } from './simulation3d/ResponderAvatarCanvas';

interface LandingScreenProps {
  users: UserAccount[];
  onEnterWithUser: (user: UserAccount) => void;
  onCreateTraineeAndEnter: (name: string, cohort: string) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  users,
  onEnterWithUser,
  onCreateTraineeAndEnter,
}) => {
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<
    UserRole | 'all'
  >('all');
  const [previewUniform, setPreviewUniform] =
    useState<ResponderUniformId>('trauma_navy');
  const [newTraineeName, setNewTraineeName] = useState('');
  const [newTraineeCohort, setNewTraineeCohort] = useState(
    'PGY-1 Emergency Medicine'
  );

  const defaultDemoTrainee =
    users.find((u) => u.role === 'trainee') || users[0];
  const defaultInstructor =
    users.find((u) => u.role === 'instructor') || users[0];

  const filteredUsers =
    selectedRoleFilter === 'all'
      ? users
      : users.filter((u) => u.role === selectedRoleFilter);

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTraineeName.trim()) return;
    onCreateTraineeAndEnter(
      newTraineeName.trim(),
      newTraineeCohort.trim() || 'Emergency Response Cohort'
    );
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 border-b border-slate-800/90 bg-[#070B14]">
        <a
          href="#top"
          className="text-base sm:text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Immersive Response Intelligence
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          <a
            href="#features"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            Gameplay
          </a>
          <a
            href="#features"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            Missions
          </a>
          <a
            href="#access"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            Operators
          </a>
          <a
            href="#access"
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            Command Console
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() =>
              defaultDemoTrainee && onEnterWithUser(defaultDemoTrainee)
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Play Now
          </button>
        </div>
      </header>

      <main
        id="top"
        className="flex-1 max-w-[1380px] w-full mx-auto px-6 lg:px-12 py-10 lg:py-14 space-y-12"
      >
        {/* GAME TITLE HERO: Concise Action Copy + Live Interactive 3D Responder Showcase */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-mono text-cyan-400">
                3D EMERGENCY SIMULATION GAME · WEBGL &amp; OPENXR READY
              </div>

              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]"
                style={{ textWrap: 'balance' } as React.CSSProperties}
              >
                Train Under Pressure. Understand Every Decision.
              </h1>

              <p className="text-sm sm:text-base text-slate-300 max-w-lg">
                1st-person 3D trauma bay &amp; mass-casualty ward · Real-time patient telemetry · Skill trees, XP &amp; verified debriefs.
              </p>

              {/* Visual Game Stat Strip */}
              <div className="grid grid-cols-3 gap-3 pt-2 font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-[#0B1220] border border-slate-800">
                  <div className="text-lg font-bold text-cyan-300">4 Sectors</div>
                  <div className="text-[11px] font-sans text-slate-400">
                    3D Mission Map
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0B1220] border border-slate-800">
                  <div className="text-lg font-bold text-emerald-400">5 Drills</div>
                  <div className="text-[11px] font-sans text-slate-400">
                    Skill Challenges
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0B1220] border border-slate-800">
                  <div className="text-lg font-bold text-amber-300">12 Nodes</div>
                  <div className="text-[11px] font-sans text-slate-400">
                    Responder Tree
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    defaultDemoTrainee && onEnterWithUser(defaultDemoTrainee)
                  }
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap shadow-lg"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Enter Responder Home Base
                </button>
                <button
                  type="button"
                  onClick={() =>
                    defaultInstructor && onEnterWithUser(defaultInstructor)
                  }
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#0B1220] hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  Instructor Console
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                Educational training prototype · Simulated physiology only · Not for clinical diagnosis or patient care.
              </div>
            </div>
          </div>

          {/* Right Live 3D Responder Showcase + Uniform Switcher */}
          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-800 bg-[#0B1220] min-h-[380px] flex flex-col justify-between">
            <img
              src={VISUAL_ASSETS.landingHero}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
            />
            <div className="relative h-[320px] sm:h-[340px] w-full">
              <ResponderAvatarCanvas
                profile={{
                  callsign: 'MED-01',
                  uniformId: previewUniform,
                  specialization: 'Resuscitation Specialist',
                  gloveColor: UNIFORM_PRESETS[previewUniform].defaultGloveColor,
                  skinTone: '#e2b093',
                  visorStyle: 'tinted_tactical',
                  primaryKit: 'aed_rapid',
                }}
                level={3}
                reducedMotion={false}
              />
            </div>

            <div className="relative px-4 py-3 bg-[#080E1A]/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-cyan-300">
                DRAG TO ROTATE 3D RESPONDER
              </span>
              <div className="flex items-center gap-1.5">
                {(Object.keys(UNIFORM_PRESETS) as ResponderUniformId[]).map(
                  (uid) => {
                    const u = UNIFORM_PRESETS[uid];
                    const active = previewUniform === uid;
                    return (
                      <button
                        key={uid}
                        type="button"
                        onClick={() => setPreviewUniform(uid)}
                        title={u.name}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-[#070B14] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: u.primaryColor }}
                        />
                        <span className="hidden sm:inline">
                          {u.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Compact 4-Tile Visual Game Loop Strip (Zero Long Paragraphs) */}
        <section
          id="features"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2"
        >
          <div className="p-4 rounded-xl bg-[#0B1220] border border-slate-800 flex items-start gap-3">
            <Crosshair className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-slate-100">
                1st-Person Bay Ops
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                WASD walk, sprint &amp; [E] interact
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#0B1220] border border-slate-800 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-slate-100">
                Sector Mission Map
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Unlock cardiac &amp; surge wards
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#0B1220] border border-slate-800 flex items-start gap-3">
            <Flame className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-slate-100">
                Reflex Skill Drills
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                3D spotter, ECG &amp; triage blitz
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#0B1220] border border-slate-800 flex items-start gap-3">
            <Award className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-slate-100">
                Honest Safety Ranks
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                XP never hides critical errors
              </div>
            </div>
          </div>
        </section>

        {/* SELECT OPERATOR / CREATE RESPONDER */}
        <section
          id="access"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-800/80"
        >
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                Select Operator Profile
              </h2>

              <div className="flex items-center gap-1 p-1 bg-[#0B1220] border border-slate-800 rounded-lg">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'trainee', label: 'Responders' },
                    { id: 'instructor', label: 'Instructor' },
                    { id: 'administrator', label: 'Admin' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedRoleFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                      selectedRoleFilter === tab.id
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredUsers.map((u) => {
                const prof = getDefaultResponderProfile(u);
                const swatch = UNIFORM_PRESETS[prof.uniformId]?.primaryColor;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onEnterWithUser(u)}
                    className="p-3.5 rounded-xl bg-[#0B1220] hover:bg-[#111b30] border border-slate-800 hover:border-cyan-400/70 text-left transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg border border-white/15 flex items-center justify-center font-mono text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: swatch || '#1e3a5f' }}
                      >
                        {prof.callsign.split('-')[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 truncate">
                          {u.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          <span className="capitalize text-cyan-300">
                            {u.role}
                          </span>
                          <span className="mx-1.5">·</span>
                          <span>{u.cohort}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* New Responder Quick Creator */}
          <div className="lg:col-span-4 p-5 rounded-xl bg-[#0B1220] border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <UserPlus className="w-4 h-4 text-cyan-400" />
              New Responder Character
            </div>

            <form onSubmit={handleQuickCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Responder Name
                </label>
                <input
                  type="text"
                  required
                  value={newTraineeName}
                  onChange={(e) => setNewTraineeName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Squad / Cohort
                </label>
                <input
                  type="text"
                  value={newTraineeCohort}
                  onChange={(e) => setNewTraineeCohort(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-bold transition-colors"
              >
                Create &amp; Enter Home Base
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="px-6 lg:px-12 py-4 border-t border-slate-800/80 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <span>Immersive Response Intelligence</span>
        <span>Educational Simulation Prototype · Simulated Data Only</span>
      </footer>
    </div>
  );
};

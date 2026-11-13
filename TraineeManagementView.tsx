import React, { useMemo, useState } from 'react';
import {
  Check,
  MessageSquarePlus,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  InstructorNote,
  NavSection,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
  UserRole,
} from '../types/simulation';

interface TraineeManagementViewProps {
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  notes: InstructorNote[];
  currentUser: UserAccount;
  onAddUser: (user: UserAccount) => void;
  onUpdateUser: (user: UserAccount) => void;
  onAddNote: (note: InstructorNote) => void;
  onNavigate: (section: NavSection, sessionId?: string) => void;
}

export const TraineeManagementView: React.FC<TraineeManagementViewProps> = ({
  users,
  scenarios,
  sessions,
  notes,
  currentUser,
  onAddUser,
  onUpdateUser,
  onAddNote,
  onNavigate,
}) => {
  const [roleFilter, setRoleFilter] = useState<'trainee' | 'all'>('trainee');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    users.find((u) => u.role === 'trainee')?.id || users[0]?.id || ''
  );

  // New user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('trainee');
  const [newCohort, setNewCohort] = useState('PGY-1 Emergency Medicine');
  const [noteInput, setNoteInput] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const visibleUsers = useMemo(
    () =>
      roleFilter === 'all' ? users : users.filter((u) => u.role === 'trainee'),
    [users, roleFilter]
  );

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || visibleUsers[0] || null,
    [users, selectedUserId, visibleUsers]
  );

  const selectedUserSessions = useMemo(
    () =>
      selectedUser
        ? sessions.filter(
            (s) => s.traineeId === selectedUser.id && s.status === 'completed'
          )
        : [],
    [sessions, selectedUser]
  );

  const selectedUserNotes = useMemo(
    () =>
      selectedUser ? notes.filter((n) => n.traineeId === selectedUser.id) : [],
    [notes, selectedUser]
  );

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created: UserAccount = {
      id: `usr_custom_${Date.now()}`,
      name: newName.trim(),
      email:
        newEmail.trim() ||
        `${newName.trim().toLowerCase().replace(/\s+/g, '.')}@iri-training.edu`,
      role: newRole,
      cohort: newCohort.trim() || 'Emergency Simulation Cohort',
      department: 'Acute Simulation Centre',
      assignedScenarioIds:
        newRole === 'trainee' ? ['scen_cardiac_01', 'scen_triage_01'] : [],
      active: true,
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
    onAddUser(created);
    setSelectedUserId(created.id);
    setNewName('');
    setNewEmail('');
    setFeedbackBanner(`Added ${created.role} profile "${created.name}".`);
  };

  const toggleAssignedScenario = (scenId: string) => {
    if (!selectedUser) return;
    const has = selectedUser.assignedScenarioIds.includes(scenId);
    const nextIds = has
      ? selectedUser.assignedScenarioIds.filter((x) => x !== scenId)
      : [...selectedUser.assignedScenarioIds, scenId];
    onUpdateUser({
      ...selectedUser,
      assignedScenarioIds: nextIds,
    });
  };

  const handleAddCoachingNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !noteInput.trim()) return;
    const note: InstructorNote = {
      id: `note_${Date.now()}`,
      traineeId: selectedUser.id,
      authorName: currentUser.name,
      createdAt: new Date().toISOString(),
      content: noteInput.trim(),
    };
    onAddNote(note);
    setNoteInput('');
    setFeedbackBanner(`Recorded faculty note for ${selectedUser.name}.`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1380px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-800/90">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Trainee &amp; Operator Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage trainee cohorts, assign simulation modules, review individual attempt history, and log persistent instructor coaching notes.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D1424] border border-slate-800">
          <button
            type="button"
            onClick={() => setRoleFilter('trainee')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              roleFilter === 'trainee'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Trainees Only
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              roleFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            All Platform Users ({users.length})
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Directory + Add User Form */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Directory ({visibleUsers.length})
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {visibleUsers.map((u) => {
                const userSessions = sessions.filter(
                  (s) => s.traineeId === u.id && s.status === 'completed'
                );
                const avg =
                  userSessions.length > 0
                    ? Math.round(
                        userSessions.reduce(
                          (a, s) => a + (s.assessment?.overallScore || 0),
                          0
                        ) / userSessions.length
                      )
                    : null;

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 ${
                      selectedUser?.id === u.id
                        ? 'bg-cyan-950/45 border-cyan-400'
                        : 'bg-[#070B14] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {u.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        <span className="capitalize">{u.role}</span> · {u.cohort}
                        {u.isDemo && ' · DEMO'}
                      </div>
                    </div>
                    {u.role === 'trainee' && (
                      <div className="text-right font-mono text-xs shrink-0">
                        <div className="text-cyan-300 font-semibold">
                          {avg !== null ? `${avg}/100` : 'No Runs'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {userSessions.length} sess
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Trainee / User Form */}
          <form
            onSubmit={handleCreateUser}
            className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-3"
          >
            <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              Register New User Account
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Dr. Hannah Park"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Platform Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                >
                  <option value="trainee">Trainee</option>
                  <option value="instructor">Instructor</option>
                  <option value="administrator">Administrator</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="h.park@iri-training.edu"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Cohort / Unit
                </label>
                <input
                  type="text"
                  value={newCohort}
                  onChange={(e) => setNewCohort(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors"
            >
              Save User Profile
            </button>
          </form>
        </div>

        {/* Right Selected Profile Inspector */}
        {selectedUser && (
          <div className="lg:col-span-7 space-y-5">
            <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-cyan-400">
                    <span className="capitalize">{selectedUser.role}</span> ·{' '}
                    {selectedUser.email}
                    {selectedUser.isDemo ? ' · DEMO DATA' : ' · USER RECORD'}
                  </div>
                  <h2 className="text-lg font-bold text-slate-100 mt-0.5">
                    {selectedUser.name}
                  </h2>
                  <div className="text-xs text-slate-400">
                    {selectedUser.cohort} · {selectedUser.department}
                  </div>
                </div>
              </div>

              {selectedUser.role === 'trainee' && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Assigned Simulation Scenarios ({selectedUser.assignedScenarioIds.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {scenarios
                      .filter((s) => !s.archived)
                      .map((scen) => {
                        const assigned = selectedUser.assignedScenarioIds.includes(
                          scen.id
                        );
                        return (
                          <label
                            key={scen.id}
                            className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer"
                          >
                            <span className="text-slate-200 truncate">
                              {scen.code} · {scen.title}
                            </span>
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={() => toggleAssignedScenario(scen.id)}
                              className="accent-cyan-400 shrink-0"
                            />
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Completed Sessions History */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-200">
                  Completed Training Attempts ({selectedUserSessions.length})
                </div>
                {selectedUserSessions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No completed attempts recorded for this user yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedUserSessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="p-2.5 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-medium text-slate-100">
                            {sess.scenarioCode} · Attempt #{sess.attemptNumber}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Duration {sess.durationSec}s · Critical Errors:{' '}
                            <span
                              className={
                                (sess.assessment?.criticalErrorsCount || 0) > 0
                                  ? 'text-red-400 font-semibold'
                                  : 'text-emerald-400'
                              }
                            >
                              {sess.assessment?.criticalErrorsCount ?? 0}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-cyan-300">
                            {sess.assessment?.overallScore ?? 0}/100
                          </span>
                          <button
                            type="button"
                            onClick={() => onNavigate('session-replay', sess.id)}
                            className="text-cyan-400 hover:text-cyan-300 font-medium"
                          >
                            Replay →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Coaching Notes */}
            <div className="p-5 rounded-xl bg-[#0D1424] border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <MessageSquarePlus className="w-4 h-4 text-cyan-400" />
                Instructor Coaching Log ({selectedUserNotes.length})
              </h3>

              <div className="space-y-2 max-h-44 overflow-y-auto">
                {selectedUserNotes.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-lg bg-[#070B14] border border-slate-800 text-xs space-y-1"
                  >
                    <div className="text-[11px] text-slate-400">
                      {n.authorName} · {new Date(n.createdAt).toLocaleDateString()}
                    </div>
                    <p className="text-slate-200">{n.content}</p>
                  </div>
                ))}
                {selectedUserNotes.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No coaching notes logged for this profile yet.
                  </p>
                )}
              </div>

              <form onSubmit={handleAddCoachingNote} className="flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add persistent coaching note or competency target..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-slate-100"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold whitespace-nowrap"
                >
                  Log Note
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

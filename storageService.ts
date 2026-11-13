import {
  DEFAULT_PLATFORM_SETTINGS,
  DEMO_INSTRUCTOR_NOTES,
  DEMO_SCENARIOS,
  DEMO_SESSIONS,
  DEMO_USERS,
} from '../data/demoSeedData';
import {
  DebriefReport,
  DrillAttemptRecord,
  InstructorNote,
  PlatformSettings,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from '../types/simulation';

/**
 * Modular Persistence Repository
 * - Stores collections in browser localStorage under `iri_v1_*` keys so refreshing
 *   never erases user-created sessions, scenarios, users, drills, or instructor notes.
 * - Separates `isDemo: true` records from user-created (`isDemo: false`) records.
 * - Mirrors mutations asynchronously to `/api/*` REST routes so both browser persistence
 *   and future MongoDB / Unity OpenXR clients share identical document schemas.
 */

const KEYS = {
  USERS: 'iri_v1_users',
  SCENARIOS: 'iri_v1_scenarios',
  SESSIONS: 'iri_v1_sessions',
  NOTES: 'iri_v1_instructor_notes',
  SETTINGS: 'iri_v1_settings',
  DRILLS: 'iri_v1_drills',
  ACTIVE_USER: 'iri_v1_active_user_id',
};

const DEMO_DRILLS: DrillAttemptRecord[] = [
  {
    id: 'drill_demo_01',
    traineeId: 'usr_trainee_1',
    challengeType: 'protocol_sequence',
    title: 'VFib Arrest Sequence Blitz',
    scorePct: 100,
    xpEarned: 65,
    durationSec: 22,
    criticalSafetyMistakes: 0,
    completedAt: '2026-10-28T10:15:00Z',
    isDemo: true,
  },
  {
    id: 'drill_demo_02',
    traineeId: 'usr_trainee_1',
    challengeType: 'equipment_hunt_3d',
    title: '3D Trauma Bay Equipment Spotter',
    scorePct: 92,
    xpEarned: 58,
    durationSec: 26,
    criticalSafetyMistakes: 0,
    completedAt: '2026-10-29T14:20:00Z',
    isDemo: true,
  },
  {
    id: 'drill_demo_03',
    traineeId: 'usr_trainee_5',
    challengeType: 'rapid_triage_blitz',
    title: 'START Mass-Casualty Tagging Blitz',
    scorePct: 100,
    xpEarned: 70,
    durationSec: 29,
    criticalSafetyMistakes: 0,
    completedAt: '2026-10-30T09:10:00Z',
    isDemo: true,
  },
];

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, data: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Storage persistence warning:', err);
  }
}

export function initializePlatformStorage(): {
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  notes: InstructorNote[];
  settings: PlatformSettings;
  drills: DrillAttemptRecord[];
} {
  let users = safeRead<UserAccount[] | null>(KEYS.USERS, null);
  if (!users || users.length === 0) {
    users = DEMO_USERS;
    safeWrite(KEYS.USERS, users);
  }

  let scenarios = safeRead<ScenarioDefinition[] | null>(KEYS.SCENARIOS, null);
  if (!scenarios || scenarios.length === 0) {
    scenarios = DEMO_SCENARIOS;
    safeWrite(KEYS.SCENARIOS, scenarios);
  }

  let sessions = safeRead<TrainingSession[] | null>(KEYS.SESSIONS, null);
  if (!sessions) {
    sessions = DEMO_SESSIONS;
    safeWrite(KEYS.SESSIONS, sessions);
  }

  let notes = safeRead<InstructorNote[] | null>(KEYS.NOTES, null);
  if (!notes) {
    notes = DEMO_INSTRUCTOR_NOTES;
    safeWrite(KEYS.NOTES, notes);
  }

  let settings = safeRead<PlatformSettings | null>(KEYS.SETTINGS, null);
  if (!settings) {
    settings = DEFAULT_PLATFORM_SETTINGS;
    safeWrite(KEYS.SETTINGS, settings);
  }

  let drills = safeRead<DrillAttemptRecord[] | null>(KEYS.DRILLS, null);
  if (!drills) {
    drills = DEMO_DRILLS;
    safeWrite(KEYS.DRILLS, drills);
  }

  return { users, scenarios, sessions, notes, settings, drills };
}

export function saveUsers(users: UserAccount[]): void {
  safeWrite(KEYS.USERS, users);
}

export function saveScenarios(scenarios: ScenarioDefinition[]): void {
  safeWrite(KEYS.SCENARIOS, scenarios);
}

export function upsertScenarioWithApi(
  scenarios: ScenarioDefinition[],
  scenario: ScenarioDefinition
): ScenarioDefinition[] {
  const exists = scenarios.some((s) => s.id === scenario.id);
  const next = exists
    ? scenarios.map((s) => (s.id === scenario.id ? scenario : s))
    : [scenario, ...scenarios];
  safeWrite(KEYS.SCENARIOS, next);

  fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  }).catch(() => {
    // Non-blocking mirror to Express REST API
  });

  return next;
}

export function saveSessions(sessions: TrainingSession[]): void {
  safeWrite(KEYS.SESSIONS, sessions);
}

export function upsertSessionWithApi(
  sessions: TrainingSession[],
  session: TrainingSession
): TrainingSession[] {
  const exists = sessions.some((s) => s.id === session.id);
  const next = exists
    ? sessions.map((s) => (s.id === session.id ? session : s))
    : [session, ...sessions];
  safeWrite(KEYS.SESSIONS, next);

  fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  }).catch(() => {
    // Non-blocking mirror to Express REST API
  });

  return next;
}

export function saveNotes(notes: InstructorNote[]): void {
  safeWrite(KEYS.NOTES, notes);
}

export function saveSettings(settings: PlatformSettings): void {
  safeWrite(KEYS.SETTINGS, settings);
}

export function saveDrills(drills: DrillAttemptRecord[]): void {
  safeWrite(KEYS.DRILLS, drills);
}

export function getSavedActiveUserId(): string | null {
  try {
    return window.localStorage.getItem(KEYS.ACTIVE_USER);
  } catch {
    return null;
  }
}

export function setSavedActiveUserId(userId: string | null): void {
  try {
    if (!userId) {
      window.localStorage.removeItem(KEYS.ACTIVE_USER);
    } else {
      window.localStorage.setItem(KEYS.ACTIVE_USER, userId);
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Resets demo records to factory state while strictly preserving all user-created
 * (`isDemo === false`) sessions, scenarios, users, drills, and instructor notes.
 */
export function resetDemoRecordsPreservingUserRecords(): {
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
  notes: InstructorNote[];
  drills: DrillAttemptRecord[];
} {
  const current = initializePlatformStorage();
  const customUsers = current.users.filter((u) => !u.isDemo);
  const customScenarios = current.scenarios.filter((s) => !s.isDemo);
  const customSessions = current.sessions.filter((s) => !s.isDemo);
  const customDrills = current.drills.filter((d) => !d.isDemo);
  const customNotes = current.notes.filter(
    (n) => !DEMO_INSTRUCTOR_NOTES.some((d) => d.id === n.id)
  );

  const users = [...customUsers, ...DEMO_USERS];
  const scenarios = [...customScenarios, ...DEMO_SCENARIOS];
  const sessions = [...customSessions, ...DEMO_SESSIONS];
  const notes = [...customNotes, ...DEMO_INSTRUCTOR_NOTES];
  const drills = [...customDrills, ...DEMO_DRILLS];

  safeWrite(KEYS.USERS, users);
  safeWrite(KEYS.SCENARIOS, scenarios);
  safeWrite(KEYS.SESSIONS, sessions);
  safeWrite(KEYS.NOTES, notes);
  safeWrite(KEYS.DRILLS, drills);

  return { users, scenarios, sessions, notes, drills };
}

/**
 * Requests an AI-assisted evidence-based debrief from the server-side Gemini endpoint
 * (`POST /api/sessions/:sessionId/debrief`). Never exposes API keys in client code.
 */
export async function requestSessionDebrief(
  session: TrainingSession,
  scenario: ScenarioDefinition
): Promise<DebriefReport> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(session.id)}/debrief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, scenario }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Debrief request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as { debrief: DebriefReport };
  return data.debrief;
}

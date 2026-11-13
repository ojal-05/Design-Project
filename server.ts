import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DEMO_SCENARIOS,
  DEMO_SESSIONS,
  DEMO_USERS,
} from './src/data/demoSeedData.ts';
import {
  calculateSessionAssessment,
  generateRuleBasedDebrief,
} from './src/engine/assessmentEngine.ts';
import type {
  ActionEventRecord,
  DebriefReport,
  PatientState,
  ScenarioDefinition,
  TrainingSession,
  UserAccount,
} from './src/types/simulation.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'iri-db.json');

interface ServerDatabase {
  users: UserAccount[];
  scenarios: ScenarioDefinition[];
  sessions: TrainingSession[];
}

function loadServerDb(): ServerDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw) as ServerDatabase;
    }
  } catch (err) {
    console.warn('Initializing fresh server persistence store:', err);
  }

  const initial: ServerDatabase = {
    users: [...DEMO_USERS],
    scenarios: [...DEMO_SCENARIOS],
    sessions: [...DEMO_SESSIONS],
  };

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  } catch {
    // Ephemeral filesystem fallback
  }

  return initial;
}

const db: ServerDatabase = loadServerDb();

function persistServerDb(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // Non-fatal if read-only container
  }
}

function hasConfiguredGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && key !== 'MY_GEMINI_API_KEY');
}

function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // ============================================================================
  // DOCUMENTED REST API FOR WEB + FUTURE UNITY / C# / OPENXR VR CLIENT INTEGRATION
  // ============================================================================

  // Health & API Capability Discovery
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Immersive Response Intelligence API',
      openXrReady: true,
      aiDebriefAvailable: hasConfiguredGeminiKey(),
      counts: {
        scenarios: db.scenarios.length,
        sessions: db.sessions.length,
        users: db.users.length,
      },
    });
  });

  // 1. POST /api/sessions — Create or upsert a training session (Web or Unity OpenXR client)
  app.post('/api/sessions', (req: Request, res: Response) => {
    const payload = req.body as Partial<TrainingSession>;
    if (!payload || !payload.scenarioId || !payload.traineeId) {
      res.status(400).json({ error: 'scenarioId and traineeId are required.' });
      return;
    }

    const scenario = db.scenarios.find((s) => s.id === payload.scenarioId) || DEMO_SCENARIOS[0];
    const sessionId = payload.id || `sess_xr_${Date.now()}`;
    const existingIdx = db.sessions.findIndex((s) => s.id === sessionId);

    const existing = existingIdx >= 0 ? db.sessions[existingIdx] : undefined;

    const sessionRecord: TrainingSession = {
      id: sessionId,
      traineeId: payload.traineeId,
      traineeName: payload.traineeName || existing?.traineeName || 'Trainee Operator',
      scenarioId: scenario.id,
      scenarioCode: payload.scenarioCode || existing?.scenarioCode || scenario.code,
      scenarioTitle: payload.scenarioTitle || existing?.scenarioTitle || scenario.title,
      scenarioMode: payload.scenarioMode || existing?.scenarioMode || scenario.mode,
      difficulty: payload.difficulty || existing?.difficulty || scenario.difficulty,
      attemptNumber: payload.attemptNumber ?? existing?.attemptNumber ?? 1,
      startedAt: payload.startedAt || existing?.startedAt || new Date().toISOString(),
      completedAt: payload.completedAt !== undefined ? payload.completedAt : (existing?.completedAt ?? null),
      durationSec: payload.durationSec ?? existing?.durationSec ?? 0,
      status: payload.status || existing?.status || 'in_progress',
      seed: payload.seed ?? existing?.seed ?? scenario.disruptionsConfig.seed,
      isDemo: payload.isDemo ?? existing?.isDemo ?? false,
      events: payload.events ?? existing?.events ?? [],
      vitalTimeline: payload.vitalTimeline ?? existing?.vitalTimeline ?? [],
      disruptions: payload.disruptions ?? existing?.disruptions ?? [],
      finalPatients: payload.finalPatients ?? existing?.finalPatients ?? scenario.initialPatients,
      assessment: payload.assessment !== undefined ? payload.assessment : (existing?.assessment ?? null),
      debrief: payload.debrief !== undefined ? payload.debrief : (existing?.debrief ?? null),
      instructorNotes: payload.instructorNotes ?? existing?.instructorNotes ?? '',
    };

    if (existingIdx >= 0) {
      db.sessions[existingIdx] = sessionRecord;
    } else {
      db.sessions.unshift(sessionRecord);
    }
    persistServerDb();

    res.status(existingIdx >= 0 ? 200 : 201).json({ session: sessionRecord });
  });

  // List all sessions
  app.get('/api/sessions', (_req: Request, res: Response) => {
    res.json({ sessions: db.sessions });
  });

  // 2. GET /api/sessions/:sessionId — Retrieve session details
  app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    res.json({ session });
  });

  // 3. POST /api/sessions/:sessionId/events — Stream trainee interaction events from Web or VR
  app.post('/api/sessions/:sessionId/events', (req: Request, res: Response) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const incoming = Array.isArray(req.body.events)
      ? (req.body.events as ActionEventRecord[])
      : [req.body as ActionEventRecord];

    session.events.push(...incoming);
    persistServerDb();
    res.status(201).json({
      sessionId: session.id,
      recordedCount: incoming.length,
      totalEvents: session.events.length,
    });
  });

  // 4. POST /api/sessions/:sessionId/patient-state — Push simulated patient vital state snapshot
  app.post('/api/sessions/:sessionId/patient-state', (req: Request, res: Response) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const patients = req.body.patients as PatientState[] | undefined;
    const elapsedSec = Number(req.body.elapsedSec ?? session.durationSec);

    if (patients && Array.isArray(patients)) {
      session.finalPatients = patients;
      patients.forEach((p) => {
        session.vitalTimeline.push({
          elapsedSec,
          patientId: p.patientId,
          patientName: p.name,
          heartRate: p.heartRate,
          systolicBP: p.systolicBP,
          respiratoryRate: p.respiratoryRate,
          spo2: p.spo2,
          conditionStatus: p.conditionStatus,
        });
      });
      persistServerDb();
    }

    res.json({ sessionId: session.id, updatedPatients: session.finalPatients });
  });

  // 5. POST /api/sessions/:sessionId/complete — Complete session & calculate assessment
  app.post('/api/sessions/:sessionId/complete', (req: Request, res: Response) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const scenario =
      db.scenarios.find((s) => s.id === session.scenarioId) || DEMO_SCENARIOS[0];
    const durationSec = Number(req.body.durationSec ?? session.durationSec ?? 120);

    session.status = 'completed';
    session.durationSec = durationSec;
    session.completedAt = new Date().toISOString();
    if (req.body.finalPatients) {
      session.finalPatients = req.body.finalPatients;
    }

    session.assessment = calculateSessionAssessment(
      session.id,
      scenario,
      session.events,
      session.finalPatients,
      durationSec
    );
    persistServerDb();

    res.json({ session, assessment: session.assessment });
  });

  // 6. GET /api/sessions/:sessionId/assessment — Retrieve assessment breakdown
  app.get('/api/sessions/:sessionId/assessment', (req: Request, res: Response) => {
    const session = db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    if (!session.assessment) {
      const scenario =
        db.scenarios.find((s) => s.id === session.scenarioId) || DEMO_SCENARIOS[0];
      session.assessment = calculateSessionAssessment(
        session.id,
        scenario,
        session.events,
        session.finalPatients,
        session.durationSec
      );
    }
    res.json({ assessment: session.assessment });
  });

  // 7. GET /api/scenarios — List scenarios
  app.get('/api/scenarios', (_req: Request, res: Response) => {
    res.json({ scenarios: db.scenarios });
  });

  // 8. GET /api/scenarios/:scenarioId — Retrieve single scenario configuration
  app.get('/api/scenarios/:scenarioId', (req: Request, res: Response) => {
    const scenario = db.scenarios.find((s) => s.id === req.params.scenarioId);
    if (!scenario) {
      res.status(404).json({ error: 'Scenario not found.' });
      return;
    }
    res.json({ scenario });
  });

  // 9. POST /api/scenarios — Create or update scenario configuration
  app.post('/api/scenarios', (req: Request, res: Response) => {
    const incoming = req.body as ScenarioDefinition;
    if (!incoming || !incoming.title || !incoming.mode) {
      res.status(400).json({ error: 'Scenario title and mode are required.' });
      return;
    }

    const id = incoming.id || `scen_custom_${Date.now()}`;
    const record: ScenarioDefinition = {
      ...incoming,
      id,
      updatedAt: new Date().toISOString(),
    };

    const idx = db.scenarios.findIndex((s) => s.id === id);
    if (idx >= 0) {
      db.scenarios[idx] = record;
    } else {
      db.scenarios.unshift(record);
    }
    persistServerDb();

    res.status(idx >= 0 ? 200 : 201).json({ scenario: record });
  });

  // 10. GET /api/trainees/:traineeId/analytics — Aggregated trainee performance analytics
  app.get('/api/trainees/:traineeId/analytics', (req: Request, res: Response) => {
    const { traineeId } = req.params;
    const traineeSessions = db.sessions.filter(
      (s) => s.traineeId === traineeId && s.status === 'completed' && s.assessment
    );

    if (traineeSessions.length === 0) {
      res.json({
        traineeId,
        completedSessions: 0,
        averageScore: 0,
        averageProceduralAccuracy: 0,
        averageDecisionAccuracy: 0,
        averageResponseTimeSec: 0,
        totalCriticalErrors: 0,
        sessions: [],
      });
      return;
    }

    const count = traineeSessions.length;
    const avgScore = Math.round(
      traineeSessions.reduce((s, x) => s + (x.assessment?.overallScore || 0), 0) / count
    );
    const avgProc = Math.round(
      traineeSessions.reduce((s, x) => s + (x.assessment?.proceduralAccuracy || 0), 0) / count
    );
    const avgDec = Math.round(
      traineeSessions.reduce((s, x) => s + (x.assessment?.decisionAccuracy || 0), 0) / count
    );
    const avgResp = Number(
      (
        traineeSessions.reduce((s, x) => s + (x.assessment?.avgResponseTimeSec || 0), 0) / count
      ).toFixed(1)
    );
    const totalCrit = traineeSessions.reduce(
      (s, x) => s + (x.assessment?.criticalErrorsCount || 0),
      0
    );

    res.json({
      traineeId,
      completedSessions: count,
      averageScore: avgScore,
      averageProceduralAccuracy: avgProc,
      averageDecisionAccuracy: avgDec,
      averageResponseTimeSec: avgResp,
      totalCriticalErrors: totalCrit,
      sessions: traineeSessions,
    });
  });

  // 11. POST /api/sessions/:sessionId/debrief — Evidence-based Gemini AI Debrief with Rule-Based Fallback
  app.post('/api/sessions/:sessionId/debrief', async (req: Request, res: Response) => {
    const bodySession = req.body?.session as TrainingSession | undefined;
    const bodyScenario = req.body?.scenario as ScenarioDefinition | undefined;

    const session =
      bodySession || db.sessions.find((s) => s.id === req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found for debrief generation.' });
      return;
    }

    const scenario =
      bodyScenario ||
      db.scenarios.find((s) => s.id === session.scenarioId) ||
      DEMO_SCENARIOS[0];

    const fallbackDebrief = generateRuleBasedDebrief(session, scenario);

    if (!hasConfiguredGeminiKey() || req.body?.preferRuleBased === true) {
      session.debrief = fallbackDebrief;
      persistServerDb();
      res.json({
        debrief: fallbackDebrief,
        fallbackReason: req.body?.preferRuleBased ? 'rule_based_requested' : 'no_api_key_configured',
      });
      return;
    }

    try {
      const ai = createGeminiClient();
      const evidencePayload = {
        disclaimer:
          'EDUCATIONAL SIMULATION ONLY. Interpret strictly the recorded events and approved educational rules below. Do not invent events, modify scores, diagnose real patients, or give real-world clinical treatment instructions.',
        traineeName: session.traineeName,
        scenarioTitle: scenario.title,
        scenarioMode: scenario.mode,
        durationSec: session.durationSec,
        seed: session.seed,
        educationalRules: scenario.expectedActions.map((s) => ({
          order: s.order,
          label: s.label,
          rule: s.educationalRule,
          targetWindowSec: s.targetWindowSec,
          isCritical: s.isCritical,
        })),
        assessmentSummary: session.assessment,
        recordedEvents: session.events.map((e) => ({
          seq: e.sequencePosition,
          elapsedSec: e.elapsedSec,
          actionLabel: e.actionLabel,
          targetObject: e.targetObject,
          patientId: e.patientId,
          correctness: e.correctness,
          errorType: e.errorType,
          errorSeverity: e.errorSeverity,
          feedbackMessage: e.feedbackMessage,
        })),
        disruptionsTriggered: session.disruptions
          .filter((d) => d.triggered)
          .map((d) => ({ title: d.title, triggerAtSec: d.triggerAtSec, resolved: d.resolved })),
      };

      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a structured educational training debrief strictly from this recorded simulation session JSON:\n${JSON.stringify(
          evidencePayload
        )}`,
        config: {
          systemInstruction:
            'You are an educational healthcare simulation debriefing interpreter for IMMERSIVE RESPONSE INTELLIGENCE. Strictly summarize ONLY the recorded events, timestamps, disruptions, and educator-approved training rules provided in the JSON input. Never invent unrecorded events, never alter numerical scores, never diagnose patients, and never give real-world medical treatment advice. Keep each bullet concise (1-2 sentences) and cite exact timestamps from recordedEvents where relevant.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Concise 2-3 sentence educational summary referencing recorded score and outcome.',
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              weaknesses: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              delayedActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              missedActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              incorrectDecisions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              criticalErrors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              improvementRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'summary',
              'strengths',
              'weaknesses',
              'delayedActions',
              'missedActions',
              'incorrectDecisions',
              'criticalErrors',
              'improvementRecommendations',
            ],
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Gemini debrief request timed out after 12s; using deterministic rule-based debrief'));
        }, 12000);
        timer.unref?.();
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const aiDebrief: DebriefReport = {
        sessionId: session.id,
        generatedAt: new Date().toISOString(),
        source: 'gemini-ai',
        modelUsed: 'gemini-3.8-flash',
        summary: parsed.summary || fallbackDebrief.summary,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : fallbackDebrief.strengths,
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : fallbackDebrief.weaknesses,
        delayedActions: Array.isArray(parsed.delayedActions)
          ? parsed.delayedActions
          : fallbackDebrief.delayedActions,
        missedActions: Array.isArray(parsed.missedActions)
          ? parsed.missedActions
          : fallbackDebrief.missedActions,
        incorrectDecisions: Array.isArray(parsed.incorrectDecisions)
          ? parsed.incorrectDecisions
          : fallbackDebrief.incorrectDecisions,
        criticalErrors: Array.isArray(parsed.criticalErrors)
          ? parsed.criticalErrors
          : fallbackDebrief.criticalErrors,
        improvementRecommendations: Array.isArray(parsed.improvementRecommendations)
          ? parsed.improvementRecommendations
          : fallbackDebrief.improvementRecommendations,
      };

      const existing = db.sessions.find((s) => s.id === session.id);
      if (existing) {
        existing.debrief = aiDebrief;
        persistServerDb();
      }

      res.json({ debrief: aiDebrief });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Gemini API unavailable';
      console.warn('Gemini debrief fell back to deterministic rule-based interpreter:', errMsg);
      res.json({
        debrief: fallbackDebrief,
        fallbackReason: errMsg,
      });
    }
  });

  // ============================================================================
  // VITE MIDDLEWARE (DEVELOPMENT) OR STATIC DIST SERVING (PRODUCTION)
  // ============================================================================
  const publicPath = path.join(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Immersive Response Intelligence server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

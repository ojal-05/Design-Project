import type {
  EnvironmentConfig,
  PatientConditionStatus,
  ScenarioMode,
} from '../types/simulation';

export interface AudioMixerPreferences {
  enabled: boolean;
  masterVolume: number; // 0..1
  ambienceVolume: number; // 0..1
  sfxVolume: number; // 0..1
  musicEnabled: boolean;
}

export const DEFAULT_AUDIO_MIXER: AudioMixerPreferences = {
  enabled: true,
  masterVolume: 0.78,
  ambienceVolume: 0.68,
  sfxVolume: 0.85,
  musicEnabled: false,
};

export interface ListenerPose3D {
  x: number;
  y: number;
  z: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
}

export interface SpatialTelemetryAudioState {
  mode: ScenarioMode;
  isRunning: boolean;
  ambientNoiseLevel: EnvironmentConfig['ambientNoiseLevel'];
  lightingMode: EnvironmentConfig['lightingMode'];
  heartRate: number;
  spo2: number;
  conditionStatus: PatientConditionStatus;
  oxygenApplied: boolean;
  cprActive: boolean;
  monitorPos: [number, number, number];
  ambulancePos: [number, number, number];
}

export type ActionSoundKind =
  | 'check_scene_safety'
  | 'check_responsiveness'
  | 'open_airway'
  | 'start_cpr'
  | 'power_on_aed'
  | 'attach_pads'
  | 'analyze_rhythm'
  | 'deliver_shock'
  | 'apply_oxygen'
  | 'control_bleeding'
  | 'apply_dressing'
  | 'call_code_blue'
  | 'activate_backup_aed'
  | 'clear_blocked_exit'
  | 'restore_lighting'
  | 'assign_triage'
  | 'drawer_open'
  | 'footstep_left'
  | 'footstep_right'
  | 'warning'
  | 'critical'
  | 'disruption'
  | 'mission_start'
  | 'mission_complete';

/**
 * Layered Web Audio API Environmental, Spatial 3D & Interactive Soundscape Engine.
 * Synthesizes authentic hospital HVAC room tone, spatially-positioned 3D patient monitor telemetry,
 * distant emergency sirens, EMS radio squelch/comms, disaster wind/fire ambience, hospital PA chimes,
 * corridor footsteps, and tactile medical equipment sound effects with zero external audio 404s.
 */
class ImmersiveAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private masterGain: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;

  // Continuous environmental layer nodes
  private hvacSource: AudioBufferSourceNode | null = null;
  private hvacGain: GainNode | null = null;

  private disasterWindSource: AudioBufferSourceNode | null = null;
  private disasterWindFilter: BiquadFilterNode | null = null;
  private disasterWindGain: GainNode | null = null;
  private disasterWindPanner: PannerNode | null = null;

  private oxygenFlowSource: AudioBufferSourceNode | null = null;
  private oxygenFlowGain: GainNode | null = null;

  // Optional subtle low-pulse tension underscore
  private musicOscA: OscillatorNode | null = null;
  private musicOscB: OscillatorNode | null = null;
  private musicActiveGain: GainNode | null = null;

  // Spatial 3D Panner for Bedside Telemetry Monitor
  private monitorPanner: PannerNode | null = null;

  private prefs: AudioMixerPreferences = { ...DEFAULT_AUDIO_MIXER };
  private state: SpatialTelemetryAudioState | null = null;
  private schedulerId: number | null = null;

  private lastBeatTime = 0;
  private lastAlarmTime = 0;
  private nextAmbientEventTime = 0;
  private nextSirenTime = 0;
  private nextRadioTime = 0;
  private isLoopActive = false;

  public unlockAndResume(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        this.setupBuses(this.ctx);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const seconds = 4;
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pink-weighted natural acoustic noise (smooth, non-harsh)
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private createSpatialPanner(
    ctx: AudioContext,
    pos: [number, number, number],
    refDistance = 2.2,
    maxDistance = 18
  ): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = 1.35;
    panner.positionX.setValueAtTime(pos[0], ctx.currentTime);
    panner.positionY.setValueAtTime(pos[1], ctx.currentTime);
    panner.positionZ.setValueAtTime(pos[2], ctx.currentTime);
    return panner;
  }

  private setupBuses(ctx: AudioContext) {
    this.masterGain = ctx.createGain();
    this.ambienceBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();

    this.ambienceBus.connect(this.masterGain);
    this.sfxBus.connect(this.masterGain);
    this.musicBus.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    this.monitorPanner = this.createSpatialPanner(ctx, [1.38, 1.4, -1.35], 2.4, 16);
    this.monitorPanner.connect(this.ambienceBus);

    this.applyMixerGains();
  }

  public setPreferences(next: AudioMixerPreferences) {
    this.prefs = { ...next };
    if (next.enabled) {
      this.unlockAndResume();
    }
    this.applyMixerGains();
  }

  public getPreferences(): AudioMixerPreferences {
    return { ...this.prefs };
  }

  private applyMixerGains() {
    if (!this.ctx || !this.masterGain || !this.ambienceBus || !this.sfxBus || !this.musicBus) {
      return;
    }
    const now = this.ctx.currentTime;
    const masterTarget = this.prefs.enabled ? this.prefs.masterVolume : 0;
    this.masterGain.gain.setTargetAtTime(masterTarget, now, 0.08);
    this.ambienceBus.gain.setTargetAtTime(this.prefs.ambienceVolume, now, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.prefs.sfxVolume, now, 0.08);
    this.musicBus.gain.setTargetAtTime(
      this.prefs.musicEnabled && this.isLoopActive ? 0.18 : 0,
      now,
      0.25
    );
  }

  public updateListenerPose(pose: ListenerPose3D) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const t = this.ctx.currentTime;
    try {
      if ('positionX' in listener && listener.positionX) {
        listener.positionX.setValueAtTime(pose.x, t);
        listener.positionY.setValueAtTime(pose.y, t);
        listener.positionZ.setValueAtTime(pose.z, t);
        listener.forwardX.setValueAtTime(pose.forwardX, t);
        listener.forwardY.setValueAtTime(pose.forwardY, t);
        listener.forwardZ.setValueAtTime(pose.forwardZ, t);
        listener.upX.setValueAtTime(0, t);
        listener.upY.setValueAtTime(1, t);
        listener.upZ.setValueAtTime(0, t);
      } else {
        listener.setPosition(pose.x, pose.y, pose.z);
        listener.setOrientation(pose.forwardX, pose.forwardY, pose.forwardZ, 0, 1, 0);
      }
    } catch {
      // Safe fallback across browser implementations
    }
  }

  /**
   * Starts or updates the continuous scenario-specific environmental audio layers.
   */
  public syncSimulationEnvironment(nextState: SpatialTelemetryAudioState) {
    this.state = nextState;

    if (!nextState.isRunning || !this.prefs.enabled) {
      this.suspendContinuousLayers();
      return;
    }

    const ctx = this.unlockAndResume();
    if (!ctx || !this.ambienceBus || !this.musicBus) return;

    this.ensureContinuousLayersStarted(ctx);
    this.isLoopActive = true;
    this.applyMixerGains();

    const now = ctx.currentTime;
    const isTriage = nextState.mode === 'multi_patient_triage';
    const surgeMult =
      nextState.ambientNoiseLevel === 'High Surge'
        ? 1.35
        : nextState.ambientNoiseLevel === 'Low'
        ? 0.72
        : 1.0;

    // Update 3D Monitor Panner Position
    if (this.monitorPanner) {
      this.monitorPanner.positionX.setTargetAtTime(nextState.monitorPos[0], now, 0.1);
      this.monitorPanner.positionY.setTargetAtTime(nextState.monitorPos[1], now, 0.1);
      this.monitorPanner.positionZ.setTargetAtTime(nextState.monitorPos[2], now, 0.1);
    }

    // Update Hospital HVAC Ventilation Room Tone
    if (this.hvacGain) {
      const hvacLevel = (isTriage ? 0.08 : 0.12) * surgeMult;
      this.hvacGain.gain.setTargetAtTime(hvacLevel, now, 0.4);
    }

    // Update Outdoor/Threshold Disaster Wind & Surge Atmosphere positioned at Ambulance Doors
    if (this.disasterWindGain && this.disasterWindPanner) {
      this.disasterWindPanner.positionX.setTargetAtTime(
        nextState.ambulancePos[0],
        now,
        0.1
      );
      this.disasterWindPanner.positionY.setTargetAtTime(
        nextState.ambulancePos[1],
        now,
        0.1
      );
      this.disasterWindPanner.positionZ.setTargetAtTime(
        nextState.ambulancePos[2],
        now,
        0.1
      );
      const windLevel = isTriage ? 0.22 * surgeMult : 0.0;
      this.disasterWindGain.gain.setTargetAtTime(windLevel, now, 0.6);
    }

    // Subtle bedside oxygen mask flow whisper when O2 applied
    if (this.oxygenFlowGain) {
      this.oxygenFlowGain.gain.setTargetAtTime(
        nextState.oxygenApplied ? 0.045 : 0,
        now,
        0.3
      );
    }

    if (this.schedulerId === null) {
      this.lastBeatTime = now;
      this.lastAlarmTime = now;
      this.nextAmbientEventTime = now + 2.8;
      this.nextSirenTime = now + (isTriage ? 3.5 : 19.0);
      this.nextRadioTime = now + (isTriage ? 6.5 : 15.0);
      this.schedulerId = window.setInterval(() => this.tickScheduler(), 120);
    }
  }

  private ensureContinuousLayersStarted(ctx: AudioContext) {
    if (this.hvacSource || !this.ambienceBus || !this.musicBus) return;
    const noise = this.getNoiseBuffer(ctx);

    // 1. Hospital HVAC Positive-Pressure Ventilation Layer
    const hvacSrc = ctx.createBufferSource();
    hvacSrc.buffer = noise;
    hvacSrc.loop = true;
    const hvacLowpass = ctx.createBiquadFilter();
    hvacLowpass.type = 'lowpass';
    hvacLowpass.frequency.value = 240;
    const hvacGain = ctx.createGain();
    hvacGain.gain.value = 0.001;
    hvacSrc.connect(hvacLowpass);
    hvacLowpass.connect(hvacGain);
    hvacGain.connect(this.ambienceBus);
    hvacSrc.start();
    this.hvacSource = hvacSrc;
    this.hvacGain = hvacGain;

    // 2. Disaster Threshold Wind & Exterior Surge Rumble (Spatially anchored at Ambulance Doors)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noise;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 310;
    windFilter.Q.value = 1.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    const windPanner = this.createSpatialPanner(ctx, [0, 1.5, 5.6], 3.2, 22);
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(windPanner);
    windPanner.connect(this.ambienceBus);
    windSrc.start();
    this.disasterWindSource = windSrc;
    this.disasterWindFilter = windFilter;
    this.disasterWindGain = windGain;
    this.disasterWindPanner = windPanner;

    // 3. Bedside Supplemental Oxygen Laminar Mask Flow
    const o2Src = ctx.createBufferSource();
    o2Src.buffer = noise;
    o2Src.loop = true;
    const o2Filter = ctx.createBiquadFilter();
    o2Filter.type = 'bandpass';
    o2Filter.frequency.value = 2100;
    o2Filter.Q.value = 1.8;
    const o2Gain = ctx.createGain();
    o2Gain.gain.value = 0.0;
    o2Src.connect(o2Filter);
    o2Filter.connect(o2Gain);
    o2Gain.connect(this.ambienceBus);
    o2Src.start();
    this.oxygenFlowSource = o2Src;
    this.oxygenFlowGain = o2Gain;

    // 4. Optional Subtle Clinical Tension Underscore (Warm Fifth Drone, off by default unless toggled)
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = 'sine';
    oscB.type = 'triangle';
    oscA.frequency.value = 65.41; // C2
    oscB.frequency.value = 98.0; // G2
    const musicLp = ctx.createBiquadFilter();
    musicLp.type = 'lowpass';
    musicLp.frequency.value = 180;
    const mGain = ctx.createGain();
    mGain.gain.value = 0.14;
    oscA.connect(musicLp);
    oscB.connect(musicLp);
    musicLp.connect(mGain);
    mGain.connect(this.musicBus);
    oscA.start();
    oscB.start();
    this.musicOscA = oscA;
    this.musicOscB = oscB;
    this.musicActiveGain = mGain;
  }

  public suspendContinuousLayers() {
    this.isLoopActive = false;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.hvacGain?.gain.setTargetAtTime(0, now, 0.2);
    this.disasterWindGain?.gain.setTargetAtTime(0, now, 0.2);
    this.oxygenFlowGain?.gain.setTargetAtTime(0, now, 0.15);
    this.musicBus?.gain.setTargetAtTime(0, now, 0.2);
  }

  /**
   * Periodic non-repetitive scheduler for:
   * - Spatially attenuated bedside QRS pulse-oximeter beeps & IEC clinical alarms
   * - Distant hospital footsteps, muffled staff murmur, trolley wheel roll, soft PA chime
   * - Disaster wind modulation, distant emergency vehicle siren sweeps & EMS radio traffic
   */
  private tickScheduler() {
    if (!this.ctx || !this.state || !this.state.isRunning || !this.prefs.enabled) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const st = this.state;

    // Gentle wind gust modulation in disaster triage mode
    if (st.mode === 'multi_patient_triage' && this.disasterWindFilter) {
      const gust = 260 + Math.sin(now * 0.42) * 95 + Math.cos(now * 0.19) * 55;
      this.disasterWindFilter.frequency.setTargetAtTime(gust, now, 0.15);
    }

    // 1. Spatial 3D Patient Monitor QRS Beep (Pitch mapped to SpO2 saturation!)
    if (st.heartRate > 0 && this.monitorPanner) {
      const beatInterval = Math.max(0.32, 60 / st.heartRate);
      if (now - this.lastBeatTime >= beatInterval) {
        this.lastBeatTime = now;
        this.triggerSpatialMonitorBeep(ctx, st.spo2);
      }
    }

    // 2. Spatial IEC High-Priority Monitor Alarm Cadence on Arrest / Critical
    const isCritical =
      st.conditionStatus === 'Arrest' || st.conditionStatus === 'Critical';
    if (isCritical && this.monitorPanner && now - this.lastAlarmTime >= 5.4) {
      this.lastAlarmTime = now;
      this.triggerSpatialClinicalAlarm(ctx, st.conditionStatus === 'Arrest');
    }

    // 3. Organic Hospital Activity Cues (Distant Footsteps, Staff Murmur, Trolley Roll, Hospital PA)
    if (now >= this.nextAmbientEventTime) {
      const gap = st.mode === 'multi_patient_triage' ? 5.5 + Math.random() * 6 : 7.5 + Math.random() * 9;
      this.nextAmbientEventTime = now + gap;
      const roll = Math.random();
      if (roll < 0.34) {
        this.triggerDistantCorridorFootsteps(ctx);
      } else if (roll < 0.68) {
        this.triggerMuffledStaffActivity(ctx);
      } else if (roll < 0.86) {
        this.triggerDistantTrolleyRoll(ctx);
      } else {
        this.triggerDistantHospitalPaChime(ctx);
      }
    }

    // 4. Distant Emergency Vehicle Sirens (Primarily Disaster Triage, rare/muffled in Hospital)
    if (now >= this.nextSirenTime) {
      this.nextSirenTime =
        now +
        (st.mode === 'multi_patient_triage'
          ? 15 + Math.random() * 14
          : 34 + Math.random() * 22);
      this.triggerDistantEmergencySiren(
        ctx,
        st.mode === 'multi_patient_triage' ? 0.055 : 0.018
      );
    }

    // 5. Responder VHF Radio Comms Squelch (Disaster Triage & EmergencyBackup)
    if (
      (st.mode === 'multi_patient_triage' ||
        st.lightingMode === 'Emergency Backup') &&
      now >= this.nextRadioTime
    ) {
      this.nextRadioTime = now + 13 + Math.random() * 14;
      this.triggerResponderRadioTraffic(ctx);
    }
  }

  private triggerSpatialMonitorBeep(ctx: AudioContext, spo2: number) {
    if (!this.monitorPanner) return;
    const now = ctx.currentTime;
    // Authentic SpO2 pitch modulation: 99% -> 880Hz, 75% -> 520Hz
    const clampedSpo2 = Math.max(70, Math.min(100, spo2));
    const freq = 500 + ((clampedSpo2 - 70) / 30) * 380;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.042, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.085);

    osc.connect(gain);
    gain.connect(this.monitorPanner);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  private triggerSpatialClinicalAlarm(ctx: AudioContext, isArrest: boolean) {
    if (!this.monitorPanner) return;
    const now = ctx.currentTime;
    // IEC 60601-1-8 cardiac medium/high priority 3-note cadence at comfortable volume
    const notes = isArrest ? [523.25, 659.25, 783.99] : [440, 554.37];
    notes.forEach((freq, idx) => {
      const t0 = now + idx * 0.19;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.045, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.15);
      osc.connect(g);
      g.connect(this.monitorPanner!);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    });
  }

  private triggerDistantCorridorFootsteps(ctx: AudioContext) {
    if (!this.ambienceBus) return;
    const panner = this.createSpatialPanner(ctx, [6.2, 0.4, 0.8], 3.0, 20);
    panner.connect(this.ambienceBus);
    const steps = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
      const t0 = ctx.currentTime + i * 0.44;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110 + (i % 2) * 14, t0);
      osc.frequency.exponentialRampToValueAtTime(52, t0 + 0.055);
      lp.type = 'lowpass';
      lp.frequency.value = 340;
      g.gain.setValueAtTime(0.024, t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.07);
      osc.connect(lp);
      lp.connect(g);
      g.connect(panner);
      osc.start(t0);
      osc.stop(t0 + 0.08);
    }
  }

  private triggerMuffledStaffActivity(ctx: AudioContext) {
    if (!this.ambienceBus) return;
    // Soft wall-occluded clinical voice-formant cadence from adjacent nurse/doctor station
    const panner = this.createSpatialPanner(ctx, [5.4, 1.5, -2.5], 2.8, 18);
    panner.connect(this.ambienceBus);
    const syllables = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < syllables; i++) {
      const t0 = ctx.currentTime + i * (0.16 + Math.random() * 0.08);
      const osc = ctx.createOscillator();
      const f1 = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(135 + Math.random() * 45, t0);
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(420 + Math.random() * 260, t0);
      f1.Q.value = 3.2;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.015, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.14);
      osc.connect(f1);
      f1.connect(g);
      g.connect(panner);
      osc.start(t0);
      osc.stop(t0 + 0.15);
    }
  }

  private triggerDistantTrolleyRoll(ctx: AudioContext) {
    if (!this.ambienceBus) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(380, now);
    bp.frequency.linearRampToValueAtTime(520, now + 0.9);
    bp.Q.value = 2.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.025, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 1.1);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.ambienceBus);
    src.start(now);
    src.stop(now + 1.15);
  }

  private triggerDistantHospitalPaChime(ctx: AudioContext) {
    if (!this.ambienceBus) return;
    const now = ctx.currentTime;
    // Soft distant hospital two-tone paging chime (G4 -> B4)
    [392.0, 493.88].forEach((freq, idx) => {
      const t0 = now + idx * 0.34;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.022, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.55);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.ambienceBus!);
      osc.start(t0);
      osc.stop(t0 + 0.58);
    });
  }

  private triggerDistantEmergencySiren(ctx: AudioContext, peakGain: number) {
    if (!this.ambienceBus) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, [-1.5, 1.8, 7.5], 4.0, 26);
    panner.connect(this.ambienceBus);

    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = 'triangle';
    // Classic distant emergency wail sweep
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 1.45);
    osc.frequency.exponentialRampToValueAtTime(540, now + 2.9);
    osc.frequency.exponentialRampToValueAtTime(890, now + 4.1);
    osc.frequency.exponentialRampToValueAtTime(510, now + 5.2);

    lp.type = 'lowpass';
    lp.frequency.value = 720;

    g.gain.setValueAtTime(0.0008, now);
    g.gain.linearRampToValueAtTime(peakGain, now + 1.2);
    g.gain.linearRampToValueAtTime(peakGain * 0.75, now + 3.6);
    g.gain.exponentialRampToValueAtTime(0.0006, now + 5.3);

    osc.connect(lp);
    lp.connect(g);
    g.connect(panner);
    osc.start(now);
    osc.stop(now + 5.4);
  }

  private triggerResponderRadioTraffic(ctx: AudioContext) {
    if (!this.ambienceBus) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, [2.8, 1.5, 4.8], 3.0, 20);
    panner.connect(this.ambienceBus);

    // PTT squelch burst + bandpass comms carrier + courtesy roger beep
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1350;
    bp.Q.value = 2.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.028, now);
    ng.gain.setValueAtTime(0.012, now + 0.06);
    ng.gain.setValueAtTime(0.026, now + 0.85);
    ng.gain.exponentialRampToValueAtTime(0.0006, now + 0.94);

    noise.connect(bp);
    bp.connect(ng);
    ng.connect(panner);
    noise.start(now);
    noise.stop(now + 0.96);

    // Roger beep at end of radio transmission
    const beep = ctx.createOscillator();
    const bg = ctx.createGain();
    beep.type = 'sine';
    beep.frequency.setValueAtTime(1560, now + 0.84);
    bg.gain.setValueAtTime(0.018, now + 0.84);
    bg.gain.exponentialRampToValueAtTime(0.0006, now + 0.91);
    beep.connect(bg);
    bg.connect(panner);
    beep.start(now + 0.84);
    beep.stop(now + 0.92);
  }

  /**
   * Plays tactile, context-sensitive interactive sound effects for equipment & clinical actions.
   */
  public playActionSound(
    kind: ActionSoundKind,
    spatialPos?: [number, number, number]
  ) {
    if (!this.prefs.enabled) return;
    const ctx = this.unlockAndResume();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    let targetNode: AudioNode = this.sfxBus;
    if (spatialPos) {
      const p = this.createSpatialPanner(ctx, spatialPos, 2.5, 18);
      p.connect(this.sfxBus);
      targetNode = p;
    }

    switch (kind) {
      case 'footstep_left':
      case 'footstep_right': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        const base = kind === 'footstep_left' ? 112 : 124;
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.05);
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.06);
        osc.connect(g);
        g.connect(targetNode);
        osc.start(now);
        osc.stop(now + 0.065);
        break;
      }

      case 'apply_oxygen': {
        // High-pressure O2 regulator crack + laminar hiss
        const src = ctx.createBufferSource();
        src.buffer = this.getNoiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2800, now);
        bp.frequency.exponentialRampToValueAtTime(1650, now + 0.45);
        bp.Q.value = 1.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.14, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
        src.connect(bp);
        bp.connect(g);
        g.connect(targetNode);
        src.start(now);
        src.stop(now + 0.55);
        break;
      }

      case 'start_cpr': {
        // Firm chest compression thump + sternal recoil cue
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(135, now);
        osc.frequency.exponentialRampToValueAtTime(52, now + 0.09);
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(g);
        g.connect(targetNode);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }

      case 'power_on_aed':
      case 'activate_backup_aed': {
        // Biphasic defibrillator self-test power-on dual chime
        [587.33, 880].forEach((f, i) => {
          const t0 = now + i * 0.1;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t0);
          g.gain.setValueAtTime(0.08, t0);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
          osc.connect(g);
          g.connect(targetNode);
          osc.start(t0);
          osc.stop(t0 + 0.15);
        });
        break;
      }

      case 'attach_pads':
      case 'control_bleeding':
      case 'apply_dressing': {
        // Tactile adhesive / Velcro trauma strap rip + click
        const src = ctx.createBufferSource();
        src.buffer = this.getNoiseBuffer(ctx);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.09, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        src.connect(hp);
        hp.connect(g);
        g.connect(targetNode);
        src.start(now);
        src.stop(now + 0.2);
        break;
      }

      case 'analyze_rhythm': {
        // 3-pulse ECG rhythm analysis scan
        [660, 740, 880].forEach((f, i) => {
          const t0 = now + i * 0.09;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, t0);
          g.gain.setValueAtTime(0.065, t0);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
          osc.connect(g);
          g.connect(targetNode);
          osc.start(t0);
          osc.stop(t0 + 0.09);
        });
        break;
      }

      case 'deliver_shock': {
        // Rising capacitor whine + crisp biphasic discharge thump
        const whine = ctx.createOscillator();
        const wg = ctx.createGain();
        whine.type = 'sine';
        whine.frequency.setValueAtTime(520, now);
        whine.frequency.exponentialRampToValueAtTime(1480, now + 0.22);
        wg.gain.setValueAtTime(0.07, now);
        wg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        whine.connect(wg);
        wg.connect(targetNode);
        whine.start(now);
        whine.stop(now + 0.25);

        const thump = ctx.createOscillator();
        const tg = ctx.createGain();
        thump.type = 'triangle';
        thump.frequency.setValueAtTime(220, now + 0.22);
        thump.frequency.exponentialRampToValueAtTime(48, now + 0.36);
        tg.gain.setValueAtTime(0.18, now + 0.22);
        tg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        thump.connect(tg);
        tg.connect(targetNode);
        thump.start(now + 0.22);
        thump.stop(now + 0.39);
        break;
      }

      case 'call_code_blue': {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const t0 = now + i * 0.085;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t0);
          g.gain.setValueAtTime(0.075, t0);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
          osc.connect(g);
          g.connect(targetNode);
          osc.start(t0);
          osc.stop(t0 + 0.15);
        });
        break;
      }

      case 'drawer_open': {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(600, now);
        bp.frequency.linearRampToValueAtTime(920, now + 0.16);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.055, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        src.connect(bp);
        bp.connect(g);
        g.connect(targetNode);
        src.start(now);
        src.stop(now + 0.19);
        break;
      }

      case 'warning':
      case 'disruption': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.setValueAtTime(380, now + 0.11);
        g.gain.setValueAtTime(0.085, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(g);
        g.connect(targetNode);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }

      case 'critical': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(310, now);
        osc.frequency.setValueAtTime(225, now + 0.14);
        g.gain.setValueAtTime(0.09, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(g);
        g.connect(targetNode);
        osc.start(now);
        osc.stop(now + 0.34);
        break;
      }

      case 'mission_complete': {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const t0 = now + i * 0.095;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t0);
          g.gain.setValueAtTime(0.08, t0);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
          osc.connect(g);
          g.connect(targetNode);
          osc.start(t0);
          osc.stop(t0 + 0.3);
        });
        break;
      }

      default: {
        // Clean clinical confirmation click + tone
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(860, now + 0.075);
        g.gain.setValueAtTime(0.065, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(g);
        g.connect(targetNode);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
    }
  }
}

export const immersiveAudio = new ImmersiveAudioEngine();

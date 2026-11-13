import { immersiveAudio, type ActionSoundKind } from './immersiveAudioEngine';

/**
 * Unified clinical simulation & UI sound facade backed by ImmersiveAudioEngine
 * so Master Volume, SFX Volume, and Mute preferences apply consistently across
 * 3D simulation actions, skill drills, and replay controls.
 */

export type SimulationToneKind =
  | 'correct'
  | 'warning'
  | 'critical'
  | 'shock'
  | 'disruption'
  | 'footstep'
  | 'interact'
  | 'aed_charge'
  | 'monitor_beep'
  | 'mission_start'
  | 'mission_complete';

const TONE_TO_ACTION_MAP: Record<SimulationToneKind, ActionSoundKind> = {
  correct: 'check_scene_safety',
  warning: 'warning',
  critical: 'critical',
  shock: 'deliver_shock',
  disruption: 'disruption',
  footstep: 'footstep_left',
  interact: 'check_responsiveness',
  aed_charge: 'analyze_rhythm',
  monitor_beep: 'check_responsiveness',
  mission_start: 'mission_start',
  mission_complete: 'mission_complete',
};

export function playSimulationTone(
  kind: SimulationToneKind,
  enabled: boolean
): void {
  if (!enabled) return;
  immersiveAudio.unlockAndResume();
  if (kind === 'monitor_beep') {
    // Live 3D spatial QRS telemetry beeps are scheduled continuously by ImmersiveAudioEngine
    return;
  }
  const mapped = TONE_TO_ACTION_MAP[kind];
  immersiveAudio.playActionSound(mapped);
}

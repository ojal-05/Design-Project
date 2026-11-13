import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  EnvironmentConfig,
  PatientState,
  ResponderCustomization,
  ScenarioMode,
} from '../../types/simulation';
import { immersiveAudio } from '../../utils/immersiveAudioEngine';
import {
  ColliderBox,
  FirstPersonResponderRig,
  InteractableStationAnchor,
  ProximityTargetInfo,
} from './FirstPersonResponderRig';
import {
  BedPatientHumanoid,
  ResponderHumanoidCharacter,
} from './assets/HumanoidCharacter';
import {
  RealisticAedDefibrillator,
  RealisticCrashTrolley,
  RealisticHospitalBed,
  RealisticOxygenStation,
  RealisticPatientMonitor,
} from './assets/MedicalEquipmentAssets';
import { RealisticHospitalEnvironment } from './assets/HospitalEnvironmentAssets';

export type InteractiveTargetId =
  | 'Virtual Patient'
  | 'Hospital Bed'
  | 'Patient Monitor'
  | 'AED Device'
  | 'Medical Trolley'
  | 'Oxygen Equipment'
  | 'Emergency Supplies'
  | 'Emergency Call Panel'
  | 'Bay Exit Doors';

export interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface EmergencyRoomSceneProps {
  mode: ScenarioMode;
  patients: PatientState[];
  selectedPatientId: string;
  selectedObject: InteractiveTargetId;
  environment: EnvironmentConfig;
  isPaused: boolean;
  reducedMotion: boolean;
  cameraPreset: CameraPreset | null;
  onSelectObject: (target: InteractiveTargetId, patientId?: string) => void;
  onClearCameraPreset: () => void;
  // First-person gameplay extensions (optional so Studio 3D preview & Training Spotter stay 100% compatible)
  controlMode?: 'first_person' | 'orbit';
  responderProfile?: ResponderCustomization;
  resetSignal?: string;
  interactionPulse?: { seq: number; kind: 'reach' | 'cpr' | 'shock' };
  nearbyKey?: string | null;
  requestPointerLockTrigger?: number;
  audioEnabled?: boolean;
  onProximityChange?: (info: ProximityTargetInfo | null) => void;
  onPointerLockChange?: (locked: boolean) => void;
}

const DEFAULT_RESPONDER_PROFILE: ResponderCustomization = {
  callsign: 'MED-01',
  uniformId: 'trauma_navy',
  specialization: 'Resuscitation Specialist',
  gloveColor: '#0ea5e9',
};

const DEFAULT_PULSE = { seq: 0, kind: 'reach' as const };
const NOOP = () => {};

const IS_SOFTWARE_GL = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

// Pre-allocated math vectors at module scope to prevent per-frame GC allocations
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _orbitForward = new THREE.Vector3();

function OrbitAudioListenerSync({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const frameRef = useRef(0);
  useFrame(() => {
    if (!enabled) return;
    frameRef.current = (frameRef.current + 1) % 5;
    if (frameRef.current === 0) {
      camera.getWorldDirection(_orbitForward);
      immersiveAudio.updateListenerPose({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        forwardX: _orbitForward.x,
        forwardY: _orbitForward.y,
        forwardZ: _orbitForward.z,
      });
    }
  });
  return null;
}

function StudioEnvironmentSetup({
  lightingMode,
}: {
  lightingMode: EnvironmentConfig['lightingMode'];
}) {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure =
      lightingMode === 'Night Shift Dim'
        ? 0.92
        : lightingMode === 'Emergency Backup'
        ? 0.96
        : 1.12;

    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    return () => {
      envTex.dispose();
    };
  }, [gl, scene, lightingMode]);

  return null;
}

function SmoothCameraRig({
  enabled,
  preset,
  controlsRef,
  onClearPreset,
  reducedMotion,
}: {
  enabled: boolean;
  preset: CameraPreset | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onClearPreset: () => void;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();

  useFrame((_state, delta) => {
    if (!enabled || !preset || !controlsRef.current) return;
    _targetPos.set(preset.position[0], preset.position[1], preset.position[2]);
    _targetLook.set(preset.target[0], preset.target[1], preset.target[2]);

    if (reducedMotion) {
      camera.position.copy(_targetPos);
      controlsRef.current.target.copy(_targetLook);
      controlsRef.current.update();
      onClearPreset();
      return;
    }

    const alpha = 1 - Math.exp(-5.5 * Math.min(delta, 0.1));
    camera.position.lerp(_targetPos, alpha);
    controlsRef.current.target.lerp(_targetLook, alpha);
    controlsRef.current.update();

    if (
      camera.position.distanceToSquared(_targetPos) < 0.008 &&
      controlsRef.current.target.distanceToSquared(_targetLook) < 0.008
    ) {
      onClearPreset();
    }
  });

  return null;
}

/**
 * Generates a crisp bay number floor stencil decal texture.
 */
function useBayFloorDecalTexture(bayLabel: string, colorHex: string) {
  const { gl } = useThree();
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 128);
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, 236, 108);
      ctx.fillStyle = colorHex;
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(bayLabel, 128, 76);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [gl, bayLabel, colorHex]);
}

/**
 * Composite Hospital Resuscitation Bed + Rigged Humanoid Patient Character + Clinical Attachments
 */
function PatientBayAssembly({
  patient,
  position,
  isSelectedPatient,
  isBedSelected,
  isPatientSelected,
  isNearby,
  isFirstPerson,
  isTriageMode,
  isPaused,
  reducedMotion,
  playerWorldPosRef,
  onSelectObject,
}: {
  patient: PatientState;
  position: [number, number, number];
  isSelectedPatient: boolean;
  isBedSelected: boolean;
  isPatientSelected: boolean;
  isNearby: boolean;
  isFirstPerson: boolean;
  isTriageMode: boolean;
  isPaused: boolean;
  reducedMotion: boolean;
  playerWorldPosRef: React.RefObject<THREE.Vector3 | null>;
  onSelectObject: (target: InteractiveTargetId, patientId?: string) => void;
}) {
  const [hoveredPart, setHoveredPart] = useState<'bed' | 'patient' | null>(
    null
  );

  const triageColor =
    patient.assignedTriage === 'IMMEDIATE'
      ? '#ef4444'
      : patient.assignedTriage === 'DELAYED'
      ? '#f59e0b'
      : patient.assignedTriage === 'MINOR'
      ? '#10b981'
      : patient.assignedTriage === 'EXPECTANT'
      ? '#64748b'
      : '#38bdf8';

  const bayDecalTex = useBayFloorDecalTexture(
    `BAY 0${patient.bayNumber}`,
    triageColor
  );

  // Semi-Fowler incline for conscious/respiratory triage patients (flat supine during CPR / cardiac arrest)
  const fowlerAngleRad = useMemo(() => {
    if (!isTriageMode || patient.cprActive) return 0;
    if (patient.bayNumber === 4) return 0.34;
    if (patient.bayNumber === 2 && patient.airwayClear) return 0.26;
    if (patient.consciousness === 'Alert') return 0.24;
    return 0.06;
  }, [
    isTriageMode,
    patient.cprActive,
    patient.bayNumber,
    patient.airwayClear,
    patient.consciousness,
  ]);

  const bedHighlight =
    isBedSelected || hoveredPart === 'bed' ? '#0284c7' : '#000000';
  const patientHighlight =
    isNearby ||
    isPatientSelected ||
    hoveredPart === 'patient' ||
    (isTriageMode && isSelectedPatient)
      ? '#06b6d4'
      : '#000000';

  const handleBedClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectObject(
      isTriageMode ? 'Virtual Patient' : 'Hospital Bed',
      patient.patientId
    );
  };

  const handlePatientClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectObject('Virtual Patient', patient.patientId);
  };

  return (
    <group position={position}>
      {/* Contact Grounding Bedside Zone Mat */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.68, 2.7]} />
        <meshBasicMaterial
          color={isNearby || isSelectedPatient ? '#083344' : '#04070d'}
          transparent
          opacity={isNearby ? 0.68 : isSelectedPatient ? 0.52 : 0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Stenciled Floor Bay Label at Foot of Bed */}
      <mesh position={[0, 0.012, 1.58]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.92, 0.46]} />
        <meshBasicMaterial
          map={bayDecalTex}
          transparent
          opacity={0.8}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Detailed Articulated Hospital Resuscitation Bed + IV Infusion Pump */}
      <RealisticHospitalBed
        fowlerAngleRad={fowlerAngleRad}
        triageColor={triageColor}
        showTriagePlacard={isTriageMode}
        dropRightFootRail={isTriageMode && patient.bayNumber === 4}
        bedHighlightHex={bedHighlight}
        onClick={handleBedClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredPart('bed');
        }}
        onPointerOut={() => setHoveredPart(null)}
      />

      {/* Rigged Humanoid Patient Character with Skeletal Posture, Breathing, CPR & Clinical Attachments */}
      <group
        onClick={handlePatientClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredPart('patient');
        }}
        onPointerOut={() => setHoveredPart(null)}
      >
        <BedPatientHumanoid
          patient={patient}
          isTriageMode={isTriageMode}
          fowlerAngleRad={fowlerAngleRad}
          highlightHex={patientHighlight}
          isPaused={isPaused}
          reducedMotion={reducedMotion}
          playerWorldPosRef={playerWorldPosRef}
          bayWorldPos={position}
        />
      </group>

      {/* Spatial Marker with [E] — Interact Prompt When Nearby */}
      {(!isFirstPerson || isNearby || isTriageMode) && (
        <Html
          position={[
            0,
            isTriageMode && patient.bayNumber === 4 ? 1.82 : 1.58,
            isTriageMode && patient.bayNumber === 4 ? 0.25 : -0.22,
          ]}
          center
          distanceFactor={isFirstPerson ? 5.2 : 8}
          zIndexRange={[10, 0]}
        >
          <button
            type="button"
            onClick={() => onSelectObject('Virtual Patient', patient.patientId)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-transform duration-150 border ${
              isNearby
                ? 'bg-[#082f49] text-cyan-100 border-cyan-400 scale-105 shadow-lg'
                : isSelectedPatient
                ? 'bg-[#082f49]/95 text-cyan-200 border-cyan-500/70'
                : 'bg-[#0b1220]/90 text-slate-200 border-slate-700'
            }`}
          >
            {isFirstPerson && isNearby ? (
              <span className="font-mono text-cyan-300 mr-1.5">[E]</span>
            ) : null}
            <span>
              {isFirstPerson && isNearby
                ? patient.examined
                  ? `Treat ${patient.patientId}`
                  : `Examine ${patient.patientId}`
                : `${patient.patientId} · ${
                    patient.examined ? patient.conditionStatus : 'Examine'
                  }`}
            </span>
            {isTriageMode && patient.assignedTriage && (
              <>
                <span className="mx-1 text-slate-500">·</span>
                <span className="font-mono text-cyan-300">
                  {patient.assignedTriage}
                </span>
              </>
            )}
          </button>
        </Html>
      )}
    </group>
  );
}

export const EmergencyRoomScene: React.FC<EmergencyRoomSceneProps> = ({
  mode,
  patients,
  selectedPatientId,
  selectedObject,
  environment,
  isPaused,
  reducedMotion,
  cameraPreset,
  onSelectObject,
  onClearCameraPreset,
  controlMode = 'orbit',
  responderProfile = DEFAULT_RESPONDER_PROFILE,
  resetSignal = 'default',
  interactionPulse = DEFAULT_PULSE,
  nearbyKey = null,
  requestPointerLockTrigger = 0,
  audioEnabled = true,
  onProximityChange = NOOP,
  onPointerLockChange = NOOP,
}) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const playerWorldPosRef = useRef<THREE.Vector3>(
    new THREE.Vector3(0, 0, mode === 'cardiac_arrest' ? 3.85 : 4.25)
  );
  const playerWorldYawRef = useRef<number>(Math.PI);

  const isFirstPerson = controlMode === 'first_person';

  const activePatient =
    patients.find((p) => p.patientId === selectedPatientId) || patients[0];

  const keyLightColor =
    environment.lightingMode === 'Emergency Backup'
      ? '#fca5a5'
      : environment.lightingMode === 'Night Shift Dim'
      ? '#93c5fd'
      : '#f8fafc';

  const keyLightIntensity =
    environment.lightingMode === 'Emergency Backup'
      ? 1.22
      : environment.lightingMode === 'Night Shift Dim'
      ? 1.32
      : 1.88;

  // Spatial positions for 1 patient (Cardiac Arrest) vs 4–5 patients (Multi-Patient Triage)
  const bayPositions = useMemo((): [number, number, number][] => {
    if (mode === 'cardiac_arrest') {
      return [[0, 0, -0.4]];
    }
    const count = patients.length;
    if (count <= 4) {
      return [
        [-4.2, 0, -0.8],
        [-1.4, 0, -0.8],
        [1.4, 0, -0.8],
        [4.2, 0, -0.8],
      ];
    }
    return [
      [-5.2, 0, -0.8],
      [-2.6, 0, -0.8],
      [0, 0, -0.8],
      [2.6, 0, -0.8],
      [5.2, 0, -0.8],
    ];
  }, [mode, patients.length]);

  const monitorPos: [number, number, number] =
    mode === 'cardiac_arrest' ? [1.38, 0, -1.35] : [0, 0, -2.75];
  const aedPos: [number, number, number] =
    mode === 'cardiac_arrest' ? [-1.42, 0, -0.55] : [-2.6, 0, 2.05];
  const trolleyPos: [number, number, number] =
    mode === 'cardiac_arrest' ? [-2.25, 0, -1.85] : [0, 0, 2.15];
  const oxygenPos: [number, number, number] =
    mode === 'cardiac_arrest' ? [1.75, 0, -2.25] : [2.6, 0, 2.05];
  const backZ = mode === 'cardiac_arrest' ? -3.4 : -3.55;
  const frontZ = mode === 'cardiac_arrest' ? 5.25 : 5.65;
  const halfW = mode === 'cardiac_arrest' ? 7 : 8;

  // Compute physical 2D AABB Collision Boxes for First-Person Navigation
  const colliders = useMemo((): ColliderBox[] => {
    const boxes: ColliderBox[] = [];
    // Patient beds
    bayPositions.forEach(([bx, , bz]) => {
      boxes.push({
        minX: bx - 0.64,
        maxX: bx + 0.64,
        minZ: bz - 1.14,
        maxZ: bz + 1.14,
      });
    });
    // Monitor stand
    boxes.push({
      minX: monitorPos[0] - 0.35,
      maxX: monitorPos[0] + 0.35,
      minZ: monitorPos[2] - 0.35,
      maxZ: monitorPos[2] + 0.35,
    });
    // AED cart
    boxes.push({
      minX: aedPos[0] - 0.36,
      maxX: aedPos[0] + 0.36,
      minZ: aedPos[2] - 0.3,
      maxZ: aedPos[2] + 0.3,
    });
    // Medical crash trolley
    boxes.push({
      minX: trolleyPos[0] - 0.48,
      maxX: trolleyPos[0] + 0.48,
      minZ: trolleyPos[2] - 0.34,
      maxZ: trolleyPos[2] + 0.38,
    });
    // Oxygen cylinder caddy
    boxes.push({
      minX: oxygenPos[0] - 0.32,
      maxX: oxygenPos[0] + 0.32,
      minZ: oxygenPos[2] - 0.32,
      maxZ: oxygenPos[2] + 0.32,
    });
    // Back-left stocked supply cabinet
    boxes.push({
      minX: -3.75,
      maxX: -2.45,
      minZ: backZ,
      maxZ: backZ + 0.62,
    });
    // Back-right clinical telemetry desk & attending physician/nurse alcove
    const deskX = halfW - 1.55;
    boxes.push({
      minX: deskX - 0.92,
      maxX: deskX + 0.92,
      minZ: backZ,
      maxZ: backZ + 1.65,
    });
    // Disaster ambulance threshold parked field stretcher
    if (mode === 'multi_patient_triage') {
      boxes.push({
        minX: -5.1,
        maxX: -4.15,
        minZ: frontZ - 2.0,
        maxZ: frontZ - 0.1,
      });
    }
    return boxes;
  }, [bayPositions, monitorPos, aedPos, trolleyPos, oxygenPos, backZ, frontZ, halfW, mode]);

  // Compute Interactive Proximity Anchors for First-Person Contextual Prompts
  const stationAnchors = useMemo((): InteractableStationAnchor[] => {
    const list: InteractableStationAnchor[] = [];

    patients.forEach((p, idx) => {
      const pos = bayPositions[idx] || [0, 0, -0.4];
      list.push({
        key: `patient_${p.patientId}`,
        target: 'Virtual Patient',
        patientId: p.patientId,
        label: `${p.patientId} · ${p.name.replace(' (Simulated)', '')}`,
        subtitle:
          mode === 'multi_patient_triage'
            ? `Bay 0${p.bayNumber} Casualty · Examine, Stabilise & Tag Priority`
            : 'Assess Responsiveness, Airway & Perform CPR',
        position: [pos[0], 1.05, pos[2] - 0.1],
        interactRadius: 2.55,
      });

      if (mode === 'cardiac_arrest') {
        list.push({
          key: `bed_${p.patientId}`,
          target: 'Hospital Bed',
          patientId: p.patientId,
          label: 'Resuscitation Bedside & PPE Zone',
          subtitle: 'Verify Bay Scene Safety & Bedside Access',
          position: [pos[0], 0.9, pos[2] + 1.02],
          interactRadius: 2.35,
        });
      }
    });

    list.push({
      key: 'station_aed',
      target: 'AED Device',
      label: environment.primaryAedOperational
        ? 'AED Defibrillator Unit'
        : 'AED Defibrillator (CAPACITOR FAULT)',
      subtitle: 'Power On, Attach Chest Pads, Analyze Rhythm & Deliver Shock',
      position: [aedPos[0], 1.05, aedPos[2]],
      interactRadius: 2.45,
    });

    list.push({
      key: 'station_monitor',
      target: 'Patient Monitor',
      label: 'Bedside Telemetry Monitor',
      subtitle: 'Inspect Simulated 12-Lead ECG, SpO2 & Blood Pressure',
      position: [monitorPos[0], 1.35, monitorPos[2]],
      interactRadius: 2.45,
    });

    list.push({
      key: 'station_trolley',
      target: 'Medical Trolley',
      label: 'Emergency Crash Trolley',
      subtitle: 'Sterile Dressings, Airway Adjuncts & Backup AED Power Module',
      position: [trolleyPos[0], 1.0, trolleyPos[2]],
      interactRadius: 2.45,
    });

    list.push({
      key: 'station_oxygen',
      target: 'Oxygen Equipment',
      label: `Portable Oxygen Station (${environment.resources.oxygenCylinders} Cyl)`,
      subtitle: 'Administer High-Flow Supplemental Oxygen / BVM',
      position: [oxygenPos[0], 1.05, oxygenPos[2]],
      interactRadius: 2.45,
    });

    list.push({
      key: 'station_supplies',
      target: 'Emergency Supplies',
      label: `Trauma & Hemorrhage Supplies (${environment.resources.hemorrhageKits} Kits)`,
      subtitle: 'Arterial Tourniquet Kits, Dressings & PPE',
      position: [-3.1, 1.35, backZ + 0.38],
      interactRadius: 2.6,
    });

    list.push({
      key: 'station_code_blue',
      target: 'Emergency Call Panel',
      label: 'Code Blue & Bay Operations Panel',
      subtitle: 'Activate Resuscitation Team, Restore Lighting & Corridor Alerts',
      position: [3.0, 1.45, backZ + 0.25],
      interactRadius: 2.55,
    });

    list.push({
      key: 'station_exit_doors',
      target: 'Bay Exit Doors',
      label: environment.exitClear
        ? 'Trauma Transfer Exit Doors'
        : 'Obstructed Transfer Exit Doors',
      subtitle: environment.exitClear
        ? 'ICU / Surgical Evacuation Route Clear'
        : 'Corridor Blocked — Reroute Evacuation Path',
      position: [halfW - 0.25, 1.35, 0.4],
      interactRadius: 2.65,
    });

    return list;
  }, [
    patients,
    bayPositions,
    mode,
    environment.primaryAedOperational,
    environment.resources.oxygenCylinders,
    environment.resources.hemorrhageKits,
    environment.exitClear,
    aedPos,
    monitorPos,
    trolleyPos,
    oxygenPos,
    backZ,
    halfW,
  ]);

  if (contextLost) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#070B14] border border-slate-800 p-8 text-center">
        <p className="text-sm font-semibold text-slate-200 mb-2">
          3D WebGL Context Paused by Browser
        </p>
        <p className="text-xs text-slate-400 max-w-md mb-4">
          Simulation state, patient vitals, and action tracking remain active.
          Click below to restore the 3D emergency bay.
        </p>
        <button
          type="button"
          onClick={() => setContextLost(false)}
          className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors"
        >
          Restore 3D Viewport
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#070B14] select-none">
      <Canvas
        shadows={!IS_SOFTWARE_GL}
        dpr={IS_SOFTWARE_GL ? 1 : [1, 2]}
        gl={{
          antialias: !IS_SOFTWARE_GL,
          powerPreference: 'high-performance',
        }}
        camera={{
          position: isFirstPerson
            ? [0, 1.66, mode === 'cardiac_arrest' ? 3.85 : 4.25]
            : mode === 'cardiac_arrest'
            ? [0, 3.3, 4.4]
            : [0, 4.4, 6.2],
          fov: isFirstPerson ? 62 : 46,
          near: 0.08,
          far: 60,
        }}
        onCreated={({ gl }) => {
          const dom = gl.domElement;
          dom.addEventListener('webglcontextlost', (ev) => {
            ev.preventDefault();
            setContextLost(true);
          });
          dom.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
          });
        }}
      >
        <color attach="background" args={['#070b14']} />
        <fog attach="fog" args={['#070b14', 12, 30]} />

        <StudioEnvironmentSetup lightingMode={environment.lightingMode} />

        {/* Balanced 3-Point Clinical Lighting Rig */}
        <hemisphereLight args={['#bae6fd', '#0f172a', 0.72]} />
        <directionalLight
          position={[4.5, 7.5, 4.5]}
          intensity={keyLightIntensity}
          color={keyLightColor}
          castShadow={!IS_SOFTWARE_GL}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-8.5}
          shadow-camera-right={8.5}
          shadow-camera-top={7.5}
          shadow-camera-bottom={-7.5}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
        />
        <directionalLight
          position={[-5, 4, -3]}
          intensity={0.62}
          color="#38bdf8"
        />

        {/* Complete Realistic Hospital & Disaster Triage Environment + Supporting Trainees & Clinical Staff */}
        <RealisticHospitalEnvironment
          mode={mode}
          environment={environment}
          patients={patients}
          playerWorldPosRef={playerWorldPosRef}
          selectedObject={selectedObject}
          nearbyKey={nearbyKey}
          isFirstPerson={isFirstPerson}
          isPaused={isPaused}
          reducedMotion={reducedMotion}
          bayPositions={bayPositions}
          onSelectStation={(target) =>
            onSelectObject(target, activePatient?.patientId)
          }
        />

        {/* Patient Bays with Articulated Beds & Rigged Humanoid Patients */}
        {patients.map((patient, idx) => {
          const pos = bayPositions[idx] || [0, 0, -0.4];
          const isSelPat = patient.patientId === selectedPatientId;
          const isNearPat =
            nearbyKey === `patient_${patient.patientId}` ||
            nearbyKey === `bed_${patient.patientId}`;
          return (
            <PatientBayAssembly
              key={patient.patientId}
              patient={patient}
              position={pos}
              isSelectedPatient={isSelPat}
              isBedSelected={selectedObject === 'Hospital Bed' && isSelPat}
              isPatientSelected={
                selectedObject === 'Virtual Patient' && isSelPat
              }
              isNearby={isNearPat}
              isFirstPerson={isFirstPerson}
              isTriageMode={mode === 'multi_patient_triage'}
              isPaused={isPaused}
              reducedMotion={reducedMotion}
              playerWorldPosRef={playerWorldPosRef}
              onSelectObject={onSelectObject}
            />
          );
        })}

        {/* Detailed Multi-Part Interactive Medical Equipment */}
        {activePatient && (
          <RealisticPatientMonitor
            patient={activePatient}
            position={monitorPos}
            isSelected={selectedObject === 'Patient Monitor'}
            isNearby={nearbyKey === 'station_monitor'}
            isFirstPerson={isFirstPerson}
            reducedMotion={reducedMotion}
            onSelect={() =>
              onSelectObject('Patient Monitor', activePatient.patientId)
            }
          />
        )}

        <RealisticAedDefibrillator
          position={aedPos}
          isOperational={environment.primaryAedOperational}
          poweredOn={Boolean(activePatient?.aedPoweredOn)}
          padsAttached={Boolean(activePatient?.padsAttached)}
          shockAdvised={Boolean(activePatient?.shockAdvised)}
          isSelected={selectedObject === 'AED Device'}
          isNearby={nearbyKey === 'station_aed'}
          isFirstPerson={isFirstPerson}
          reducedMotion={reducedMotion}
          onSelect={() =>
            onSelectObject('AED Device', activePatient?.patientId)
          }
        />

        <RealisticCrashTrolley
          position={trolleyPos}
          isSelected={selectedObject === 'Medical Trolley'}
          isNearby={nearbyKey === 'station_trolley'}
          isFirstPerson={isFirstPerson}
          reducedMotion={reducedMotion}
          onSelect={() =>
            onSelectObject('Medical Trolley', activePatient?.patientId)
          }
        />

        <RealisticOxygenStation
          position={oxygenPos}
          cylindersRemaining={environment.resources.oxygenCylinders}
          isSelected={selectedObject === 'Oxygen Equipment'}
          isNearby={nearbyKey === 'station_oxygen'}
          isFirstPerson={isFirstPerson}
          onSelect={() =>
            onSelectObject('Oxygen Equipment', activePatient?.patientId)
          }
        />

        {/* First-Person Playable Responder Controller & Articulated 5-Fingered Hands */}
        <FirstPersonResponderRig
          enabled={isFirstPerson}
          mode={mode}
          isPaused={isPaused}
          reducedMotion={reducedMotion}
          audioEnabled={audioEnabled}
          responderProfile={responderProfile}
          colliders={colliders}
          anchors={stationAnchors}
          resetSignal={resetSignal}
          interactionPulse={interactionPulse}
          requestPointerLockTrigger={requestPointerLockTrigger}
          externalPlayerPosRef={playerWorldPosRef}
          externalPlayerYawRef={playerWorldYawRef}
          onProximityChange={onProximityChange}
          onPointerLockChange={onPointerLockChange}
        />

        {/* Tactical Orbit Mode (Available for Overhead Toggle & Studio Preview — Shows Full-Body Playable Trainee!) */}
        {!isFirstPerson && (
          <>
            <ResponderHumanoidCharacter
              profile={responderProfile}
              position={[
                playerWorldPosRef.current.x,
                0,
                playerWorldPosRef.current.z,
              ]}
              rotationY={playerWorldYawRef.current}
              isPaused={isPaused}
              reducedMotion={reducedMotion}
              clip={activePatient?.cprActive ? 'crouch' : 'idle'}
              roleBadge={`${responderProfile.callsign} · Lead Trainee`}
            />
            <OrbitControls
              ref={controlsRef}
              enableDamping={!IS_SOFTWARE_GL}
              dampingFactor={0.07}
              minDistance={2.1}
              maxDistance={13.5}
              maxPolarAngle={Math.PI / 2 - 0.06}
              target={mode === 'cardiac_arrest' ? [0, 0.9, -0.5] : [0, 0.9, -0.4]}
              onStart={() => {
                if (cameraPreset) onClearCameraPreset();
              }}
            />
            <SmoothCameraRig
              enabled={!isFirstPerson}
              preset={cameraPreset}
              controlsRef={controlsRef}
              onClearPreset={onClearCameraPreset}
              reducedMotion={reducedMotion}
            />
            <OrbitAudioListenerSync enabled={!isFirstPerson} />
          </>
        )}
      </Canvas>
    </div>
  );
};

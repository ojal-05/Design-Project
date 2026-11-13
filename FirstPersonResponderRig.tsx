import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { UNIFORM_PRESETS } from '../../engine/progressionEngine';
import type { ResponderCustomization, ScenarioMode } from '../../types/simulation';
import { immersiveAudio } from '../../utils/immersiveAudioEngine';
import type { InteractiveTargetId } from './EmergencyRoomScene';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface InteractableStationAnchor {
  key: string;
  target: InteractiveTargetId;
  patientId?: string;
  label: string;
  subtitle: string;
  position: [number, number, number];
  interactRadius: number;
}

export interface ProximityTargetInfo {
  key: string;
  target: InteractiveTargetId;
  patientId?: string;
  label: string;
  subtitle: string;
  distanceMeters: number;
}

interface FirstPersonResponderRigProps {
  enabled: boolean;
  mode: ScenarioMode;
  isPaused: boolean;
  reducedMotion: boolean;
  audioEnabled: boolean;
  responderProfile: ResponderCustomization;
  colliders: ColliderBox[];
  anchors: InteractableStationAnchor[];
  resetSignal: string;
  interactionPulse: { seq: number; kind: 'reach' | 'cpr' | 'shock' };
  requestPointerLockTrigger: number;
  externalPlayerPosRef?: React.MutableRefObject<THREE.Vector3>;
  externalPlayerYawRef?: React.MutableRefObject<number>;
  onProximityChange: (info: ProximityTargetInfo | null) => void;
  onPointerLockChange: (locked: boolean) => void;
}

// Pre-allocated math objects at module scope (zero per-frame GC allocation)
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _toAnchor = new THREE.Vector3();
const _camForward = new THREE.Vector3();

const PLAYER_STANDING_HEIGHT = 1.66;
const PLAYER_CROUCH_HEIGHT = 1.18;
const PLAYER_RADIUS = 0.34;

function collidesWithAny(
  x: number,
  z: number,
  colliders: ColliderBox[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
  if (
    x - PLAYER_RADIUS < bounds.minX ||
    x + PLAYER_RADIUS > bounds.maxX ||
    z - PLAYER_RADIUS < bounds.minZ ||
    z + PLAYER_RADIUS > bounds.maxZ
  ) {
    return true;
  }
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (
      x + PLAYER_RADIUS > c.minX &&
      x - PLAYER_RADIUS < c.maxX &&
      z + PLAYER_RADIUS > c.minZ &&
      z - PLAYER_RADIUS < c.maxZ
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Anatomically Articulated First-Person Forearm, Exposed Wrist, Uniform Sleeve &
 * 5-Fingered Nitrile-Gloved Clinical Hand (Thumb + Index, Middle, Ring & Little Phalanges)
 */
const ArticulatedFirstPersonArm: React.FC<{
  side: 'left' | 'right';
  armRef: React.RefObject<THREE.Group | null>;
  fingersGroupRef: React.RefObject<THREE.Group | null>;
  sleeveColor: string;
  trimColor: string;
  skinColor: string;
  gloveColor: string;
  wearGloves: boolean;
}> = ({
  side,
  armRef,
  fingersGroupRef,
  sleeveColor,
  trimColor,
  skinColor,
  gloveColor,
  wearGloves,
}) => {
  const handSurfaceColor = wearGloves ? gloveColor : skinColor;
  const handRoughness = wearGloves ? 0.34 : 0.56;
  const handMetalness = wearGloves ? 0.08 : 0.02;
  const isLeft = side === 'left';
  const sign = isLeft ? 1 : -1;

  // Sculpted beveled palm geometry
  const palmGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 0.072;
    const h = 0.084;
    const r = 0.018;
    const x = -w / 2;
    const y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.005,
      bevelThickness: 0.006,
    });
    geom.center();
    geom.rotateX(Math.PI / 2);
    return geom;
  }, []);

  const fingerSpecs = [
    { x: sign * 0.025, len1: 0.032, len2: 0.024, rad: 0.0074, curl: 0.24 }, // Index
    { x: sign * 0.008, len1: 0.036, len2: 0.026, rad: 0.0078, curl: 0.28 }, // Middle
    { x: -sign * 0.009, len1: 0.033, len2: 0.024, rad: 0.0073, curl: 0.32 }, // Ring
    { x: -sign * 0.025, len1: 0.026, len2: 0.019, rad: 0.0064, curl: 0.38 }, // Pinky
  ];

  return (
    <group
      ref={armRef}
      position={[isLeft ? -0.24 : 0.24, -0.28, -0.38]}
      rotation={[0.38, isLeft ? -0.18 : 0.18, isLeft ? -0.14 : 0.14]}
    >
      {/* Tailored Uniform Forearm Sleeve with Fabric Taper */}
      <mesh position={[0, 0, 0.185]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.044, 0.056, 0.27, 20]} />
        <meshStandardMaterial color={sleeveColor} roughness={0.62} metalness={0.08} />
      </mesh>
      {/* High-Visibility Reflective Sleeve Cuff Piping */}
      <mesh position={[0, 0, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0455, 0.0455, 0.022, 20]} />
        <meshStandardMaterial
          color={trimColor}
          emissive={trimColor}
          emissiveIntensity={0.28}
          roughness={0.28}
        />
      </mesh>

      {/* Anatomical Forearm Wrist Skin Transition */}
      <mesh position={[0, -0.001, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.034, 0.038, 0.038, 18]} />
        <meshStandardMaterial color={skinColor} roughness={0.56} />
      </mesh>

      {/* Responder Digital Tactical Chronometer on Right Wrist */}
      {!isLeft && (
        <group position={[0, 0.032, 0.034]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.036, 0.006, 8, 20]} />
            <meshStandardMaterial color="#0f172a" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.008, 0]}>
            <boxGeometry args={[0.036, 0.009, 0.028]} />
            <meshStandardMaterial color="#1e293b" roughness={0.25} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.028, 0.02]} />
            <meshBasicMaterial color="#06b6d4" />
          </mesh>
        </group>
      )}

      {/* Rolled Nitrile Glove Wrist Bead Cuff (Visible when clinical gloves donned) */}
      {wearGloves && (
        <mesh position={[0, -0.002, 0.005]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.0345, 0.0045, 8, 22]} />
          <meshStandardMaterial color={gloveColor} roughness={0.32} metalness={0.08} />
        </mesh>
      )}

      {/* Sculpted Metacarpal Palm */}
      <mesh geometry={palmGeom} position={[0, -0.004, -0.042]}>
        <meshStandardMaterial
          color={handSurfaceColor}
          roughness={handRoughness}
          metalness={handMetalness}
        />
      </mesh>

      {/* Opposable Articulated 2-Segment Thumb */}
      <group
        position={[sign * 0.036, -0.008, -0.026]}
        rotation={[0.16, -sign * 0.52, -sign * 0.25]}
      >
        <mesh position={[0, 0, -0.016]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.0088, 0.022, 6, 10]} />
          <meshStandardMaterial
            color={handSurfaceColor}
            roughness={handRoughness}
            metalness={handMetalness}
          />
        </mesh>
        <group position={[0, 0, -0.032]} rotation={[0.22, sign * 0.18, 0]}>
          <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.0076, 0.016, 6, 10]} />
            <meshStandardMaterial
              color={handSurfaceColor}
              roughness={handRoughness}
              metalness={handMetalness}
            />
          </mesh>
        </group>
      </group>

      {/* 4 Articulated 2-Jointed Fingers (Index, Middle, Ring, Little) */}
      <group ref={fingersGroupRef} position={[0, -0.004, -0.084]}>
        {fingerSpecs.map((f, idx) => (
          <group key={idx} position={[f.x, 0, 0]} rotation={[f.curl, 0, 0]}>
            {/* Proximal Phalanx */}
            <mesh position={[0, 0, -f.len1 * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[f.rad, f.len1 * 0.65, 6, 10]} />
              <meshStandardMaterial
                color={handSurfaceColor}
                roughness={handRoughness}
                metalness={handMetalness}
              />
            </mesh>
            {/* Middle + Distal Phalanx */}
            <group position={[0, 0, -f.len1]} rotation={[f.curl * 1.15, 0, 0]}>
              <mesh position={[0, 0, -f.len2 * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                <capsuleGeometry args={[f.rad * 0.88, f.len2 * 0.65, 6, 10]} />
                <meshStandardMaterial
                  color={handSurfaceColor}
                  roughness={handRoughness}
                  metalness={handMetalness}
                />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
};

export const FirstPersonResponderRig: React.FC<FirstPersonResponderRigProps> = ({
  enabled,
  mode,
  isPaused,
  reducedMotion,
  audioEnabled,
  responderProfile,
  colliders,
  anchors,
  resetSignal,
  interactionPulse,
  requestPointerLockTrigger,
  externalPlayerPosRef,
  externalPlayerYawRef,
  onProximityChange,
  onPointerLockChange,
}) => {
  const { camera, gl } = useThree();

  const playerPosRef = useRef(
    new THREE.Vector3(0, PLAYER_STANDING_HEIGHT, 3.85)
  );
  const currentEyeHeightRef = useRef(PLAYER_STANDING_HEIGHT);
  const crouchToggleRef = useRef(false);
  const velocityRef = useRef(new THREE.Vector2(0, 0));
  const yawRef = useRef(0);
  const pitchRef = useRef(-0.08);
  const keysRef = useRef<Record<string, boolean>>({});
  const walkPhaseRef = useRef(0);
  const stepAccumRef = useRef(0);
  const leftStepNextRef = useRef(true);
  const audioPoseFrameRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastProximityHashRef = useRef<string>('none');

  // First-person arms & articulated finger groups attached to camera transform
  const armsGroupRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftFingersRef = useRef<THREE.Group>(null);
  const rightFingersRef = useRef<THREE.Group>(null);
  const pulseTimerRef = useRef<number>(0);
  const pulseKindRef = useRef<'reach' | 'cpr' | 'shock'>('reach');
  const lastPulseSeqRef = useRef<number>(0);

  // Trigger hand reach / CPR / shock animation when player interacts
  useEffect(() => {
    if (interactionPulse.seq !== lastPulseSeqRef.current) {
      lastPulseSeqRef.current = interactionPulse.seq;
      pulseKindRef.current = interactionPulse.kind;
      pulseTimerRef.current = interactionPulse.kind === 'cpr' ? 0.65 : 0.48;
    }
  }, [interactionPulse]);

  // Reset spawn position when scenario or mode changes
  useEffect(() => {
    const startZ = mode === 'cardiac_arrest' ? 3.85 : 4.25;
    playerPosRef.current.set(0, PLAYER_STANDING_HEIGHT, startZ);
    currentEyeHeightRef.current = PLAYER_STANDING_HEIGHT;
    crouchToggleRef.current = false;
    velocityRef.current.set(0, 0);
    yawRef.current = 0;
    pitchRef.current = -0.09;
    lastProximityHashRef.current = '__force_refresh__';

    if (externalPlayerPosRef) {
      externalPlayerPosRef.current.set(0, 0, startZ);
    }
    if (externalPlayerYawRef) {
      externalPlayerYawRef.current = Math.PI;
    }

    if (enabled) {
      camera.position.copy(playerPosRef.current);
      _euler.set(pitchRef.current, yawRef.current, 0);
      camera.quaternion.setFromEuler(_euler);
    }
  }, [
    resetSignal,
    mode,
    enabled,
    camera,
    externalPlayerPosRef,
    externalPlayerYawRef,
  ]);

  // Request Pointer Lock when requested by HUD button
  useEffect(() => {
    if (!enabled || requestPointerLockTrigger === 0) return;
    const dom = gl.domElement;
    if (dom && dom.requestPointerLock && document.pointerLockElement !== dom) {
      try {
        const res = dom.requestPointerLock() as unknown as Promise<void> | undefined;
        res?.catch?.(() => {});
      } catch {
        // Fallback drag-look remains active if iframe restricts pointer lock
      }
    }
  }, [requestPointerLockTrigger, enabled, gl]);

  // Keyboard & Mouse Look Listeners
  useEffect(() => {
    if (!enabled) {
      keysRef.current = {};
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock?.();
      }
      onPointerLockChange(false);
      return;
    }

    const dom = gl.domElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyG' && !e.repeat) {
        crouchToggleRef.current = !crouchToggleRef.current;
      }
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
      isDraggingRef.current = false;
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === dom;
      onPointerLockChange(locked);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPaused) return;
      if (document.pointerLockElement === dom) {
        yawRef.current -= e.movementX * 0.0022;
        pitchRef.current = THREE.MathUtils.clamp(
          pitchRef.current - e.movementY * 0.002,
          -1.22,
          1.12
        );
      } else if (isDraggingRef.current) {
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        lastPointerRef.current.x = e.clientX;
        lastPointerRef.current.y = e.clientY;
        yawRef.current -= dx * 0.0034;
        pitchRef.current = THREE.MathUtils.clamp(
          pitchRef.current - dy * 0.0028,
          -1.22,
          1.12
        );
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isPaused) return;
      if (document.pointerLockElement !== dom) {
        isDraggingRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [enabled, isPaused, gl, onPointerLockChange]);

  const roomBounds =
    mode === 'cardiac_arrest'
      ? { minX: -6.45, maxX: 6.45, minZ: -2.95, maxZ: 4.85 }
      : { minX: -7.25, maxX: 7.25, minZ: -3.05, maxZ: 5.25 };

  useFrame((state, rawDelta) => {
    if (!enabled) return;
    const dt = Math.min(rawDelta, 0.08);
    const keys = keysRef.current;

    const isCrouching = Boolean(
      crouchToggleRef.current || keys['ControlLeft'] || keys['ControlRight']
    );

    if (!isPaused) {
      const turnInput =
        (keys['ArrowLeft'] || keys['KeyQ'] ? 1 : 0) -
        (keys['ArrowRight'] ? 1 : 0);
      if (turnInput !== 0) {
        yawRef.current += turnInput * 1.9 * dt;
      }

      const forwardInput =
        (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
        (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
      const strafeInput =
        (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

      _forward.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
      _right.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));

      _moveDir.set(0, 0, 0);
      _moveDir.addScaledVector(_forward, forwardInput);
      _moveDir.addScaledVector(_right, strafeInput);
      if (_moveDir.lengthSq() > 0.001) {
        _moveDir.normalize();
      }

      const isSprinting =
        !isCrouching && Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
      const maxSpeed = isCrouching ? 2.15 : isSprinting ? 4.85 : 3.35;
      const targetVx = _moveDir.x * maxSpeed;
      const targetVz = _moveDir.z * maxSpeed;

      velocityRef.current.x = THREE.MathUtils.damp(
        velocityRef.current.x,
        targetVx,
        13,
        dt
      );
      velocityRef.current.y = THREE.MathUtils.damp(
        velocityRef.current.y,
        targetVz,
        13,
        dt
      );

      // Smooth eye-height damping for bedside crouching (Ctrl hold or G toggle)
      const targetEyeY = isCrouching
        ? PLAYER_CROUCH_HEIGHT
        : PLAYER_STANDING_HEIGHT;
      currentEyeHeightRef.current = reducedMotion
        ? targetEyeY
        : THREE.MathUtils.damp(currentEyeHeightRef.current, targetEyeY, 10, dt);

      // Subtle dynamic FOV cue during brisk responder movement
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera && !reducedMotion) {
        const persp = camera as THREE.PerspectiveCamera;
        const targetFov =
          isSprinting && _moveDir.lengthSq() > 0.01 ? 66 : 62;
        if (Math.abs(persp.fov - targetFov) > 0.05) {
          persp.fov = THREE.MathUtils.damp(persp.fov, targetFov, 8, dt);
          persp.updateProjectionMatrix();
        }
      }

      // Axis-separated sliding collision detection
      const nextX = playerPosRef.current.x + velocityRef.current.x * dt;
      if (!collidesWithAny(nextX, playerPosRef.current.z, colliders, roomBounds)) {
        playerPosRef.current.x = nextX;
      } else {
        velocityRef.current.x = 0;
      }

      const nextZ = playerPosRef.current.z + velocityRef.current.y * dt;
      if (!collidesWithAny(playerPosRef.current.x, nextZ, colliders, roomBounds)) {
        playerPosRef.current.z = nextZ;
      } else {
        velocityRef.current.y = 0;
      }

      const horizontalSpeed = velocityRef.current.length();
      if (horizontalSpeed > 0.25) {
        walkPhaseRef.current += horizontalSpeed * dt * 2.8;
        stepAccumRef.current += horizontalSpeed * dt;
        if (stepAccumRef.current >= 1.52) {
          stepAccumRef.current = 0;
          if (audioEnabled) {
            const isLeft = leftStepNextRef.current;
            leftStepNextRef.current = !isLeft;
            immersiveAudio.playActionSound(
              isLeft ? 'footstep_left' : 'footstep_right'
            );
          }
        }
      }
    }

    const bobOffset =
      !reducedMotion && velocityRef.current.length() > 0.25
        ? Math.sin(walkPhaseRef.current * 2) * 0.02
        : 0;

    camera.position.set(
      playerPosRef.current.x,
      currentEyeHeightRef.current + bobOffset,
      playerPosRef.current.z
    );
    _euler.set(pitchRef.current, yawRef.current, 0);
    camera.quaternion.setFromEuler(_euler);

    if (externalPlayerPosRef) {
      externalPlayerPosRef.current.set(
        playerPosRef.current.x,
        0,
        playerPosRef.current.z
      );
    }
    if (externalPlayerYawRef) {
      externalPlayerYawRef.current = yawRef.current + Math.PI;
    }

    // Sync Articulated First-Person Forearms & 5-Fingered Hands with Camera
    if (armsGroupRef.current) {
      armsGroupRef.current.position.copy(camera.position);
      armsGroupRef.current.quaternion.copy(camera.quaternion);

      const t = state.clock.getElapsedTime();
      const idleBreath = reducedMotion ? 0 : Math.sin(t * 2.05) * 0.0055;
      const speed = velocityRef.current.length();
      const walkSwing =
        reducedMotion || speed <= 0.2
          ? 0
          : Math.sin(walkPhaseRef.current) * Math.min(0.032, speed * 0.0075);

      if (pulseTimerRef.current > 0) {
        pulseTimerRef.current = Math.max(0, pulseTimerRef.current - dt);
      }
      const maxDur = pulseKindRef.current === 'cpr' ? 0.65 : 0.48;
      const pulseRatio =
        pulseTimerRef.current > 0
          ? Math.sin((pulseTimerRef.current / maxDur) * Math.PI)
          : 0;

      if (leftForearmRef.current && rightForearmRef.current) {
        if (pulseKindRef.current === 'cpr' && pulseRatio > 0) {
          // Both hands interlock palms-down over sternum and pump downward
          const pump = Math.sin(pulseRatio * Math.PI * 2) * 0.035;
          leftForearmRef.current.position.set(
            -0.065,
            -0.24 - pulseRatio * 0.04 - pump,
            -0.44 - pulseRatio * 0.14
          );
          leftForearmRef.current.rotation.set(0.18, -0.42, -0.35);
          rightForearmRef.current.position.set(
            0.065,
            -0.23 - pulseRatio * 0.04 - pump,
            -0.44 - pulseRatio * 0.14
          );
          rightForearmRef.current.rotation.set(0.18, 0.42, 0.35);
        } else if (pulseKindRef.current === 'shock' && pulseRatio > 0) {
          // Left hand steady clear, right index reaches purposefully to press shock button
          leftForearmRef.current.position.set(
            -0.25,
            -0.26 + idleBreath,
            -0.36
          );
          leftForearmRef.current.rotation.set(0.45, -0.18, -0.14);
          rightForearmRef.current.position.set(
            0.16,
            -0.23 + pulseRatio * 0.03,
            -0.42 - pulseRatio * 0.18
          );
          rightForearmRef.current.rotation.set(0.24, 0.24, 0.1);
        } else {
          leftForearmRef.current.position.set(
            -0.235,
            -0.28 + idleBreath + walkSwing,
            -0.38 - pulseRatio * 0.05
          );
          leftForearmRef.current.rotation.set(
            0.38 - walkSwing * 1.4,
            -0.18,
            -0.14
          );
          rightForearmRef.current.position.set(
            0.235 - pulseRatio * 0.06,
            -0.275 + idleBreath - walkSwing + pulseRatio * 0.035,
            -0.38 - pulseRatio * 0.16
          );
          rightForearmRef.current.rotation.set(
            0.38 + walkSwing * 1.4 - pulseRatio * 0.16,
            0.18 + pulseRatio * 0.12,
            0.14
          );
        }
      }

      // Subtle finger flexion during reach / grip / CPR extension
      if (leftFingersRef.current && rightFingersRef.current) {
        const cprExtend =
          pulseKindRef.current === 'cpr' && pulseRatio > 0
            ? -0.22 * pulseRatio
            : 0;
        const reachCurl =
          pulseKindRef.current === 'reach' && pulseRatio > 0
            ? 0.25 * pulseRatio
            : 0;
        leftFingersRef.current.rotation.x = cprExtend;
        rightFingersRef.current.rotation.x = cprExtend + reachCurl;
      }
    }

    // Evaluate Object & Patient Proximity + Gaze Alignment & Sync 3D Spatial Audio Listener
    camera.getWorldDirection(_camForward);
    audioPoseFrameRef.current = (audioPoseFrameRef.current + 1) % 4;
    if (audioPoseFrameRef.current === 0) {
      immersiveAudio.updateListenerPose({
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        forwardX: _camForward.x,
        forwardY: _camForward.y,
        forwardZ: _camForward.z,
      });
    }
    let bestAnchor: InteractableStationAnchor | null = null;
    let bestScore = Infinity;
    let bestDist = Infinity;

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const dx = a.position[0] - playerPosRef.current.x;
      const dz = a.position[2] - playerPosRef.current.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= a.interactRadius) {
        _toAnchor
          .set(
            a.position[0] - camera.position.x,
            a.position[1] - camera.position.y,
            a.position[2] - camera.position.z
          )
          .normalize();
        const dot = _camForward.dot(_toAnchor);
        if (dot > 0.18 || dist < 1.15) {
          const score = dist - dot * 1.15;
          if (score < bestScore) {
            bestScore = score;
            bestAnchor = a;
            bestDist = dist;
          }
        }
      }
    }

    const roundedDist = Math.round(bestDist * 5) / 5;
    const nextHash = bestAnchor ? `${bestAnchor.key}:${roundedDist}` : 'none';
    if (nextHash !== lastProximityHashRef.current) {
      lastProximityHashRef.current = nextHash;
      if (bestAnchor) {
        onProximityChange({
          key: bestAnchor.key,
          target: bestAnchor.target,
          patientId: bestAnchor.patientId,
          label: bestAnchor.label,
          subtitle: bestAnchor.subtitle,
          distanceMeters: Number(bestDist.toFixed(1)),
        });
      } else {
        onProximityChange(null);
      }
    }
  });

  if (!enabled) return null;

  const uniform =
    UNIFORM_PRESETS[responderProfile.uniformId] || UNIFORM_PRESETS.trauma_navy;
  const skinColor = responderProfile.skinTone || '#e2b093';
  const wearGloves = responderProfile.wearGloves !== false;

  return (
    <group ref={armsGroupRef}>
      <ArticulatedFirstPersonArm
        side="left"
        armRef={leftForearmRef}
        fingersGroupRef={leftFingersRef}
        sleeveColor={uniform.primaryColor}
        trimColor={uniform.trimColor}
        skinColor={skinColor}
        gloveColor={responderProfile.gloveColor}
        wearGloves={wearGloves}
      />
      <ArticulatedFirstPersonArm
        side="right"
        armRef={rightForearmRef}
        fingersGroupRef={rightFingersRef}
        sleeveColor={uniform.primaryColor}
        trimColor={uniform.trimColor}
        skinColor={skinColor}
        gloveColor={responderProfile.gloveColor}
        wearGloves={wearGloves}
      />
    </group>
  );
};

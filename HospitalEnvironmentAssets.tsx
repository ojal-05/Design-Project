import React, { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type {
  EnvironmentConfig,
  PatientState,
  ScenarioMode,
} from '../../../types/simulation';
import { StandingHumanoid } from './HumanoidCharacter';
import {
  ProximityGroundRing,
  RealisticTraumaJumpBag,
} from './MedicalEquipmentAssets';

type StationSelectTarget =
  | 'Emergency Supplies'
  | 'Emergency Call Panel'
  | 'Bay Exit Doors';

/**
 * Generates realistic hospital seamless sheet-vinyl floor texture with welded seams & subtle speckle.
 */
function useHospitalVinylFloorTexture(isTriage: boolean) {
  const { gl } = useThree();
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = isTriage ? '#101826' : '#0f1929';
      ctx.fillRect(0, 0, 512, 512);

      // Large hospital vinyl tile seam lines
      ctx.strokeStyle = '#1d2d44';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, 0, 512, 512);
      ctx.strokeStyle = '#162438';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(256, 0);
      ctx.lineTo(256, 512);
      ctx.moveTo(0, 256);
      ctx.lineTo(512, 256);
      ctx.stroke();

      // Subtle homogenous medical vinyl terrazzo micro-flecks
      for (let i = 0; i < 220; i++) {
        const sx = (i * 97) % 512;
        const sy = (i * 151) % 512;
        ctx.fillStyle =
          i % 3 === 0
            ? 'rgba(148, 163, 184, 0.055)'
            : 'rgba(56, 189, 248, 0.035)';
        ctx.fillRect(sx, sy, 3, 3);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 8);
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [gl, isTriage]);
}

/**
 * Generates illuminated Thoracic Radiograph (Chest X-Ray) & Trauma Protocol Lightbox texture.
 */
function useDiagnosticXrayTexture() {
  const { gl } = useThree();
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 320;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#07111e';
      ctx.fillRect(0, 0, 512, 320);

      // Left Panel: PA Chest X-Ray Film
      ctx.fillStyle = '#0c1c2e';
      ctx.fillRect(16, 16, 228, 288);
      const lungGradL = ctx.createRadialGradient(92, 145, 8, 92, 145, 72);
      lungGradL.addColorStop(0, '#040911');
      lungGradL.addColorStop(1, 'rgba(148, 163, 184, 0.32)');
      ctx.fillStyle = lungGradL;
      ctx.beginPath();
      ctx.ellipse(92, 148, 42, 76, 0.1, 0, Math.PI * 2);
      ctx.fill();

      const lungGradR = ctx.createRadialGradient(168, 145, 8, 168, 145, 72);
      lungGradR.addColorStop(0, '#040911');
      lungGradR.addColorStop(1, 'rgba(148, 163, 184, 0.32)');
      ctx.fillStyle = lungGradR;
      ctx.beginPath();
      ctx.ellipse(168, 148, 42, 76, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Spine, Clavicles & Rib Cage Arcs
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.58)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(130, 38);
      ctx.lineTo(130, 265);
      ctx.stroke();

      ctx.lineWidth = 2.5;
      for (let r = 0; r < 7; r++) {
        const ry = 82 + r * 22;
        ctx.beginPath();
        ctx.arc(95, ry, 38, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(165, ry, 38, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      // Cardiac silhouette
      ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
      ctx.beginPath();
      ctx.ellipse(142, 172, 28, 34, -0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('CXR PORTABLE AP · TRAUMA BAY', 24, 292);

      // Right Panel: ACLS / ATLS Digital Protocol Matrix
      ctx.fillStyle = '#091829';
      ctx.fillRect(260, 16, 236, 288);
      ctx.fillStyle = '#0ea5e9';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('RESUSCITATION PROTOCOL', 274, 44);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px monospace';
      ctx.fillText('1. SCENE & PPE SAFETY', 274, 80);
      ctx.fillText('2. RESPONSIVENESS / PULSE', 274, 110);
      ctx.fillText('3. CODE BLUE & DEFIB', 274, 140);
      ctx.fillText('4. CPR 100-120 / MIN', 274, 170);
      ctx.fillText('5. RHYTHM / 200J SHOCK', 274, 200);
      ctx.fillText('6. HIGH-FLOW O2 / HEMO', 274, 230);
      ctx.fillStyle = '#10b981';
      ctx.fillText('TELEMETRY SYNC: ONLINE', 274, 276);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [gl]);
}

/**
 * Pleated Medical Privacy Curtain hanging from Ceiling Track via Chrome Rings
 */
function PleatedPrivacyCurtain({
  position,
  lengthZ = 1.35,
}: {
  position: [number, number, number];
  lengthZ?: number;
}) {
  const pleatWaveGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const folds = 9;
    const step = lengthZ / folds;
    shape.moveTo(0, -lengthZ / 2);
    for (let i = 0; i < folds; i++) {
      const z0 = -lengthZ / 2 + i * step;
      const amp = i % 2 === 0 ? 0.038 : -0.038;
      shape.quadraticCurveTo(amp, z0 + step * 0.5, 0, z0 + step);
    }
    for (let i = folds; i > 0; i--) {
      const z0 = -lengthZ / 2 + i * step;
      const amp = (i - 1) % 2 === 0 ? 0.038 : -0.038;
      shape.quadraticCurveTo(
        amp + 0.012,
        z0 - step * 0.5,
        0.012,
        z0 - step
      );
    }
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 1.72,
      bevelEnabled: false,
      steps: 1,
    });
    // Rotate so extrusion depth runs vertically along Y
    geom.rotateX(-Math.PI / 2);
    return geom;
  }, [lengthZ]);

  return (
    <group position={position}>
      {/* Extruded Aluminum Ceiling Curtain Track + Drop Rods */}
      <mesh position={[0, 2.58, 0]}>
        <boxGeometry args={[0.035, 0.035, 2.25]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.22} metalness={0.88} />
      </mesh>
      {[-0.95, 0.95].map((rz, idx) => (
        <mesh key={idx} position={[0, 3.2, rz]}>
          <cylinderGeometry args={[0.01, 0.01, 1.24, 8]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.85} />
        </mesh>
      ))}
      {/* Upper Ventilated Mesh Top Strip */}
      <mesh position={[0.006, 2.4, -0.38]}>
        <boxGeometry args={[0.02, 0.28, lengthZ]} />
        <meshStandardMaterial
          color="#bae6fd"
          transparent
          opacity={0.45}
          wireframe
        />
      </mesh>
      {/* Sinusoidal Pleated Antimicrobial Fabric Drape */}
      <mesh geometry={pleatWaveGeom} position={[0, 0.56, -0.38]} castShadow>
        <meshStandardMaterial
          color="#1e3a5f"
          roughness={0.82}
          metalness={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Articulated Dual-Head Surgical / Resuscitation Ceiling Boom Lamp
 */
function SurgicalCeilingBoomLight({
  position,
  isEmergencyLight,
}: {
  position: [number, number, number];
  isEmergencyLight: boolean;
}) {
  const glowColor = isEmergencyLight ? '#fca5a5' : '#e0f2fe';

  return (
    <group position={position}>
      {/* Ceiling Flange & Central Down-Column */}
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.06, 24]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.048, 0.055, 0.38, 18]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.22} metalness={0.86} />
      </mesh>

      {/* Primary Articulated Arm + Main Multi-Pod Surgical Dome */}
      <group position={[0, -0.1, 0]} rotation={[0, 0.25, 0]}>
        <mesh position={[-0.24, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.028, 0.5, 14]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.24} metalness={0.85} />
        </mesh>
        <group position={[-0.46, -0.09, 0]} rotation={[0.14, 0, -0.12]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.32, 0.38, 0.075, 28]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.26} metalness={0.68} />
          </mesh>
          {/* Multi-Lens Surgical LED Array */}
          <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.33, 28]} />
            <meshBasicMaterial color={glowColor} />
          </mesh>
          {/* Central Sterile Positioning Handle */}
          <mesh position={[0, -0.09, 0]}>
            <cylinderGeometry args={[0.018, 0.014, 0.11, 14]} />
            <meshStandardMaterial color="#0284c7" roughness={0.35} />
          </mesh>
        </group>
      </group>

      {/* Secondary Satellite Examination Lamp */}
      <group position={[0, -0.06, 0]} rotation={[0, -0.55, 0]}>
        <mesh position={[0.26, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.024, 0.024, 0.52, 14]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.24} metalness={0.85} />
        </mesh>
        <group position={[0.5, -0.08, 0]} rotation={[0.18, 0, 0.15]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.26, 0.065, 24]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.26} metalness={0.68} />
          </mesh>
          <mesh position={[0, -0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 24]} />
            <meshBasicMaterial color={glowColor} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * Clinical Wheelchair Prop Parked Neatly Against Perimeter Wall
 */
function ClinicalWheelchairProp({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Rear Spoked Large Wheels + Handrims */}
      {[-0.27, 0.27].map((wx, idx) => (
        <group key={idx} position={[wx, 0.28, -0.06]}>
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[0.26, 0.02, 10, 28]} />
            <meshStandardMaterial color="#0f172a" roughness={0.75} />
          </mesh>
          <mesh
            position={[idx === 0 ? -0.02 : 0.02, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <torusGeometry args={[0.22, 0.008, 8, 24]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.028, 0.028, 0.04, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* Front Swivel Caster Wheels */}
      {[-0.23, 0.23].map((fx, idx) => (
        <mesh
          key={idx}
          position={[fx, 0.09, 0.28]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.085, 0.085, 0.024, 18]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>
      ))}
      {/* Vinyl Seat, Backrest, Padded Armrests & Footplates */}
      <mesh position={[0, 0.48, 0.04]} castShadow>
        <boxGeometry args={[0.46, 0.045, 0.44]} />
        <meshStandardMaterial color="#0f172a" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.74, -0.17]} rotation={[-0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.48, 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.62} />
      </mesh>
      {[-0.25, 0.25].map((ax, idx) => (
        <group key={idx} position={[ax, 0.66, 0.04]}>
          <mesh>
            <boxGeometry args={[0.04, 0.03, 0.38]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.28, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.14, 10]} />
            <meshStandardMaterial color="#0284c7" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {[-0.14, 0.14].map((px, idx) => (
        <mesh key={idx} position={[px, 0.12, 0.38]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.16, 0.02, 0.16]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Emergency Ambulance Rear Bay + Wheeled EMS Field Stretcher + Surge Tripod Light
 * Rendered at the wide Ambulance Entrance during Multi-Patient Disaster Triage!
 */
function DisasterAmbulanceBayThreshold({
  frontZ,
  isPaused,
  reducedMotion,
}: {
  frontZ: number;
  isPaused: boolean;
  reducedMotion: boolean;
}) {
  const redBeaconRef = useRef<THREE.MeshStandardMaterial>(null);
  const blueBeaconRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (isPaused || reducedMotion) return;
    const t = state.clock.getElapsedTime();
    const s = Math.sin(t * 7.5);
    if (redBeaconRef.current) {
      redBeaconRef.current.emissiveIntensity = s > 0 ? 1.35 : 0.2;
    }
    if (blueBeaconRef.current) {
      blueBeaconRef.current.emissiveIntensity = s <= 0 ? 1.35 : 0.2;
    }
  });

  return (
    <group position={[0, 0, frontZ]}>
      {/* Docked Emergency Ambulance Rear Cabin Backing Up to Trauma Threshold */}
      <group position={[0, 0, 0.92]}>
        {/* Ambulance Box Body Frame */}
        <mesh position={[0, 1.48, 0.55]} castShadow>
          <boxGeometry args={[2.52, 2.38, 1.35]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.32} metalness={0.22} />
        </mesh>
        {/* High-Visibility Red/Orange EMS Stripe */}
        <mesh position={[0, 1.15, -0.13]}>
          <boxGeometry args={[2.54, 0.34, 0.02]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#dc2626"
            emissiveIntensity={0.22}
            roughness={0.35}
          />
        </mesh>
        {/* Ambulance Interior Compartment Recess */}
        <mesh position={[0, 1.38, 0.12]}>
          <boxGeometry args={[2.1, 1.88, 0.65]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} />
        </mesh>
        {/* Diamond-Plate Rear Step Bumper + Loading Ramp */}
        <mesh position={[0, 0.28, -0.25]} castShadow>
          <boxGeometry args={[2.48, 0.12, 0.34]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.14, -0.58]} rotation={[-0.22, 0, 0]}>
          <boxGeometry args={[1.28, 0.04, 0.68]} />
          <meshStandardMaterial color="#64748b" roughness={0.38} metalness={0.78} />
        </mesh>

        {/* Open Double Rear Ambulance Doors with Windows & Reflective Chevrons */}
        {[-1, 1].map((side) => (
          <group
            key={side}
            position={[side * 1.16, 1.38, -0.12]}
            rotation={[0, side * 0.95, 0]}
          >
            <mesh position={[-side * 0.48, 0, 0]} castShadow>
              <boxGeometry args={[0.96, 1.86, 0.06]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.35} metalness={0.2} />
            </mesh>
            <mesh position={[-side * 0.48, 0.38, -0.035]}>
              <planeGeometry args={[0.64, 0.68]} />
              <meshBasicMaterial color="#082f49" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-side * 0.48, -0.42, -0.035]}>
              <planeGeometry args={[0.78, 0.28]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#f97316"
                emissiveIntensity={0.28}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}

        {/* Roof Emergency Beacon Lightbar */}
        <group position={[0, 2.72, -0.08]}>
          <mesh>
            <boxGeometry args={[1.95, 0.11, 0.2]} />
            <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[-0.62, 0, -0.09]}>
            <boxGeometry args={[0.52, 0.085, 0.05]} />
            <meshStandardMaterial
              ref={redBeaconRef}
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={0.85}
            />
          </mesh>
          <mesh position={[0.62, 0, -0.09]}>
            <boxGeometry args={[0.52, 0.085, 0.05]} />
            <meshStandardMaterial
              ref={blueBeaconRef}
              color="#38bdf8"
              emissive="#0ea5e9"
              emissiveIntensity={0.85}
            />
          </mesh>
        </group>
      </group>

      {/* Wheeled EMS Ambulance Field Stretcher / Gurney Parked Aside Entrance */}
      <group position={[-4.65, 0, -1.05]} rotation={[0, 0.28, 0]}>
        {/* Folding X-Frame Aluminum Legs */}
        <mesh position={[0, 0.36, 0]} rotation={[0.68, 0, 0]}>
          <boxGeometry args={[0.52, 0.035, 1.05]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.36, 0]} rotation={[-0.68, 0, 0]}>
          <boxGeometry args={[0.52, 0.035, 1.05]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
        </mesh>
        {/* High-Visibility Orange EMS Stretcher Pad + Black Restraint Straps */}
        <mesh position={[0, 0.68, 0]} castShadow>
          <boxGeometry args={[0.58, 0.08, 1.82]} />
          <meshStandardMaterial color="#ea580c" roughness={0.55} />
        </mesh>
        {[-0.35, 0.35].map((sz, idx) => (
          <mesh key={idx} position={[0, 0.725, sz]}>
            <boxGeometry args={[0.6, 0.015, 0.05]} />
            <meshStandardMaterial color="#0f172a" roughness={0.75} />
          </mesh>
        ))}
      </group>

      {/* Portable Tripod Disaster Surge Work Light */}
      <group position={[4.85, 0, -0.95]} rotation={[0, -0.45, 0]}>
        {[0, 1, 2].map((i) => {
          const a = (i * Math.PI * 2) / 3;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.18, 0.28, Math.cos(a) * 0.18]}
              rotation={[Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]}
            >
              <cylinderGeometry args={[0.014, 0.014, 0.62, 8]} />
              <meshStandardMaterial color="#eab308" roughness={0.4} metalness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.016, 0.02, 1.35, 10]} />
          <meshStandardMaterial color="#eab308" roughness={0.38} metalness={0.45} />
        </mesh>
        <mesh position={[0, 1.86, 0]}>
          <boxGeometry args={[0.42, 0.22, 0.09]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.86, 0.048]}>
          <planeGeometry args={[0.36, 0.16]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
      </group>

      {/* High-Visibility Orange Triage Cones & Trauma Jump Bag */}
      {[-2.1, 2.1].map((cx, idx) => (
        <group key={idx} position={[cx, 0, -0.42]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.32, 0.04, 0.32]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.28, 0]} castShadow>
            <coneGeometry args={[0.12, 0.52, 18]} />
            <meshStandardMaterial color="#f97316" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.062, 0.082, 0.09, 18]} />
            <meshStandardMaterial
              color="#f8fafc"
              emissive="#f8fafc"
              emissiveIntensity={0.25}
            />
          </mesh>
        </group>
      ))}

      <RealisticTraumaJumpBag
        position={[-3.65, 0, -0.78]}
        rotation={[0, 0.45, 0]}
        bagColor="#dc2626"
        accentColor="#f59e0b"
        includePortableO2
      />
    </group>
  );
}

/**
 * Clinical Telemetry Control Workstation + Authentic Supporting Trainees & Medical Staff
 * Includes:
 * - Supporting Emergency-Response Trainee (Fellow Trainee assisting with crash cart, airway/CPR prep & bay monitoring)
 * - Attending Emergency Physician (White clinical coat over scrubs, stethoscope, ID badge, real-time clinical oversight)
 * - Resuscitation / Trauma Charge Nurse (Teal clinical scrubs, nitrile gloves, charting clipboard, stethoscope, ID badge)
 * - EMS Paramedic & Triage Officer at Ambulance Threshold during Multi-Patient Triage
 */
function ClinicalControlWorkstationAndStaff({
  mode,
  backZ,
  frontZ,
  halfW,
  patients,
  environment,
  bayPositions,
  playerWorldPosRef,
  isPaused,
  reducedMotion,
}: {
  mode: ScenarioMode;
  backZ: number;
  frontZ: number;
  halfW: number;
  patients: PatientState[];
  environment: EnvironmentConfig;
  bayPositions: [number, number, number][];
  playerWorldPosRef?: React.RefObject<THREE.Vector3 | null>;
  isPaused: boolean;
  reducedMotion: boolean;
}) {
  const deskX = halfW - 1.55;
  const deskZ = backZ + 0.82;

  const primaryPatient = patients[0];
  const isResusActive =
    mode === 'cardiac_arrest' &&
    Boolean(
      primaryPatient &&
        (primaryPatient.cprActive ||
          primaryPatient.padsAttached ||
          primaryPatient.shockAdvised)
    );
  const isShockStandClear =
    mode === 'cardiac_arrest' && Boolean(primaryPatient?.shockAdvised);
  const isRoscAchieved =
    mode === 'cardiac_arrest' &&
    (primaryPatient?.conditionStatus === 'Stabilising' ||
      primaryPatient?.conditionStatus === 'Stable');

  // Triage coordination metrics
  const untriagedCount = patients.filter((p) => !p.assignedTriage).length;
  const unexaminedImmediate = patients.find(
    (p) => p.bleedingSeverity === 'Severe' && !p.bleedingControlled
  );
  const stabilizedImmediateIdx = patients.findIndex(
    (p) =>
      p.assignedTriage === 'IMMEDIATE' &&
      (p.bleedingControlled || p.oxygenApplied)
  );

  // Attending Physician event-driven coordination
  const doctorPriorityPos: [number, number, number] | null =
    mode === 'cardiac_arrest' && (isResusActive || isRoscAchieved)
      ? [2.15, 0, -1.55]
      : null;
  const doctorLine = isShockStandClear
    ? 'Shock advised — stand clear!'
    : primaryPatient?.cprActive
    ? 'Good rate — 100 to 120 BPM'
    : isRoscAchieved
    ? 'ROSC confirmed — monitor SpO2'
    : !environment.exitClear
    ? 'Clear transfer corridor'
    : null;

  // Charge Nurse event-driven coordination
  const nursePriorityPos: [number, number, number] | null =
    mode === 'cardiac_arrest'
      ? isShockStandClear
        ? [-1.95, 0, -1.35]
        : primaryPatient?.cprActive
        ? [-1.72, 0, -0.92]
        : null
      : unexaminedImmediate
      ? [-3.15, 0, -2.15]
      : null;
  const nurseLine =
    mode === 'cardiac_arrest'
      ? isShockStandClear
        ? 'Oxygen clear — logging shock'
        : primaryPatient?.cprActive
        ? 'Charting cycle & epi timer'
        : null
      : unexaminedImmediate
      ? 'Bay 01 severe hemorrhage!'
      : untriagedCount === 0
      ? 'All casualties tagged'
      : null;

  // Supporting Emergency-Response Trainee (Peer Trainee working alongside the player)
  const traineePriorityPos: [number, number, number] | null = useMemo(() => {
    if (mode === 'cardiac_arrest') {
      if (isShockStandClear) return [1.35, 0, -0.22];
      if (!environment.primaryAedOperational) return [-1.78, 0, -1.42];
      if (primaryPatient?.cprActive || isRoscAchieved) return [0.94, 0, -0.36];
      return null;
    }
    if (stabilizedImmediateIdx >= 0 && bayPositions[stabilizedImmediateIdx]) {
      const bp = bayPositions[stabilizedImmediateIdx];
      return [bp[0] + 0.78, 0, bp[2] + 1.32];
    }
    return null;
  }, [
    mode,
    isShockStandClear,
    environment.primaryAedOperational,
    primaryPatient?.cprActive,
    isRoscAchieved,
    stabilizedImmediateIdx,
    bayPositions,
  ]);

  const traineeLine =
    mode === 'cardiac_arrest'
      ? isShockStandClear
        ? 'Hands off — clear of bed!'
        : !environment.primaryAedOperational
        ? 'Checking trolley backup cell'
        : primaryPatient?.cprActive
        ? 'Standing by to swap CPR'
        : isRoscAchieved
        ? 'Radial & carotid pulse back'
        : null
      : !environment.exitClear
      ? 'Exit obstructed — rerouting'
      : stabilizedImmediateIdx >= 0
      ? 'Re-checking Immediate vitals'
      : null;

  return (
    <group>
      {/* Observation Control Window Framed into Upper Back-Right Wall */}
      <group position={[deskX - 0.15, 1.92, backZ + 0.1]}>
        <mesh>
          <boxGeometry args={[2.35, 1.28, 0.06]} />
          <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.75} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[2.18, 1.12]} />
          <meshPhysicalMaterial
            color="#0c2d48"
            transparent
            opacity={0.72}
            roughness={0.08}
            metalness={0.35}
          />
        </mesh>
      </group>

      {/* Clinical Charting & Telemetry Desk + Dual Curved Monitors */}
      <group position={[deskX, 0, deskZ]}>
        <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.65, 0.045, 0.68]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.32} metalness={0.25} />
        </mesh>
        {[-0.74, 0.74].map((lx, idx) => (
          <mesh key={idx} position={[lx, 0.37, 0]} castShadow>
            <boxGeometry args={[0.06, 0.74, 0.62]} />
            <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.55} />
          </mesh>
        ))}

        {/* Dual Widescreen Clinical Displays */}
        {[-0.36, 0.36].map((mx, idx) => (
          <group
            key={idx}
            position={[mx, 1.03, -0.14]}
            rotation={[0, idx === 0 ? 0.16 : -0.16, 0]}
          >
            <mesh castShadow>
              <boxGeometry args={[0.58, 0.34, 0.035]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.02]}>
              <planeGeometry args={[0.53, 0.29]} />
              <meshBasicMaterial color={idx === 0 ? '#082f49' : '#064e3b'} />
            </mesh>
            <mesh position={[0, -0.21, 0]}>
              <cylinderGeometry args={[0.02, 0.03, 0.1, 12]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* Medical Keyboard */}
        <mesh position={[0, 0.79, 0.14]}>
          <boxGeometry args={[0.38, 0.015, 0.13]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
      </group>

      {/* 1. Attending Emergency Physician (White Lab Coat over Scrubs, Stethoscope, ID Badge) */}
      <StandingHumanoid
        modelKey="operator"
        position={[deskX - 0.42, 0, deskZ + 0.58]}
        patrolWaypoints={[
          [deskX - 0.42, 0, deskZ + 0.58],
          [deskX + 0.28, 0, deskZ + 0.64],
        ]}
        patrolPauseSec={6.2}
        patrolWalkSpeed={1.02}
        priorityTargetPos={doctorPriorityPos}
        priorityFocusYaw={-0.95}
        priorityClip={isShockStandClear ? 'gesture' : 'examine'}
        gazeTargetWorld={
          mode === 'cardiac_arrest'
            ? [0, 1.05, -0.4]
            : [deskX + 0.62, 1.58, deskZ + 0.9]
        }
        playerWorldPosRef={playerWorldPosRef}
        enablePlayerYield={true}
        isCommunicating={Boolean(doctorLine)}
        communicationLine={doctorLine}
        rotationY={-0.42}
        targetHeight={1.79}
        clip="examine"
        isPaused={isPaused}
        reducedMotion={reducedMotion}
        topColor="#f8fafc"
        bottomColor="#1e293b"
        footwearColor="#0f172a"
        topFabricStyle="physician_coat"
        bottomFabricStyle="scrubs_bottom"
        footwearFabricStyle="medical_footwear"
        showBeard={true}
        showStethoscope={true}
        showBadge={true}
        accentColor="#0284c7"
        roleBadge="Dr. M. Chen · Attending MD"
      />

      {/* 2. Resuscitation / Trauma Charge Nurse (Teal Scrubs, Nitrile Gloves, Charting Clipboard, ID Badge) */}
      <StandingHumanoid
        modelKey="medic_female"
        position={[
          mode === 'cardiac_arrest' ? -3.05 : deskX + 0.62,
          0,
          mode === 'cardiac_arrest' ? backZ + 1.08 : deskZ + 0.92,
        ]}
        patrolWaypoints={
          mode === 'cardiac_arrest'
            ? [
                [-3.05, 0, backZ + 1.08],
                [-2.05, 0, -0.98],
              ]
            : [
                [deskX + 0.62, 0, deskZ + 0.92],
                [2.25, 0, -2.05],
              ]
        }
        patrolPauseSec={5.4}
        patrolWalkSpeed={1.12}
        priorityTargetPos={nursePriorityPos}
        priorityFocusYaw={mode === 'cardiac_arrest' ? 1.15 : 0.35}
        priorityClip="examine"
        gazeTargetWorld={
          mode === 'cardiac_arrest'
            ? [0, 1.05, -0.4]
            : [deskX - 0.42, 1.65, deskZ + 0.58]
        }
        playerWorldPosRef={playerWorldPosRef}
        enablePlayerYield={true}
        isCommunicating={Boolean(nurseLine)}
        communicationLine={nurseLine}
        rotationY={mode === 'cardiac_arrest' ? 0.68 : -0.58}
        targetHeight={1.7}
        clip="idle_var"
        isPaused={isPaused}
        reducedMotion={reducedMotion}
        topColor="#0d9488"
        bottomColor="#115e59"
        footwearColor="#0f172a"
        topFabricStyle="scrubs_top"
        bottomFabricStyle="scrubs_bottom"
        footwearFabricStyle="medical_footwear"
        showGlasses={true}
        showStethoscope={true}
        showBadge={true}
        wearGloves={true}
        gloveColor="#0ea5e9"
        carriedProp="clipboard"
        accentColor="#14b8a6"
        roleBadge="RN S. Patel · Charge Nurse"
      />

      {/* 3. Supporting Emergency-Response Trainee (Distinct Clinician Avatar, Fitted Scrubs, PPE, Med Kit) */}
      <StandingHumanoid
        modelKey="clinician"
        position={
          mode === 'cardiac_arrest'
            ? [1.18, 0, 0.52]
            : [1.15, 0, 2.15]
        }
        patrolWaypoints={
          mode === 'cardiac_arrest'
            ? [
                [1.18, 0, 0.52],
                [1.04, 0, -0.34],
                [-1.75, 0, -1.35],
              ]
            : [
                [1.15, 0, 2.15],
                [-2.25, 0, -2.35],
                [1.45, 0, 0.92],
              ]
        }
        patrolPauseSec={4.8}
        patrolWalkSpeed={1.18}
        priorityTargetPos={traineePriorityPos}
        priorityFocusYaw={
          mode === 'cardiac_arrest'
            ? isShockStandClear
              ? -Math.PI / 2
              : !environment.primaryAedOperational
              ? -0.75
              : -Math.PI / 2
            : Math.PI
        }
        priorityClip={
          mode === 'cardiac_arrest' && primaryPatient?.cprActive
            ? 'crouch'
            : isShockStandClear
            ? 'gesture'
            : 'examine'
        }
        gazeTargetWorld={
          mode === 'cardiac_arrest' ? [0, 1.02, -0.38] : [0, 1.05, -0.8]
        }
        playerWorldPosRef={playerWorldPosRef}
        enablePlayerYield={true}
        isCommunicating={Boolean(traineeLine)}
        communicationLine={traineeLine}
        rotationY={mode === 'cardiac_arrest' ? -1.35 : Math.PI}
        targetHeight={1.74}
        clip="idle"
        isPaused={isPaused}
        reducedMotion={reducedMotion}
        topColor={mode === 'cardiac_arrest' ? '#1f6f8b' : '#1b3b5f'}
        bottomColor={mode === 'cardiac_arrest' ? '#164e63' : '#132a46'}
        footwearColor="#0f172a"
        topFabricStyle="scrubs_top"
        bottomFabricStyle="scrubs_bottom"
        footwearFabricStyle="medical_footwear"
        showStethoscope={false}
        showBadge={true}
        wearMask={mode === 'cardiac_arrest'}
        wearGloves={true}
        gloveColor="#38bdf8"
        visorStyle="safety_glasses"
        carriedProp="med_kit"
        accentColor="#38bdf8"
        roleBadge={
          mode === 'cardiac_arrest'
            ? 'Trainee J. Ellis · Fellow Trainee'
            : 'Trainee M. Santos · Triage Trainee'
        }
      />

      {/* 4. Multi-Patient Disaster Ambulance Threshold EMS Paramedic & Triage Officer (World Space) */}
      {mode === 'multi_patient_triage' && (
        <>
          <StandingHumanoid
            modelKey="responder_male"
            position={[2.85, 0, frontZ - 0.88]}
            patrolWaypoints={[
              [2.85, 0, frontZ - 0.88],
              [3.62, 0, frontZ - 1.12],
            ]}
            patrolPauseSec={5.6}
            patrolWalkSpeed={1.12}
            gazeTargetWorld={[-2.95, 1.58, frontZ - 0.92]}
            playerWorldPosRef={playerWorldPosRef}
            enablePlayerYield={true}
            isCommunicating={untriagedCount > 0}
            communicationLine={
              untriagedCount > 0
                ? `${untriagedCount} casualties awaiting START tag`
                : 'Ambulance bay clear for transport'
            }
            rotationY={Math.PI + 0.35}
            targetHeight={1.81}
            clip="idle"
            isPaused={isPaused}
            reducedMotion={reducedMotion}
            topColor="#1e293b"
            bottomColor="#0f172a"
            footwearColor="#090d16"
            topFabricStyle="ems_uniform_top"
            bottomFabricStyle="ems_trousers"
            footwearFabricStyle="medical_footwear"
            showBadge={true}
            wearVest={true}
            vestColor="#84cc16"
            wearGloves={true}
            gloveColor="#0ea5e9"
            carriedProp="med_kit"
            accentColor="#84cc16"
            roleBadge="Medic R. Alvarez · EMS Paramedic"
          />

          <StandingHumanoid
            modelKey="medic_female"
            position={[-2.95, 0, frontZ - 0.92]}
            patrolWaypoints={[
              [-2.95, 0, frontZ - 0.92],
              [-3.42, 0, frontZ - 1.32],
            ]}
            patrolPauseSec={5.1}
            patrolWalkSpeed={1.08}
            gazeTargetWorld={[2.85, 1.66, frontZ - 0.88]}
            playerWorldPosRef={playerWorldPosRef}
            enablePlayerYield={true}
            isCommunicating={Boolean(unexaminedImmediate)}
            communicationLine={
              unexaminedImmediate
                ? 'Priority 1 hemorrhage in Bay 01'
                : null
            }
            rotationY={Math.PI - 0.34}
            targetHeight={1.68}
            clip="examine"
            isPaused={isPaused}
            reducedMotion={reducedMotion}
            skinColor="#c68863"
            topColor="#1b3b5f"
            bottomColor="#0f172a"
            footwearColor="#0f172a"
            topFabricStyle="scrubs_top"
            bottomFabricStyle="scrubs_bottom"
            footwearFabricStyle="medical_footwear"
            showStethoscope={true}
            showBadge={true}
            wearVest={true}
            vestColor="#f59e0b"
            wearGloves={true}
            gloveColor="#38bdf8"
            carriedProp="clipboard"
            accentColor="#f59e0b"
            roleBadge="RN K. Morales · Triage Officer"
          />
        </>
      )}
    </group>
  );
}

/**
 * Complete Realistic Hospital Resuscitation & Disaster Triage Architectural Environment
 */
export const RealisticHospitalEnvironment: React.FC<{
  mode: ScenarioMode;
  environment: EnvironmentConfig;
  patients: PatientState[];
  playerWorldPosRef?: React.RefObject<THREE.Vector3 | null>;
  selectedObject: string;
  nearbyKey: string | null;
  isFirstPerson: boolean;
  isPaused: boolean;
  reducedMotion: boolean;
  bayPositions: [number, number, number][];
  onSelectStation: (target: StationSelectTarget) => void;
}> = ({
  mode,
  environment,
  patients,
  playerWorldPosRef,
  selectedObject,
  nearbyKey,
  isFirstPerson,
  isPaused,
  reducedMotion,
  bayPositions,
  onSelectStation,
}) => {
  const isTriage = mode === 'multi_patient_triage';
  const floorTex = useHospitalVinylFloorTexture(isTriage);
  const xrayTex = useDiagnosticXrayTexture();

  const roomW = mode === 'cardiac_arrest' ? 14 : 16;
  const roomD = mode === 'cardiac_arrest' ? 10.6 : 11.4;
  const halfW = roomW / 2;
  const backZ = mode === 'cardiac_arrest' ? -3.4 : -3.55;
  const frontZ = mode === 'cardiac_arrest' ? 5.25 : 5.65;

  const isEmergencyLight = environment.lightingMode === 'Emergency Backup';
  const trofferEmissive = isEmergencyLight ? '#f87171' : '#e0f2fe';

  return (
    <group>
      {/* Seamless Hospital Sheet-Vinyl Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, (backZ + frontZ) / 2]}
        receiveShadow
      >
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial
          map={floorTex}
          roughness={0.46}
          metalness={0.14}
        />
      </mesh>

      {/* Suspended Hospital Acoustic Ceiling + Recessed LED Troffers
          FrontSide facing downward: visible from inside First-Person, culled cleanly from overhead Orbit! */}
      <group position={[0, 3.88, (backZ + frontZ) / 2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial
            color="#0e1728"
            roughness={0.86}
            metalness={0.06}
            side={THREE.FrontSide}
          />
        </mesh>
        {(
          [
            [-4.2, -1.8],
            [0, -1.8],
            [4.2, -1.8],
            [-4.2, 1.9],
            [0, 1.9],
            [4.2, 1.9],
          ] as [number, number][]
        ).map(([tx, tz], idx) => (
          <mesh
            key={idx}
            position={[tx, -0.015, tz]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[1.55, 0.58]} />
            <meshStandardMaterial
              color="#f8fafc"
              emissive={trofferEmissive}
              emissiveIntensity={isEmergencyLight ? 0.5 : 0.9}
              side={THREE.FrontSide}
            />
          </mesh>
        ))}
      </group>

      {/* Articulated Dual-Head Surgical Boom Light above Resuscitation Bed */}
      {mode === 'cardiac_arrest' && (
        <SurgicalCeilingBoomLight
          position={[0.18, 3.58, -0.38]}
          isEmergencyLight={isEmergencyLight}
        />
      )}

      {/* Back Clinical Headwall + Coved Baseboard + Crash Rail + Brushed Aluminum Gas Manifold */}
      <mesh position={[0, 1.95, backZ]} receiveShadow>
        <boxGeometry args={[roomW, 3.9, 0.18]} />
        <meshStandardMaterial color="#121e33" roughness={0.72} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.08, backZ + 0.1]}>
        <boxGeometry args={[roomW, 0.16, 0.03]} />
        <meshStandardMaterial color="#0b1322" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.92, backZ + 0.11]}>
        <boxGeometry args={[roomW - 0.4, 0.15, 0.045]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.48} metalness={0.28} />
      </mesh>
      <mesh position={[0, 1.58, backZ + 0.11]}>
        <boxGeometry args={[roomW - 1.2, 0.24, 0.085]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.85} />
      </mesh>

      {/* Per-Bay Headwall Gas Outlets (O2 Green, Air Yellow, Vac White), Red Emergency Duplex Sockets & Suction Canisters */}
      {bayPositions.map(([bx], idx) => (
        <group key={idx} position={[bx, 1.58, backZ + 0.16]}>
          {/* Colour-Coded DISS Medical Gas Quick-Connects */}
          {[
            [-0.28, '#10b981'],
            [-0.18, '#eab308'],
            [-0.08, '#f8fafc'],
          ].map(([gx, col], gIdx) => (
            <mesh
              key={gIdx}
              position={[gx as number, 0.02, 0.01]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.022, 0.022, 0.035, 14]} />
              <meshStandardMaterial color={col as string} roughness={0.35} />
            </mesh>
          ))}

          {/* Hospital-Grade Red Emergency Power Duplex Receptacles */}
          {[0.12, 0.24].map((rx, rIdx) => (
            <mesh key={rIdx} position={[rx, -0.02, 0.008]}>
              <boxGeometry args={[0.065, 0.095, 0.018]} />
              <meshStandardMaterial color="#dc2626" roughness={0.4} />
            </mesh>
          ))}

          {/* Wall Vacuum Suction Canister + Regulator */}
          <group position={[0.42, -0.06, 0.04]}>
            <mesh>
              <cylinderGeometry args={[0.052, 0.046, 0.18, 16]} />
              <meshPhysicalMaterial
                color="#38bdf8"
                transparent
                opacity={0.62}
                roughness={0.15}
              />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.056, 0.056, 0.025, 16]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.35} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Pleated Fabric Privacy Curtains between Bays (and Beside Cardiac Bay) */}
      {isTriage ? (
        bayPositions.slice(0, -1).map(([bx], idx) => {
          const nextBx = bayPositions[idx + 1][0];
          return (
            <PleatedPrivacyCurtain
              key={idx}
              position={[(bx + nextBx) / 2, 0, -1.52]}
            />
          );
        })
      ) : (
        <PleatedPrivacyCurtain position={[-3.35, 0, -1.45]} lengthZ={1.15} />
      )}

      {/* Left Clinical Wall + Diagnostic Chest X-Ray Viewer + Stainless Scrub Sink + Parked Wheelchair */}
      <mesh position={[-halfW + 0.09, 1.95, (backZ + frontZ) / 2]} receiveShadow>
        <boxGeometry args={[0.18, 3.9, roomD]} />
        <meshStandardMaterial color="#0e1729" roughness={0.78} metalness={0.08} />
      </mesh>

      {/* Illuminated Chest X-Ray & Protocol Lightbox */}
      <group
        position={[-halfW + 0.2, 1.82, -0.65]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <mesh castShadow>
          <boxGeometry args={[1.42, 0.9, 0.06]} />
          <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.033]}>
          <planeGeometry args={[1.32, 0.8]} />
          <meshBasicMaterial map={xrayTex} />
        </mesh>
      </group>

      {/* Stainless Clinical Scrub Sink + Gooseneck Faucet + Hand Sanitizer Dispenser */}
      <group
        position={[-halfW + 0.36, 0.92, 1.45]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.68, 0.24, 0.46]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.22, -0.16]}>
          <torusGeometry args={[0.09, 0.014, 10, 20, Math.PI]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.16} metalness={0.95} />
        </mesh>
        {/* Wall Sanitizer Dispenser */}
        <mesh position={[0.48, 0.36, -0.18]}>
          <boxGeometry args={[0.12, 0.22, 0.1]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
      </group>

      {/* Clinical Wheelchair Parked Neatly Along Forward-Left Perimeter */}
      <ClinicalWheelchairProp
        position={[-halfW + 0.62, 0, 2.85]}
        rotationY={Math.PI * 0.42}
      />

      {/* Right Clinical Wall */}
      <mesh position={[halfW - 0.09, 1.95, (backZ + frontZ) / 2]} receiveShadow>
        <boxGeometry args={[0.18, 3.9, roomD]} />
        <meshStandardMaterial color="#0e1729" roughness={0.78} metalness={0.08} />
      </mesh>

      {/* Front Ambulance / Trauma Reception Wall & Doors */}
      <group position={[0, 0, frontZ]}>
        {/* Left & Right Wall Wings Flanking Trauma Entrance */}
        <mesh position={[-halfW * 0.62, 1.95, 0]} receiveShadow>
          <boxGeometry args={[roomW * 0.38, 3.9, 0.18]} />
          <meshStandardMaterial color="#0e1729" roughness={0.78} metalness={0.08} />
        </mesh>
        <mesh position={[halfW * 0.62, 1.95, 0]} receiveShadow>
          <boxGeometry args={[roomW * 0.38, 3.9, 0.18]} />
          <meshStandardMaterial color="#0e1729" roughness={0.78} metalness={0.08} />
        </mesh>
        <mesh position={[0, 3.35, 0]}>
          <boxGeometry args={[roomW * 0.26, 1.1, 0.18]} />
          <meshStandardMaterial color="#0e1729" roughness={0.78} metalness={0.08} />
        </mesh>

        {/* Illuminated Green Emergency Exit Sign */}
        <mesh position={[0, 2.94, -0.12]}>
          <boxGeometry args={[0.68, 0.2, 0.04]} />
          <meshStandardMaterial
            color="#065f46"
            emissive="#10b981"
            emissiveIntensity={0.75}
          />
        </mesh>

        {mode === 'cardiac_arrest' ? (
          /* Sliding Glass Trauma Bay Doors in Resuscitation Room */
          <group position={[0, 1.4, -0.05]}>
            {[-0.88, 0.88].map((dx, idx) => (
              <group key={idx} position={[dx, 0, 0]}>
                <mesh>
                  <boxGeometry args={[1.72, 2.78, 0.06]} />
                  <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.68} />
                </mesh>
                <mesh position={[0, 0.22, -0.035]}>
                  <planeGeometry args={[1.38, 1.65]} />
                  <meshPhysicalMaterial
                    color="#082f49"
                    transparent
                    opacity={0.72}
                    roughness={0.12}
                  />
                </mesh>
              </group>
            ))}
          </group>
        ) : (
          /* Open Mass-Casualty Ambulance Bay Threshold with Docked Ambulance, Stretcher & Paramedic */
          <DisasterAmbulanceBayThreshold
            frontZ={0}
            isPaused={isPaused}
            reducedMotion={reducedMotion}
          />
        )}
      </group>

      {/* Clinical Telemetry Control Workstation + Supporting Trainees & Clinical Staff */}
      <ClinicalControlWorkstationAndStaff
        mode={mode}
        backZ={backZ}
        frontZ={frontZ}
        halfW={halfW}
        patients={patients}
        environment={environment}
        bayPositions={bayPositions}
        playerWorldPosRef={playerWorldPosRef}
        isPaused={isPaused}
        reducedMotion={reducedMotion}
      />

      {/* INTERACTIVE STATION 1: Stocked Glass-Door Medical & Hemorrhage Supply Cabinet (Back-Left) */}
      <group
        position={[-3.1, 0, backZ + 0.34]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectStation('Emergency Supplies');
        }}
      >
        <ProximityGroundRing
          active={nearbyKey === 'station_supplies'}
          radius={0.78}
          position={[0, 0.015, 0.48]}
        />
        {/* Stainless Steel Supply Cabinet Frame */}
        <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 1.96, 0.38]} />
          <meshStandardMaterial
            color="#334155"
            roughness={0.35}
            metalness={0.62}
            emissive={
              selectedObject === 'Emergency Supplies' ||
              nearbyKey === 'station_supplies'
                ? '#06b6d4'
                : '#000000'
            }
            emissiveIntensity={0.28}
          />
        </mesh>
        {/* Interior Stocked Shelves */}
        {[0.65, 1.08, 1.52].map((sy, idx) => (
          <mesh key={idx} position={[0, sy, 0.04]}>
            <boxGeometry args={[1.12, 0.025, 0.3]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
          </mesh>
        ))}
        {/* Stocked Red CAT Hemorrhage Trauma Kits, Sterile Airway Trays & IV Bags */}
        {[-0.36, -0.08].map((kx, idx) => (
          <mesh key={idx} position={[kx, 1.22, 0.08]}>
            <boxGeometry args={[0.22, 0.22, 0.18]} />
            <meshStandardMaterial
              color={
                environment.resources.hemorrhageKits > idx ? '#dc2626' : '#475569'
              }
              roughness={0.45}
            />
          </mesh>
        ))}
        {[0.2, 0.42].map((bx, idx) => (
          <mesh key={idx} position={[bx, 1.2, 0.08]}>
            <boxGeometry args={[0.18, 0.18, 0.16]} />
            <meshStandardMaterial color="#0284c7" roughness={0.45} />
          </mesh>
        ))}
        {[-0.32, 0.0, 0.32].map((gx, idx) => (
          <mesh key={idx} position={[gx, 1.64, 0.08]}>
            <boxGeometry args={[0.24, 0.14, 0.14]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.4} />
          </mesh>
        ))}
        {/* Framed Tempered Glass Cabinet Doors + Chrome Handles */}
        {[-0.29, 0.29].map((dx, idx) => (
          <group key={idx} position={[dx, 1.15, 0.198]}>
            <mesh>
              <planeGeometry args={[0.52, 1.48]} />
              <meshPhysicalMaterial
                color="#bae6fd"
                transparent
                opacity={0.26}
                roughness={0.08}
              />
            </mesh>
            <mesh position={[idx === 0 ? 0.21 : -0.21, 0, 0.018]}>
              <cylinderGeometry args={[0.008, 0.008, 0.18, 8]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.18} />
            </mesh>
          </group>
        ))}

        {(!isFirstPerson || nearbyKey === 'station_supplies') && (
          <Html position={[0, 2.15, 0.15]} center distanceFactor={6.5} zIndexRange={[10, 0]}>
            <button
              type="button"
              onClick={() => onSelectStation('Emergency Supplies')}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border bg-[#082f49] text-cyan-100 border-cyan-400 shadow-lg"
            >
              {isFirstPerson && nearbyKey === 'station_supplies'
                ? `E — Trauma Kits (${environment.resources.hemorrhageKits})`
                : `Emergency Supplies (${environment.resources.hemorrhageKits})`}
            </button>
          </Html>
        )}
      </group>

      {/* INTERACTIVE STATION 2: Code Blue & Intercom Dispatch Wall Console */}
      <group
        position={[3.0, 1.48, backZ + 0.16]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectStation('Emergency Call Panel');
        }}
      >
        <ProximityGroundRing
          active={nearbyKey === 'station_code_blue'}
          radius={0.68}
          position={[0, -1.465, 0.55]}
        />
        <mesh castShadow>
          <boxGeometry args={[0.46, 0.58, 0.075]} />
          <meshStandardMaterial
            color="#e2e8f0"
            roughness={0.26}
            metalness={0.78}
            emissive={
              selectedObject === 'Emergency Call Panel' ||
              nearbyKey === 'station_code_blue'
                ? '#06b6d4'
                : '#000000'
            }
            emissiveIntensity={0.35}
          />
        </mesh>
        {/* Top Blue Code Beacon + Speaker Grille + Mushroom Code Blue Pushbutton */}
        <mesh position={[0, 0.21, 0.042]}>
          <boxGeometry args={[0.36, 0.07, 0.025]} />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#0ea5e9"
            emissiveIntensity={0.85}
          />
        </mesh>
        <mesh position={[0, 0.04, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.082, 0.032, 24]} />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#0284c7"
            emissiveIntensity={0.65}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[-0.1, -0.14, 0.044]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 18]} />
          <meshStandardMaterial color="#dc2626" roughness={0.35} />
        </mesh>
        <mesh position={[0.1, -0.14, 0.044]}>
          <boxGeometry args={[0.14, 0.1, 0.01]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>

        {(!isFirstPerson || nearbyKey === 'station_code_blue') && (
          <Html position={[0, 0.46, 0]} center distanceFactor={6.5} zIndexRange={[10, 0]}>
            <button
              type="button"
              onClick={() => onSelectStation('Emergency Call Panel')}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border bg-[#082f49] text-cyan-100 border-cyan-400 shadow-lg"
            >
              {isFirstPerson && nearbyKey === 'station_code_blue'
                ? 'E — Activate Code Blue'
                : 'Code Blue Panel'}
            </button>
          </Html>
        )}
      </group>

      {/* INTERACTIVE STATION 3: ICU / Surgical Trauma Transfer Double Doors (Right Wall) */}
      <group
        position={[halfW - 0.16, 1.38, 0.4]}
        rotation={[0, -Math.PI / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectStation('Bay Exit Doors');
        }}
      >
        <ProximityGroundRing
          active={nearbyKey === 'station_exit_doors'}
          radius={0.78}
          position={[0, -1.365, 0.55]}
        />
        <mesh castShadow>
          <boxGeometry args={[2.04, 2.72, 0.08]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.58} />
        </mesh>
        {[-0.48, 0.48].map((dx, idx) => (
          <group key={idx} position={[dx, 0, 0.045]}>
            {/* Vision Lite Window */}
            <mesh position={[0, 0.42, 0]}>
              <planeGeometry args={[0.42, 0.78]} />
              <meshPhysicalMaterial
                color="#082f49"
                transparent
                opacity={0.78}
                roughness={0.12}
              />
            </mesh>
            {/* Stainless Stretcher Kickplate & Push Bar */}
            <mesh position={[0, -0.82, 0.005]}>
              <planeGeometry args={[0.88, 0.68]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.24} metalness={0.88} />
            </mesh>
            <mesh position={[0, -0.05, 0.025]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, 0.68, 12]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.92} />
            </mesh>
          </group>
        ))}

        {/* Physical Gurney / Hazard Obstruction Bar when Exit Blocked */}
        {!environment.exitClear && (
          <group position={[0, -0.25, 0.26]}>
            <mesh castShadow>
              <boxGeometry args={[1.82, 0.16, 0.16]} />
              <meshStandardMaterial
                color="#f59e0b"
                emissive="#d97706"
                emissiveIntensity={0.55}
              />
            </mesh>
          </group>
        )}

        {(!environment.exitClear || nearbyKey === 'station_exit_doors') && (
          <Html position={[0, 1.18, 0.1]} center distanceFactor={7} zIndexRange={[10, 0]}>
            <button
              type="button"
              onClick={() => onSelectStation('Bay Exit Doors')}
              className="px-2.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap bg-amber-950/95 text-amber-200 border border-amber-500"
            >
              {environment.exitClear
                ? 'Transfer Corridor Clear'
                : 'Exit Obstructed · Reroute'}
            </button>
          </Html>
        )}
      </group>
    </group>
  );
};

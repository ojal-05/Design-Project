import React, { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PatientState } from '../../../types/simulation';
import { immersiveAudio } from '../../../utils/immersiveAudioEngine';

/**
 * Shared helper: Creates a beveled rounded rectangular prism geometry centered on X/Y/Z.
 */
function useRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.025,
  bevelSize = 0.01
) {
  return useMemo(() => {
    const w = width - bevelSize * 2;
    const h = height - bevelSize * 2;
    const r = Math.min(radius, w * 0.45, h * 0.45);
    const shape = new THREE.Shape();
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
      depth: Math.max(0.01, depth - bevelSize * 2),
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize,
      bevelThickness: bevelSize,
    });
    geom.center();
    return geom;
  }, [width, height, depth, radius, bevelSize]);
}

export function ProximityGroundRing({
  active,
  radius = 0.72,
  position = [0, 0.015, 0],
}: {
  active: boolean;
  radius?: number;
  position?: [number, number, number];
}) {
  if (!active) return null;
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.055, radius, 44]} />
      <meshBasicMaterial
        color="#22d3ee"
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

/**
 * Dual-Wheel Medical Caster Assembly (Swivel Fork + Twin Polyurethane Wheels + Brake Tab)
 */
function MedicalCaster({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      {/* Swivel Stem & Fork */}
      <mesh position={[0, 0.072, 0]}>
        <cylinderGeometry args={[0.02, 0.024, 0.04, 12]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.048, -0.008]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.052, 0.036, 0.034]} />
        <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Twin Polyurethane Wheels */}
      {[-0.018, 0.018].map((wx, idx) => (
        <mesh
          key={idx}
          position={[wx, 0.034, -0.012]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.034, 0.034, 0.012, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.72} metalness={0.15} />
        </mesh>
      ))}
      {/* Red Locking Brake Pedal */}
      <mesh position={[0, 0.05, 0.022]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.024, 0.008, 0.03]} />
        <meshStandardMaterial color="#dc2626" roughness={0.45} />
      </mesh>
    </group>
  );
}

/**
 * Realistic Articulated Hospital Resuscitation Bed with:
 * - Hydraulic base frame, foot pedals & 4 dual-wheel casters
 * - Contoured beveled pressure-relief mattress + articulated Fowler backrest
 * - Molded ABS headboard/footboard with ergonomic grip cutouts & corner bumpers
 * - Split collapsible aluminum safety side rails with latch handles
 * - Telescopic IV stand, translucent saline bag, volumetric IV infusion pump & curved IV line
 */
export const RealisticHospitalBed: React.FC<{
  fowlerAngleRad: number;
  triageColor: string;
  showTriagePlacard: boolean;
  bedHighlightHex: string;
  dropRightFootRail?: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: () => void;
}> = ({
  fowlerAngleRad,
  triageColor,
  showTriagePlacard,
  bedHighlightHex,
  dropRightFootRail = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const lowerMattressGeom = useRoundedBoxGeometry(1.06, 0.14, 1.24, 0.04, 0.018);
  const fowlerMattressGeom = useRoundedBoxGeometry(1.06, 0.135, 0.82, 0.04, 0.018);
  const pillowGeom = useRoundedBoxGeometry(0.64, 0.085, 0.34, 0.035, 0.02);
  const boardGeom = useRoundedBoxGeometry(1.16, 0.44, 0.055, 0.04, 0.012);

  const ivLineCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.63, 1.72, -0.88),
        new THREE.Vector3(-0.63, 1.44, -0.88),
        new THREE.Vector3(-0.56, 1.18, -0.62),
        new THREE.Vector3(-0.34, 0.96, -0.18),
      ]),
    []
  );

  return (
    <group
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* 4 Dual-Wheel Locking Hospital Casters */}
      <MedicalCaster position={[-0.5, 0, -0.94]} />
      <MedicalCaster position={[0.5, 0, -0.94]} />
      <MedicalCaster position={[-0.5, 0, 0.94]} />
      <MedicalCaster position={[0.5, 0, 0.94]} />

      {/* Undercarriage Base H-Frame + Central Hydraulic Lift Column */}
      <mesh position={[0, 0.13, 0]} castShadow>
        <boxGeometry args={[0.92, 0.055, 1.88]} />
        <meshStandardMaterial color="#334155" roughness={0.42} metalness={0.68} />
      </mesh>
      <mesh position={[-0.48, 0.13, 0]}>
        <boxGeometry args={[0.07, 0.055, 1.96]} />
        <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.75} />
      </mesh>
      <mesh position={[0.48, 0.13, 0]}>
        <boxGeometry args={[0.07, 0.055, 1.96]} />
        <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* Dual Telescoping Hydraulic Columns with Rubber Bellows */}
      {[-0.48, 0.48].map((cz, idx) => (
        <group key={idx} position={[0, 0.4, cz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.085, 0.095, 0.48, 18]} />
            <meshStandardMaterial color="#1e293b" roughness={0.68} metalness={0.25} />
          </mesh>
          {/* Scissor Stabilizer Strut */}
          <mesh position={[0.24, 0, 0]} rotation={[0, 0, 0.45]}>
            <boxGeometry args={[0.03, 0.5, 0.04]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[-0.24, 0, 0]} rotation={[0, 0, -0.45]}>
            <boxGeometry args={[0.03, 0.5, 0.04]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Nurse Foot-Control Hydraulic Pedals (Green Steer / Red Brake) */}
      <mesh position={[0.53, 0.14, 0.22]}>
        <boxGeometry args={[0.09, 0.018, 0.08]} />
        <meshStandardMaterial color="#10b981" roughness={0.4} />
      </mesh>
      <mesh position={[0.53, 0.14, 0.34]}>
        <boxGeometry args={[0.09, 0.018, 0.08]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} />
      </mesh>

      {/* Main Powder-Coated Upper Bed Deck Chassis */}
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.14, 0.07, 2.14]} />
        <meshStandardMaterial
          color="#64748b"
          roughness={0.32}
          metalness={0.72}
          emissive={bedHighlightHex}
          emissiveIntensity={0.24}
        />
      </mesh>

      {/* 4 Corner Rotating Wall-Protection Bumpers */}
      {(
        [
          [-0.58, -1.07],
          [0.58, -1.07],
          [-0.58, 1.07],
          [0.58, 1.07],
        ] as [number, number][]
      ).map(([bx, bz], idx) => (
        <mesh key={idx} position={[bx, 0.68, bz]}>
          <cylinderGeometry args={[0.045, 0.045, 0.045, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.75} />
        </mesh>
      ))}

      {/* Lower Contoured Pressure-Relief Mattress Section */}
      <mesh geometry={lowerMattressGeom} position={[0, 0.785, 0.42]} castShadow receiveShadow>
        <meshStandardMaterial
          color="#1e3a5f"
          roughness={0.62}
          metalness={0.06}
          emissive={bedHighlightHex}
          emissiveIntensity={0.16}
        />
      </mesh>

      {/* Articulated Fowler Head-of-Bed Mattress + Pillow */}
      <group position={[0, 0.785, -0.2]} rotation={[fowlerAngleRad, 0, 0]}>
        <mesh
          geometry={fowlerMattressGeom}
          position={[0, 0, -0.41]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#1e3a5f"
            roughness={0.62}
            metalness={0.06}
            emissive={bedHighlightHex}
            emissiveIntensity={0.16}
          />
        </mesh>
        {/* Crisp White Fitted Top Sheet */}
        <mesh position={[0, 0.071, -0.41]}>
          <boxGeometry args={[1.02, 0.008, 0.78]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.86} />
        </mesh>
        {/* Contoured Clinical Pillow */}
        <mesh geometry={pillowGeom} position={[0, 0.105, -0.6]} castShadow>
          <meshStandardMaterial color="#f8fafc" roughness={0.82} />
        </mesh>
      </group>

      {/* Crisp Fitted Clinical Bottom Sheet (Leaves patient's full legs, knees & footwear 100% unobstructed) */}
      <mesh position={[0, 0.858, 0.42]}>
        <boxGeometry args={[1.02, 0.008, 1.2]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.86} />
      </mesh>
      {/* Sleek Folded Linen Runner Tucked Neatly Against Footboard */}
      <mesh position={[0, 0.868, 0.985]}>
        <boxGeometry args={[1.02, 0.02, 0.11]} />
        <meshStandardMaterial color="#0284c7" roughness={0.78} />
      </mesh>

      {/* Molded ABS Headboard & Footboard with Blue Clinical Trim Panels */}
      <group position={[0, 0.93, -1.09]}>
        <mesh geometry={boardGeom} castShadow>
          <meshStandardMaterial color="#e2e8f0" roughness={0.38} metalness={0.12} />
        </mesh>
        <mesh position={[0, -0.02, 0.03]}>
          <planeGeometry args={[0.84, 0.22]} />
          <meshStandardMaterial color="#0369a1" roughness={0.45} />
        </mesh>
        {/* Ergonomic Push-Handle Bar */}
        <mesh position={[0, 0.15, 0.03]}>
          <boxGeometry args={[0.62, 0.03, 0.02]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.6} />
        </mesh>
      </group>

      <group position={[0, 0.88, 1.09]}>
        <mesh geometry={boardGeom} scale={[1, 0.84, 1]} castShadow>
          <meshStandardMaterial color="#e2e8f0" roughness={0.38} metalness={0.12} />
        </mesh>
        <mesh position={[0, -0.02, -0.03]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.84, 0.18]} />
          <meshStandardMaterial color="#0369a1" roughness={0.45} />
        </mesh>
        {/* Footboard Chart / Triage Priority Placard */}
        {showTriagePlacard && (
          <mesh position={[0, 0.21, 0.03]}>
            <boxGeometry args={[0.54, 0.13, 0.028]} />
            <meshStandardMaterial
              color={triageColor}
              emissive={triageColor}
              emissiveIntensity={0.42}
              roughness={0.35}
            />
          </mesh>
        )}
      </group>

      {/* Split Collapsible Safety Side Rails (Head & Foot Sections, Left & Right) */}
      {[-0.575, 0.575].map((rx, sideIdx) => (
        <group key={sideIdx} position={[rx, 0, 0]}>
          {[-0.44, 0.38].map((rz, secIdx) => {
            const isDropped = dropRightFootRail && sideIdx === 1 && secIdx === 1;
            return (
              <group
                key={secIdx}
                position={[0, isDropped ? 0.56 : 0.92, rz]}
              >
              {/* Top & Bottom Moulded Rail Bars */}
              <mesh position={[0, 0.095, 0]} castShadow>
                <boxGeometry args={[0.032, 0.042, 0.68]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.32} metalness={0.45} />
              </mesh>
              <mesh position={[0, -0.085, 0]}>
                <boxGeometry args={[0.028, 0.032, 0.66]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.65} />
              </mesh>
              {/* Vertical Rail Spindles */}
              {[-0.24, -0.08, 0.08, 0.24].map((sz, spIdx) => (
                <mesh key={spIdx} position={[0, 0.005, sz]}>
                  <cylinderGeometry args={[0.009, 0.009, 0.16, 8]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.82} />
                </mesh>
              ))}
              {/* Blue Quick-Release Drop Latch */}
              <mesh position={[sideIdx === 0 ? -0.018 : 0.018, -0.085, 0]}>
                <boxGeometry args={[0.012, 0.03, 0.09]} />
                <meshStandardMaterial color="#0284c7" roughness={0.4} />
              </mesh>
            </group>
            );
          })}
        </group>
      ))}

      {/* Telescoping Stainless IV Pole + Volumetric Infusion Pump + Saline Drip Bag + IV Line */}
      <group position={[-0.63, 0, -0.88]}>
        <mesh position={[0, 1.32, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.015, 1.36, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.92} />
        </mesh>
        {/* Top Dual Ram's-Horn IV Hooks */}
        <mesh position={[0.04, 1.98, 0]} rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.035, 0.004, 6, 14, Math.PI * 1.3]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Translucent 1000mL 0.9% NaCl IV Bag + Drip Chamber */}
        <mesh position={[0.04, 1.84, 0]}>
          <capsuleGeometry args={[0.042, 0.11, 8, 14]} />
          <meshPhysicalMaterial
            color="#bae6fd"
            transparent
            opacity={0.62}
            roughness={0.14}
            metalness={0.05}
          />
        </mesh>
        <mesh position={[0.04, 1.72, 0]}>
          <cylinderGeometry args={[0.009, 0.009, 0.045, 10]} />
          <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.7} roughness={0.1} />
        </mesh>
        {/* Clamped Volumetric IV Infusion Pump */}
        <group position={[0.02, 1.42, 0.02]} rotation={[0, 0.35, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.13, 0.18, 0.11]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.025, 0.057]}>
            <planeGeometry args={[0.09, 0.055]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          <mesh position={[0.035, -0.04, 0.057]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshStandardMaterial
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={0.85}
            />
          </mesh>
        </group>
      </group>

      {/* Curved Clear IV Infusion Line to Patient Bedside */}
      <mesh>
        <tubeGeometry args={[ivLineCurve, 22, 0.0032, 6, false]} />
        <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.65} roughness={0.2} />
      </mesh>
    </group>
  );
};

/**
 * Generates high-resolution multi-parameter bedside clinical monitor CanvasTexture.
 */
function useDetailedMonitorTexture(patient: PatientState) {
  const { gl } = useThree();
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#040811';
      ctx.fillRect(0, 0, 640, 400);

      // Subtle clinical gridlines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 1;
      for (let gx = 16; gx < 430; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 48);
        ctx.lineTo(gx, 360);
        ctx.stroke();
      }
      for (let gy = 56; gy < 360; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(16, gy);
        ctx.lineTo(430, gy);
        ctx.stroke();
      }

      // Header Banner
      const isCrit =
        patient.conditionStatus === 'Arrest' ||
        patient.conditionStatus === 'Critical';
      ctx.fillStyle = isCrit ? '#7f1d1d' : '#0c2d48';
      ctx.fillRect(0, 0, 640, 44);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(
        `ADULT ICU/TRAUMA · ${patient.patientId} · ${patient.conditionStatus.toUpperCase()}`,
        16,
        28
      );

      // Lead II ECG Waveform
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`II  1mV  ${patient.cardiacRhythm}`, 18, 66);
      ctx.strokeStyle =
        patient.conditionStatus === 'Arrest' ? '#ef4444' : '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, 112);
      for (let x = 16; x < 424; x += 5) {
        let y = 112;
        if (patient.cardiacRhythm === 'VFib') {
          y = 112 + Math.sin(x * 0.36) * 24 + Math.cos(x * 0.78) * 14;
        } else if (patient.cardiacRhythm === 'Sinus Tachycardia') {
          const tc = x % 44;
          if (tc === 18) y = 66;
          else if (tc === 22) y = 132;
          else if (tc === 30) y = 96;
        } else if (patient.heartRate > 0) {
          const c = x % 70;
          if (c === 15) y = 102;
          else if (c === 25) y = 120;
          else if (c === 30) y = 62;
          else if (c === 35) y = 134;
          else if (c === 50) y = 96;
        }
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // SpO2 Plethysmograph Waveform
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('PLETH  PERF 3.4', 18, 174);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(16, 224);
      for (let x = 16; x < 424; x += 5) {
        const y =
          patient.spo2 > 75 && patient.heartRate > 0
            ? 224 - Math.pow(Math.max(0, Math.sin(x * 0.085)), 2) * 32
            : 224 + Math.sin(x * 0.05) * 3;
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Capnography / Resp Waveform
      ctx.fillStyle = '#fde047';
      ctx.fillText('RESP / EtCO2', 18, 276);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(16, 330);
      for (let x = 16; x < 424; x += 6) {
        const phase = (x % 96) / 96;
        const y =
          patient.respiratoryRate > 0
            ? phase > 0.22 && phase < 0.72
              ? 296
              : 330
            : 330;
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Right-Column Numeric Telemetry Boxes
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.strokeRect(442, 52, 184, 98);
      ctx.strokeRect(442, 158, 184, 98);
      ctx.strokeRect(442, 264, 184, 108);

      // HR
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('HR (bpm)', 454, 72);
      ctx.font = 'bold 52px monospace';
      ctx.fillText(
        patient.heartRate > 0 ? `${patient.heartRate}` : '---',
        454,
        130
      );

      // SpO2
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('SpO2 (%)', 454, 178);
      ctx.font = 'bold 48px monospace';
      ctx.fillText(`${patient.spo2}`, 454, 236);

      // NIBP & RR
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('NIBP (mmHg)', 454, 284);
      ctx.font = 'bold 32px monospace';
      ctx.fillText(
        patient.systolicBP > 0
          ? `${patient.systolicBP}/${patient.diastolicBP}`
          : '---/---',
        454,
        324
      );
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`RR ${patient.respiratoryRate} /min`, 454, 356);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    return tex;
  }, [
    gl,
    patient.patientId,
    patient.conditionStatus,
    patient.cardiacRhythm,
    patient.heartRate,
    patient.spo2,
    patient.systolicBP,
    patient.diastolicBP,
    patient.respiratoryRate,
  ]);
}

/**
 * Multi-Part Clinical Patient Telemetry Monitor on 5-Star Rolling Stand with Sensor Leads
 */
export const RealisticPatientMonitor: React.FC<{
  patient: PatientState;
  position: [number, number, number];
  isSelected: boolean;
  isNearby: boolean;
  isFirstPerson: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}> = ({
  patient,
  position,
  isSelected,
  isNearby,
  isFirstPerson,
  reducedMotion,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const alarmLampRef = useRef<THREE.MeshStandardMaterial>(null);
  const screenTex = useDetailedMonitorTexture(patient);
  const bezelGeom = useRoundedBoxGeometry(0.68, 0.46, 0.095, 0.03, 0.012);
  const highlight = isSelected || isNearby || hovered ? '#06b6d4' : '#000000';

  const isAlarm =
    patient.conditionStatus === 'Arrest' ||
    patient.conditionStatus === 'Critical';

  useFrame((state) => {
    if (!alarmLampRef.current) return;
    if (isAlarm && !reducedMotion) {
      const pulse = 0.35 + Math.abs(Math.sin(state.clock.getElapsedTime() * 5.2)) * 1.1;
      alarmLampRef.current.emissiveIntensity = pulse;
    } else {
      alarmLampRef.current.emissiveIntensity = isAlarm ? 0.9 : 0.45;
    }
  });

  const leadCurveA = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.33, 1.38, -0.02),
        new THREE.Vector3(-0.46, 1.12, 0.08),
        new THREE.Vector3(-0.62, 0.92, 0.25),
      ]),
    []
  );
  const leadCurveB = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.33, 1.32, 0.01),
        new THREE.Vector3(-0.42, 1.04, 0.14),
        new THREE.Vector3(-0.58, 0.89, 0.34),
      ]),
    []
  );

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ProximityGroundRing active={isNearby} radius={0.62} />

      {/* 5-Star Weighted Pedestal Legs + Twin Casters */}
      {[0, 1, 2, 3, 4].map((idx) => {
        const ang = (idx * Math.PI * 2) / 5;
        return (
          <group key={idx} rotation={[0, ang, 0]}>
            <mesh position={[0, 0.075, 0.16]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[0.042, 0.028, 0.32]} />
              <meshStandardMaterial color="#334155" roughness={0.42} metalness={0.68} />
            </mesh>
            <MedicalCaster position={[0, 0, 0.3]} scale={0.72} />
          </group>
        );
      })}

      {/* Telescoping Chrome Support Column */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.036, 0.042, 0.72, 16]} />
        <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.75} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.028, 0.68, 16]} />
        <meshStandardMaterial
          color="#e2e8f0"
          roughness={0.2}
          metalness={0.9}
          emissive={highlight}
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Utility Wire Basket + Coiled NIBP Cuff */}
      <group position={[0, 0.86, 0.09]}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.13, 0.2]} />
          <meshStandardMaterial
            color="#94a3b8"
            roughness={0.35}
            metalness={0.7}
            wireframe={false}
          />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.12, 14]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.68} />
        </mesh>
      </group>

      {/* Articulated Monitor Head Unit */}
      <group position={[0, 1.46, 0]} rotation={[-0.06, -0.35, 0]}>
        <mesh geometry={bezelGeom} castShadow>
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.36}
            metalness={0.38}
            emissive={highlight}
            emissiveIntensity={0.26}
          />
        </mesh>

        {/* Moulded Top Carry Handle */}
        <mesh position={[0, 0.255, -0.01]}>
          <boxGeometry args={[0.22, 0.026, 0.035]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Alarm Beacon Dome */}
        <mesh position={[0, 0.238, 0.02]}>
          <boxGeometry args={[0.24, 0.024, 0.038]} />
          <meshStandardMaterial
            ref={alarmLampRef}
            color={isAlarm ? '#ef4444' : '#10b981'}
            emissive={isAlarm ? '#ef4444' : '#10b981'}
            emissiveIntensity={0.75}
            roughness={0.2}
          />
        </mesh>

        {/* Live Telemetry LCD Screen */}
        <mesh position={[-0.015, 0.018, 0.049]}>
          <planeGeometry args={[0.58, 0.355]} />
          <meshBasicMaterial map={screenTex} />
        </mesh>

        {/* Tactile Rotary Trim Knob + Softkey Buttons */}
        <mesh
          position={[0.275, -0.18, 0.055]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.024, 18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
        {[-0.22, -0.14, -0.06, 0.02, 0.1].map((bx, i) => (
          <mesh key={i} position={[bx, -0.188, 0.05]}>
            <boxGeometry args={[0.048, 0.018, 0.01]} />
            <meshStandardMaterial
              color="#334155"
              emissive="#38bdf8"
              emissiveIntensity={0.25}
            />
          </mesh>
        ))}

        {/* Side Sensor Connector Module Jacks (ECG Green, SpO2 Blue, NIBP Grey) */}
        <mesh position={[-0.345, 0.02, 0]}>
          <boxGeometry args={[0.02, 0.24, 0.06]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} />
        </mesh>
        {[
          [0.06, '#10b981'],
          [0.0, '#38bdf8'],
          [-0.06, '#94a3b8'],
        ].map(([py, col], idx) => (
          <mesh
            key={idx}
            position={[-0.36, py as number, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.02, 10]} />
            <meshStandardMaterial color={col as string} roughness={0.35} />
          </mesh>
        ))}
      </group>

      {/* Patient Sensor Cables Draping Toward Resuscitation Bed */}
      <mesh>
        <tubeGeometry args={[leadCurveA, 18, 0.0045, 6, false]} />
        <meshStandardMaterial color="#10b981" roughness={0.5} />
      </mesh>
      <mesh>
        <tubeGeometry args={[leadCurveB, 18, 0.0045, 6, false]} />
        <meshStandardMaterial color="#0284c7" roughness={0.5} />
      </mesh>

      {(!isFirstPerson || isNearby) && (
        <Html position={[0, 1.9, 0]} center distanceFactor={6.5} zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={onSelect}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border bg-[#082f49] text-cyan-100 border-cyan-400 shadow-lg"
          >
            {isFirstPerson && isNearby ? 'E — Check Monitor' : 'Patient Monitor'}
          </button>
        </Html>
      )}
    </group>
  );
};

/**
 * Generates live AED Defibrillator LCD display CanvasTexture.
 */
function useAedScreenTexture(
  isOperational: boolean,
  poweredOn: boolean,
  padsAttached: boolean,
  shockAdvised: boolean
) {
  const { gl } = useThree();
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 200;
    const ctx = c.getContext('2d');
    if (ctx) {
      if (!isOperational) {
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(0, 0, 320, 200);
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('! CAPACITOR FAULT !', 32, 72);
        ctx.font = '15px monospace';
        ctx.fillText('UNIT OUT OF SERVICE', 56, 110);
        ctx.fillText('USE CRASH TROLLEY BACKUP', 38, 142);
      } else if (!poweredOn) {
        ctx.fillStyle = '#09131f';
        ctx.fillRect(0, 0, 320, 200);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('BIPHASIC AED READY', 58, 86);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px monospace';
        ctx.fillText('PRESS GREEN POWER KEY', 56, 122);
      } else if (!padsAttached) {
        ctx.fillStyle = '#082f49';
        ctx.fillRect(0, 0, 320, 200);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('APPLY PADS TO CHEST', 42, 54);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(110, 76, 100, 96);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(122, 88, 24, 30);
        ctx.fillRect(172, 126, 24, 30);
      } else if (shockAdvised) {
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(0, 0, 320, 200);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('SHOCK ADVISED 200J', 34, 52);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(20, 110);
        for (let x = 20; x < 300; x += 6) {
          ctx.lineTo(x, 110 + Math.sin(x * 0.45) * 24);
        }
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('STAND CLEAR · PRESS SHOCK', 26, 174);
      } else {
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, 320, 200);
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('PADS CONNECTED · 200J', 36, 56);
        ctx.fillStyle = '#ffffff';
        ctx.font = '15px monospace';
        ctx.fillText('ANALYZE RHYTHM OR', 68, 108);
        ctx.fillText('PERFORM 30:2 CPR', 72, 138);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    return tex;
  }, [gl, isOperational, poweredOn, padsAttached, shockAdvised]);
}

/**
 * Contoured Biphasic AED / Manual Defibrillator Unit on Stainless Mobile Cart
 */
export const RealisticAedDefibrillator: React.FC<{
  position: [number, number, number];
  isOperational: boolean;
  poweredOn: boolean;
  padsAttached: boolean;
  shockAdvised: boolean;
  isSelected: boolean;
  isNearby: boolean;
  isFirstPerson: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}> = ({
  position,
  isOperational,
  poweredOn,
  padsAttached,
  shockAdvised,
  isSelected,
  isNearby,
  isFirstPerson,
  reducedMotion,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const shockBtnMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const aedBodyGeom = useRoundedBoxGeometry(0.36, 0.22, 0.29, 0.038, 0.015);
  const screenTex = useAedScreenTexture(
    isOperational,
    poweredOn,
    padsAttached,
    shockAdvised
  );
  const highlight = isSelected || isNearby || hovered ? '#06b6d4' : '#000000';

  useFrame((state) => {
    if (!shockBtnMatRef.current) return;
    if (shockAdvised && isOperational && !reducedMotion) {
      shockBtnMatRef.current.emissiveIntensity =
        0.45 + Math.abs(Math.sin(state.clock.getElapsedTime() * 7)) * 1.25;
    } else {
      shockBtnMatRef.current.emissiveIntensity = shockAdvised ? 1.0 : 0.18;
    }
  });

  const coiledCableRed = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.14, 0.02, 0.14),
        new THREE.Vector3(-0.22, -0.05, 0.18),
        new THREE.Vector3(-0.24, -0.1, 0.06),
        new THREE.Vector3(-0.18, -0.1, -0.06),
      ]),
    []
  );

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ProximityGroundRing active={isNearby} radius={0.62} />

      {/* Stainless Steel Mobile Defibrillator Cart */}
      {(
        [
          [-0.27, -0.21],
          [0.27, -0.21],
          [-0.27, 0.21],
          [0.27, 0.21],
        ] as [number, number][]
      ).map(([lx, lz], idx) => (
        <group key={idx} position={[lx, 0, lz]}>
          <MedicalCaster position={[0, 0, 0]} scale={0.68} />
          <mesh position={[0, 0.44, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.78, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Lower Supply Shelf + Spare Electrode Foil Packet & Prep Kit */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[0.58, 0.032, 0.46]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.24} metalness={0.85} />
      </mesh>
      <mesh position={[-0.1, 0.39, 0.02]} rotation={[0, 0.18, 0]}>
        <boxGeometry args={[0.22, 0.028, 0.26]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>
      <mesh position={[0.15, 0.41, -0.02]}>
        <boxGeometry args={[0.16, 0.07, 0.18]} />
        <meshStandardMaterial color="#0284c7" roughness={0.5} />
      </mesh>

      {/* Rimmed Stainless Top Tray */}
      <mesh position={[0, 0.83, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.038, 0.5]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.88} />
      </mesh>
      <mesh position={[0, 0.865, -0.24]}>
        <boxGeometry args={[0.62, 0.04, 0.02]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Contoured Biphasic AED / Defibrillator Unit */}
      <group position={[0, 0.97, 0]} rotation={[0, 0.28, 0]}>
        <mesh geometry={aedBodyGeom} castShadow>
          <meshStandardMaterial
            color={isOperational ? '#ea580c' : '#475569'}
            roughness={0.38}
            metalness={0.18}
            emissive={highlight}
            emissiveIntensity={0.26}
          />
        </mesh>

        {/* Protective Black Elastomer Side Shock Bumpers */}
        {[-0.175, 0.175].map((bx, i) => (
          <mesh key={i} position={[bx, -0.01, 0]}>
            <boxGeometry args={[0.036, 0.23, 0.3]} />
            <meshStandardMaterial color="#0f172a" roughness={0.82} metalness={0.08} />
          </mesh>
        ))}

        {/* Integrated Moulded Carrying Handle */}
        <group position={[0, 0.135, -0.06]}>
          <mesh>
            <boxGeometry args={[0.22, 0.026, 0.042]} />
            <meshStandardMaterial color="#0f172a" roughness={0.7} />
          </mesh>
          <mesh position={[-0.09, -0.02, 0]}>
            <boxGeometry args={[0.028, 0.035, 0.038]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </mesh>
          <mesh position={[0.09, -0.02, 0]}>
            <boxGeometry args={[0.028, 0.035, 0.038]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </mesh>
        </group>

        {/* Recessed Tilted AED LCD Screen */}
        <mesh position={[-0.035, 0.022, 0.148]}>
          <planeGeometry args={[0.195, 0.122]} />
          <meshBasicMaterial map={screenTex} />
        </mesh>

        {/* Green Power Button, Blue Analyze Button & Flashing Shock Button */}
        <mesh position={[0.105, 0.062, 0.148]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.016, 16]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={poweredOn ? 0.85 : 0.25}
          />
        </mesh>
        <mesh position={[0.105, 0.015, 0.148]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.016, 16]} />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#38bdf8"
            emissiveIntensity={padsAttached ? 0.55 : 0.15}
          />
        </mesh>
        <mesh position={[0.105, -0.042, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.028, 0.02, 18]} />
          <meshStandardMaterial
            ref={shockBtnMatRef}
            color="#ef4444"
            emissive="#f97316"
            emissiveIntensity={0.25}
          />
        </mesh>

        {/* Orange Defibrillator Cable Connector & Coiled Lead */}
        <mesh position={[-0.14, 0.02, 0.146]}>
          <boxGeometry args={[0.034, 0.042, 0.024]} />
          <meshStandardMaterial color="#f97316" roughness={0.4} />
        </mesh>
        <mesh>
          <tubeGeometry args={[coiledCableRed, 20, 0.0055, 6, false]} />
          <meshStandardMaterial color="#dc2626" roughness={0.48} />
        </mesh>
      </group>

      {(!isFirstPerson || isNearby || !isOperational) && (
        <Html position={[0, 1.38, 0]} center distanceFactor={6.5} zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={onSelect}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border shadow-lg ${
              !isOperational
                ? 'bg-red-950/95 text-red-200 border-red-500'
                : 'bg-[#082f49] text-cyan-100 border-cyan-400'
            }`}
          >
            {!isOperational
              ? 'AED Fault — Check Trolley'
              : isFirstPerson && isNearby
              ? 'E — Operate AED'
              : 'AED Device'}
          </button>
        </Html>
      )}
    </group>
  );
};

/**
 * 5-Drawer Resuscitation Crash Cart with Animated Sliding Top Airway/Drug Drawer,
 * Side Push Handle, Yellow Biohazard Sharps Bin, Rear Cardiac Board & BVM Resuscitator
 */
export const RealisticCrashTrolley: React.FC<{
  position: [number, number, number];
  isSelected: boolean;
  isNearby: boolean;
  isFirstPerson: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}> = ({
  position,
  isSelected,
  isNearby,
  isFirstPerson,
  reducedMotion,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const topDrawerRef = useRef<THREE.Group>(null);
  const drawerProgressRef = useRef(0);
  const bodyGeom = useRoundedBoxGeometry(0.78, 0.86, 0.5, 0.025, 0.012);
  const highlight = isSelected || isNearby || hovered ? '#06b6d4' : '#000000';

  const drawerWasOpenRef = useRef(false);
  const shouldOpenDrawer = isNearby || isSelected || hovered;
  if (shouldOpenDrawer !== drawerWasOpenRef.current) {
    drawerWasOpenRef.current = shouldOpenDrawer;
    if (shouldOpenDrawer) {
      immersiveAudio.playActionSound('drawer_open', position);
    }
  }

  useFrame((_state, rawDelta) => {
    if (!topDrawerRef.current) return;
    const targetZ = shouldOpenDrawer ? 0.24 : 0;
    if (reducedMotion) {
      drawerProgressRef.current = targetZ;
    } else {
      drawerProgressRef.current = THREE.MathUtils.damp(
        drawerProgressRef.current,
        targetZ,
        9,
        Math.min(rawDelta, 0.08)
      );
    }
    topDrawerRef.current.position.z = drawerProgressRef.current;
  });

  const drawerConfigs = [
    { y: 0.22, h: 0.18, stripe: '#10b981' }, // IV & Trauma Dressings
    { y: 0.41, h: 0.14, stripe: '#f59e0b' }, // Pediatric / Backup Defib
    { y: 0.56, h: 0.13, stripe: '#38bdf8' }, // Circulatory / Vascular
    { y: 0.7, h: 0.13, stripe: '#eab308' }, // ACLS Medications
  ];

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ProximityGroundRing active={isNearby} radius={0.74} />

      {/* 4 Swivel Casters + Molded ABS Bumper Base */}
      <MedicalCaster position={[-0.35, 0, -0.21]} scale={0.78} />
      <MedicalCaster position={[0.35, 0, -0.21]} scale={0.78} />
      <MedicalCaster position={[-0.35, 0, 0.21]} scale={0.78} />
      <MedicalCaster position={[0.35, 0, 0.21]} scale={0.78} />

      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.86, 0.065, 0.58]} />
        <meshStandardMaterial color="#0f172a" roughness={0.78} metalness={0.15} />
      </mesh>

      {/* Main Powder-Coated Red Crash Cart Cabinet */}
      <mesh geometry={bodyGeom} position={[0, 0.56, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color="#b91c1c"
          roughness={0.34}
          metalness={0.32}
          emissive={highlight}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Extruded Dark Corner Guards */}
      {(
        [
          [-0.39, -0.25],
          [0.39, -0.25],
          [-0.39, 0.25],
          [0.39, 0.25],
        ] as [number, number][]
      ).map(([cx, cz], idx) => (
        <mesh key={idx} position={[cx, 0.56, cz]}>
          <cylinderGeometry args={[0.024, 0.024, 0.86, 10]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}

      {/* Lower 4 Color-Coded Clinical Drawers */}
      {drawerConfigs.map((d, idx) => (
        <group key={idx} position={[0, d.y, 0.255]}>
          <mesh castShadow>
            <boxGeometry args={[0.69, d.h - 0.015, 0.022]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.28} metalness={0.65} />
          </mesh>
          <mesh position={[0, (d.h - 0.015) * 0.34, 0.012]}>
            <planeGeometry args={[0.66, 0.022]} />
            <meshBasicMaterial color={d.stripe} />
          </mesh>
          <mesh position={[0, -0.01, 0.022]}>
            <boxGeometry args={[0.38, 0.022, 0.02]} />
            <meshStandardMaterial color="#475569" roughness={0.22} metalness={0.88} />
          </mesh>
        </group>
      ))}

      {/* ANIMATED TOP DRAWER (Airway, ACLS Ampoules & Backup AED Module) */}
      <group ref={topDrawerRef} position={[0, 0.84, 0]}>
        {/* Drawer Front Face */}
        <mesh position={[0, 0, 0.255]} castShadow>
          <boxGeometry args={[0.69, 0.125, 0.022]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.28} metalness={0.65} />
        </mesh>
        <mesh position={[0, 0.042, 0.268]}>
          <planeGeometry args={[0.66, 0.022]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, -0.008, 0.278]}>
          <boxGeometry args={[0.38, 0.022, 0.02]} />
          <meshStandardMaterial color="#334155" roughness={0.22} metalness={0.88} />
        </mesh>

        {/* Internal Drawer Tray & Realistic Resuscitation Contents (Visible when Drawer Slides Out) */}
        <mesh position={[0, -0.02, 0.11]}>
          <boxGeometry args={[0.66, 0.06, 0.28]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.45} metalness={0.4} />
        </mesh>
        {/* Backup AED Capacitor Module */}
        <mesh position={[-0.18, 0.015, 0.12]}>
          <boxGeometry args={[0.18, 0.045, 0.14]} />
          <meshStandardMaterial
            color="#ea580c"
            emissive="#f97316"
            emissiveIntensity={0.25}
            roughness={0.35}
          />
        </mesh>
        {/* ACLS Epinephrine & Amiodarone Prefilled Syringes / Vials */}
        {[-0.02, 0.03, 0.08].map((vx, idx) => (
          <mesh key={idx} position={[vx, 0.015, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.12, 10]} />
            <meshStandardMaterial color="#fde047" roughness={0.25} />
          </mesh>
        ))}
        {/* Stainless Laryngoscope Handle & Curved Macintosh Blade */}
        <mesh position={[0.2, 0.018, 0.12]} rotation={[0, 0.35, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.15, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.92} />
        </mesh>
      </group>

      {/* Left Tubular Stainless Push Handle */}
      <group position={[-0.45, 0.88, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.38, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0.03, 0, -0.16]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.06, 10]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0.03, 0, 0.16]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.06, 10]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>

      {/* Right Side Yellow Biohazard Sharps Disposal Bin */}
      <group position={[0.45, 0.68, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.11, 0.26, 0.18]} />
          <meshStandardMaterial color="#eab308" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.12, 0.03, 0.19]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
      </group>

      {/* Rear-Mounted Orange CPR Rigid Cardiac Backboard */}
      <mesh position={[0, 0.56, -0.275]} castShadow>
        <boxGeometry args={[0.52, 0.76, 0.028]} />
        <meshStandardMaterial color="#ea580c" roughness={0.48} />
      </mesh>

      {/* Top Stainless Work Tray + Guardrail + BVM Resuscitator Bag + Sterile Canisters */}
      <mesh position={[0, 1.01, 0]} castShadow>
        <boxGeometry args={[0.8, 0.035, 0.52]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.18} metalness={0.88} />
      </mesh>
      <mesh position={[0, 1.06, -0.245]}>
        <boxGeometry args={[0.78, 0.065, 0.015]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Translucent BVM Bag-Valve-Mask Resuscitator */}
      <group position={[0.18, 1.09, 0.03]} rotation={[0, 0.4, Math.PI / 2]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.062, 0.13, 10, 16]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transparent
            opacity={0.72}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <coneGeometry args={[0.055, 0.075, 16]} />
          <meshPhysicalMaterial
            color="#bae6fd"
            transparent
            opacity={0.65}
            roughness={0.15}
          />
        </mesh>
      </group>

      {/* Sterile Gauze & Antiseptic Canisters on Top Surface */}
      <mesh position={[-0.22, 1.09, -0.08]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.13, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[-0.08, 1.08, -0.1]} castShadow>
        <cylinderGeometry args={[0.038, 0.038, 0.11, 14]} />
        <meshStandardMaterial color="#0284c7" roughness={0.35} />
      </mesh>

      {(!isFirstPerson || isNearby) && (
        <Html position={[0, 1.44, 0]} center distanceFactor={6.5} zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={onSelect}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border bg-[#082f49] text-cyan-100 border-cyan-400 shadow-lg"
          >
            {isFirstPerson && isNearby ? 'E — Collect Equipment' : 'Medical Trolley'}
          </button>
        </Html>
      )}
    </group>
  );
};

/**
 * Lathed Bull-Nose Medical Oxygen E-Cylinders in Wheeled Caddy with
 * Brass Pin-Index Regulator, Bourdon Dial Gauge, Thorpe Flowmeter & Coiled O2 Tubing
 */
export const RealisticOxygenStation: React.FC<{
  position: [number, number, number];
  cylindersRemaining: number;
  isSelected: boolean;
  isNearby: boolean;
  isFirstPerson: boolean;
  onSelect: () => void;
}> = ({
  position,
  cylindersRemaining,
  isSelected,
  isNearby,
  isFirstPerson,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const highlight = isSelected || isNearby || hovered ? '#06b6d4' : '#000000';

  // Smooth bull-nose rounded cylinder shoulder via LatheGeometry
  const cylinderShoulderGeom = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const ang = (i / 10) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(ang) * 0.102, Math.sin(ang) * 0.125));
    }
    pts.push(new THREE.Vector2(0.028, 0.155));
    return new THREE.LatheGeometry(pts, 24);
  }, []);

  const gaugeTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 5;
      ctx.stroke();
      // Green full zone + red low zone
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(64, 64, 44, -Math.PI * 0.2, Math.PI * 0.5);
      ctx.stroke();
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(64, 64, 44, Math.PI * 0.75, Math.PI * 1.15);
      ctx.stroke();
      // Needle
      const needleAng = cylindersRemaining > 0 ? -0.35 : 2.6;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.lineTo(64 + Math.cos(needleAng) * 42, 64 + Math.sin(needleAng) * 42);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [cylindersRemaining]);

  const coiledO2Hose = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.04, 1.22, 0.05),
        new THREE.Vector3(0.06, 1.05, 0.15),
        new THREE.Vector3(-0.02, 0.88, 0.18),
        new THREE.Vector3(-0.14, 0.78, 0.12),
        new THREE.Vector3(-0.08, 0.68, 0.16),
      ]),
    []
  );

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <ProximityGroundRing active={isNearby} radius={0.58} />

      {/* Twin-Cylinder Wheeled Steel Caddy Base, Retaining Ring & Tall Push Handle */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.48, 0.045, 0.32]} />
        <meshStandardMaterial color="#334155" roughness={0.48} metalness={0.65} />
      </mesh>
      {[-0.25, 0.25].map((wx, idx) => (
        <mesh
          key={idx}
          position={[wx, 0.085, -0.1]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.085, 0.085, 0.032, 20]} />
          <meshStandardMaterial color="#0f172a" roughness={0.78} />
        </mesh>
      ))}
      <mesh position={[0, 0.64, -0.13]}>
        <cylinderGeometry args={[0.015, 0.015, 1.2, 12]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.85} />
      </mesh>
      <mesh position={[0, 1.24, -0.16]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.016, 0.26, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
      {/* Cylinder Retaining Collar */}
      <mesh position={[0, 0.66, 0]}>
        <boxGeometry args={[0.46, 0.04, 0.26]} />
        <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Primary E-Cylinder (ISO Medical Green Body + White Bull-Nose Shoulder) */}
      <group position={[-0.1, 0.06, 0]}>
        <mesh position={[0, 0.44, 0]} castShadow>
          <cylinderGeometry args={[0.102, 0.102, 0.88, 24]} />
          <meshStandardMaterial
            color={cylindersRemaining > 0 ? '#059669' : '#475569'}
            roughness={0.28}
            metalness={0.42}
            emissive={highlight}
            emissiveIntensity={0.26}
          />
        </mesh>
        <mesh geometry={cylinderShoulderGeom} position={[0, 0.88, 0]} castShadow>
          <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.22} />
        </mesh>

        {/* Machined Brass Pin-Index Yoke Regulator + T-Handle */}
        <mesh position={[0, 1.09, 0]}>
          <cylinderGeometry args={[0.026, 0.028, 0.12, 14]} />
          <meshStandardMaterial color="#eab308" roughness={0.22} metalness={0.9} />
        </mesh>
        <mesh position={[-0.045, 1.09, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.07, 8]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Circular Glass-Faced Bourdon Pressure Gauge */}
        <group position={[0.042, 1.13, 0.036]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.022, 20]} />
            <meshStandardMaterial color="#eab308" roughness={0.24} metalness={0.88} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <circleGeometry args={[0.037, 20]} />
            <meshBasicMaterial map={gaugeTex} />
          </mesh>
        </group>

        {/* Upright Transparent Thorpe-Tube Flowmeter + Floating Ball */}
        <mesh position={[0.06, 1.24, 0.02]}>
          <cylinderGeometry args={[0.014, 0.014, 0.14, 12]} />
          <meshPhysicalMaterial
            color="#e0f2fe"
            transparent
            opacity={0.58}
            roughness={0.1}
          />
        </mesh>
        {/* Humidifier Bottle */}
        <mesh position={[0.06, 1.11, 0.05]}>
          <cylinderGeometry args={[0.028, 0.026, 0.085, 14]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transparent
            opacity={0.62}
            roughness={0.15}
          />
        </mesh>
      </group>

      {/* Secondary Reserve E-Cylinder */}
      <group position={[0.11, 0.06, 0]}>
        <mesh position={[0, 0.44, 0]} castShadow>
          <cylinderGeometry args={[0.098, 0.098, 0.86, 22]} />
          <meshStandardMaterial
            color={cylindersRemaining > 1 ? '#059669' : '#334155'}
            roughness={0.3}
            metalness={0.42}
          />
        </mesh>
        <mesh
          geometry={cylinderShoulderGeom}
          position={[0, 0.86, 0]}
          scale={0.96}
          castShadow
        >
          <meshStandardMaterial color="#f1f5f9" roughness={0.32} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.022, 0.024, 0.08, 12]} />
          <meshStandardMaterial color="#ca8a04" roughness={0.25} metalness={0.88} />
        </mesh>
      </group>

      {/* Coiled Green Medical Oxygen Supply Tubing + Non-Rebreather Mask */}
      <mesh>
        <tubeGeometry args={[coiledO2Hose, 24, 0.005, 6, false]} />
        <meshStandardMaterial color="#10b981" roughness={0.36} />
      </mesh>
      <mesh position={[-0.08, 0.65, 0.17]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.042, 0.065, 14]} />
        <meshPhysicalMaterial
          color="#7dd3fc"
          transparent
          opacity={0.62}
          roughness={0.18}
        />
      </mesh>

      {(!isFirstPerson || isNearby) && (
        <Html position={[0, 1.54, 0]} center distanceFactor={6.5} zIndexRange={[10, 0]}>
          <button
            type="button"
            onClick={onSelect}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border bg-[#082f49] text-cyan-100 border-cyan-400 shadow-lg"
          >
            {isFirstPerson && isNearby
              ? `E — Apply Oxygen (${cylindersRemaining})`
              : `Oxygen (${cylindersRemaining})`}
          </button>
        </Html>
      )}
    </group>
  );
};

/**
 * Detailed Responder Trauma Jump Bag (Used in Responder Ready Room & Trauma Triage Zones)
 */
export const RealisticTraumaJumpBag: React.FC<{
  position?: [number, number, number];
  rotation?: [number, number, number];
  bagColor?: string;
  accentColor?: string;
  includePortableO2?: boolean;
}> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  bagColor = '#dc2626',
  accentColor = '#38bdf8',
  includePortableO2 = false,
}) => {
  const mainBagGeom = useRoundedBoxGeometry(0.42, 0.25, 0.26, 0.04, 0.015);
  const sidePouchGeom = useRoundedBoxGeometry(0.075, 0.18, 0.2, 0.02, 0.01);

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={mainBagGeom} position={[0, 0.125, 0]} castShadow>
        <meshStandardMaterial color={bagColor} roughness={0.62} metalness={0.1} />
      </mesh>
      {/* Left & Right Zippered Side Trauma Pouches */}
      <mesh geometry={sidePouchGeom} position={[-0.24, 0.1, 0]} castShadow>
        <meshStandardMaterial color={bagColor} roughness={0.65} />
      </mesh>
      <mesh geometry={sidePouchGeom} position={[0.24, 0.1, 0]} castShadow>
        <meshStandardMaterial color={bagColor} roughness={0.65} />
      </mesh>
      {/* Front Trauma Pocket + Reflective Star-of-Life / Telemetry Chevrons */}
      <mesh position={[0, 0.1, 0.138]} castShadow>
        <boxGeometry args={[0.32, 0.15, 0.035]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.12, 0.158]}>
        <planeGeometry args={[0.28, 0.038]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.4}
          roughness={0.25}
        />
      </mesh>
      {/* Webbing Carry Straps */}
      {[-0.09, 0.09].map((sx, idx) => (
        <mesh key={idx} position={[sx, 0.13, 0]}>
          <boxGeometry args={[0.028, 0.265, 0.272]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.016, 0.18, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>

      {includePortableO2 && (
        <group position={[-0.31, 0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.052, 0.052, 0.36, 18]} />
            <meshStandardMaterial color="#059669" roughness={0.28} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0, 0.19]}>
            <sphereGeometry args={[0.052, 16, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  EQUIPMENT_KIT_PRESETS,
  UNIFORM_PRESETS,
} from '../../engine/progressionEngine';
import type { ResponderCustomization } from '../../types/simulation';
import { ResponderHumanoidCharacter } from './assets/HumanoidCharacter';
import { RealisticTraumaJumpBag } from './assets/MedicalEquipmentAssets';

interface ResponderAvatarCanvasProps {
  profile: ResponderCustomization;
  level: number;
  reducedMotion: boolean;
  cameraZoom?: 'full' | 'upper';
}

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

const _camGoal = new THREE.Vector3();
const _targetGoal = new THREE.Vector3();

function AvatarEnvSetup() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.16;
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    pmrem.dispose();
    return () => {
      tex.dispose();
    };
  }, [gl, scene]);
  return null;
}

function AvatarCameraZoomRig({
  cameraZoom,
  controlsRef,
  reducedMotion,
}: {
  cameraZoom: 'full' | 'upper';
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  useFrame((_state, rawDelta) => {
    if (!controlsRef.current) return;
    const dt = Math.min(rawDelta, 0.08);
    if (cameraZoom === 'upper') {
      _camGoal.set(0, 0.54, 1.62);
      _targetGoal.set(0, 0.42, 0);
    } else {
      _camGoal.set(0, 0.08, 3.22);
      _targetGoal.set(0, -0.02, 0);
    }

    if (reducedMotion) {
      camera.position.copy(_camGoal);
      controlsRef.current.target.copy(_targetGoal);
      controlsRef.current.update();
      return;
    }

    const alpha = 1 - Math.exp(-5.5 * dt);
    camera.position.lerp(_camGoal, alpha);
    controlsRef.current.target.lerp(_targetGoal, alpha);
    controlsRef.current.update();
  });
  return null;
}

/**
 * Responder Ready-Bay Showcase featuring the Rigged 3D Humanoid Responder Character,
 * Skeletal Idle Animation, Custom Uniform/Skin/Headgear/Stethoscope & Realistic Trauma Kit
 */
function ResponderReadyRoomStage({
  profile,
  level,
  reducedMotion,
}: {
  profile: ResponderCustomization;
  level: number;
  reducedMotion: boolean;
}) {
  const preset =
    UNIFORM_PRESETS[profile.uniformId] || UNIFORM_PRESETS.trauma_navy;
  const kit =
    EQUIPMENT_KIT_PRESETS[profile.primaryKit || 'aed_rapid'] ||
    EQUIPMENT_KIT_PRESETS.aed_rapid;

  const padTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#091220';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(256, 256, 228, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(256, 256, 174, 0, Math.PI * 2);
      ctx.stroke();

      // Anti-slip radial deck ribs
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI * 2) / 12;
        ctx.beginPath();
        ctx.moveTo(256 + Math.cos(a) * 174, 256 + Math.sin(a) * 174);
        ctx.lineTo(256 + Math.cos(a) * 226, 256 + Math.sin(a) * 226);
        ctx.stroke();
      }

      // Level progression pips along forward rim
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < Math.min(8, level); i++) {
        const ang = Math.PI * 0.5 + (i - 3.5) * 0.16;
        ctx.fillRect(
          256 + Math.cos(ang) * 202 - 6,
          256 + Math.sin(ang) * 202 - 6,
          12,
          12
        );
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [level]);

  return (
    <group position={[0, -0.92, 0]}>
      {/* Grounded Ready-Room Platform Deck */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.98, 1.05, 0.06, 48]} />
        <meshStandardMaterial map={padTex} roughness={0.34} metalness={0.62} />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.91, 0.945, 56]} />
        <meshBasicMaterial
          color={preset.trimColor}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Subtle Ready-Room Equipment Backdrop Frame */}
      <group position={[0, 1.02, -0.78]}>
        <mesh>
          <boxGeometry args={[1.42, 1.9, 0.06]} />
          <meshStandardMaterial color="#0d1729" roughness={0.68} metalness={0.35} />
        </mesh>
        <mesh position={[-0.68, 0, 0.02]}>
          <boxGeometry args={[0.04, 1.88, 0.04]} />
          <meshStandardMaterial
            color={preset.trimColor}
            emissive={preset.trimColor}
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh position={[0.68, 0, 0.02]}>
          <boxGeometry args={[0.04, 1.88, 0.04]} />
          <meshStandardMaterial
            color={preset.trimColor}
            emissive={preset.trimColor}
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>

      {/* Rigged Realistic Humanoid Responder Character */}
      <group position={[0, 0.06, 0]}>
        <ResponderHumanoidCharacter
          profile={profile}
          reducedMotion={reducedMotion}
          clip="idle"
        />
      </group>

      {/* Detailed Primary Trauma / AED / Airway Jump Bag Beside Responder */}
      <RealisticTraumaJumpBag
        position={[0.52, 0.06, 0.16]}
        rotation={[0, -0.45, 0]}
        bagColor={kit.bagColor}
        accentColor={kit.accentColor}
        includePortableO2={profile.primaryKit === 'airway_oxygen'}
      />
    </group>
  );
}

export const ResponderAvatarCanvas: React.FC<ResponderAvatarCanvasProps> = ({
  profile,
  level,
  reducedMotion,
  cameraZoom = 'full',
}) => {
  const [contextLost, setContextLost] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  if (contextLost) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#070B14] p-4 text-center">
        <p className="text-xs text-slate-300 mb-2">3D Responder Ready Room Paused</p>
        <button
          type="button"
          onClick={() => setContextLost(false)}
          className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
        >
          Restore Character View
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#070B14] select-none">
      <Canvas
        shadows={!IS_SOFTWARE_GL}
        dpr={IS_SOFTWARE_GL ? 1 : [1, 2]}
        gl={{ antialias: !IS_SOFTWARE_GL, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.08, 3.22], fov: 40, near: 0.1, far: 25 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
          });
        }}
      >
        <color attach="background" args={['#070b14']} />
        <AvatarEnvSetup />
        <hemisphereLight args={['#bae6fd', '#0f172a', 0.8]} />
        <directionalLight
          position={[2.5, 4.2, 3.4]}
          intensity={1.85}
          color="#f8fafc"
          castShadow={!IS_SOFTWARE_GL}
        />
        <directionalLight
          position={[-2.5, 2.5, -2]}
          intensity={0.72}
          color="#38bdf8"
        />

        <ResponderReadyRoomStage
          profile={profile}
          level={level}
          reducedMotion={reducedMotion}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          minDistance={1.38}
          maxDistance={4.3}
          enableDamping={!IS_SOFTWARE_GL}
          dampingFactor={0.08}
          minPolarAngle={Math.PI / 2 - 0.42}
          maxPolarAngle={Math.PI / 2 + 0.16}
          target={[0, -0.02, 0]}
        />
        <AvatarCameraZoomRig
          cameraZoom={cameraZoom}
          controlsRef={controlsRef}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
};

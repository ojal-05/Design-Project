import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame as useR3FFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type {
  PatientState,
  ResponderCustomization,
  ResponderVisorStyle,
} from '../../../types/simulation';
import { UNIFORM_PRESETS } from '../../../engine/progressionEngine';
import {
  getClinicalGarmentTexture,
  type GarmentFabricStyle,
} from './clinicalGarmentTextures';

export type HumanoidModelKey =
  | 'responder_male'
  | 'medic_female'
  | 'clinician'
  | 'operator'
  | 'michelle';

export type HumanoidClipKind =
  | 'idle'
  | 'idle_02'
  | 'idle_var'
  | 'idle_var_02'
  | 'walk'
  | 'run'
  | 'examine'
  | 'talk_02'
  | 'gesture'
  | 'crouch';

export type CarriedClinicalProp = 'none' | 'clipboard' | 'med_kit';

interface LoadedHumanoidBundle {
  responder_male: GLTF;
  medic_female: GLTF;
  clinician: GLTF;
  operator: GLTF;
  michelle: GLTF;
  maleClips: Record<HumanoidClipKind, THREE.AnimationClip>;
  femaleClips: Record<HumanoidClipKind, THREE.AnimationClip>;
  clinicianClips: Record<HumanoidClipKind, THREE.AnimationClip>;
  michelleClips: Record<HumanoidClipKind, THREE.AnimationClip>;
  heights: Record<HumanoidModelKey, { rawHeight: number; minY: number }>;
}

const MODEL_PATHS = {
  responder_male: '/models/responder_male_humanoid.glb',
  medic_female: '/models/medic_female_humanoid.glb',
  clinician: '/models/clinician_humanoid.glb',
  operator: '/models/operator_humanoid.glb',
  michelle: '/models/michelle_humanoid.glb',
  anim_m_idle: '/models/anims/anim_m_idle.glb',
  anim_m_idle_02: '/models/anims/anim_m_idle_02.glb',
  anim_m_idle_var: '/models/anims/anim_m_idle_var.glb',
  anim_m_idle_var_02: '/models/anims/anim_m_idle_var_02.glb',
  anim_m_walk: '/models/anims/anim_m_walk.glb',
  anim_m_run: '/models/anims/anim_m_run.glb',
  anim_m_crouch: '/models/anims/anim_m_crouch.glb',
  anim_m_talk: '/models/anims/anim_m_talk.glb',
  anim_m_talk_02: '/models/anims/anim_m_talk_02.glb',
  anim_m_gesture: '/models/anims/anim_m_gesture.glb',
  anim_f_idle: '/models/anims/anim_f_idle.glb',
  anim_f_idle_var: '/models/anims/anim_f_idle_var.glb',
  anim_f_idle_var_02: '/models/anims/anim_f_idle_var_02.glb',
  anim_f_walk: '/models/anims/anim_f_walk.glb',
  anim_f_crouch: '/models/anims/anim_f_crouch.glb',
  anim_f_talk: '/models/anims/anim_f_talk.glb',
  anim_f_talk_02: '/models/anims/anim_f_talk_02.glb',
} as const;

let bundlePromise: Promise<LoadedHumanoidBundle> | null = null;
let cachedBundle: LoadedHumanoidBundle | null = null;

// Pre-allocated math temporaries at module scope (zero per-frame GC allocation)
const _tempVecA = new THREE.Vector3();
const _tempVecB = new THREE.Vector3();
const _tempScale = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _tempQuatB = new THREE.Quaternion();
const _tempEuler = new THREE.Euler();
const _invRootMat = new THREE.Matrix4();
const _boneLocalMat = new THREE.Matrix4();

/**
 * Measures true GPU-skinned vertex bounds after hiding any non-clinical headwear (e.g. cowboy hat)
 * and applying a sample idle pose so foot soles plant flush at Y = 0.000m across all rigs.
 */
function measureAnimatedSkinnedBounds(
  gltf: GLTF,
  sampleClip?: THREE.AnimationClip
): { rawHeight: number; minY: number } {
  const clone = SkeletonUtils.clone(gltf.scene);
  clone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.name === 'Wolf3D_Headwear') {
      m.visible = false;
    }
  });

  if (sampleClip) {
    const mixer = new THREE.AnimationMixer(clone);
    mixer.clipAction(sampleClip).play();
    mixer.update(0.15);
    mixer.stopAllAction();
  }

  clone.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  let hasSkinned = false;

  clone.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.visible && sm.geometry?.attributes?.position) {
      hasSkinned = true;
      sm.skeleton.update();
      const pos = sm.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 900));
      for (let i = 0; i < pos.count; i += step) {
        sm.getVertexPosition(i, v);
        v.applyMatrix4(sm.matrixWorld);
        box.expandByPoint(v);
      }
    }
  });

  if (!hasSkinned || box.isEmpty()) {
    box.setFromObject(clone);
  }

  const rawHeight = Math.max(0.5, box.max.y - box.min.y);
  const minY = Number.isFinite(box.min.y) ? box.min.y : 0;
  return { rawHeight, minY };
}

/**
 * Strips horizontal X/Z root drift while preserving vertical pelvis weight-shift motion.
 * Optionally filters out `*4` fingertip end-bone tracks for rigs (`clinician`) that terminate at `*3`.
 */
function sanitizeWolf3DClip(
  rawClip: THREE.AnimationClip,
  clipName: string,
  stripFinger4 = false,
  hipYScale = 1
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const tr of rawClip.tracks) {
    if (
      stripFinger4 &&
      /(Thumb4|Index4|Middle4|Ring4|Pinky4)\./.test(tr.name)
    ) {
      continue;
    }
    if (tr.name === 'Hips.position') {
      const vals = tr.values.slice();
      const baseX = vals[0] || 0;
      const baseZ = vals[2] || 0;
      for (let i = 0; i < vals.length; i += 3) {
        vals[i] = baseX;
        vals[i + 1] = vals[i + 1] * hipYScale;
        vals[i + 2] = baseZ;
      }
      tracks.push(
        new THREE.VectorKeyframeTrack('Hips.position', tr.times.slice(), vals)
      );
    } else {
      tracks.push(tr.clone());
    }
  }
  return new THREE.AnimationClip(clipName, rawClip.duration, tracks);
}

function retargetFemaleClipToMichelle(
  rawClip: THREE.AnimationClip,
  clipName: string
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const tr of rawClip.tracks) {
    const dot = tr.name.lastIndexOf('.');
    if (dot === -1) continue;
    const boneName = tr.name.slice(0, dot);
    const prop = tr.name.slice(dot + 1);
    if (prop !== 'quaternion' || boneName === 'Hips') continue;
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `mixamorig${boneName}.quaternion`,
        tr.times.slice(),
        tr.values.slice()
      )
    );
  }
  return new THREE.AnimationClip(clipName, rawClip.duration, tracks);
}

export function loadHumanoidBundle(): Promise<LoadedHumanoidBundle> {
  if (cachedBundle) return Promise.resolve(cachedBundle);
  if (bundlePromise) return bundlePromise;

  const loader = new GLTFLoader();
  const loadOne = (url: string) =>
    new Promise<GLTF>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

  bundlePromise = Promise.all([
    loadOne(MODEL_PATHS.responder_male),
    loadOne(MODEL_PATHS.medic_female),
    loadOne(MODEL_PATHS.clinician),
    loadOne(MODEL_PATHS.operator),
    loadOne(MODEL_PATHS.michelle),
    loadOne(MODEL_PATHS.anim_m_idle),
    loadOne(MODEL_PATHS.anim_m_idle_02),
    loadOne(MODEL_PATHS.anim_m_idle_var),
    loadOne(MODEL_PATHS.anim_m_idle_var_02),
    loadOne(MODEL_PATHS.anim_m_walk),
    loadOne(MODEL_PATHS.anim_m_run),
    loadOne(MODEL_PATHS.anim_m_crouch),
    loadOne(MODEL_PATHS.anim_m_talk),
    loadOne(MODEL_PATHS.anim_m_talk_02),
    loadOne(MODEL_PATHS.anim_m_gesture),
    loadOne(MODEL_PATHS.anim_f_idle),
    loadOne(MODEL_PATHS.anim_f_idle_var),
    loadOne(MODEL_PATHS.anim_f_idle_var_02),
    loadOne(MODEL_PATHS.anim_f_walk),
    loadOne(MODEL_PATHS.anim_f_crouch),
    loadOne(MODEL_PATHS.anim_f_talk),
    loadOne(MODEL_PATHS.anim_f_talk_02),
  ]).then(
    ([
      responder_male,
      medic_female,
      clinician,
      operator,
      michelle,
      mIdle,
      mIdle02,
      mIdleVar,
      mIdleVar02,
      mWalk,
      mRun,
      mCrouch,
      mTalk,
      mTalk02,
      mGesture,
      fIdle,
      fIdleVar,
      fIdleVar02,
      fWalk,
      fCrouch,
      fTalk,
      fTalk02,
    ]) => {
      const maleClips: Record<HumanoidClipKind, THREE.AnimationClip> = {
        idle: sanitizeWolf3DClip(mIdle.animations[0], 'm_idle'),
        idle_02: sanitizeWolf3DClip(mIdle02.animations[0], 'm_idle_02'),
        idle_var: sanitizeWolf3DClip(mIdleVar.animations[0], 'm_idle_var'),
        idle_var_02: sanitizeWolf3DClip(
          mIdleVar02.animations[0],
          'm_idle_var_02'
        ),
        walk: sanitizeWolf3DClip(mWalk.animations[0], 'm_walk'),
        run: sanitizeWolf3DClip(mRun.animations[0], 'm_run'),
        crouch: sanitizeWolf3DClip(mCrouch.animations[0], 'm_crouch'),
        examine: sanitizeWolf3DClip(mTalk.animations[0], 'm_examine'),
        talk_02: sanitizeWolf3DClip(mTalk02.animations[0], 'm_talk_02'),
        gesture: sanitizeWolf3DClip(mGesture.animations[0], 'm_gesture'),
      };

      const femaleClips: Record<HumanoidClipKind, THREE.AnimationClip> = {
        idle: sanitizeWolf3DClip(fIdle.animations[0], 'f_idle'),
        idle_02: sanitizeWolf3DClip(fIdleVar02.animations[0], 'f_idle_02'),
        idle_var: sanitizeWolf3DClip(fIdleVar.animations[0], 'f_idle_var'),
        idle_var_02: sanitizeWolf3DClip(
          fIdleVar02.animations[0],
          'f_idle_var_02'
        ),
        walk: sanitizeWolf3DClip(fWalk.animations[0], 'f_walk'),
        run: sanitizeWolf3DClip(mRun.animations[0], 'f_run'),
        crouch: sanitizeWolf3DClip(fCrouch.animations[0], 'f_crouch'),
        examine: sanitizeWolf3DClip(fTalk.animations[0], 'f_examine'),
        talk_02: sanitizeWolf3DClip(fTalk02.animations[0], 'f_talk_02'),
        gesture: sanitizeWolf3DClip(mGesture.animations[0], 'f_gesture'),
      };

      const clinicianClips: Record<HumanoidClipKind, THREE.AnimationClip> = {
        idle: sanitizeWolf3DClip(mIdle02.animations[0], 'cl_idle', true),
        idle_02: sanitizeWolf3DClip(mIdle.animations[0], 'cl_idle_02', true),
        idle_var: sanitizeWolf3DClip(mIdleVar.animations[0], 'cl_idle_var', true),
        idle_var_02: sanitizeWolf3DClip(
          mIdleVar02.animations[0],
          'cl_idle_var_02',
          true
        ),
        walk: sanitizeWolf3DClip(mWalk.animations[0], 'cl_walk', true),
        run: sanitizeWolf3DClip(mRun.animations[0], 'cl_run', true),
        crouch: sanitizeWolf3DClip(mCrouch.animations[0], 'cl_crouch', true),
        examine: sanitizeWolf3DClip(mTalk02.animations[0], 'cl_examine', true),
        talk_02: sanitizeWolf3DClip(mTalk.animations[0], 'cl_talk_02', true),
        gesture: sanitizeWolf3DClip(mGesture.animations[0], 'cl_gesture', true),
      };

      const michelleClips: Record<HumanoidClipKind, THREE.AnimationClip> = {
        idle: retargetFemaleClipToMichelle(fIdle.animations[0], 'mi_idle'),
        idle_02: retargetFemaleClipToMichelle(
          fIdleVar02.animations[0],
          'mi_idle_02'
        ),
        idle_var: retargetFemaleClipToMichelle(
          fIdleVar.animations[0],
          'mi_idle_var'
        ),
        idle_var_02: retargetFemaleClipToMichelle(
          fIdleVar02.animations[0],
          'mi_idle_var_02'
        ),
        walk: retargetFemaleClipToMichelle(fWalk.animations[0], 'mi_walk'),
        run: retargetFemaleClipToMichelle(mRun.animations[0], 'mi_run'),
        crouch: retargetFemaleClipToMichelle(fCrouch.animations[0], 'mi_crouch'),
        examine: retargetFemaleClipToMichelle(fTalk.animations[0], 'mi_examine'),
        talk_02: retargetFemaleClipToMichelle(
          fTalk02.animations[0],
          'mi_talk_02'
        ),
        gesture: retargetFemaleClipToMichelle(
          mGesture.animations[0],
          'mi_gesture'
        ),
      };

      const bundle: LoadedHumanoidBundle = {
        responder_male,
        medic_female,
        clinician,
        operator,
        michelle,
        maleClips,
        femaleClips,
        clinicianClips,
        michelleClips,
        heights: {
          responder_male: measureAnimatedSkinnedBounds(
            responder_male,
            maleClips.idle
          ),
          medic_female: measureAnimatedSkinnedBounds(
            medic_female,
            femaleClips.idle
          ),
          clinician: measureAnimatedSkinnedBounds(
            clinician,
            clinicianClips.idle
          ),
          operator: measureAnimatedSkinnedBounds(operator, maleClips.idle),
          michelle: measureAnimatedSkinnedBounds(michelle, michelleClips.idle),
        },
      };
      cachedBundle = bundle;
      return bundle;
    }
  );

  return bundlePromise;
}

if (typeof window !== 'undefined') {
  loadHumanoidBundle().catch(() => {});
}

function useHumanoidBundle() {
  const [bundle, setBundle] = useState<LoadedHumanoidBundle | null>(cachedBundle);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cachedBundle) {
      setBundle(cachedBundle);
      return;
    }
    let active = true;
    loadHumanoidBundle()
      .then((res) => {
        if (active) setBundle(res);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { bundle, failed };
}

function findHumanoidBone(
  root: THREE.Object3D,
  shortName: string
): THREE.Bone | null {
  const candidates = [
    shortName,
    `mixamorig${shortName}`,
    `mixamorig:${shortName}`,
  ];
  let found: THREE.Bone | null = null;
  root.traverse((obj) => {
    if (found) return;
    if ((obj as THREE.Bone).isBone && candidates.includes(obj.name)) {
      found = obj as THREE.Bone;
    }
  });
  return found;
}

interface MorphBinding {
  mesh: THREE.Mesh;
  dict: Record<string, number>;
  influences: number[];
}

function collectMorphMeshes(root: THREE.Object3D): MorphBinding[] {
  const list: MorphBinding[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (
      m.isMesh &&
      m.morphTargetDictionary &&
      Array.isArray(m.morphTargetInfluences)
    ) {
      list.push({
        mesh: m,
        dict: m.morphTargetDictionary,
        influences: m.morphTargetInfluences,
      });
    }
  });
  return list;
}

function setMorphValue(
  bindings: MorphBinding[],
  names: string[],
  value: number
) {
  for (let i = 0; i < bindings.length; i++) {
    const b = bindings[i];
    for (let j = 0; j < names.length; j++) {
      const idx = b.dict[names[j]];
      if (idx !== undefined) {
        b.influences[idx] = value;
      }
    }
  }
}

/**
 * Applies role-accurate clinical or civilian fabric textures & skin/hair PBR materials
 * while preserving 100% of baked normal maps (`mat.normalMap`), facial features, eyes, and eyelashes.
 * Strictly hides any non-clinical headwear (`Wolf3D_Headwear` cowboy hat).
 */
function customizeClonedMaterials(
  clonedRoot: THREE.Object3D,
  options: {
    modelKey: HumanoidModelKey;
    skinToneHex?: string;
    topTintHex?: string;
    bottomTintHex?: string;
    footwearTintHex?: string;
    trimTintHex?: string;
    topFabricStyle?: GarmentFabricStyle;
    bottomFabricStyle?: GarmentFabricStyle;
    footwearFabricStyle?: GarmentFabricStyle;
    showBeard?: boolean;
    showGlasses?: boolean;
    overallTint?: string;
    tintStrength?: number;
    emissiveHex?: string;
    emissiveIntensity?: number;
  }
) {
  const white = new THREE.Color('#ffffff');

  clonedRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    // NEVER show the cowboy hat (`Wolf3D_Headwear`) on `operator`
    if (
      mesh.name === 'Wolf3D_Headwear' ||
      (options.modelKey === 'operator' && mesh.name === 'Mesh')
    ) {
      mesh.visible = false;
      return;
    }

    if (options.modelKey === 'operator' && mesh.name === 'Wolf3D_Beard') {
      mesh.visible = Boolean(options.showBeard);
    } else if (
      options.modelKey === 'medic_female' &&
      mesh.name === 'Wolf3D_Glasses'
    ) {
      mesh.visible = Boolean(options.showGlasses);
    } else {
      mesh.visible = true;
    }

    const applyToMat = (srcMat: THREE.Material): THREE.Material => {
      const mat = srcMat.clone() as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial) return mat;

      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
      }

      const matName = mat.name || '';
      const meshName = mesh.name || '';

      const isEyeOrTeeth =
        /Eye|Teeth|Tongue|Eyelash/i.test(matName) ||
        /Eye|Teeth|Tongue|Eyelash/i.test(meshName);
      const isHair = /Hair|Beard/i.test(matName) || /hair|Beard/i.test(meshName);
      const isSkin =
        !isEyeOrTeeth &&
        !isHair &&
        (/Skin|Body|Head|AvatarHead|AvatarBody/i.test(matName) ||
          /Head_Mesh|Body_Mesh|AvatarHead|AvatarBody/i.test(meshName));

      const isTop =
        /Outfit_Top|outfit_top|avaturn_look/i.test(matName) ||
        /Outfit_Top|outfit_top|avaturn_look/i.test(meshName);
      const isBottom =
        /Outfit_Bottom|outfit_bottom/i.test(matName) ||
        /Outfit_Bottom|outfit_bottom/i.test(meshName);
      const isFootwear =
        /Footwear|outfit_shoes|avaturn_shoes/i.test(matName) ||
        /Footwear|outfit_shoes|avaturn_shoes/i.test(meshName);

      if (options.modelKey !== 'michelle') {
        if (isEyeOrTeeth) {
          if (!/Eyelash/i.test(matName)) {
            mat.color.copy(white);
          }
        } else if (isSkin) {
          mat.color.copy(white);
          if (options.skinToneHex) {
            mat.color.lerp(new THREE.Color(options.skinToneHex), 0.25);
          }
          mat.roughness = Math.max(0.54, mat.roughness || 0.62);
          mat.metalness = 0.02;
        } else if (isTop && (options.topFabricStyle || options.topTintHex)) {
          if (options.topFabricStyle) {
            // Replace baked tuxedo/gym diffuse texture with authentic woven clinical fabric while keeping 1K normalMap wrinkles!
            mat.map = getClinicalGarmentTexture(
              options.topFabricStyle,
              options.topTintHex || '#1b3b5f',
              options.trimTintHex || '#38bdf8'
            );
            mat.color.copy(white);
          } else if (options.topTintHex) {
            mat.color.copy(white).lerp(new THREE.Color(options.topTintHex), 0.72);
          }
          mat.roughness = 0.74;
          mat.metalness = 0.04;
        } else if (
          isBottom &&
          (options.bottomFabricStyle || options.bottomTintHex)
        ) {
          if (options.bottomFabricStyle) {
            mat.map = getClinicalGarmentTexture(
              options.bottomFabricStyle,
              options.bottomTintHex || '#12263f',
              options.trimTintHex || '#38bdf8'
            );
            mat.color.copy(white);
          } else if (options.bottomTintHex) {
            mat.color
              .copy(white)
              .lerp(new THREE.Color(options.bottomTintHex), 0.72);
          }
          mat.roughness = 0.76;
          mat.metalness = 0.03;
        } else if (
          isFootwear &&
          (options.footwearFabricStyle || options.footwearTintHex)
        ) {
          if (options.footwearFabricStyle) {
            mat.map = getClinicalGarmentTexture(
              options.footwearFabricStyle,
              options.footwearTintHex || '#0f172a',
              options.trimTintHex || '#38bdf8'
            );
            mat.color.copy(white);
          } else if (options.footwearTintHex) {
            mat.color
              .copy(white)
              .lerp(new THREE.Color(options.footwearTintHex), 0.6);
          }
          mat.roughness = 0.56;
          mat.metalness = 0.1;
        }
      } else if (options.overallTint) {
        mat.color.copy(white).lerp(
          new THREE.Color(options.overallTint),
          options.tintStrength ?? 0.2
        );
      }

      if (options.emissiveHex && options.emissiveHex !== '#000000') {
        mat.emissive = new THREE.Color(options.emissiveHex);
        mat.emissiveIntensity = options.emissiveIntensity ?? 0.16;
      } else {
        mat.emissive = new THREE.Color('#000000');
        mat.emissiveIntensity = 0;
      }

      mat.needsUpdate = true;
      return mat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(applyToMat);
    } else if (mesh.material) {
      mesh.material = applyToMat(mesh.material);
    }
  });
}

function CharacterLoadingIndicator({
  failed,
  horizontal = false,
}: {
  failed: boolean;
  horizontal?: boolean;
}) {
  if (!failed) {
    return (
      <mesh
        position={horizontal ? [0, 0.87, 0] : [0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.22, 0.27, 28]} />
        <meshBasicMaterial
          color="#0ea5e9"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }
  return (
    <Html
      position={horizontal ? [0, 1.15, 0] : [0, 1.4, 0]}
      center
      distanceFactor={8}
    >
      <div className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-[10px] text-amber-200 whitespace-nowrap">
        3D Character Asset Unavailable
      </div>
    </Html>
  );
}

/**
 * Bone-Tracked Clinical PPE, ID Badge, Binaural Stethoscope, Nitrile Gloves,
 * High-Visibility Reflective Vest & Carried Clinical Equipment.
 * Moves 1:1 with Spine2, Head, LeftHand, RightHand & LeftForeArm bones!
 */
function BoneTrackedClinicalGear({
  spine2GroupRef,
  headGroupRef,
  leftHandGroupRef,
  rightHandGroupRef,
  leftForearmGroupRef,
  showStethoscope,
  showBadge,
  wearMask,
  wearVest,
  vestColor = '#f59e0b',
  wearGloves,
  gloveColor = '#0ea5e9',
  visorStyle = 'none',
  capColor = '#1b3b5f',
  carriedProp = 'none',
  accentColor,
}: {
  spine2GroupRef: React.RefObject<THREE.Group | null>;
  headGroupRef: React.RefObject<THREE.Group | null>;
  leftHandGroupRef: React.RefObject<THREE.Group | null>;
  rightHandGroupRef: React.RefObject<THREE.Group | null>;
  leftForearmGroupRef: React.RefObject<THREE.Group | null>;
  showStethoscope?: boolean;
  showBadge?: boolean;
  wearMask?: boolean;
  wearVest?: boolean;
  vestColor?: string;
  wearGloves?: boolean;
  gloveColor?: string;
  visorStyle?: ResponderVisorStyle;
  capColor?: string;
  carriedProp?: CarriedClinicalProp;
  accentColor: string;
}) {
  const stethoLeftCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.072, 0.145, -0.015),
        new THREE.Vector3(-0.102, 0.085, 0.088),
        new THREE.Vector3(-0.076, -0.035, 0.138),
        new THREE.Vector3(-0.056, -0.105, 0.142),
      ]),
    []
  );

  const stethoRightCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.072, 0.145, -0.015),
        new THREE.Vector3(0.0, 0.155, -0.072),
        new THREE.Vector3(0.076, 0.145, -0.015),
        new THREE.Vector3(0.102, 0.072, 0.092),
        new THREE.Vector3(0.088, -0.025, 0.142),
      ]),
    []
  );

  return (
    <>
      {/* CHEST / TORSO (`Spine2` Follower) */}
      <group ref={spine2GroupRef}>
        {/* High-Visibility ANSI Reflective Emergency / Triage Vest */}
        {wearVest && (
          <group position={[0, -0.05, 0.005]}>
            {/* Contoured Left & Right Front Zip Panels */}
            {[-0.085, 0.085].map((vx, idx) => (
              <group key={idx} position={[vx, 0, 0.118]}>
                <mesh castShadow>
                  <boxGeometry args={[0.115, 0.36, 0.016]} />
                  <meshStandardMaterial
                    color={vestColor}
                    roughness={0.58}
                    metalness={0.06}
                  />
                </mesh>
                {/* Dual Silver Retro-Reflective ANSI Stripes */}
                {[-0.08, 0.03].map((sy, sIdx) => (
                  <mesh key={sIdx} position={[0, sy, 0.009]}>
                    <planeGeometry args={[0.114, 0.024]} />
                    <meshStandardMaterial
                      color="#f1f5f9"
                      emissive="#e2e8f0"
                      emissiveIntensity={0.22}
                      roughness={0.22}
                      metalness={0.65}
                    />
                  </mesh>
                ))}
              </group>
            ))}
            {/* Back Vest Panel + Reflective Crossbar */}
            <group position={[0, 0.01, -0.112]}>
              <mesh castShadow>
                <boxGeometry args={[0.28, 0.37, 0.016]} />
                <meshStandardMaterial color={vestColor} roughness={0.58} />
              </mesh>
              <mesh position={[0, 0.04, -0.009]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[0.27, 0.028]} />
                <meshStandardMaterial
                  color="#f1f5f9"
                  emissive="#e2e8f0"
                  emissiveIntensity={0.22}
                  roughness={0.22}
                  metalness={0.65}
                />
              </mesh>
            </group>
          </group>
        )}

        {/* Binaural Clinical Stethoscope */}
        {showStethoscope && (
          <group>
            <mesh castShadow>
              <tubeGeometry args={[stethoLeftCurve, 18, 0.0068, 8, false]} />
              <meshStandardMaterial
                color="#0f172a"
                roughness={0.38}
                metalness={0.28}
              />
            </mesh>
            <mesh castShadow>
              <tubeGeometry args={[stethoRightCurve, 20, 0.0068, 8, false]} />
              <meshStandardMaterial
                color="#0f172a"
                roughness={0.38}
                metalness={0.28}
              />
            </mesh>
            <mesh position={[0.088, -0.038, 0.146]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.019, 0.016, 0.012, 16]} />
              <meshStandardMaterial
                color="#e2e8f0"
                roughness={0.18}
                metalness={0.9}
              />
            </mesh>
          </group>
        )}

        {/* Clinical Hospital / Responder Photo ID Badge */}
        {showBadge && (
          <group position={[-0.088, 0.015, 0.138]} rotation={[-0.06, 0.12, 0]}>
            <mesh position={[0, 0.032, 0]}>
              <boxGeometry args={[0.02, 0.013, 0.008]} />
              <meshStandardMaterial
                color="#94a3b8"
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[0.05, 0.068, 0.005]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.28} />
            </mesh>
            {/* Role Color Header Band */}
            <mesh position={[0, 0.022, 0.003]}>
              <planeGeometry args={[0.046, 0.015]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
            {/* Simulated ID Portrait Square + Barcode Lines */}
            <mesh position={[-0.012, -0.002, 0.003]}>
              <planeGeometry args={[0.016, 0.018]} />
              <meshBasicMaterial color="#334155" />
            </mesh>
            <mesh position={[0.009, -0.002, 0.003]}>
              <planeGeometry args={[0.02, 0.005]} />
              <meshBasicMaterial color="#64748b" />
            </mesh>
            <mesh position={[0, -0.022, 0.003]}>
              <planeGeometry args={[0.038, 0.006]} />
              <meshBasicMaterial color="#0f172a" />
            </mesh>
          </group>
        )}
      </group>

      {/* HEAD (`Head` Bone Follower: Surgical Mask, Safety Glasses, Face Shield, Scrub Cap) */}
      <group ref={headGroupRef}>
        {wearMask && (
          <group position={[0, 0.022, 0.095]}>
            <mesh rotation={[0.08, 0, 0]}>
              <cylinderGeometry
                args={[0.072, 0.062, 0.068, 18, 1, true, -Math.PI * 0.34, Math.PI * 0.68]}
              />
              <meshStandardMaterial
                color="#7dd3fc"
                roughness={0.78}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* White Nose Bridge Strip */}
            <mesh position={[0, 0.032, 0.068]}>
              <boxGeometry args={[0.056, 0.006, 0.008]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.5} />
            </mesh>
          </group>
        )}

        {(visorStyle === 'safety_glasses' || visorStyle === 'tinted_tactical') && (
          <group position={[0, 0.078, 0.088]}>
            {/* Wraparound Polycarbonate Safety Lens + Brow Bar */}
            <mesh>
              <cylinderGeometry
                args={[0.078, 0.078, 0.028, 18, 1, true, -Math.PI * 0.34, Math.PI * 0.68]}
              />
              <meshPhysicalMaterial
                color={visorStyle === 'tinted_tactical' ? '#082f49' : '#e0f2fe'}
                transparent
                opacity={visorStyle === 'tinted_tactical' ? 0.68 : 0.38}
                roughness={0.08}
                metalness={0.12}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0.015, 0.074]}>
              <boxGeometry args={[0.118, 0.005, 0.01]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>
          </group>
        )}

        {visorStyle === 'clear_shield' && (
          <group position={[0, 0.082, 0.098]}>
            <mesh position={[0, 0.036, 0.065]}>
              <boxGeometry args={[0.135, 0.016, 0.022]} />
              <meshStandardMaterial color="#0284c7" roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.012, 0]}>
              <cylinderGeometry
                args={[0.095, 0.095, 0.115, 20, 1, true, -Math.PI * 0.36, Math.PI * 0.72]}
              />
              <meshPhysicalMaterial
                color="#bae6fd"
                transparent
                opacity={0.34}
                roughness={0.06}
                metalness={0.08}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )}

        {visorStyle === 'surgical_cap' && (
          <group position={[0, 0.145, -0.008]} rotation={[-0.12, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.098, 0.104, 0.072, 24]} />
              <meshStandardMaterial color={capColor} roughness={0.78} />
            </mesh>
            <mesh position={[0, 0.036, 0]} scale={[1, 0.42, 1.06]}>
              <sphereGeometry args={[0.098, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={capColor} roughness={0.8} />
            </mesh>
          </group>
        )}
      </group>

      {/* HANDS (`LeftHand` & `RightHand` Nitrile Clinical Gloves + Carried Kit) */}
      <group ref={leftHandGroupRef}>
        {wearGloves && (
          <group>
            <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.032, 0.005, 8, 18]} />
              <meshStandardMaterial color={gloveColor} roughness={0.34} />
            </mesh>
            <mesh position={[0, -0.045, 0]}>
              <capsuleGeometry args={[0.034, 0.055, 6, 12]} />
              <meshStandardMaterial color={gloveColor} roughness={0.36} />
            </mesh>
          </group>
        )}
      </group>

      <group ref={rightHandGroupRef}>
        {wearGloves && (
          <group>
            <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.032, 0.005, 8, 18]} />
              <meshStandardMaterial color={gloveColor} roughness={0.34} />
            </mesh>
            <mesh position={[0, -0.045, 0]}>
              <capsuleGeometry args={[0.034, 0.055, 6, 12]} />
              <meshStandardMaterial color={gloveColor} roughness={0.36} />
            </mesh>
          </group>
        )}
        {carriedProp === 'med_kit' && (
          <group position={[-0.04, -0.14, 0.03]} rotation={[0, 0, 0.12]}>
            <mesh castShadow>
              <boxGeometry args={[0.095, 0.16, 0.22]} />
              <meshStandardMaterial color="#dc2626" roughness={0.52} />
            </mesh>
            <mesh position={[0.049, 0, 0]}>
              <boxGeometry args={[0.004, 0.032, 0.21]} />
              <meshStandardMaterial
                color="#f8fafc"
                emissive="#e2e8f0"
                emissiveIntensity={0.2}
              />
            </mesh>
            <mesh position={[0, 0.095, 0]}>
              <boxGeometry args={[0.025, 0.03, 0.09]} />
              <meshStandardMaterial color="#0f172a" roughness={0.6} />
            </mesh>
          </group>
        )}
      </group>

      {/* LEFT FOREARM (`LeftForeArm` Clinical Chart / Triage Tablet) */}
      <group ref={leftForearmGroupRef}>
        {carriedProp === 'clipboard' && (
          <group position={[0.045, -0.14, 0.055]} rotation={[0.35, 0.25, -0.2]}>
            <mesh castShadow>
              <boxGeometry args={[0.19, 0.25, 0.012]} />
              <meshStandardMaterial color="#1e293b" roughness={0.42} metalness={0.35} />
            </mesh>
            <mesh position={[0, 0, 0.008]}>
              <planeGeometry args={[0.165, 0.22]} />
              <meshBasicMaterial color="#e0f2fe" />
            </mesh>
            <mesh position={[0, 0.11, 0.01]}>
              <boxGeometry args={[0.07, 0.02, 0.012]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        )}
      </group>
    </>
  );
}

function syncFollowerToBone(
  follower: THREE.Group | null,
  bone: THREE.Bone | null,
  rootGroup: THREE.Group | null
) {
  if (!follower || !bone || !rootGroup) return;
  _invRootMat.copy(rootGroup.matrixWorld).invert();
  _boneLocalMat.multiplyMatrices(_invRootMat, bone.matrixWorld);
  _boneLocalMat.decompose(_tempVecA, _tempQuat, _tempScale);
  follower.position.copy(_tempVecA);
  follower.quaternion.copy(_tempQuat);
  follower.scale.set(1, 1, 1);
}

export interface StandingHumanoidProps {
  modelKey: HumanoidModelKey;
  position?: [number, number, number];
  rotationY?: number;
  targetHeight?: number;
  clip?: HumanoidClipKind;
  /** Optional clinical patrol waypoints [x, y, z] — NPC smoothly walks, turns, and pauses to examine/coordinate */
  patrolWaypoints?: [number, number, number][];
  patrolPauseSec?: number;
  patrolWalkSpeed?: number;
  /** Dynamic target station override (e.g., team response to CPR / Code Blue / Alarm) */
  priorityTargetPos?: [number, number, number] | null;
  priorityFocusYaw?: number;
  priorityClip?: HumanoidClipKind;
  /** Optional world-space point for natural head/eye gaze tracking (colleague speaking or active patient) */
  gazeTargetWorld?: [number, number, number] | null;
  /** Live player world position ref so supporting staff smoothly step out of the player's way & glance naturally */
  playerWorldPosRef?: React.RefObject<THREE.Vector3 | null>;
  enablePlayerYield?: boolean;
  /** Active speech/communication indicator for lip/brow micro-animation & subtle role status */
  isCommunicating?: boolean;
  communicationLine?: string | null;
  autoNaturalCycle?: boolean;
  isPaused?: boolean;
  reducedMotion?: boolean;
  skinColor?: string;
  topColor?: string;
  bottomColor?: string;
  footwearColor?: string;
  topFabricStyle?: GarmentFabricStyle;
  bottomFabricStyle?: GarmentFabricStyle;
  footwearFabricStyle?: GarmentFabricStyle;
  showBeard?: boolean;
  showGlasses?: boolean;
  showStethoscope?: boolean;
  showBadge?: boolean;
  wearMask?: boolean;
  wearVest?: boolean;
  vestColor?: string;
  wearGloves?: boolean;
  gloveColor?: string;
  visorStyle?: ResponderVisorStyle;
  carriedProp?: CarriedClinicalProp;
  accentColor?: string;
  overallTint?: string;
  tintStrength?: number;
  roleBadge?: string;
}

export const StandingHumanoid: React.FC<StandingHumanoidProps> = ({
  modelKey,
  position = [0, 0, 0],
  rotationY = 0,
  targetHeight = 1.76,
  clip = 'idle',
  patrolWaypoints,
  patrolPauseSec = 5.5,
  patrolWalkSpeed = 1.15,
  priorityTargetPos = null,
  priorityFocusYaw,
  priorityClip = 'examine',
  gazeTargetWorld = null,
  playerWorldPosRef,
  enablePlayerYield = false,
  isCommunicating = false,
  communicationLine = null,
  autoNaturalCycle = true,
  isPaused = false,
  reducedMotion = false,
  skinColor,
  topColor,
  bottomColor,
  footwearColor = '#0f172a',
  topFabricStyle = 'scrubs_top',
  bottomFabricStyle = 'scrubs_bottom',
  footwearFabricStyle = 'medical_footwear',
  showBeard = false,
  showGlasses = false,
  showStethoscope = false,
  showBadge = false,
  wearMask = false,
  wearVest = false,
  vestColor = '#f59e0b',
  wearGloves = false,
  gloveColor = '#0ea5e9',
  visorStyle = 'none',
  carriedProp = 'none',
  accentColor = '#0ea5e9',
  overallTint,
  tintStrength,
  roleBadge,
}) => {
  const { bundle, failed } = useHumanoidBundle();
  const rootGroupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Partial<Record<HumanoidClipKind, THREE.AnimationAction>>>({});
  const activeClipRef = useRef<HumanoidClipKind>('idle');

  // Bone-tracked accessory group refs
  const spine2FollowerRef = useRef<THREE.Group>(null);
  const headFollowerRef = useRef<THREE.Group>(null);
  const leftHandFollowerRef = useRef<THREE.Group>(null);
  const rightHandFollowerRef = useRef<THREE.Group>(null);
  const leftForearmFollowerRef = useRef<THREE.Group>(null);

  const phaseOffset = useMemo(
    () =>
      Math.abs(
        position[0] * 1.93 +
          position[2] * 2.47 +
          modelKey.length * 0.71 +
          targetHeight * 3.1
      ) % 11.3,
    [position, modelKey, targetHeight]
  );

  // Locomotion & gaze state refs (zero React re-renders per frame)
  const patrolIdxRef = useRef(0);
  const patrolWaitTimerRef = useRef(patrolPauseSec * 0.45 + (phaseOffset % 3.2));
  const currentPosRef = useRef(new THREE.Vector3(position[0], position[1], position[2]));
  const currentYawRef = useRef(rotationY);
  const dampedHeadYawRef = useRef(0);
  const dampedHeadPitchRef = useRef(0);
  const cycleTimerRef = useRef(3.4 + (phaseOffset % 4.1));
  const idleStepCounterRef = useRef(Math.floor(phaseOffset * 3));

  // Blinking & eye saccade physiological timers
  const nextBlinkInRef = useRef(1.8 + (phaseOffset % 3.4));
  const blinkElapsedRef = useRef(-1);
  const saccadeTimerRef = useRef(1.5 + (phaseOffset % 2.1));
  const eyeTargetXRef = useRef(0);
  const eyeTargetYRef = useRef(0);
  const eyeCurrXRef = useRef(0);
  const eyeCurrYRef = useRef(0);

  useEffect(() => {
    currentPosRef.current.set(position[0], position[1], position[2]);
    currentYawRef.current = rotationY;
    if (rootGroupRef.current) {
      rootGroupRef.current.position.copy(currentPosRef.current);
      rootGroupRef.current.rotation.y = currentYawRef.current;
    }
  }, [position[0], position[1], position[2], rotationY]);

  const clonedData = useMemo(() => {
    if (!bundle) return null;
    const srcGltf = bundle[modelKey];
    const clonedScene = SkeletonUtils.clone(srcGltf.scene);
    const { rawHeight, minY } = bundle.heights[modelKey];
    const scale = targetHeight / rawHeight;
    const groundOffsetY = -minY * scale;

    const spine2 = findHumanoidBone(clonedScene, 'Spine2');
    const neck = findHumanoidBone(clonedScene, 'Neck');
    const head = findHumanoidBone(clonedScene, 'Head');
    const leftEye = findHumanoidBone(clonedScene, 'LeftEye');
    const rightEye = findHumanoidBone(clonedScene, 'RightEye');
    const leftHand = findHumanoidBone(clonedScene, 'LeftHand');
    const rightHand = findHumanoidBone(clonedScene, 'RightHand');
    const leftForeArm = findHumanoidBone(clonedScene, 'LeftForeArm');
    const morphs = collectMorphMeshes(clonedScene);

    return {
      clonedScene,
      scale,
      groundOffsetY,
      bones: {
        spine2,
        neck,
        head,
        leftEye,
        rightEye,
        leftHand,
        rightHand,
        leftForeArm,
      },
      morphs,
    };
  }, [bundle, modelKey, targetHeight]);

  useLayoutEffect(() => {
    if (!clonedData) return;
    customizeClonedMaterials(clonedData.clonedScene, {
      modelKey,
      skinToneHex: skinColor,
      topTintHex: topColor,
      bottomTintHex: bottomColor,
      footwearTintHex: footwearColor,
      trimTintHex: accentColor,
      topFabricStyle,
      bottomFabricStyle,
      footwearFabricStyle,
      showBeard,
      showGlasses,
      overallTint,
      tintStrength,
    });
  }, [
    clonedData,
    modelKey,
    skinColor,
    topColor,
    bottomColor,
    footwearColor,
    accentColor,
    topFabricStyle,
    bottomFabricStyle,
    footwearFabricStyle,
    showBeard,
    showGlasses,
    overallTint,
    tintStrength,
  ]);

  const switchToClip = (nextKind: HumanoidClipKind, fadeSec = 0.36) => {
    const actions = actionsRef.current;
    const nextAction = actions[nextKind] || actions.idle;
    if (!nextAction || activeClipRef.current === nextKind) return;

    const prevAction = actions[activeClipRef.current];
    nextAction.reset().play();
    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, fadeSec, false);
    } else {
      nextAction.fadeIn(fadeSec);
    }
    activeClipRef.current = nextKind;
  };

  useEffect(() => {
    if (!bundle || !clonedData) return;
    const mixer = new THREE.AnimationMixer(clonedData.clonedScene);
    mixerRef.current = mixer;
    const map: Partial<Record<HumanoidClipKind, THREE.AnimationAction>> = {};

    const clipBank =
      modelKey === 'responder_male' || modelKey === 'operator'
        ? bundle.maleClips
        : modelKey === 'medic_female'
        ? bundle.femaleClips
        : modelKey === 'clinician'
        ? bundle.clinicianClips
        : bundle.michelleClips;

    (Object.keys(clipBank) as HumanoidClipKind[]).forEach((k) => {
      map[k] = mixer.clipAction(clipBank[k]);
    });

    actionsRef.current = map;
    const initialKind =
      clip === 'idle' && Math.floor(phaseOffset) % 2 === 1 ? 'idle_02' : clip;
    const initial = map[initialKind] || map.idle;
    if (initial) {
      initial.reset().play();
      mixer.update(phaseOffset * 0.43);
      activeClipRef.current = initialKind;
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedData.clonedScene);
      mixerRef.current = null;
    };
  }, [bundle, clonedData, modelKey, phaseOffset]);

  useEffect(() => {
    switchToClip(clip, 0.32);
  }, [clip]);

  useR3FFrame((state, rawDelta) => {
    if (!clonedData || !rootGroupRef.current) return;
    const dt = Math.min(rawDelta, 0.08);

    if (!isPaused && !reducedMotion) {
      let actualMoveSpeed = 0;
      let desiredBodyYaw = currentYawRef.current;

      // 1. Check Dynamic Player Proximity Yielding so supporting staff NEVER block or clip the player!
      const playerPos = playerWorldPosRef?.current;
      let yieldingToPlayer = false;
      if (enablePlayerYield && playerPos) {
        const px = currentPosRef.current.x - playerPos.x;
        const pz = currentPosRef.current.z - playerPos.z;
        const pDist = Math.hypot(px, pz);
        if (pDist < 1.22 && pDist > 0.001) {
          yieldingToPlayer = true;
          const pushStep = Math.min(1.22 - pDist, 1.35 * dt);
          currentPosRef.current.x += (px / pDist) * pushStep;
          currentPosRef.current.z += (pz / pDist) * pushStep;
          actualMoveSpeed = pushStep / Math.max(0.016, dt);
          // Turn respectfully toward player while stepping aside
          desiredBodyYaw = Math.atan2(-px, -pz);
          if (actualMoveSpeed > 0.35 && activeClipRef.current !== 'walk') {
            switchToClip('walk', 0.24);
          }
        }
      }

      // 2. Priority Team Response Target OR Waypoint Clinical Patrol
      if (!yieldingToPlayer && priorityTargetPos) {
        const dx = priorityTargetPos[0] - currentPosRef.current.x;
        const dz = priorityTargetPos[2] - currentPosRef.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.1) {
          const speed = patrolWalkSpeed * 1.18;
          const step = Math.min(dist, speed * dt);
          currentPosRef.current.x += (dx / dist) * step;
          currentPosRef.current.z += (dz / dist) * step;
          actualMoveSpeed = speed;
          desiredBodyYaw = Math.atan2(dx, dz);
          if (activeClipRef.current !== 'walk') {
            switchToClip('walk', 0.25);
          }
        } else {
          desiredBodyYaw = priorityFocusYaw ?? rotationY;
          const targetAnim = isCommunicating ? 'talk_02' : priorityClip;
          if (
            activeClipRef.current === 'walk' ||
            activeClipRef.current !== targetAnim
          ) {
            switchToClip(targetAnim, 0.38);
          }
        }
      } else if (
        !yieldingToPlayer &&
        patrolWaypoints &&
        patrolWaypoints.length >= 2
      ) {
        if (patrolWaitTimerRef.current > 0) {
          patrolWaitTimerRef.current -= dt;
          desiredBodyYaw = rotationY;

          const stationClips: HumanoidClipKind[] = isCommunicating
            ? ['talk_02', 'examine']
            : ['examine', 'idle_var', 'gesture', 'idle_var_02'];
          if (activeClipRef.current === 'walk') {
            const pick =
              stationClips[
                (patrolIdxRef.current + idleStepCounterRef.current) %
                  stationClips.length
              ];
            switchToClip(pick, 0.38);
          }
        } else {
          const nextIdx = (patrolIdxRef.current + 1) % patrolWaypoints.length;
          const targetPt = patrolWaypoints[nextIdx];
          const dx = targetPt[0] - currentPosRef.current.x;
          const dz = targetPt[2] - currentPosRef.current.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.08) {
            currentPosRef.current.set(targetPt[0], targetPt[1], targetPt[2]);
            patrolIdxRef.current = nextIdx;
            idleStepCounterRef.current += 1;
            patrolWaitTimerRef.current =
              patrolPauseSec + ((idleStepCounterRef.current * 1.3) % 2.4);
            const arrivalClips: HumanoidClipKind[] = [
              'examine',
              'idle_var',
              'talk_02',
              'idle_var_02',
            ];
            switchToClip(
              arrivalClips[idleStepCounterRef.current % arrivalClips.length],
              0.38
            );
          } else {
            if (activeClipRef.current !== 'walk') {
              switchToClip('walk', 0.26);
            }
            const step = Math.min(dist, patrolWalkSpeed * dt);
            currentPosRef.current.x += (dx / dist) * step;
            currentPosRef.current.z += (dz / dist) * step;
            actualMoveSpeed = patrolWalkSpeed;
            desiredBodyYaw = Math.atan2(dx, dz);
          }
        }
      } else if (!yieldingToPlayer && autoNaturalCycle && clip === 'idle') {
        desiredBodyYaw = rotationY;
        cycleTimerRef.current -= dt;
        if (cycleTimerRef.current <= 0) {
          idleStepCounterRef.current += 1;
          const variedPool: HumanoidClipKind[] = isCommunicating
            ? ['talk_02', 'examine', 'gesture']
            : [
                'idle',
                'idle_var',
                'idle_02',
                'examine',
                'idle_var_02',
                'gesture',
              ];
          const chosen =
            variedPool[idleStepCounterRef.current % variedPool.length];
          switchToClip(chosen, 0.48);
          cycleTimerRef.current = 4.2 + ((idleStepCounterRef.current * 1.7) % 3.5);
        }
      } else if (!yieldingToPlayer) {
        desiredBodyYaw = rotationY;
      }

      // Velocity-matched foot contact speed so feet never slide
      const walkAct = actionsRef.current.walk;
      if (walkAct && activeClipRef.current === 'walk') {
        walkAct.timeScale = THREE.MathUtils.clamp(
          (actualMoveSpeed || patrolWalkSpeed) / 1.14,
          0.75,
          1.35
        );
      }

      // Smooth damped body rotation (pelvis follows head rather than snapping instantly)
      const bodyYawDiff =
        ((desiredBodyYaw - currentYawRef.current + Math.PI * 3) %
          (Math.PI * 2)) -
        Math.PI;
      currentYawRef.current += bodyYawDiff * Math.min(1, dt * 5.2);
      rootGroupRef.current.position.copy(currentPosRef.current);
      rootGroupRef.current.rotation.y = currentYawRef.current;

      // 3. Advance Skeletal AnimationMixer
      if (mixerRef.current) {
        mixerRef.current.update(dt);
      }

      // 4. Natural Head/Neck Gaze Tracking (Leads turns & tracks speaking colleagues / nearby player)
      let targetLocalHeadYaw = THREE.MathUtils.clamp(bodyYawDiff * 0.55, -0.5, 0.5);
      let targetLocalHeadPitch = 0;

      const resolvedGazeTarget: [number, number, number] | null =
        gazeTargetWorld ||
        (playerPos &&
        Math.hypot(
          playerPos.x - currentPosRef.current.x,
          playerPos.z - currentPosRef.current.z
        ) < 2.85
          ? [playerPos.x, 1.62, playerPos.z]
          : null);

      if (resolvedGazeTarget && activeClipRef.current !== 'walk') {
        const gx = resolvedGazeTarget[0] - currentPosRef.current.x;
        const gy = resolvedGazeTarget[1] - (currentPosRef.current.y + targetHeight * 0.9);
        const gz = resolvedGazeTarget[2] - currentPosRef.current.z;
        const horizDist = Math.max(0.2, Math.hypot(gx, gz));
        const worldLookYaw = Math.atan2(gx, gz);
        const relYaw =
          ((worldLookYaw - currentYawRef.current + Math.PI * 3) %
            (Math.PI * 2)) -
          Math.PI;
        if (Math.abs(relYaw) < 1.25) {
          targetLocalHeadYaw = THREE.MathUtils.clamp(relYaw * 0.68, -0.58, 0.58);
          targetLocalHeadPitch = THREE.MathUtils.clamp(
            -Math.atan2(gy, horizDist) * 0.55,
            -0.28,
            0.32
          );
        }
      }

      dampedHeadYawRef.current = THREE.MathUtils.damp(
        dampedHeadYawRef.current,
        targetLocalHeadYaw,
        7.5,
        dt
      );
      dampedHeadPitchRef.current = THREE.MathUtils.damp(
        dampedHeadPitchRef.current,
        targetLocalHeadPitch,
        7.5,
        dt
      );

      if (clonedData.bones.neck) {
        _tempEuler.set(
          dampedHeadPitchRef.current * 0.4,
          dampedHeadYawRef.current * 0.42,
          0
        );
        _tempQuatB.setFromEuler(_tempEuler);
        clonedData.bones.neck.quaternion.multiply(_tempQuatB);
      }
      if (clonedData.bones.head) {
        _tempEuler.set(
          dampedHeadPitchRef.current * 0.6,
          dampedHeadYawRef.current * 0.58,
          0
        );
        _tempQuatB.setFromEuler(_tempEuler);
        clonedData.bones.head.quaternion.multiply(_tempQuatB);
      }

      // 5. Physiological Blinking, Eye Saccades & Subtle Communication Morphs
      nextBlinkInRef.current -= dt;
      if (nextBlinkInRef.current <= 0 && blinkElapsedRef.current < 0) {
        blinkElapsedRef.current = 0;
        // Occasional natural human double-blink
        const isDouble = Math.floor(state.clock.elapsedTime + phaseOffset) % 5 === 0;
        nextBlinkInRef.current = isDouble ? 0.26 : 2.8 + ((phaseOffset * 1.7) % 2.9);
      }

      let blinkWeight = 0;
      if (blinkElapsedRef.current >= 0) {
        blinkElapsedRef.current += dt;
        const dur = 0.145;
        if (blinkElapsedRef.current >= dur) {
          blinkElapsedRef.current = -1;
          blinkWeight = 0;
        } else {
          blinkWeight = Math.sin((blinkElapsedRef.current / dur) * Math.PI);
        }
      }

      saccadeTimerRef.current -= dt;
      if (saccadeTimerRef.current <= 0) {
        const seed = Math.sin(state.clock.elapsedTime * 3.17 + phaseOffset * 5.1);
        const seedY = Math.cos(state.clock.elapsedTime * 2.41 + phaseOffset * 3.7);
        eyeTargetXRef.current = seed * 0.24;
        eyeTargetYRef.current = seedY * 0.14;
        saccadeTimerRef.current = 1.4 + Math.abs(seed) * 2.1;
      }
      eyeCurrXRef.current = THREE.MathUtils.damp(
        eyeCurrXRef.current,
        eyeTargetXRef.current,
        12,
        dt
      );
      eyeCurrYRef.current = THREE.MathUtils.damp(
        eyeCurrYRef.current,
        eyeTargetYRef.current,
        12,
        dt
      );

      if (clonedData.morphs.length > 0) {
        setMorphValue(
          clonedData.morphs,
          ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'],
          blinkWeight
        );
        const lx = eyeCurrXRef.current;
        const ly = eyeCurrYRef.current;
        setMorphValue(
          clonedData.morphs,
          ['eyeLookOutLeft', 'eyeLookInRight'],
          Math.max(0, lx)
        );
        setMorphValue(
          clonedData.morphs,
          ['eyeLookInLeft', 'eyeLookOutRight'],
          Math.max(0, -lx)
        );
        setMorphValue(
          clonedData.morphs,
          ['eyeLookUpLeft', 'eyeLookUpRight', 'eyesLookUp'],
          Math.max(0, ly)
        );
        setMorphValue(
          clonedData.morphs,
          ['eyeLookDownLeft', 'eyeLookDownRight', 'eyesLookDown'],
          Math.max(0, -ly)
        );

        // Subtle conversational mouth & brow articulation when communicating with team
        const talkWave = isCommunicating
          ? Math.max(
              0,
              Math.sin(state.clock.elapsedTime * 9.5 + phaseOffset) *
                Math.cos(state.clock.elapsedTime * 3.7) *
                0.34
            )
          : 0;
        setMorphValue(
          clonedData.morphs,
          ['jawOpen', 'mouthOpen', 'viseme_aa'],
          talkWave
        );
        setMorphValue(
          clonedData.morphs,
          ['browInnerUp'],
          isCommunicating ? 0.22 : 0.04
        );
      }

      if (clonedData.bones.leftEye && clonedData.bones.rightEye) {
        _tempEuler.set(-eyeCurrYRef.current * 0.14, eyeCurrXRef.current * 0.18, 0);
        _tempQuatB.setFromEuler(_tempEuler);
        clonedData.bones.leftEye.quaternion.multiply(_tempQuatB);
        clonedData.bones.rightEye.quaternion.multiply(_tempQuatB);
      }
    }

    // 6. Update World Matrices & Sync Bone-Tracked Clinical Gear 1:1
    rootGroupRef.current.updateMatrixWorld(true);
    syncFollowerToBone(
      spine2FollowerRef.current,
      clonedData.bones.spine2,
      rootGroupRef.current
    );
    syncFollowerToBone(
      headFollowerRef.current,
      clonedData.bones.head,
      rootGroupRef.current
    );
    syncFollowerToBone(
      leftHandFollowerRef.current,
      clonedData.bones.leftHand,
      rootGroupRef.current
    );
    syncFollowerToBone(
      rightHandFollowerRef.current,
      clonedData.bones.rightHand,
      rootGroupRef.current
    );
    syncFollowerToBone(
      leftForearmFollowerRef.current,
      clonedData.bones.leftForeArm,
      rootGroupRef.current
    );
  });

  if (!clonedData) {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <CharacterLoadingIndicator failed={failed} />
      </group>
    );
  }

  return (
    <group ref={rootGroupRef} position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, clonedData.groundOffsetY, 0]} scale={clonedData.scale}>
        <primitive object={clonedData.clonedScene} />
      </group>

      <BoneTrackedClinicalGear
        spine2GroupRef={spine2FollowerRef}
        headGroupRef={headFollowerRef}
        leftHandGroupRef={leftHandFollowerRef}
        rightHandGroupRef={rightHandFollowerRef}
        leftForearmGroupRef={leftForearmFollowerRef}
        showStethoscope={showStethoscope}
        showBadge={showBadge}
        wearMask={wearMask}
        wearVest={wearVest}
        vestColor={vestColor}
        wearGloves={wearGloves}
        gloveColor={gloveColor}
        visorStyle={visorStyle}
        capColor={topColor || '#1b3b5f'}
        carriedProp={carriedProp}
        accentColor={accentColor}
      />

      {(roleBadge || communicationLine) && (
        <Html
          position={[0, targetHeight + 0.16, 0]}
          center
          distanceFactor={9}
          zIndexRange={[5, 0]}
        >
          <div className="flex flex-col items-center gap-0.5 pointer-events-none">
            {communicationLine && (
              <div className="px-2 py-0.5 rounded bg-cyan-950/92 border border-cyan-400/70 text-[9px] font-medium text-cyan-100 whitespace-nowrap shadow">
                {communicationLine}
              </div>
            )}
            {roleBadge && (
              <div className="px-2 py-0.5 rounded bg-slate-950/88 border border-slate-700/80 text-[9px] font-semibold tracking-wider uppercase text-slate-200 whitespace-nowrap">
                {roleBadge}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

/**
 * Main Playable Healthcare Emergency-Response Trainee Character
 * Professional medical scrubs or EMS responder uniform, ID badge, stethoscope,
 * nitrile procedure gloves, closed medical footwear, and optional PPE mask / safety glasses / vest.
 */
export const ResponderHumanoidCharacter: React.FC<{
  profile: ResponderCustomization;
  position?: [number, number, number];
  rotationY?: number;
  isPaused?: boolean;
  reducedMotion?: boolean;
  clip?: HumanoidClipKind;
  roleBadge?: string;
}> = ({
  profile,
  position = [0, 0, 0],
  rotationY = 0,
  isPaused = false,
  reducedMotion = false,
  clip = 'idle',
  roleBadge,
}) => {
  const preset =
    UNIFORM_PRESETS[profile.uniformId] || UNIFORM_PRESETS.trauma_navy;
  const isFemale = profile.bodyModel === 'female';
  const isEmsOrSurge =
    profile.uniformId === 'tactical_slate' ||
    profile.uniformId === 'hazmat_amber';
  const wearVest =
    profile.wearVest !== undefined
      ? profile.wearVest
      : profile.uniformId === 'hazmat_amber';
  const wearGloves = profile.wearGloves !== false;

  return (
    <StandingHumanoid
      modelKey={isFemale ? 'medic_female' : 'responder_male'}
      position={position}
      rotationY={rotationY}
      targetHeight={isFemale ? 1.7 : 1.78}
      clip={clip}
      autoNaturalCycle={clip === 'idle'}
      isPaused={isPaused}
      reducedMotion={reducedMotion}
      skinColor={profile.skinTone}
      topColor={preset.primaryColor}
      bottomColor={preset.secondaryColor}
      footwearColor="#0f172a"
      topFabricStyle={isEmsOrSurge ? 'ems_uniform_top' : 'scrubs_top'}
      bottomFabricStyle={isEmsOrSurge ? 'ems_trousers' : 'scrubs_bottom'}
      footwearFabricStyle="medical_footwear"
      showBeard={false}
      showGlasses={false}
      showStethoscope={true}
      showBadge={true}
      wearMask={Boolean(profile.wearMask)}
      wearVest={wearVest}
      vestColor={
        profile.uniformId === 'tactical_slate' ? '#10b981' : '#f59e0b'
      }
      wearGloves={wearGloves}
      gloveColor={profile.gloveColor || preset.defaultGloveColor}
      visorStyle={profile.visorStyle || 'safety_glasses'}
      accentColor={preset.trimColor}
      roleBadge={roleBadge}
    />
  );
};

interface ResolvedPatientAppearance {
  modelKey: HumanoidModelKey;
  posture: 'supine' | 'protective_splint' | 'seated_bedside';
  targetHeight: number;
  supineBedY: number;
  skinColor?: string;
  topColor?: string;
  bottomColor?: string;
  footwearColor?: string;
  topFabricStyle?: GarmentFabricStyle;
  bottomFabricStyle?: GarmentFabricStyle;
  footwearFabricStyle?: GarmentFabricStyle;
  showHospitalBlanket: boolean;
  showIdBand: boolean;
  showBeard?: boolean;
  showGlasses?: boolean;
  overallTint?: string;
  tintStrength?: number;
}

/**
 * Scenario-accurate medical & trauma appearances:
 * - Cardiac Arrest inpatient wears a genuine snap-shoulder clinical hospital gown, ID band, non-slip socks & draped hospital blanket.
 * - Trauma & Mass-Casualty patients wear varied everyday civilian clothing matching their incident mechanism and distinct postures!
 */
function resolvePatientAppearance(
  patient: PatientState,
  isTriageMode: boolean
): ResolvedPatientAppearance {
  const bay = patient.bayNumber || 1;
  const isHypoxic =
    patient.spo2 < 86 || patient.conditionStatus === 'Arrest';

  if (!isTriageMode) {
    // Hospital Resuscitation Inpatient (PT-101 Arthur Pendelton, 58M — Clinical Gown + Hospital Blanket + Non-Slip Socks)
    return {
      modelKey: 'operator',
      posture: 'supine',
      targetHeight: 1.76,
      supineBedY: 0.995,
      skinColor: isHypoxic ? '#cbd5e1' : undefined,
      topColor: '#7dd3fc',
      bottomColor: '#bae6fd',
      footwearColor: '#cbd5e1',
      topFabricStyle: 'hospital_gown',
      bottomFabricStyle: 'hospital_gown',
      footwearFabricStyle: 'hospital_socks',
      showHospitalBlanket: true,
      showIdBand: true,
      showBeard: true,
    };
  }

  switch (bay % 5) {
    case 1:
      // Bay 01: PT-201 Marcus Vance, 34M — Severe Arterial Limb Hemorrhage (Everyday industrial workwear, supine in distress)
      return {
        modelKey: 'responder_male',
        posture: 'supine',
        targetHeight: 1.78,
        supineBedY: 0.995,
        skinColor: isHypoxic ? '#cbd5e1' : undefined,
        topColor: '#475569',
        bottomColor: '#1e293b',
        footwearColor: '#1c1917',
        topFabricStyle: 'civilian_workwear',
        bottomFabricStyle: 'civilian_trousers',
        footwearFabricStyle: 'medical_footwear',
        showHospitalBlanket: false,
        showIdBand: patient.examined,
      };
    case 2:
      // Bay 02: PT-202 Elena Rostova, 29F — Smoke Inhalation & Airway Distress (Everyday ribbed burgundy sweater & jeans, high Semi-Fowler)
      return {
        modelKey: 'medic_female',
        posture: 'supine',
        targetHeight: 1.68,
        supineBedY: 0.992,
        skinColor: isHypoxic ? '#cbd5e1' : undefined,
        topColor: '#7f1d1d',
        bottomColor: '#1e293b',
        footwearColor: '#334155',
        topFabricStyle: 'civilian_knit',
        bottomFabricStyle: 'civilian_trousers',
        footwearFabricStyle: 'medical_footwear',
        showHospitalBlanket: false,
        showIdBand: patient.examined,
        showGlasses: false,
      };
    case 3:
      // Bay 03: PT-203 David Okafor, 46M — Blunt Chest Contusion (Everyday olive commuter shirt & slacks, protective rib-splinting posture)
      return {
        modelKey: 'clinician',
        posture: 'protective_splint',
        targetHeight: 1.76,
        supineBedY: 0.995,
        skinColor: '#8d5b3e',
        topColor: '#3f6212',
        bottomColor: '#27272a',
        footwearColor: '#18181b',
        topFabricStyle: 'civilian_workwear',
        bottomFabricStyle: 'civilian_trousers',
        footwearFabricStyle: 'medical_footwear',
        showHospitalBlanket: false,
        showIdBand: patient.examined,
      };
    case 4:
      // Bay 04: PT-204 Chloe Lin, 22F — Ambulatory Minor Forearm Abrasion (Civilian outfit, SITTING UPRIGHT on bedside!)
      return {
        modelKey: 'michelle',
        posture: 'seated_bedside',
        targetHeight: 1.65,
        supineBedY: 1.032,
        showHospitalBlanket: false,
        showIdBand: patient.examined,
        overallTint: isHypoxic ? '#94a3b8' : undefined,
        tintStrength: 0.18,
      };
    default:
      // Bay 05+: Dynamic Surge Casualty (Distinct male civilian in charcoal knitwear, supine)
      return {
        modelKey: 'operator',
        posture: 'supine',
        targetHeight: 1.75,
        supineBedY: 0.995,
        topColor: '#334155',
        bottomColor: '#0f172a',
        footwearColor: '#1e293b',
        topFabricStyle: 'civilian_knit',
        bottomFabricStyle: 'civilian_trousers',
        footwearFabricStyle: 'medical_footwear',
        showHospitalBlanket: false,
        showIdBand: patient.examined,
        showBeard: false,
      };
  }
}

interface PatientBonesCache {
  spine: THREE.Bone | null;
  spine1: THREE.Bone | null;
  spine2: THREE.Bone | null;
  neck: THREE.Bone | null;
  head: THREE.Bone | null;
  leftArm: THREE.Bone | null;
  rightArm: THREE.Bone | null;
  leftForeArm: THREE.Bone | null;
  rightForeArm: THREE.Bone | null;
  leftHand: THREE.Bone | null;
  baseSpineQuat: THREE.Quaternion;
  baseSpine1Quat: THREE.Quaternion;
  baseSpine2Quat: THREE.Quaternion;
  baseNeckQuat: THREE.Quaternion;
  baseHeadQuat: THREE.Quaternion;
  baseLeftArmQuat: THREE.Quaternion;
  baseRightArmQuat: THREE.Quaternion;
  baseLeftForeArmQuat: THREE.Quaternion;
  baseRightForeArmQuat: THREE.Quaternion;
}

/**
 * Draped Contoured Hospital Blanket for Inpatient Beds:
 * Soft multi-fold arch covering lower waist & thighs (`z = 0.06 .. 0.56`) while keeping
 * upper chest clear for CPR/AED pads AND ankles/hospital-socked feet (`z = 0.58 .. 0.88`) unobstructed!
 */
function DrapedHospitalBlanket() {
  const blanketGeom = useMemo(() => {
    const shape = new THREE.Shape();
    // Arch cross-section across X (-0.42 .. +0.42)
    shape.moveTo(-0.43, 0);
    shape.quadraticCurveTo(-0.42, 0.145, -0.22, 0.165);
    shape.quadraticCurveTo(0, 0.18, 0.22, 0.165);
    shape.quadraticCurveTo(0.42, 0.145, 0.43, 0);
    shape.lineTo(0.4, 0);
    shape.quadraticCurveTo(0.39, 0.125, 0.21, 0.142);
    shape.quadraticCurveTo(0, 0.156, -0.21, 0.142);
    shape.quadraticCurveTo(-0.39, 0.125, -0.4, 0);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.48,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 2,
      bevelSize: 0.008,
      bevelThickness: 0.01,
    });
    return geom;
  }, []);

  const blanketTex = useMemo(
    () => getClinicalGarmentTexture('hospital_gown', '#e0f2fe', '#0284c7'),
    []
  );

  return (
    <group position={[0, 0.86, 0.08]}>
      <mesh geometry={blanketGeom} castShadow receiveShadow>
        <meshStandardMaterial
          map={blanketTex}
          color="#f1f5f9"
          roughness={0.86}
          metalness={0.02}
        />
      </mesh>
      {/* Crisp Folded Top Sheet Cuff Collar */}
      <mesh position={[0, 0.168, 0.035]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.76, 0.018, 0.085]} />
        <meshStandardMaterial color="#bae6fd" roughness={0.82} />
      </mesh>
    </group>
  );
}

/**
 * Rigged Full-Body Humanoid Patient with Scenario-Specific Attire, Posture (Supine, Semi-Fowler,
 * Protective Rib-Splinting, or Upright Seated Bedside), Blinking/Facial State, Shock Jolt & Clinical Attachments.
 */
export const BedPatientHumanoid: React.FC<{
  patient: PatientState;
  isTriageMode: boolean;
  fowlerAngleRad: number;
  highlightHex: string;
  isPaused: boolean;
  reducedMotion: boolean;
  playerWorldPosRef?: React.RefObject<THREE.Vector3 | null>;
  bayWorldPos?: [number, number, number];
}> = ({
  patient,
  isTriageMode,
  fowlerAngleRad,
  highlightHex,
  isPaused,
  reducedMotion,
  playerWorldPosRef,
  bayWorldPos = [0, 0, 0],
}) => {
  const { bundle, failed } = useHumanoidBundle();
  const appearance = useMemo(
    () => resolvePatientAppearance(patient, isTriageMode),
    [patient, isTriageMode]
  );

  const rootPatientGroupRef = useRef<THREE.Group>(null);
  const idBandFollowerRef = useRef<THREE.Group>(null);
  const bonesRef = useRef<PatientBonesCache | null>(null);
  const chestGroupOverlayRef = useRef<THREE.Group>(null);

  // Track shocksDelivered transitions to trigger realistic neuromuscular jolt on defibrillation
  const prevShocksRef = useRef<number>(patient.shocksDelivered);
  const shockJoltTimerRef = useRef<number>(0);
  const blinkTimerRef = useRef<number>(2.4 + (patient.bayNumber || 1) * 0.8);
  const blinkPhaseRef = useRef<number>(-1);

  useEffect(() => {
    if (patient.shocksDelivered > prevShocksRef.current) {
      shockJoltTimerRef.current = 0.44;
    }
    prevShocksRef.current = patient.shocksDelivered;
  }, [patient.shocksDelivered]);

  const clonedData = useMemo(() => {
    if (!bundle) return null;
    const src = bundle[appearance.modelKey];
    const clonedScene = SkeletonUtils.clone(src.scene);
    const { rawHeight } = bundle.heights[appearance.modelKey];
    const scale = appearance.targetHeight / rawHeight;

    const refClip =
      appearance.modelKey === 'responder_male' ||
      appearance.modelKey === 'operator'
        ? bundle.maleClips.idle
        : appearance.modelKey === 'medic_female'
        ? bundle.femaleClips.idle
        : appearance.modelKey === 'clinician'
        ? bundle.clinicianClips.idle
        : bundle.michelleClips.idle;

    const armTracks = refClip.tracks.filter((tr) =>
      /Shoulder|Arm|Hand/i.test(tr.name)
    );
    if (armTracks.length > 0) {
      const poseMixer = new THREE.AnimationMixer(clonedScene);
      const poseClip = new THREE.AnimationClip(
        'patient_relaxed_arms',
        0.1,
        armTracks
      );
      poseMixer.clipAction(poseClip).play();
      poseMixer.update(0.1);
      poseMixer.stopAllAction();
      poseMixer.uncacheRoot(clonedScene);
    }

    // Configure Seated Upright Bedside Posture (Bay 04 Minor Casualty) OR Protective Rib-Splinting Posture (Bay 03)
    if (appearance.posture === 'seated_bedside') {
      const upL = findHumanoidBone(clonedScene, 'LeftUpLeg');
      const legL = findHumanoidBone(clonedScene, 'LeftLeg');
      const upR = findHumanoidBone(clonedScene, 'RightUpLeg');
      const legR = findHumanoidBone(clonedScene, 'RightLeg');
      if (upL && legL && upR && legR) {
        upL.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(1.46, 0, -0.06))
        );
        legL.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.44, 0, 0))
        );
        upR.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(1.46, 0, 0.06))
        );
        legR.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.44, 0, 0))
        );
      }
    } else if (appearance.posture === 'protective_splint') {
      // Right forearm & hand cradle across bruised right/lower ribs
      const rArm = findHumanoidBone(clonedScene, 'RightArm');
      const rFore = findHumanoidBone(clonedScene, 'RightForeArm');
      if (rArm && rFore) {
        rArm.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0.25, -0.18))
        );
        rFore.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.65, 0.72, 0.35))
        );
      }
    }

    const spine = findHumanoidBone(clonedScene, 'Spine');
    const spine1 = findHumanoidBone(clonedScene, 'Spine1');
    const spine2 = findHumanoidBone(clonedScene, 'Spine2');
    const neck = findHumanoidBone(clonedScene, 'Neck');
    const head = findHumanoidBone(clonedScene, 'Head');
    const leftArm = findHumanoidBone(clonedScene, 'LeftArm');
    const rightArm = findHumanoidBone(clonedScene, 'RightArm');
    const leftForeArm = findHumanoidBone(clonedScene, 'LeftForeArm');
    const rightForeArm = findHumanoidBone(clonedScene, 'RightForeArm');
    const leftHand = findHumanoidBone(clonedScene, 'LeftHand');
    const morphs = collectMorphMeshes(clonedScene);

    return {
      clonedScene,
      scale,
      morphs,
      initialBones: {
        spine,
        spine1,
        spine2,
        neck,
        head,
        leftArm,
        rightArm,
        leftForeArm,
        rightForeArm,
        leftHand,
        baseSpineQuat: spine ? spine.quaternion.clone() : new THREE.Quaternion(),
        baseSpine1Quat: spine1 ? spine1.quaternion.clone() : new THREE.Quaternion(),
        baseSpine2Quat: spine2 ? spine2.quaternion.clone() : new THREE.Quaternion(),
        baseNeckQuat: neck ? neck.quaternion.clone() : new THREE.Quaternion(),
        baseHeadQuat: head ? head.quaternion.clone() : new THREE.Quaternion(),
        baseLeftArmQuat: leftArm
          ? leftArm.quaternion.clone()
          : new THREE.Quaternion(),
        baseRightArmQuat: rightArm
          ? rightArm.quaternion.clone()
          : new THREE.Quaternion(),
        baseLeftForeArmQuat: leftForeArm
          ? leftForeArm.quaternion.clone()
          : new THREE.Quaternion(),
        baseRightForeArmQuat: rightForeArm
          ? rightForeArm.quaternion.clone()
          : new THREE.Quaternion(),
      },
    };
  }, [bundle, appearance.modelKey, appearance.targetHeight, appearance.posture]);

  useLayoutEffect(() => {
    if (!clonedData) return;
    const b = clonedData.initialBones;

    if (appearance.posture !== 'seated_bedside') {
      if (b.spine) {
        _tempEuler.set(fowlerAngleRad * 0.52, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        b.spine.quaternion.copy(b.baseSpineQuat).multiply(_tempQuat);
      }
      if (b.spine1) {
        _tempEuler.set(fowlerAngleRad * 0.42, 0, 0);
        _tempQuat.setFromEuler(_tempEuler);
        b.spine1.quaternion.copy(b.baseSpine1Quat).multiply(_tempQuat);
      }
      if (b.neck) {
        if (patient.airwayClear) {
          _tempEuler.set(-0.15, 0, 0);
        } else if (patient.consciousness === 'Unresponsive') {
          _tempEuler.set(0.08, 0.14, 0.08);
        } else if (patient.respiratoryRate >= 28 && !patient.oxygenApplied) {
          // Tachypneic airway distress tripod/extension posture
          _tempEuler.set(-0.1, 0, 0);
        } else {
          _tempEuler.set(0, 0, 0);
        }
        _tempQuat.setFromEuler(_tempEuler);
        b.neck.quaternion.copy(b.baseNeckQuat).multiply(_tempQuat);
      }
    }

    bonesRef.current = b;
  }, [
    clonedData,
    appearance.posture,
    fowlerAngleRad,
    patient.airwayClear,
    patient.consciousness,
    patient.respiratoryRate,
    patient.oxygenApplied,
  ]);

  useLayoutEffect(() => {
    if (!clonedData) return;
    customizeClonedMaterials(clonedData.clonedScene, {
      modelKey: appearance.modelKey,
      skinToneHex: appearance.skinColor,
      topTintHex: appearance.topColor,
      bottomTintHex: appearance.bottomColor,
      footwearTintHex: appearance.footwearColor,
      topFabricStyle: appearance.topFabricStyle,
      bottomFabricStyle: appearance.bottomFabricStyle,
      footwearFabricStyle: appearance.footwearFabricStyle,
      showBeard: appearance.showBeard,
      showGlasses: appearance.showGlasses,
      overallTint: appearance.overallTint,
      tintStrength: appearance.tintStrength,
      emissiveHex: highlightHex,
      emissiveIntensity: 0.15,
    });
  }, [clonedData, appearance, highlightHex]);

  useR3FFrame((state, rawDelta) => {
    if (!clonedData || !rootPatientGroupRef.current) return;
    const dt = Math.min(rawDelta, 0.08);
    const bones = bonesRef.current;
    const t = state.clock.getElapsedTime() + (patient.bayNumber || 1) * 1.15;

    if (!isPaused && !reducedMotion && bones) {
      // 1. Defibrillation Neuromuscular Jolt Impulse
      let shockImpulse = 0;
      if (shockJoltTimerRef.current > 0) {
        shockJoltTimerRef.current = Math.max(0, shockJoltTimerRef.current - dt);
        shockImpulse = Math.sin((shockJoltTimerRef.current / 0.44) * Math.PI);
      }

      // 2. Condition-Connected Breathing, CPR Recoil & Shock Contraction
      if (bones.spine2) {
        if (shockImpulse > 0) {
          bones.spine2.scale.set(
            1 + shockImpulse * 0.03,
            1,
            1 + shockImpulse * 0.075
          );
          _tempEuler.set(-shockImpulse * 0.09, 0, 0);
          _tempQuat.setFromEuler(_tempEuler);
          bones.spine2.quaternion.copy(bones.baseSpine2Quat).multiply(_tempQuat);
        } else if (patient.cprActive) {
          const compression = Math.abs(Math.sin(t * Math.PI * 1.83));
          bones.spine2.scale.set(
            1 + compression * 0.016,
            1,
            1 - compression * 0.088
          );
          if (chestGroupOverlayRef.current) {
            chestGroupOverlayRef.current.position.y = -compression * 0.03;
          }
        } else if (patient.respiratoryRate > 0) {
          const respHz = Math.max(0.12, patient.respiratoryRate / 60);
          const breath = Math.sin(t * Math.PI * 2 * respHz);
          const depth =
            patient.respiratoryRate >= 26
              ? 0.048
              : patient.respiratoryRate <= 10
              ? 0.015
              : 0.025;
          bones.spine2.scale.set(1 + breath * 0.012, 1, 1 + breath * depth);
          _tempEuler.set(breath * (depth * 0.8), 0, 0);
          _tempQuat.setFromEuler(_tempEuler);
          bones.spine2.quaternion.copy(bones.baseSpine2Quat).multiply(_tempQuat);
          if (chestGroupOverlayRef.current) {
            chestGroupOverlayRef.current.position.y = breath * 0.011;
          }
        } else {
          // Cardiac arrest / apnea: completely motionless chest
          bones.spine2.scale.set(1, 1, 1);
          bones.spine2.quaternion.copy(bones.baseSpine2Quat);
          if (chestGroupOverlayRef.current) {
            chestGroupOverlayRef.current.position.y = 0;
          }
        }
      }

      // 3. Limb & Head Behaviour Driven by Simulated Consciousness & Pain
      if (bones.leftArm && bones.rightArm) {
        if (shockImpulse > 0) {
          _tempEuler.set(-shockImpulse * 0.16, 0, shockImpulse * 0.1);
          _tempQuat.setFromEuler(_tempEuler);
          bones.leftArm.quaternion.copy(bones.baseLeftArmQuat).multiply(_tempQuat);
          _tempEuler.set(-shockImpulse * 0.16, 0, -shockImpulse * 0.1);
          _tempQuat.setFromEuler(_tempEuler);
          bones.rightArm.quaternion.copy(bones.baseRightArmQuat).multiply(_tempQuat);
        } else if (
          patient.bleedingSeverity === 'Severe' &&
          !patient.bleedingControlled &&
          patient.consciousness !== 'Unresponsive'
        ) {
          // Restless hemorrhagic distress motion on uninjured left arm
          _tempEuler.set(Math.sin(t * 2.1) * 0.07, 0, Math.cos(t * 1.6) * 0.04);
          _tempQuat.setFromEuler(_tempEuler);
          bones.leftArm.quaternion.copy(bones.baseLeftArmQuat).multiply(_tempQuat);
        } else if (appearance.posture === 'seated_bedside') {
          // Gentle natural seated breathing & hand poise
          _tempEuler.set(Math.sin(t * 1.1) * 0.035, 0, 0);
          _tempQuat.setFromEuler(_tempEuler);
          bones.leftArm.quaternion.copy(bones.baseLeftArmQuat).multiply(_tempQuat);
        }
      }

      if (bones.head) {
        if (patient.consciousness === 'Unresponsive') {
          // Unresponsive patient remains flaccid except passive CPR/shock transmission
          if (patient.cprActive || shockImpulse > 0) {
            const nod = shockImpulse > 0 ? -shockImpulse * 0.12 : Math.sin(t * Math.PI * 1.83) * 0.025;
            _tempEuler.set(nod, 0.12, 0.06);
            _tempQuat.setFromEuler(_tempEuler);
            bones.head.quaternion.copy(bones.baseHeadQuat).multiply(_tempQuat);
          } else {
            bones.head.quaternion.copy(bones.baseHeadQuat);
          }
        } else {
          // Alert / Voice-responsive patient looks naturally toward nearby responder or scans bay
          let lookYaw = Math.sin(t * 0.68) * 0.15;
          const pPos = playerWorldPosRef?.current;
          if (pPos) {
            const dx = pPos.x - bayWorldPos[0];
            const dz = pPos.z - bayWorldPos[2];
            if (Math.hypot(dx, dz) < 3.1) {
              lookYaw = THREE.MathUtils.clamp(dx * 0.22, -0.38, 0.38);
            }
          }
          const distressNod =
            patient.painLevel >= 7 && !patient.bleedingControlled
              ? Math.sin(t * 2.4) * 0.055
              : Math.cos(t * 0.5) * 0.03;
          _tempEuler.set(distressNod, lookYaw, Math.sin(t * 0.45) * 0.035);
          _tempQuat.setFromEuler(_tempEuler);
          bones.head.quaternion.copy(bones.baseHeadQuat).multiply(_tempQuat);
        }
      }

      // 4. Patient Facial Morphs: Closed Eyes in Arrest/Unresponsive, Pain Squint in Severe Trauma, Natural Blinking when Alert
      if (clonedData.morphs.length > 0) {
        if (patient.consciousness === 'Unresponsive') {
          setMorphValue(
            clonedData.morphs,
            ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'],
            1
          );
          setMorphValue(clonedData.morphs, ['jawOpen', 'mouthOpen'], 0.22);
        } else {
          blinkTimerRef.current -= dt;
          if (blinkTimerRef.current <= 0 && blinkPhaseRef.current < 0) {
            blinkPhaseRef.current = 0;
            blinkTimerRef.current = 2.6 + ((patient.bayNumber || 1) * 0.9);
          }
          let blinkVal = 0;
          if (blinkPhaseRef.current >= 0) {
            blinkPhaseRef.current += dt;
            if (blinkPhaseRef.current >= 0.15) {
              blinkPhaseRef.current = -1;
            } else {
              blinkVal = Math.sin((blinkPhaseRef.current / 0.15) * Math.PI);
            }
          }
          const painSquint =
            patient.painLevel >= 6 && !patient.bleedingControlled ? 0.45 : 0;
          setMorphValue(
            clonedData.morphs,
            ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'],
            Math.max(blinkVal, painSquint * 0.35)
          );
          setMorphValue(
            clonedData.morphs,
            ['eyeSquintLeft', 'eyeSquintRight', 'browDownLeft', 'browDownRight'],
            painSquint
          );
          setMorphValue(
            clonedData.morphs,
            ['jawOpen', 'mouthOpen'],
            patient.respiratoryRate >= 28 && !patient.oxygenApplied ? 0.28 : 0.04
          );
        }
      }
    }

    rootPatientGroupRef.current.updateMatrixWorld(true);
    syncFollowerToBone(
      idBandFollowerRef.current,
      bones?.leftHand || null,
      rootPatientGroupRef.current
    );
  });

  const rightPadLead = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.11, 1.09, -0.39),
        new THREE.Vector3(-0.28, 1.03, -0.38),
        new THREE.Vector3(-0.56, 0.92, -0.44),
      ]),
    []
  );
  const apexPadLead = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.145, 1.045, -0.18),
        new THREE.Vector3(-0.12, 1.04, -0.16),
        new THREE.Vector3(-0.56, 0.92, -0.36),
      ]),
    []
  );
  const o2TubeCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 1.09 + fowlerAngleRad * 0.22, -0.66),
        new THREE.Vector3(0.16, 1.02 + fowlerAngleRad * 0.14, -0.74),
        new THREE.Vector3(0.42, 0.98, -0.96),
      ]),
    [fowlerAngleRad]
  );

  if (!clonedData) {
    return <CharacterLoadingIndicator failed={failed} horizontal />;
  }

  const headLiftY = Math.sin(fowlerAngleRad) * 0.24;
  const isSeated = appearance.posture === 'seated_bedside';

  const triageBandColor =
    patient.assignedTriage === 'IMMEDIATE'
      ? '#ef4444'
      : patient.assignedTriage === 'DELAYED'
      ? '#f59e0b'
      : patient.assignedTriage === 'MINOR'
      ? '#10b981'
      : patient.assignedTriage === 'EXPECTANT'
      ? '#64748b'
      : '#f8fafc';

  return (
    <group ref={rootPatientGroupRef}>
      {/* SEATED BEDSIDE POSTURE (Bay 04 Minor Casualty) vs SUPINE / SEMI-FOWLER POSTURE */}
      {isSeated ? (
        <group
          position={[0.24, -0.02, 0.34]}
          rotation={[0, Math.PI / 2, 0]}
          scale={clonedData.scale}
        >
          <primitive object={clonedData.clonedScene} />
        </group>
      ) : (
        <group
          position={[0, appearance.supineBedY, 0.88]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={clonedData.scale}
        >
          <primitive object={clonedData.clonedScene} />
        </group>
      )}

      {/* Draped Contoured Hospital Blanket for Hospital Resuscitation Inpatient */}
      {appearance.showHospitalBlanket && !isSeated && <DrapedHospitalBlanket />}

      {/* Bone-Tracked Hospital Patient ID / Triage Wristband */}
      <group ref={idBandFollowerRef}>
        {(appearance.showIdBand || Boolean(patient.assignedTriage)) && (
          <mesh position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.031, 0.0055, 8, 18]} />
            <meshStandardMaterial color={triageBandColor} roughness={0.35} />
          </mesh>
        )}
      </group>

      {/* Rigid Cervical Collar ONLY on High-Mechanism Supine Trauma Casualties */}
      {isTriageMode && !isSeated && (patient.bayNumber === 1 || patient.bayNumber === 3) && (
        <group position={[0, 1.0 + headLiftY * 0.72, -0.6]}>
          <mesh rotation={[Math.PI / 2 - fowlerAngleRad * 0.7, 0, 0]}>
            <cylinderGeometry args={[0.074, 0.08, 0.062, 20, 1, true]} />
            <meshStandardMaterial
              color="#f8fafc"
              roughness={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh
            position={[0, 0.024, 0.01]}
            rotation={[Math.PI / 2 - fowlerAngleRad * 0.7, 0, 0]}
          >
            <torusGeometry args={[0.075, 0.0085, 8, 20]} />
            <meshStandardMaterial color="#0284c7" roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* Finger Clip Pulse Oximeter Sensor (When inpatient or examined) */}
      {(!isTriageMode || patient.examined) && !isSeated && (
        <group position={[0.27, 0.94, 0.06]}>
          <mesh castShadow>
            <boxGeometry args={[0.026, 0.02, 0.042]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.004, 0.01]}>
            <sphereGeometry args={[0.0055, 8, 8]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      )}

      {/* Chest Intervention Attachments (AED Pads & CPR Target Zone) */}
      <group ref={chestGroupOverlayRef}>
        {patient.padsAttached && !isSeated && (
          <group position={[0, headLiftY * 0.35, 0]}>
            <group position={[-0.095, 1.09, -0.39]} rotation={[0.08, 0, 0.12]}>
              <mesh castShadow>
                <boxGeometry args={[0.092, 0.008, 0.12]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.07, 0.092]} />
                <meshStandardMaterial
                  color="#ea580c"
                  emissive="#f97316"
                  emissiveIntensity={patient.shockAdvised ? 0.65 : 0.15}
                />
              </mesh>
            </group>

            <group position={[0.145, 1.045, -0.18]} rotation={[0, 0, -0.46]}>
              <mesh castShadow>
                <boxGeometry args={[0.092, 0.008, 0.12]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.07, 0.092]} />
                <meshStandardMaterial
                  color="#0284c7"
                  emissive="#38bdf8"
                  emissiveIntensity={patient.shockAdvised ? 0.55 : 0.12}
                />
              </mesh>
            </group>

            <mesh>
              <tubeGeometry args={[rightPadLead, 16, 0.0042, 6, false]} />
              <meshStandardMaterial color="#ef4444" roughness={0.45} />
            </mesh>
            <mesh>
              <tubeGeometry args={[apexPadLead, 16, 0.0042, 6, false]} />
              <meshStandardMaterial color="#0284c7" roughness={0.45} />
            </mesh>
          </group>
        )}

        {patient.cprActive && !isSeated && (
          <group position={[0, 1.125 + headLiftY * 0.35, -0.29]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.052, 0.082, 28]} />
              <meshBasicMaterial color="#22d3ee" side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>

      {/* Non-Rebreather Medical Oxygen Mask + Reservoir Bag + Supply Tubing */}
      {patient.oxygenApplied && !isSeated && (
        <group>
          <group position={[0, 1.125 + headLiftY * 0.85, -0.72]}>
            <mesh rotation={[-0.35, 0, 0]}>
              <coneGeometry args={[0.05, 0.076, 18]} />
              <meshPhysicalMaterial
                color="#7dd3fc"
                transparent
                opacity={0.62}
                roughness={0.15}
                metalness={0.05}
              />
            </mesh>
            <mesh position={[0, -0.025, -0.035]} rotation={[0.2, 0, 0]}>
              <torusGeometry args={[0.08, 0.004, 6, 20]} />
              <meshStandardMaterial color="#10b981" roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.02, 0.075]} rotation={[0.65, 0, 0]}>
              <capsuleGeometry args={[0.022, 0.062, 6, 12]} />
              <meshPhysicalMaterial
                color="#bae6fd"
                transparent
                opacity={0.5}
                roughness={0.2}
              />
            </mesh>
          </group>
          <mesh>
            <tubeGeometry args={[o2TubeCurve, 18, 0.004, 6, false]} />
            <meshStandardMaterial color="#10b981" roughness={0.35} />
          </mesh>
        </group>
      )}

      {/* Torn Trouser Cuff & Non-Graphic Arterial Limb Trauma vs CAT Tourniquet + Sterile Dressing */}
      {patient.bleedingSeverity === 'Severe' &&
        !patient.bleedingControlled &&
        !isSeated && (
          <group position={[0.105, 0.985, 0.36]}>
            {/* Torn Dark Fabric Flap Ring + Non-Graphic Arterial Injury Indicator */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.074, 0.07, 0.14, 16]} />
              <meshStandardMaterial
                color="#991b1b"
                emissive="#dc2626"
                emissiveIntensity={0.32}
                roughness={0.38}
              />
            </mesh>
            <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0.25]}>
              <torusGeometry args={[0.074, 0.011, 6, 14]} />
              <meshStandardMaterial color="#1e293b" roughness={0.85} />
            </mesh>
          </group>
        )}

      {((patient.bleedingControlled && patient.bleedingSeverity !== 'None') ||
        patient.woundDressed) &&
        (isSeated ? (
          /* Seated Bay 04 Minor Casualty: Sterile Forearm Gauze Bandage */
          <mesh position={[0.42, 1.02, 0.14]} rotation={[0.35, 0, 0.45]} castShadow>
            <cylinderGeometry args={[0.044, 0.042, 0.11, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.78} />
          </mesh>
        ) : (
          /* Supine Casualty: Sterile Trauma Pressure Dressing + CAT Windlass Tourniquet */
          <group position={[0.105, 0.99, 0.36]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.076, 0.074, 0.105, 18]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.78} />
            </mesh>
            {patient.bleedingControlled && (
              <group position={[0, 0.01, -0.085]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.079, 0.079, 0.036, 18]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.55} />
                </mesh>
                <mesh position={[0, 0.08, 0]} rotation={[0, 0.35, Math.PI / 2]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.105, 10]} />
                  <meshStandardMaterial
                    color="#f97316"
                    emissive="#ea580c"
                    emissiveIntensity={0.25}
                    roughness={0.35}
                  />
                </mesh>
              </group>
            )}
          </group>
        ))}
    </group>
  );
};

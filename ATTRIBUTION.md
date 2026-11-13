# 3D Humanoid & Animation Asset Attribution

All bundled 3D humanoid skeletal models and motion-capture animation clips in `/public/models/` are open-source assets distributed via the official Three.js (`mrdoob/three.js`), Ready Player Me (`readyplayerme/animation-library`), and `met4citizen/TalkingHead` open-source repositories for real-time WebGL/Three.js applications:

1. **`responder_male_humanoid.glb`**
   - Source: `met4citizen/TalkingHead` (`avatars/avatarsdk.glb`)
   - License: MIT
   - Usage: Full-body rigged male emergency-response trainee, supporting trainee, EMS paramedic, and trauma casualty variants (`SkinnedMesh` with 66 ARKit facial blendshapes, eyes, eyelashes, full-sleeve top, trousers, and closed medical shoes).

2. **`medic_female_humanoid.glb`**
   - Source: `met4citizen/TalkingHead` (`avatars/brunette.glb` — Ready Player Me full-body female avatar)
   - License: MIT / Ready Player Me CC BY 4.0
   - Usage: Full-body rigged female emergency-response trainee, charge nurse, triage officer, and female patient variants (`SkinnedMesh` with 72 ARKit facial blendshapes, hair, top, trousers, and closed non-slip footwear).

3. **`clinician_humanoid.glb`**
   - Source: `met4citizen/TalkingHead` (`avatars/avaturn.glb` — Avaturn full-body human avatar)
   - License: MIT
   - Usage: Full-body rigged supporting trainee, clinical support specialist, and trauma patient variants (`SkinnedMesh` with 72 ARKit facial blendshapes, layered hair, full-length attire, and closed footwear).

4. **`operator_humanoid.glb`**
   - Source: `mrdoob/three.js` (`examples/models/gltf/readyplayer.me.glb` — Ready Player Me full-body male avatar, non-clinical headwear hidden)
   - License: CC BY 4.0 / MIT Three.js Examples distribution
   - Usage: Attending emergency physician (rigged clinical lab coat over scrubs) and hospital inpatient variants.

5. **`michelle_humanoid.glb`**
   - Source: `mrdoob/three.js` (`examples/models/gltf/Michelle.glb` — Adobe Mixamo / Three.js official example character)
   - License: MIT Three.js Examples distribution
   - Usage: Civilian ambulatory minor-trauma patient (`PT-204`) in everyday incident clothing.

6. **`anims/anim_m_*.glb` & `anims/anim_f_*.glb`**
   - Source: `readyplayerme/animation-library` (Official Ready Player Me full-body skeletal motion-capture animation library)
   - License: Ready Player Me Open Animation Library
   - Usage: Full-body motion-capture `AnimationClip` tracks (`idle`, `idle_02`, `idle_var`, `idle_var_02`, `walk`, `run`, `crouch`, `talk`, `talk_02`, `gesture`) for natural breathing, weight shifting, walking, crouching, and clinical communication.

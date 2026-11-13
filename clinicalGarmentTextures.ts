import * as THREE from 'three';

export type GarmentFabricStyle =
  | 'scrubs_top'
  | 'scrubs_bottom'
  | 'physician_coat'
  | 'ems_uniform_top'
  | 'ems_trousers'
  | 'hospital_gown'
  | 'hospital_socks'
  | 'civilian_workwear'
  | 'civilian_knit'
  | 'civilian_trousers'
  | 'medical_footwear';

const textureCache = new Map<string, THREE.CanvasTexture>();

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = new THREE.Color(hex);
  return {
    r: Math.round(c.r * 255),
    g: Math.round(c.g * 255),
    b: Math.round(c.b * 255),
  };
}

function shadeHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r * factor)}, ${clamp(g * factor)}, ${clamp(b * factor)})`;
}

/**
 * Generates and caches high-detail procedural PBR garment albedo textures (`SRGBColorSpace`).
 * Applied to rigged humanoid garment meshes while preserving baked 1K normal maps (`mat.normalMap`)
 * so characters display authentic clinical scrubs, physician coats, EMS uniforms, hospital gowns,
 * or varied incident clothing with realistic fabric weave, stitching, pockets, and folds —
 * eliminating any non-clinical baked graphics (e.g., tuxedos, gym stripes, or casual logos).
 */
export function getClinicalGarmentTexture(
  style: GarmentFabricStyle,
  primaryHex: string,
  trimHex = '#38bdf8'
): THREE.CanvasTexture {
  const key = `${style}:${primaryHex}:${trimHex}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 1. Base woven fabric fill with subtle vertical drape shading
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, shadeHex(primaryHex, 1.06));
    grad.addColorStop(0.55, primaryHex);
    grad.addColorStop(1, shadeHex(primaryHex, 0.88));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // 2. Fine cotton-poly / ripstop textile weave micro-pattern
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 4) {
      ctx.strokeStyle =
        y % 8 === 0 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.045)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    for (let x = 0; x < 512; x += 4) {
      ctx.strokeStyle =
        x % 8 === 0 ? 'rgba(255,255,255,0.024)' : 'rgba(0,0,0,0.035)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // 3. Soft organic fabric fold highlights & shadow troughs
    for (let i = 0; i < 9; i++) {
      const fy = 42 + i * 54;
      const foldGrad = ctx.createLinearGradient(0, fy - 12, 0, fy + 14);
      foldGrad.addColorStop(0, 'rgba(255,255,255,0)');
      foldGrad.addColorStop(0.42, 'rgba(255,255,255,0.045)');
      foldGrad.addColorStop(0.75, 'rgba(0,0,0,0.065)');
      foldGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = foldGrad;
      ctx.fillRect(0, fy - 12, 512, 26);
    }

    // 4. Garment-specific clinical tailoring, stitching, pockets & patterns
    if (style === 'scrubs_top') {
      // Double-needle V-yoke & clinical pocket top-stitching
      ctx.strokeStyle = shadeHex(primaryHex, 0.72);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      // Side seams & shoulder yoke lines
      ctx.strokeRect(18, 18, 476, 476);
      ctx.beginPath();
      ctx.moveTo(0, 118);
      ctx.lineTo(512, 118);
      ctx.stroke();

      // Left breast scrub pocket + pen slot divider + lower hip patch pockets
      ctx.fillStyle = shadeHex(primaryHex, 0.94);
      ctx.fillRect(300, 152, 78, 92);
      ctx.strokeRect(300, 152, 78, 92);
      ctx.beginPath();
      ctx.moveTo(322, 152);
      ctx.lineTo(322, 244);
      ctx.stroke();

      ctx.fillRect(72, 336, 112, 118);
      ctx.strokeRect(72, 336, 112, 118);
      ctx.fillRect(328, 336, 112, 118);
      ctx.strokeRect(328, 336, 112, 118);
      ctx.setLineDash([]);

      // Subtle clinical piping accent at pocket top edge
      ctx.fillStyle = trimHex;
      ctx.fillRect(300, 152, 78, 5);
    } else if (style === 'scrubs_bottom' || style === 'ems_trousers') {
      ctx.strokeStyle = shadeHex(primaryHex, 0.7);
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 3]);
      // Outer leg double-stitch seams & cargo utility pockets
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 512);
      ctx.moveTo(384, 0);
      ctx.lineTo(384, 512);
      ctx.stroke();

      ctx.fillStyle = shadeHex(primaryHex, 0.92);
      ctx.fillRect(82, 180, 92, 110);
      ctx.strokeRect(82, 180, 92, 110);
      ctx.fillRect(338, 180, 92, 110);
      ctx.strokeRect(338, 180, 92, 110);
      ctx.setLineDash([]);

      if (style === 'ems_trousers') {
        // Subtle lower-calf ANSI reflective tape band on EMS trousers
        ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
        ctx.fillRect(0, 418, 512, 14);
        ctx.fillStyle = trimHex;
        ctx.fillRect(0, 412, 512, 5);
      }
    } else if (style === 'physician_coat') {
      // Crisp white physician lab coat twill with subtle seams & clinical pockets
      ctx.fillStyle = '#f4f7fb';
      ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? 'rgba(15,23,42,0.022)' : 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, y, 512, 2);
      }
      // Center scrub-shirt V-underlay zone so open coat front shows clinical teal/blue shirt instead of tuxedo
      ctx.fillStyle = trimHex;
      ctx.beginPath();
      ctx.moveTo(222, 0);
      ctx.lineTo(290, 0);
      ctx.lineTo(270, 210);
      ctx.lineTo(242, 210);
      ctx.closePath();
      ctx.fill();

      // Tailored coat lapel fold lines & pocket stitching
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(306, 150, 82, 94);
      ctx.strokeRect(78, 310, 118, 126);
      ctx.strokeRect(316, 310, 118, 126);
      ctx.setLineDash([]);
    } else if (style === 'ems_uniform_top') {
      // Pre-hospital EMS / Triage Responder uniform with high-visibility reflective chest & sleeve bands
      ctx.strokeStyle = shadeHex(primaryHex, 0.7);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(78, 140, 96, 102);
      ctx.strokeRect(338, 140, 96, 102);
      ctx.setLineDash([]);

      // High-visibility ANSI trim + silver retro-reflective stripe
      ctx.fillStyle = trimHex;
      ctx.fillRect(0, 266, 512, 24);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 273, 512, 10);
    } else if (style === 'hospital_gown') {
      // Soft clinical inpatient gown with classic hospital diamond/dot weave & snap-shoulder seams
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      for (let gy = 16; gy < 512; gy += 28) {
        for (let gx = 16; gx < 512; gx += 28) {
          ctx.beginPath();
          ctx.moveTo(gx, gy - 4);
          ctx.lineTo(gx + 4, gy);
          ctx.lineTo(gx, gy + 4);
          ctx.lineTo(gx - 4, gy);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Gown shoulder snap-hem & modest tie seam
      ctx.strokeStyle = shadeHex(primaryHex, 0.78);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 86);
      ctx.lineTo(512, 86);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (style === 'hospital_socks') {
      // Non-slip hospital inpatient socks with subtle grip-tread ribs
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let x = 0; x < 512; x += 18) {
        ctx.fillRect(x, 0, 6, 512);
      }
    } else if (style === 'civilian_knit') {
      // Ribbed everyday sweater knit for emergency casualty diversity
      for (let x = 0; x < 512; x += 8) {
        ctx.fillStyle = x % 16 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, 0, 4, 512);
      }
    } else if (style === 'civilian_workwear') {
      // Everyday cotton/canvas commuter or industrial work shirt with subtle incident scuffing
      ctx.strokeStyle = shadeHex(primaryHex, 0.74);
      ctx.lineWidth = 2;
      ctx.strokeRect(92, 148, 88, 92);
      ctx.strokeRect(332, 148, 88, 92);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
      ctx.beginPath();
      ctx.ellipse(180, 340, 68, 34, 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'medical_footwear') {
      // Closed-toe non-slip medical shoes / EMS boots
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = shadeHex(primaryHex, 0.68);
      ctx.fillRect(0, 390, 512, 122);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 388);
      ctx.lineTo(512, 388);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

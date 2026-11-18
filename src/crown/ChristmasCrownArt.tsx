import { useEffect, useId, useRef, useState } from 'react';

interface ChristmasCrownArtProps {
  fillPercentage: number;
  currentSouls: number;
  targetSouls: number;
  compact?: boolean;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPt {
  sx: number;
  sy: number;
  z: number;
  scale: number;
}

interface BubbleParticle {
  xFrac: number;
  yFrac: number;
  speed: number;
  size: number;
  wobblePhase: number;
  isGoldSparkle: boolean;
}

interface GloryMote {
  angle: number;
  y: number;
  radius: number;
  speed: number;
  size: number;
  alpha: number;
}

// 5-Peak Classic Royal Coronet (3 peaks in front, 2 peaks visible in the back valleys — matching reference)
const NUM_PEAKS = 5;
const BASE_Y = 114; // Bottom torus ring center Y (y+ is down, y- is up)
const VALLEY_Y = 16; // Bottom of the smooth U-shaped valley between peaks
const PEAK_Y = -116; // Tip of the sharp peak cusp (center of sphere finial)
const SPHERE_RADIUS_3D = 22;
const MIN_FILL_Y = BASE_Y - 4;
const MAX_FILL_Y = PEAK_Y - SPHERE_RADIUS_3D - 8;

const BASE_RADIUS = 138;
const VALLEY_RADIUS = 156;
const PEAK_RADIUS = 190;

function projectPoint(
  pt: Vec3,
  rotY: number,
  tiltX: number,
  cx: number,
  cy: number,
  fov: number
): ProjectedPt {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = pt.x * cosY + pt.z * sinY;
  const z1 = -pt.x * sinY + pt.z * cosY;

  // Attenuate vertical tilt smoothly from 1.0 at the peaks down to 0.04 at the base ring
  // so the bottom rim stays flat and never protrudes below the horizontal base torus lip
  const heightFrac = Math.max(0, Math.min(1, (BASE_Y - pt.y) / (BASE_Y - PEAK_Y)));
  const effectiveTiltX = tiltX * (0.04 + 0.96 * heightFrac);

  const cosX = Math.cos(effectiveTiltX);
  const sinX = Math.sin(effectiveTiltX);
  const y2 = pt.y * cosX - z1 * sinX;
  const z2 = pt.y * sinX + z1 * cosX;

  const scale = fov / Math.max(400, fov + z2);
  // Lock vertical baseline at BASE_Y so front base strips never droop below the torus ring
  const sy = cy + pt.y + (y2 - pt.y) + (scale - 1) * pt.y * heightFrac * 0.45;

  return {
    sx: cx + x1 * scale,
    sy,
    z: z2,
    scale,
  };
}

/**
 * Evaluates the exact 3D upper rim profile of the 5-peak Royal Coronet at local angle phi in [0, 2*PI).
 * Uses a smooth catenary U-valley (d^1.85) that meets at sharp pointed cusps at each of the 5 peaks.
 */
function sampleCrownRim3D(phi: number): {
  yRim: number;
  rRim: number;
  peakRaise: number;
} {
  const sectorAngle = (Math.PI * 2) / NUM_PEAKS;
  const wrapped = ((phi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const u = (wrapped % sectorAngle) / sectorAngle; // 0 at peak k, 0.5 at valley, 1 at peak k+1
  const d = Math.abs(2 * u - 1); // 0 at valley bottom, 1 at peak tip
  const peakRaise = Math.pow(d, 1.85); // Smooth rounded U-valley, sharp pointed peak cusp

  const yRim = VALLEY_Y + (PEAK_Y - VALLEY_Y) * peakRaise;
  const rRim = VALLEY_RADIUS + (PEAK_RADIUS - VALLEY_RADIUS) * peakRaise;
  return { yRim, rRim, peakRaise };
}

/**
 * Evaluates the metallic 24K brushed gold color at camera-space horizontal normal nx in [-1, 1]
 * and depth z, matching the rich studio-lit gold sheen in the reference crown image.
 */
function computeMetallicGoldColor(
  nx: number,
  isInterior: boolean,
  alpha = 1
): string {
  if (isInterior) {
    // Warm shaded inner gold wall visible through the U-valleys
    const light = Math.max(0, Math.min(1, 0.5 + nx * 0.45));
    const r = Math.round(115 + light * 95);
    const g = Math.round(74 + light * 76);
    const b = Math.round(18 + light * 38);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Exterior 24K studio gold with bright anisotropic highlight band on the right (nx ~ 0.48)
  // and secondary rim reflection on the left (nx ~ -0.72)
  const mainSpec = Math.exp(-Math.pow((nx - 0.46) / 0.26, 2));
  const leftRim = Math.exp(-Math.pow((nx + 0.72) / 0.24, 2)) * 0.58;
  const darkCore = Math.exp(-Math.pow((nx + 0.12) / 0.38, 2));

  const baseR = 178 - darkCore * 62 + mainSpec * 77 + leftRim * 58;
  const baseG = 132 - darkCore * 54 + mainSpec * 108 + leftRim * 50;
  const baseB = 46 - darkCore * 26 + mainSpec * 145 + leftRim * 36;

  const r = Math.max(0, Math.min(255, Math.round(baseR)));
  const g = Math.max(0, Math.min(255, Math.round(baseG)));
  const b = Math.max(0, Math.min(255, Math.round(baseB)));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Draws a 3D specular-shaded solid gold sphere finial at the tip of a crown peak.
 */
function draw3DGoldSphereFinial(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radius: number,
  isBack: boolean,
  isSubmerged: boolean
) {
  ctx.save();

  // Outer glory halo when touched by the rising liquid gold wave
  if (isSubmerged) {
    const halo = ctx.createRadialGradient(sx, sy, radius * 0.2, sx, sy, radius * 2.3);
    halo.addColorStop(0, 'rgba(254, 249, 195, 0.9)');
    halo.addColorStop(0.45, 'rgba(250, 204, 21, 0.42)');
    halo.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 2.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3D Sphere Radial Gradient (bright top-left specular highlight -> rich gold -> bronze shadow)
  const grad = ctx.createRadialGradient(
    sx - radius * 0.32,
    sy - radius * 0.34,
    radius * 0.08,
    sx,
    sy,
    radius
  );
  if (isBack) {
    grad.addColorStop(0, '#fde68a');
    grad.addColorStop(0.35, '#d4a038');
    grad.addColorStop(0.75, '#8c5a14');
    grad.addColorStop(1, '#4a2c06');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.22, '#fef08a');
    grad.addColorStop(0.55, '#eab308');
    grad.addColorStop(0.84, '#9a6316');
    grad.addColorStop(1, '#4e2e05');
  }

  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = isSubmerged ? '#fef9c3' : 'rgba(254, 240, 138, 0.65)';
  ctx.lineWidth = isBack ? 1.1 : 1.8;
  ctx.stroke();

  ctx.restore();
}

/**
 * Multi-harmonic sloshing water wave function for the wavy/watery progress effect.
 */
function evalWaveOffset(
  x: number,
  time: number,
  layer: 'back' | 'mid' | 'front',
  surgeAmp: number
): number {
  const amp = (10.5 + surgeAmp) * (layer === 'mid' ? 0.8 : 1);
  if (layer === 'front') {
    return (
      Math.sin(x * 0.024 + time * 3.6) * amp +
      Math.cos(x * 0.052 - time * 2.7) * (amp * 0.48) +
      Math.sin(x * 0.088 + time * 5.1) * (amp * 0.22)
    );
  }
  if (layer === 'back') {
    return (
      Math.sin(x * 0.022 - time * 3.1 + 1.7) * amp +
      Math.cos(x * 0.046 + time * 2.4) * (amp * 0.52) +
      Math.cos(x * 0.082 - time * 4.2) * (amp * 0.2)
    );
  }
  return (
    Math.sin(x * 0.03 + time * 4.2 + 0.9) * amp +
    Math.cos(x * 0.058 - time * 3.3) * (amp * 0.42)
  );
}

export function ChristmasCrownArt({
  fillPercentage,
  currentSouls,
  targetSouls,
  compact = false,
}: ChristmasCrownArtProps) {
  const uid = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPaused, setIsPaused] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const targetFillRef = useRef<number>(Math.min(100, Math.max(0, fillPercentage)));
  const animatedFillRef = useRef<number>(Math.min(100, Math.max(0, fillPercentage)));
  const surgeAmpRef = useRef<number>(0);
  // Start at +PI/2 so Peak 0 is dead-center in front (z < 0), 2 peaks on the sides, and 2 peaks in the back valleys!
  const rotYRef = useRef<number>(Math.PI * 0.5);
  const isDraggingRef = useRef<boolean>(false);
  const dragLastXRef = useRef<number>(0);
  const dragVelocityRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(isPaused);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const clamped = Math.min(100, Math.max(0, fillPercentage));
    if (Math.abs(clamped - targetFillRef.current) > 0.2) {
      surgeAmpRef.current = Math.min(16, surgeAmpRef.current + 8.5);
    }
    targetFillRef.current = clamped;
  }, [fillPercentage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const logicalW = 640;
    const logicalH = 520;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;

    const bubbles: BubbleParticle[] = Array.from({ length: 38 }, (_, i) => ({
      xFrac: -0.88 + (i / 37) * 1.76,
      yFrac: Math.random(),
      speed: 0.25 + Math.random() * 0.42,
      size: 2.2 + Math.random() * 4.4,
      wobblePhase: Math.random() * Math.PI * 2,
      isGoldSparkle: i % 2 === 0,
    }));

    const gloryMotes: GloryMote[] = Array.from({ length: 26 }, (_, i) => ({
      angle: (i / 26) * Math.PI * 2,
      y: -145 + (i / 26) * 270,
      radius: 185 + (i % 4) * 20,
      speed: (i % 2 === 0 ? 1 : -1) * (0.35 + (i % 3) * 0.18),
      size: 1.8 + (i % 3) * 1.2,
      alpha: 0.45 + (i % 3) * 0.2,
    }));

    let rafId = 0;
    let lastTime = performance.now();
    let elapsedTime = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const motionActive = !pausedRef.current;
      if (motionActive) {
        elapsedTime += dt;
        if (!isDraggingRef.current) {
          rotYRef.current += (0.48 + dragVelocityRef.current) * dt;
          dragVelocityRef.current *= Math.pow(0.08, dt);
        }
      }

      const diff = targetFillRef.current - animatedFillRef.current;
      animatedFillRef.current += diff * Math.min(1, dt * 4.5);
      surgeAmpRef.current *= Math.pow(0.28, dt);

      const fillPct = Math.min(100, Math.max(0, animatedFillRef.current));
      const rotY = rotYRef.current;
      const tiltX = -0.095; // Studio camera angle so center front peak is tallest & back peaks sit lower inside valleys
      const cx = logicalW * 0.5;
      const cy = logicalH * 0.54;
      const fov = 1450;

      const waterLevelY = MIN_FILL_Y - ((MIN_FILL_Y - MAX_FILL_Y) * fillPct) / 100;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalW, logicalH);

      // ======================================================================
      // 0. KING OF GLORY THRONE-ROOM SUNBURST RAYS & ROYAL PEDESTAL SHADOW
      // ======================================================================
      const gloryBurst = ctx.createRadialGradient(cx, cy - 15, 15, cx, cy - 15, 290);
      gloryBurst.addColorStop(0, 'rgba(250, 204, 21, 0.34)');
      gloryBurst.addColorStop(0.45, 'rgba(217, 119, 6, 0.16)');
      gloryBurst.addColorStop(1, 'rgba(2, 44, 34, 0)');
      ctx.fillStyle = gloryBurst;
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Rotating God-Rays / King of Glory Sunbeams behind the Crown
      ctx.save();
      ctx.translate(cx, cy - 10);
      const numRays = 12;
      for (let r = 0; r < numRays; r++) {
        const rayAngle = (r / numRays) * Math.PI * 2 + elapsedTime * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 265, rayAngle - 0.09, rayAngle + 0.09);
        ctx.closePath();
        const rayGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 265);
        rayGrad.addColorStop(0, 'rgba(254, 240, 138, 0.16)');
        rayGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.06)');
        rayGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = rayGrad;
        ctx.fill();
      }
      ctx.restore();

      // Soft Drop Shadow under the Crown Base (matching the reference vector crown shadow)
      ctx.save();
      ctx.translate(cx, cy + BASE_Y + 26);
      ctx.scale(1, 0.18);
      const shadowGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 175);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      shadowGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.25)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 175, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Background Milestone Guides (25%, 50%, 75%, 100%)
      if (!compact) {
        const milestones = [
          { pct: 25, label: '25%' },
          { pct: 50, label: '50%' },
          { pct: 75, label: '75%' },
          { pct: 100, label: '100% FULL CROWN' },
        ];
        for (const m of milestones) {
          const my = MIN_FILL_Y - ((MIN_FILL_Y - MAX_FILL_Y) * m.pct) / 100;
          const sp = projectPoint({ x: 0, y: my, z: 0 }, rotY, tiltX, cx, cy, fov);
          const reached = fillPct >= m.pct - 0.5;
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([5, 6]);
          ctx.moveTo(38, sp.sy);
          ctx.lineTo(logicalW - 38, sp.sy);
          ctx.strokeStyle = reached
            ? 'rgba(253, 224, 71, 0.45)'
            : 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.3;
          ctx.stroke();

          ctx.font = '800 11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = reached ? '#fde047' : 'rgba(255, 255, 255, 0.42)';
          ctx.textAlign = 'right';
          ctx.fillText(m.label, logicalW - 42, sp.sy - 5);
          ctx.restore();
        }
      }

      // ======================================================================
      // PRECOMPUTE 3D CROWN MESH STRIPS & 5 PEAK SPHERE FINIALS
      // ======================================================================
      const numStrips = 120;
      interface CrownStrip {
        phi0: number;
        phi1: number;
        midZ: number;
        nx: number;
        top0: ProjectedPt;
        top1: ProjectedPt;
        bot0: ProjectedPt;
        bot1: ProjectedPt;
      }

      const strips: CrownStrip[] = [];
      for (let i = 0; i < numStrips; i++) {
        const phi0 = (i / numStrips) * Math.PI * 2;
        const phi1 = ((i + 1) / numStrips) * Math.PI * 2;
        const phiMid = (phi0 + phi1) * 0.5;

        const rim0 = sampleCrownRim3D(phi0);
        const rim1 = sampleCrownRim3D(phi1);

        const top0 = projectPoint(
          {
            x: Math.cos(phi0) * rim0.rRim,
            y: rim0.yRim,
            z: Math.sin(phi0) * rim0.rRim,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const top1 = projectPoint(
          {
            x: Math.cos(phi1) * rim1.rRim,
            y: rim1.yRim,
            z: Math.sin(phi1) * rim1.rRim,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const bot0 = projectPoint(
          {
            x: Math.cos(phi0) * BASE_RADIUS,
            y: BASE_Y,
            z: Math.sin(phi0) * BASE_RADIUS,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const bot1 = projectPoint(
          {
            x: Math.cos(phi1) * BASE_RADIUS,
            y: BASE_Y,
            z: Math.sin(phi1) * BASE_RADIUS,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );

        // Camera-space outward normal X component after rotating by rotY
        const worldAngle = phiMid - rotY;
        const nx = Math.cos(worldAngle);
        const midZ = (top0.z + top1.z + bot0.z + bot1.z) * 0.25;

        strips.push({
          phi0,
          phi1,
          midZ,
          nx,
          top0,
          top1,
          bot0,
          bot1,
        });
      }

      // Precompute the 5 Peak Sphere Finials in 3D
      interface PeakSphere3D {
        index: number;
        phi: number;
        pt: ProjectedPt;
        radiusScreen: number;
      }
      const peakSpheres: PeakSphere3D[] = [];
      for (let k = 0; k < NUM_PEAKS; k++) {
        const phi = (k / NUM_PEAKS) * Math.PI * 2;
        const pt = projectPoint(
          {
            x: Math.cos(phi) * (PEAK_RADIUS + 4),
            y: PEAK_Y - 5,
            z: Math.sin(phi) * (PEAK_RADIUS + 4),
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        peakSpheres.push({
          index: k,
          phi,
          pt,
          radiusScreen: SPHERE_RADIUS_3D * pt.scale,
        });
      }

      const backStrips = strips
        .filter((s) => s.midZ > 0)
        .sort((a, b) => b.midZ - a.midZ);
      const frontStrips = strips
        .filter((s) => s.midZ <= 0)
        .sort((a, b) => b.midZ - a.midZ);

      const backSpheres = peakSpheres
        .filter((p) => p.pt.z > 0)
        .sort((a, b) => b.pt.z - a.pt.z);
      const frontSpheres = peakSpheres
        .filter((p) => p.pt.z <= 0)
        .sort((a, b) => b.pt.z - a.pt.z);

      // ======================================================================
      // 1. RENDER BACK-FACING INTERIOR 24K GOLD CROWN WALL & BACK SPHERES
      //    (Visible through the front U-valleys just like the reference image!)
      // ======================================================================
      for (const s of backStrips) {
        ctx.beginPath();
        ctx.moveTo(s.top0.sx, s.top0.sy);
        ctx.lineTo(s.top1.sx, s.top1.sy);
        ctx.lineTo(s.bot1.sx, s.bot1.sy);
        ctx.lineTo(s.bot0.sx, s.bot0.sy);
        ctx.closePath();
        ctx.fillStyle = computeMetallicGoldColor(s.nx, true, 0.92);
        ctx.fill();

        // Rolled metallic gold inner rim edge along the back peaks
        ctx.beginPath();
        ctx.moveTo(s.top0.sx, s.top0.sy);
        ctx.lineTo(s.top1.sx, s.top1.sy);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      for (const sp of backSpheres) {
        draw3DGoldSphereFinial(
          ctx,
          sp.pt.sx,
          sp.pt.sy,
          sp.radiusScreen * 0.92,
          true,
          waterLevelY <= PEAK_Y + 8
        );
      }

      // ======================================================================
      // 2. RENDER FRONT-FACING METALLIC 24K GOLD CROWN BODY (Base Layer)
      // ======================================================================
      // When fillPct < 100, the crown body itself is a solid, gleaming 3D 24K gold coronet
      // so the exact reference crown shape and brushed gold shading are always 100% unmistakable!
      for (const s of frontStrips) {
        ctx.beginPath();
        ctx.moveTo(s.top0.sx, s.top0.sy);
        ctx.lineTo(s.top1.sx, s.top1.sy);
        ctx.lineTo(s.bot1.sx, s.bot1.sy);
        ctx.lineTo(s.bot0.sx, s.bot0.sy);
        ctx.closePath();
        ctx.fillStyle = computeMetallicGoldColor(s.nx, false, 0.86);
        ctx.fill();
      }

      // ======================================================================
      // 3. WAVY, WATERY, LIVING-GOLD & EMERALD PROGRESS FILL INSIDE THE CROWN
      //    (Strictly clipped to the exact 3D rotating crown silhouette!)
      // ======================================================================
      if (fillPct > 0.15) {
        ctx.save();

        // Build exact union clip path of all 3D crown wall strips + 5 peak spheres
        // so the wavy water conforms strictly to the exact 5-peak crown silhouette!
        const clipRegion = new Path2D();
        for (const s of strips) {
          clipRegion.moveTo(s.top0.sx, s.top0.sy);
          clipRegion.lineTo(s.top1.sx, s.top1.sy);
          clipRegion.lineTo(s.bot1.sx, s.bot1.sy);
          clipRegion.lineTo(s.bot0.sx, s.bot0.sy);
          clipRegion.closePath();
        }
        for (const sp of peakSpheres) {
          clipRegion.moveTo(sp.pt.sx + sp.radiusScreen, sp.pt.sy);
          clipRegion.arc(sp.pt.sx, sp.pt.sy, sp.radiusScreen, 0, Math.PI * 2);
        }
        ctx.clip(clipRegion);

        const screenWaterCenter = projectPoint(
          { x: 0, y: waterLevelY, z: 0 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const screenBottomCenter = projectPoint(
          { x: 0, y: BASE_Y + 35, z: 0 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );

        const waveLeftX = 50;
        const waveRightX = logicalW - 50;
        const waveSteps = 72;
        const stepX = (waveRightX - waveLeftX) / waveSteps;

        // 3A. Back Wavy Water Layer (Rich Royal Amber & Living Emerald Wave)
        ctx.beginPath();
        ctx.moveTo(waveLeftX, screenBottomCenter.sy + 40);
        for (let i = 0; i <= waveSteps; i++) {
          const sx = waveLeftX + i * stepX;
          const wy =
            screenWaterCenter.sy -
            7 +
            evalWaveOffset(sx - cx, elapsedTime, 'back', surgeAmpRef.current);
          ctx.lineTo(sx, wy);
        }
        ctx.lineTo(waveRightX, screenBottomCenter.sy + 40);
        ctx.closePath();

        const backWaveGrad = ctx.createLinearGradient(
          cx,
          screenWaterCenter.sy - 24,
          cx,
          screenBottomCenter.sy
        );
        backWaveGrad.addColorStop(0, 'rgba(52, 211, 153, 0.85)');
        backWaveGrad.addColorStop(0.3, 'rgba(16, 185, 129, 0.78)');
        backWaveGrad.addColorStop(0.7, 'rgba(217, 119, 6, 0.72)');
        backWaveGrad.addColorStop(1, 'rgba(146, 64, 14, 0.85)');
        ctx.fillStyle = backWaveGrad;
        ctx.fill();

        // 3B. Mid Wavy Water Layer (Counter-sloshing Liquid Gold Wave)
        ctx.beginPath();
        ctx.moveTo(waveLeftX, screenBottomCenter.sy + 40);
        for (let i = 0; i <= waveSteps; i++) {
          const sx = waveLeftX + i * stepX;
          const wy =
            screenWaterCenter.sy -
            2 +
            evalWaveOffset(sx - cx, elapsedTime, 'mid', surgeAmpRef.current);
          ctx.lineTo(sx, wy);
        }
        ctx.lineTo(waveRightX, screenBottomCenter.sy + 40);
        ctx.closePath();

        const midWaveGrad = ctx.createLinearGradient(
          cx,
          screenWaterCenter.sy - 18,
          cx,
          screenBottomCenter.sy
        );
        midWaveGrad.addColorStop(0, 'rgba(253, 224, 71, 0.88)');
        midWaveGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.78)');
        midWaveGrad.addColorStop(0.75, 'rgba(180, 83, 9, 0.78)');
        midWaveGrad.addColorStop(1, 'rgba(120, 53, 15, 0.88)');
        ctx.fillStyle = midWaveGrad;
        ctx.fill();

        // 3C. Front Wavy Water Layer + Glowing Specular Wave Crest
        const frontWavePts: Array<{ x: number; y: number }> = [];
        ctx.beginPath();
        ctx.moveTo(waveLeftX, screenBottomCenter.sy + 40);
        for (let i = 0; i <= waveSteps; i++) {
          const sx = waveLeftX + i * stepX;
          const wy =
            screenWaterCenter.sy +
            4 +
            evalWaveOffset(sx - cx, elapsedTime, 'front', surgeAmpRef.current);
          frontWavePts.push({ x: sx, y: wy });
          ctx.lineTo(sx, wy);
        }
        ctx.lineTo(waveRightX, screenBottomCenter.sy + 40);
        ctx.closePath();

        const frontWaveGrad = ctx.createLinearGradient(
          cx,
          screenWaterCenter.sy - 12,
          cx,
          screenBottomCenter.sy
        );
        frontWaveGrad.addColorStop(0, 'rgba(254, 249, 195, 0.92)');
        frontWaveGrad.addColorStop(0.22, 'rgba(250, 204, 21, 0.86)');
        frontWaveGrad.addColorStop(0.55, 'rgba(217, 119, 6, 0.82)');
        frontWaveGrad.addColorStop(1, 'rgba(146, 64, 14, 0.92)');
        ctx.fillStyle = frontWaveGrad;
        ctx.fill();

        // Re-blend the 3D Metallic Gold Specular Sheen over the submerged liquid so it looks like
        // a 3D golden glass/metal crown filled with glowing liquid gold waves!
        for (const s of frontStrips) {
          if (s.nx > 0.15) {
            const specIntensity = Math.exp(-Math.pow((s.nx - 0.46) / 0.25, 2)) * 0.42;
            if (specIntensity > 0.03) {
              ctx.beginPath();
              ctx.moveTo(s.top0.sx, s.top0.sy);
              ctx.lineTo(s.top1.sx, s.top1.sy);
              ctx.lineTo(s.bot1.sx, s.bot1.sy);
              ctx.lineTo(s.bot0.sx, s.bot0.sy);
              ctx.closePath();
              ctx.fillStyle = `rgba(255, 254, 240, ${specIntensity})`;
              ctx.fill();
            }
          }
        }

        // 3D. Effervescent Rising Bubbles & Golden Sparkles inside the Wavy Liquid
        for (const b of bubbles) {
          if (motionActive) {
            b.yFrac += b.speed * dt;
            if (b.yFrac > 1) {
              b.yFrac = 0;
              b.xFrac = -0.88 + Math.random() * 1.76;
            }
          }
          const by = screenBottomCenter.sy - (screenBottomCenter.sy - screenWaterCenter.sy) * b.yFrac;
          const bx =
            cx +
            b.xFrac * 155 +
            Math.sin(elapsedTime * 3.4 + b.wobblePhase) * 9;

          ctx.beginPath();
          ctx.arc(bx, by, b.size, 0, Math.PI * 2);
          ctx.fillStyle = b.isGoldSparkle
            ? 'rgba(254, 249, 195, 0.88)'
            : 'rgba(110, 231, 183, 0.72)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 3E. Glowing Foaming Wave Crest Ribbon along the undulating water surface
        if (frontWavePts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(frontWavePts[0].x, frontWavePts[0].y);
          for (let i = 1; i < frontWavePts.length; i++) {
            ctx.lineTo(frontWavePts[i].x, frontWavePts[i].y);
          }
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4.5;
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 16;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      // ======================================================================
      // 4. FOREGROUND 3D ROLLED GOLD VALLEY RIM BEVEL, BASE TORUS RING & SPHERES
      //    (Exact sculptural details from the user's reference crown!)
      // ======================================================================

      // 4A. Thick 3D Rolled Metallic Gold Rim Bevel sweeping along the front U-valleys & peaks
      for (const s of frontStrips) {
        // Outer dark bronze crease line just below the rolled lip
        ctx.beginPath();
        ctx.moveTo(s.top0.sx, s.top0.sy + 4.5);
        ctx.lineTo(s.top1.sx, s.top1.sy + 4.5);
        ctx.strokeStyle = 'rgba(78, 44, 7, 0.75)';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main 3D rolled gold tube along the sweeping U-valley and peak edges
        ctx.beginPath();
        ctx.moveTo(s.top0.sx, s.top0.sy);
        ctx.lineTo(s.top1.sx, s.top1.sy);
        ctx.strokeStyle = s.nx > 0 ? '#fde68a' : '#d49b35';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Specular white-gold top highlight along the rolled lip
        ctx.beginPath();
        ctx.moveTo(s.top0.sx, s.top0.sy - 1.2);
        ctx.lineTo(s.top1.sx, s.top1.sy - 1.2);
        ctx.strokeStyle = s.nx > -0.1 ? '#fffbeb' : 'rgba(254, 240, 138, 0.65)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 4B. 3D Rounded Metallic Gold Base Torus Rim (sleek horizontal double-lipped base from the reference crown)
      const baseLeft = projectPoint({ x: -BASE_RADIUS, y: BASE_Y, z: 0 }, 0, tiltX, cx, cy, fov);
      const baseRight = projectPoint({ x: BASE_RADIUS, y: BASE_Y, z: 0 }, 0, tiltX, cx, cy, fov);
      const baseCenter = projectPoint({ x: 0, y: BASE_Y, z: 0 }, 0, tiltX, cx, cy, fov);
      const baseRx = (baseRight.sx - baseLeft.sx) * 0.512;
      const baseRy = 6.5;

      ctx.save();
      // Anisotropic 24K gold horizontal gradient across the base torus rim
      const torusGrad = ctx.createLinearGradient(baseLeft.sx, baseCenter.sy, baseRight.sx, baseCenter.sy);
      torusGrad.addColorStop(0, '#9a6b24');
      torusGrad.addColorStop(0.18, '#dfb15b');
      torusGrad.addColorStop(0.46, '#785018');
      torusGrad.addColorStop(0.72, '#fff9c2');
      torusGrad.addColorStop(0.86, '#dfb15b');
      torusGrad.addColorStop(1, '#7c531a');

      // Upper shadow crease where the crown wall meets the rolled base torus lip
      ctx.beginPath();
      ctx.ellipse(cx, baseCenter.sy - 3.5, baseRx * 0.99, baseRy * 0.55, 0, 0, Math.PI);
      ctx.strokeStyle = 'rgba(72, 42, 8, 0.72)';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Main 3D rolled metallic gold base rim
      ctx.beginPath();
      ctx.ellipse(cx, baseCenter.sy, baseRx, baseRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = torusGrad;
      ctx.fill();
      ctx.strokeStyle = '#6b4411';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Bright white-gold specular ridge running horizontally across the rolled base lip
      ctx.beginPath();
      ctx.ellipse(cx, baseCenter.sy - 1.8, baseRx * 0.98, baseRy * 0.52, 0, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.strokeStyle = '#fffef0';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Subtle warm gold recessed underside lip (matching the shallow double-lip in the reference crown)
      ctx.beginPath();
      ctx.ellipse(cx, baseCenter.sy + 2.2, baseRx * 0.94, baseRy * 0.44, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#85581a';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // 4C. Render Front-Facing 3D Solid Gold Sphere Finials at the Peak Tips
      for (const sp of frontSpheres) {
        draw3DGoldSphereFinial(
          ctx,
          sp.pt.sx,
          sp.pt.sy,
          sp.radiusScreen,
          false,
          waterLevelY <= PEAK_Y + 8
        );
      }

      // 5. Orbiting King of Glory Golden Starlight Motes
      for (const m of gloryMotes) {
        if (motionActive) {
          m.angle += m.speed * dt;
        }
        const mPt = projectPoint(
          {
            x: Math.cos(m.angle) * m.radius,
            y: m.y + Math.sin(elapsedTime * 2.2 + m.angle) * 7,
            z: Math.sin(m.angle) * m.radius,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        ctx.beginPath();
        ctx.arc(mPt.sx, mPt.sy, m.size * mPt.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(254, 240, 138, ${m.alpha})`;
        ctx.fill();
      }

      // 6. Royal Inscription Footer
      ctx.font = '900 13.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(
        '👑 KING OF GLORY · 3D ROYAL CROWN OF SOULS ✨',
        cx,
        logicalH - 18
      );

      ctx.restore();
      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [compact]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragLastXRef.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragLastXRef.current;
    dragLastXRef.current = e.clientX;
    rotYRef.current += dx * 0.012;
    dragVelocityRef.current = dx * 0.08;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleSurgeWave = () => {
    surgeAmpRef.current = 16;
    dragVelocityRef.current = 2.2;
  };

  const clampedPct = Math.min(100, Math.max(0, Math.round(fillPercentage * 10) / 10));

  return (
    <div className={`crown-art-wrap ${compact ? 'crown-art-wrap--compact' : ''}`}>
      <canvas
        ref={canvasRef}
        id={`crown-3d-canvas-${uid}`}
        role="img"
        aria-label={`3D Rotating King of Glory Royal Gold Crown with Wavy Water Progress: ${currentSouls} of ${targetSouls} souls registered (${clampedPct}% full)`}
        className="crown-art-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {!compact && (
        <div className="crown-art-controls no-print">
          <span className="crown-art-controls__hint">
            🔄 3D Auto-Rotating Royal Crown · Drag to Spin
          </span>
          <div className="crown-art-controls__btns">
            <button
              type="button"
              className="btn btn--ghost btn--sm crown-art-ctrl-btn"
              onClick={handleSurgeWave}
            >
              🌊 Surge Wave
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm crown-art-ctrl-btn"
              onClick={() => setIsPaused((p) => !p)}
            >
              {isPaused ? '▶ Play 3D Motion' : '⏸ Pause 3D Motion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

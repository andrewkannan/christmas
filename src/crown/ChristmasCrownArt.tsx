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
  angle: number;
  radiusFrac: number;
  yFrac: number;
  speed: number;
  size: number;
  wobblePhase: number;
  sparkle: boolean;
}

interface OrbitParticle {
  angle: number;
  y: number;
  radius: number;
  speed: number;
  size: number;
  color: string;
}

const NUM_SPIRES = 8;
const BASE_Y = 155; // Bottom of crown in 3D space (y+ is down, y- is up)
const BAND_TOP_Y = 98;
const TALL_SPIRE_Y = -125;
const SHORT_SPIRE_Y = -72;
const ARCH_APEX_Y = -155;
const STAR_CENTER_Y = -192;
const MIN_FILL_Y = BASE_Y;
const MAX_FILL_Y = -205;

function projectPoint(
  pt: Vec3,
  rotY: number,
  tiltX: number,
  cx: number,
  cy: number,
  fov: number
): ProjectedPt {
  // Rotate around Y axis
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = pt.x * cosY + pt.z * sinY;
  const z1 = -pt.x * sinY + pt.z * cosY;

  // Tilt around X axis so the viewer looks slightly down into the 3D crown & water surface
  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);
  const y2 = pt.y * cosX - z1 * sinX;
  const z2 = pt.y * sinX + z1 * cosX;

  const scale = fov / Math.max(120, fov + z2 + 60);
  return {
    sx: cx + x1 * scale,
    sy: cy + y2 * scale,
    z: z2,
    scale,
  };
}

/**
 * Computes the 3D crown outer radius at a given vertical coordinate y (-205..155)
 * so the wavy liquid volume conforms organically to the tapered 3D crown shape.
 */
function getCrownRadiusAtY(y: number): number {
  if (y >= BAND_TOP_Y) {
    // Base band: 138 at bottom flaring to 152 at band top
    const t = (BASE_Y - y) / Math.max(1, BASE_Y - BAND_TOP_Y);
    return 138 + t * 14;
  }
  if (y >= TALL_SPIRE_Y) {
    // Main crown-tree body: flares from 152 at band top to 170 mid-way, then tapers toward spire tips
    const t = (BAND_TOP_Y - y) / Math.max(1, BAND_TOP_Y - TALL_SPIRE_Y);
    return 152 + Math.sin(t * Math.PI) * 18 - t * 34;
  }
  if (y >= ARCH_APEX_Y) {
    // Royal diadem arch dome: tapers smoothly toward the orb
    const t = (TALL_SPIRE_Y - y) / Math.max(1, TALL_SPIRE_Y - ARCH_APEX_Y);
    return 118 * (1 - t * 0.72);
  }
  return 34;
}

/**
 * Evaluates the multi-harmonic water wave height offset at horizontal coordinate x and time t.
 */
function evalWaveOffset(
  x: number,
  z: number,
  time: number,
  layer: 'front' | 'back' | 'caustic',
  surgeAmp: number
): number {
  const baseAmp = (11.5 + surgeAmp) * (layer === 'caustic' ? 0.75 : 1);
  if (layer === 'front') {
    return (
      Math.sin(x * 0.024 + time * 3.4) * baseAmp +
      Math.cos(x * 0.048 - time * 2.5 + z * 0.015) * (baseAmp * 0.52) +
      Math.sin(x * 0.085 + time * 4.8) * (baseAmp * 0.25)
    );
  }
  if (layer === 'back') {
    return (
      Math.sin(x * 0.022 - time * 2.9 + 1.6) * baseAmp +
      Math.cos(x * 0.044 + time * 2.2 - z * 0.015) * (baseAmp * 0.54) +
      Math.cos(x * 0.08 - time * 4.1) * (baseAmp * 0.22)
    );
  }
  return (
    Math.sin(x * 0.032 + time * 4.0 + 0.8) * baseAmp +
    Math.cos(x * 0.056 - time * 3.1) * (baseAmp * 0.45)
  );
}

/**
 * Traces the full 3D outer vessel envelope of the rotating Crown-Dome
 * so the sloshing 3D water waves fill the entire 3D crown from left spire to right spire!
 */
function build3DCrownClipPath(
  ctx: CanvasRenderingContext2D,
  rotY: number,
  tiltX: number,
  cx: number,
  cy: number,
  fov: number
) {
  ctx.beginPath();

  const leftBase = projectPoint({ x: -138, y: BASE_Y, z: 0 }, 0, tiltX, cx, cy, fov);
  const leftBand = projectPoint({ x: -152, y: BAND_TOP_Y, z: 0 }, 0, tiltX, cx, cy, fov);
  const leftMid = projectPoint({ x: -166, y: 12, z: 0 }, 0, tiltX, cx, cy, fov);
  const leftSpire = projectPoint({ x: -154, y: TALL_SPIRE_Y, z: 0 }, 0, tiltX, cx, cy, fov);
  const topDome = projectPoint({ x: 0, y: MAX_FILL_Y - 8, z: 0 }, 0, tiltX, cx, cy, fov);
  const rightSpire = projectPoint({ x: 154, y: TALL_SPIRE_Y, z: 0 }, 0, tiltX, cx, cy, fov);
  const rightMid = projectPoint({ x: 166, y: 12, z: 0 }, 0, tiltX, cx, cy, fov);
  const rightBand = projectPoint({ x: 152, y: BAND_TOP_Y, z: 0 }, 0, tiltX, cx, cy, fov);
  const rightBase = projectPoint({ x: 138, y: BASE_Y, z: 0 }, 0, tiltX, cx, cy, fov);

  // Subtle 3D breathing width from rotation
  const breath = Math.sin(rotY * 4) * 5;

  ctx.moveTo(leftBase.sx, leftBase.sy);
  ctx.lineTo(leftBand.sx - breath * 0.4, leftBand.sy);
  ctx.lineTo(leftMid.sx - breath, leftMid.sy);
  ctx.lineTo(leftSpire.sx - breath * 0.7, leftSpire.sy);

  // Royal Diadem Arch Dome curve up to the Star of Bethlehem apex
  ctx.quadraticCurveTo(
    cx - 88,
    topDome.sy + 14,
    topDome.sx,
    topDome.sy
  );
  ctx.quadraticCurveTo(
    cx + 88,
    topDome.sy + 14,
    rightSpire.sx + breath * 0.7,
    rightSpire.sy
  );

  ctx.lineTo(rightMid.sx + breath, rightMid.sy);
  ctx.lineTo(rightBand.sx + breath * 0.4, rightBand.sy);
  ctx.lineTo(rightBase.sx, rightBase.sy);

  // Curved 3D elliptical base bottom
  ctx.quadraticCurveTo(cx, leftBase.sy + 32, leftBase.sx, leftBase.sy);
  ctx.closePath();
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
  const rotYRef = useRef<number>(0.35);
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
      // Trigger a lively water wave slosh whenever progress changes!
      surgeAmpRef.current = Math.min(14, surgeAmpRef.current + 7.5);
    }
    targetFillRef.current = clamped;
  }, [fillPercentage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const logicalW = 620;
    const logicalH = 540;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;

    // Initialize effervescent rising bubbles inside the liquid
    const bubbles: BubbleParticle[] = Array.from({ length: 34 }, (_, i) => ({
      angle: (i / 34) * Math.PI * 2 + Math.random() * 0.5,
      radiusFrac: 0.2 + Math.random() * 0.72,
      yFrac: Math.random(),
      speed: 0.22 + Math.random() * 0.38,
      size: 2.2 + Math.random() * 4.2,
      wobblePhase: Math.random() * Math.PI * 2,
      sparkle: i % 3 === 0,
    }));

    // Initialize 3D orbiting golden Christmas starlight dust around the crown
    const orbiters: OrbitParticle[] = Array.from({ length: 24 }, (_, i) => ({
      angle: (i / 24) * Math.PI * 2,
      y: -170 + (i / 24) * 310,
      radius: 175 + (i % 4) * 18,
      speed: (i % 2 === 0 ? 1 : -1) * (0.45 + (i % 3) * 0.2),
      size: 1.8 + (i % 3) * 1.1,
      color: i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#34d399' : '#fca5a5',
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
          rotYRef.current += (0.58 + dragVelocityRef.current) * dt;
          dragVelocityRef.current *= Math.pow(0.08, dt);
        }
      }

      // Smooth spring interpolation for liquid level & wave surge decay
      const diff = targetFillRef.current - animatedFillRef.current;
      animatedFillRef.current += diff * Math.min(1, dt * 4.5);
      surgeAmpRef.current *= Math.pow(0.28, dt);

      const fillPct = Math.min(100, Math.max(0, animatedFillRef.current));
      const rotY = rotYRef.current;
      const tiltX = 0.22; // 12.6° 3D camera downward tilt
      const cx = logicalW * 0.5;
      const cy = logicalH * 0.54;
      const fov = 560;

      // Vertical water level in 3D space (BASE_Y = 155 is 0%, MAX_FILL_Y = -205 is 100%)
      const waterLevelY = MIN_FILL_Y - ((MIN_FILL_Y - MAX_FILL_Y) * fillPct) / 100;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalW, logicalH);

      // 0. Ambient 3D Stage Halo & Volumetric Floor Reflection
      const stageGlow = ctx.createRadialGradient(cx, cy - 20, 20, cx, cy - 20, 275);
      stageGlow.addColorStop(0, 'rgba(16, 185, 129, 0.26)');
      stageGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.14)');
      stageGlow.addColorStop(1, 'rgba(2, 44, 34, 0)');
      ctx.fillStyle = stageGlow;
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Rotating 3D Golden Pedestal Ring beneath the Crown
      ctx.save();
      ctx.translate(cx, cy + BASE_Y + 24);
      ctx.scale(1, 0.26);
      ctx.beginPath();
      ctx.arc(0, 0, 162, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

      // Background Milestone Elevation Rings (25%, 50%, 75%, 100%)
      if (!compact) {
        const milestones = [
          { pct: 25, label: '25%' },
          { pct: 50, label: '50%' },
          { pct: 75, label: '75%' },
          { pct: 100, label: '100% FULL CROWN' },
        ];
        for (const m of milestones) {
          const my = MIN_FILL_Y - ((MIN_FILL_Y - MAX_FILL_Y) * m.pct) / 100;
          const screenPt = projectPoint({ x: 0, y: my, z: 0 }, rotY, tiltX, cx, cy, fov);
          const reached = fillPct >= m.pct - 0.5;
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([5, 6]);
          ctx.moveTo(42, screenPt.sy);
          ctx.lineTo(logicalW - 42, screenPt.sy);
          ctx.strokeStyle = reached
            ? 'rgba(253, 224, 71, 0.42)'
            : 'rgba(255, 255, 255, 0.13)';
          ctx.lineWidth = 1.3;
          ctx.stroke();

          ctx.font = '800 11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = reached ? '#fde047' : 'rgba(255, 255, 255, 0.45)';
          ctx.textAlign = 'right';
          ctx.fillText(m.label, logicalW - 44, screenPt.sy - 5);
          ctx.restore();
        }
      }

      // Build 3D Spires with their depth (z) so we can render back-facing spires BEFORE the liquid
      // and front-facing spires AFTER the liquid for true 3D depth occlusion!
      interface Spire3D {
        index: number;
        angle: number;
        isTall: boolean;
        centerZ: number;
        baseLeft: ProjectedPt;
        baseRight: ProjectedPt;
        midLeft: ProjectedPt;
        midRight: ProjectedPt;
        upperLeft: ProjectedPt;
        upperRight: ProjectedPt;
        tip: ProjectedPt;
        archMid: ProjectedPt;
        ornaments: Array<{ pt: ProjectedPt; y3d: number; color: string; r: number }>;
      }

      const spires: Spire3D[] = [];
      const angleStep = (Math.PI * 2) / NUM_SPIRES;

      for (let i = 0; i < NUM_SPIRES; i++) {
        const angle = i * angleStep;
        const isTall = i % 2 === 0;
        const tipY = isTall ? TALL_SPIRE_Y : SHORT_SPIRE_Y;
        const halfSpread = angleStep * 0.48;

        const pBaseL = projectPoint(
          {
            x: Math.cos(angle - halfSpread) * 150,
            y: BAND_TOP_Y,
            z: Math.sin(angle - halfSpread) * 150,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const pBaseR = projectPoint(
          {
            x: Math.cos(angle + halfSpread) * 150,
            y: BAND_TOP_Y,
            z: Math.sin(angle + halfSpread) * 150,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        // Pine bough serration tier 1
        const pMidL = projectPoint(
          {
            x: Math.cos(angle - halfSpread * 0.72) * 162,
            y: 18,
            z: Math.sin(angle - halfSpread * 0.72) * 162,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const pMidR = projectPoint(
          {
            x: Math.cos(angle + halfSpread * 0.72) * 162,
            y: 18,
            z: Math.sin(angle + halfSpread * 0.72) * 162,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        // Pine bough serration tier 2
        const pUpL = projectPoint(
          {
            x: Math.cos(angle - halfSpread * 0.42) * 156,
            y: isTall ? -55 : -28,
            z: Math.sin(angle - halfSpread * 0.42) * 156,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const pUpR = projectPoint(
          {
            x: Math.cos(angle + halfSpread * 0.42) * 156,
            y: isTall ? -55 : -28,
            z: Math.sin(angle + halfSpread * 0.42) * 156,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const pTip = projectPoint(
          {
            x: Math.cos(angle) * (isTall ? 152 : 144),
            y: tipY,
            z: Math.sin(angle) * (isTall ? 152 : 144),
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const pArchMid = projectPoint(
          {
            x: Math.cos(angle) * 78,
            y: ARCH_APEX_Y,
            z: Math.sin(angle) * 78,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );

        const orn1Y = 45;
        const orn2Y = isTall ? -28 : -5;
        const orn1 = projectPoint(
          {
            x: Math.cos(angle) * 154,
            y: orn1Y,
            z: Math.sin(angle) * 154,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const orn2 = projectPoint(
          {
            x: Math.cos(angle) * 150,
            y: orn2Y,
            z: Math.sin(angle) * 150,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );

        spires.push({
          index: i,
          angle,
          isTall,
          centerZ: pTip.z,
          baseLeft: pBaseL,
          baseRight: pBaseR,
          midLeft: pMidL,
          midRight: pMidR,
          upperLeft: pUpL,
          upperRight: pUpR,
          tip: pTip,
          archMid: pArchMid,
          ornaments: [
            {
              pt: orn1,
              y3d: orn1Y,
              color: i % 2 === 0 ? '#ef4444' : '#38bdf8',
              r: 7.5,
            },
            {
              pt: orn2,
              y3d: orn2Y,
              color: i % 2 === 0 ? '#facc15' : '#22c55e',
              r: 6.5,
            },
            {
              pt: pTip,
              y3d: tipY,
              color: isTall ? '#fef08a' : '#f43f5e',
              r: isTall ? 9 : 7.5,
            },
          ],
        });
      }

      const royalOrbTop = projectPoint({ x: 0, y: ARCH_APEX_Y + 6, z: 0 }, rotY, tiltX, cx, cy, fov);

      // Helper to draw a single 3D Spire & its Royal Diadem Arch
      const drawSpire = (sp: Spire3D, isBack: boolean) => {
        ctx.save();
        // Christmas pine-bough serrated spire polygon
        ctx.beginPath();
        ctx.moveTo(sp.baseLeft.sx, sp.baseLeft.sy);
        ctx.lineTo(sp.midLeft.sx, sp.midLeft.sy);
        ctx.lineTo(
          sp.midLeft.sx * 0.85 + sp.baseRight.sx * 0.15,
          sp.midLeft.sy + 8
        );
        ctx.lineTo(sp.upperLeft.sx, sp.upperLeft.sy);
        ctx.lineTo(sp.tip.sx, sp.tip.sy);
        ctx.lineTo(sp.upperRight.sx, sp.upperRight.sy);
        ctx.lineTo(
          sp.midRight.sx * 0.85 + sp.baseLeft.sx * 0.15,
          sp.midRight.sy + 8
        );
        ctx.lineTo(sp.midRight.sx, sp.midRight.sy);
        ctx.lineTo(sp.baseRight.sx, sp.baseRight.sy);
        ctx.closePath();

        const spireGrad = ctx.createLinearGradient(
          sp.tip.sx,
          sp.tip.sy,
          sp.tip.sx,
          sp.baseLeft.sy
        );
        if (isBack) {
          spireGrad.addColorStop(0, 'rgba(6, 95, 70, 0.42)');
          spireGrad.addColorStop(1, 'rgba(2, 44, 34, 0.55)');
        } else {
          spireGrad.addColorStop(0, 'rgba(22, 163, 74, 0.36)');
          spireGrad.addColorStop(0.55, 'rgba(5, 150, 105, 0.28)');
          spireGrad.addColorStop(1, 'rgba(6, 78, 59, 0.42)');
        }
        ctx.fillStyle = spireGrad;
        ctx.fill();

        ctx.strokeStyle = isBack
          ? 'rgba(253, 224, 71, 0.36)'
          : 'rgba(254, 240, 138, 0.92)';
        ctx.lineWidth = isBack ? 1.8 : 3.2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Central Golden Spire Spine Rib
        const baseCenterSx = (sp.baseLeft.sx + sp.baseRight.sx) * 0.5;
        const baseCenterSy = (sp.baseLeft.sy + sp.baseRight.sy) * 0.5;
        ctx.beginPath();
        ctx.moveTo(baseCenterSx, baseCenterSy);
        ctx.lineTo(sp.tip.sx, sp.tip.sy);
        ctx.strokeStyle = isBack
          ? 'rgba(253, 224, 71, 0.18)'
          : 'rgba(254, 240, 138, 0.55)';
        ctx.lineWidth = isBack ? 1.2 : 2.2;
        ctx.stroke();

        // If tall spire, draw the 3D Royal Golden Pine-Garland Arch curving into the central orb
        if (sp.isTall) {
          ctx.beginPath();
          ctx.moveTo(sp.tip.sx, sp.tip.sy);
          ctx.quadraticCurveTo(
            sp.archMid.sx,
            sp.archMid.sy - 18,
            royalOrbTop.sx,
            royalOrbTop.sy
          );
          ctx.strokeStyle = isBack
            ? 'rgba(250, 204, 21, 0.32)'
            : 'rgba(254, 240, 138, 0.92)';
          ctx.lineWidth = isBack ? 2.5 : 4.5;
          ctx.stroke();

          // Pearl & pine studs along the 3D royal arch
          for (let k = 1; k <= 4; k++) {
            const t = k / 5;
            const inv = 1 - t;
            const ax =
              inv * inv * sp.tip.sx +
              2 * inv * t * sp.archMid.sx +
              t * t * royalOrbTop.sx;
            const ay =
              inv * inv * sp.tip.sy +
              2 * inv * t * (sp.archMid.sy - 18) +
              t * t * royalOrbTop.sy;
            ctx.beginPath();
            ctx.arc(ax, ay, isBack ? 2.2 : 3.4, 0, Math.PI * 2);
            ctx.fillStyle = isBack ? 'rgba(254, 240, 138, 0.45)' : '#fef9c3';
            ctx.fill();
          }
        }

        // Draw 3D Ornaments & Spire Finial Jewels (glowing brightly when submerged/lit by the wave!)
        for (const orn of sp.ornaments) {
          const isLit = waterLevelY <= orn.y3d + 10;
          const r = orn.r * orn.pt.scale * (isBack ? 0.82 : 1.05);
          if (isLit && !isBack) {
            const halo = ctx.createRadialGradient(
              orn.pt.sx,
              orn.pt.sy,
              1,
              orn.pt.sx,
              orn.pt.sy,
              r * 2.5
            );
            halo.addColorStop(0, '#fef9c3');
            halo.addColorStop(0.45, orn.color);
            halo.addColorStop(1, 'rgba(254, 240, 138, 0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(orn.pt.sx, orn.pt.sy, r * 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(orn.pt.sx, orn.pt.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = isLit
            ? orn.color
            : isBack
              ? 'rgba(255, 255, 255, 0.14)'
              : 'rgba(255, 255, 255, 0.22)';
          ctx.fill();
          ctx.strokeStyle = isLit ? '#ffffff' : 'rgba(253, 224, 71, 0.45)';
          ctx.lineWidth = isBack ? 1.2 : 2;
          ctx.stroke();

          if (isLit && !isBack) {
            ctx.beginPath();
            ctx.arc(orn.pt.sx - r * 0.3, orn.pt.sy - r * 0.3, r * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }

        ctx.restore();
      };

      // Separate back-facing vs front-facing spires by their 3D depth (centerZ > 0 is farther away)
      const backSpires = spires
        .filter((s) => s.centerZ > 0)
        .sort((a, b) => b.centerZ - a.centerZ);
      const frontSpires = spires
        .filter((s) => s.centerZ <= 0)
        .sort((a, b) => b.centerZ - a.centerZ);

      // 1. Render Back-Facing 3D Spires & Back Royal Band Wall
      for (const sp of backSpires) {
        drawSpire(sp, true);
      }

      // Back half of the 3D Cylindrical Royal Base Band
      const bandSegments = 28;
      for (let i = 0; i < bandSegments; i++) {
        const a0 = (i / bandSegments) * Math.PI * 2;
        const a1 = ((i + 1) / bandSegments) * Math.PI * 2;
        const midA = (a0 + a1) * 0.5;
        const pMid = projectPoint(
          { x: Math.cos(midA) * 144, y: (BASE_Y + BAND_TOP_Y) * 0.5, z: Math.sin(midA) * 144 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        if (pMid.z <= 0) continue; // Only back-facing segments in pass 1

        const p0Top = projectPoint(
          { x: Math.cos(a0) * 150, y: BAND_TOP_Y, z: Math.sin(a0) * 150 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const p1Top = projectPoint(
          { x: Math.cos(a1) * 150, y: BAND_TOP_Y, z: Math.sin(a1) * 150 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const p1Bot = projectPoint(
          { x: Math.cos(a1) * 138, y: BASE_Y, z: Math.sin(a1) * 138 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const p0Bot = projectPoint(
          { x: Math.cos(a0) * 138, y: BASE_Y, z: Math.sin(a0) * 138 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );

        ctx.beginPath();
        ctx.moveTo(p0Top.sx, p0Top.sy);
        ctx.lineTo(p1Top.sx, p1Top.sy);
        ctx.lineTo(p1Bot.sx, p1Bot.sy);
        ctx.lineTo(p0Bot.sx, p0Bot.sy);
        ctx.closePath();
        ctx.fillStyle = 'rgba(69, 10, 10, 0.52)';
        ctx.fill();
      }

      // ========================================================================
      // 2. THE WAVY, WATERY, BIOLUMINESCENT LIQUID PROGRESS FILL (Clipped to 3D Crown)
      // ========================================================================
      if (fillPct > 0.15) {
        ctx.save();
        build3DCrownClipPath(ctx, rotY, tiltX, cx, cy, fov);
        ctx.clip();

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

        const waveLeftX = 55;
        const waveRightX = logicalW - 55;
        const waveSteps = 64;
        const stepX = (waveRightX - waveLeftX) / waveSteps;

        // 2A. Back Water Wave Layer (Deep Bioluminescent Emerald & Gold)
        ctx.beginPath();
        ctx.moveTo(waveLeftX, screenBottomCenter.sy + 40);
        for (let i = 0; i <= waveSteps; i++) {
          const sx = waveLeftX + i * stepX;
          const localX = sx - cx;
          const waveY =
            screenWaterCenter.sy -
            6 +
            evalWaveOffset(localX, 60, elapsedTime, 'back', surgeAmpRef.current);
          ctx.lineTo(sx, waveY);
        }
        ctx.lineTo(waveRightX, screenBottomCenter.sy + 40);
        ctx.closePath();

        const backWaveGrad = ctx.createLinearGradient(
          cx,
          screenWaterCenter.sy - 20,
          cx,
          screenBottomCenter.sy
        );
        backWaveGrad.addColorStop(0, 'rgba(52, 211, 153, 0.78)');
        backWaveGrad.addColorStop(0.28, 'rgba(16, 185, 129, 0.82)');
        backWaveGrad.addColorStop(0.7, 'rgba(4, 120, 87, 0.88)');
        backWaveGrad.addColorStop(1, 'rgba(6, 78, 59, 0.95)');
        ctx.fillStyle = backWaveGrad;
        ctx.fill();

        // 2B. Mid Water Caustic & Liquid Gold Wave Layer
        ctx.beginPath();
        ctx.moveTo(waveLeftX, screenBottomCenter.sy + 40);
        for (let i = 0; i <= waveSteps; i++) {
          const sx = waveLeftX + i * stepX;
          const localX = sx - cx;
          const waveY =
            screenWaterCenter.sy -
            1 +
            evalWaveOffset(localX, 0, elapsedTime, 'caustic', surgeAmpRef.current);
          ctx.lineTo(sx, waveY);
        }
        ctx.lineTo(waveRightX, screenBottomCenter.sy + 40);
        ctx.closePath();

        const midWaveGrad = ctx.createLinearGradient(
          cx,
          screenWaterCenter.sy - 15,
          cx,
          screenBottomCenter.sy
        );
        midWaveGrad.addColorStop(0, 'rgba(253, 224, 71, 0.62)');
        midWaveGrad.addColorStop(0.22, 'rgba(245, 158, 11, 0.45)');
        midWaveGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.5)');
        midWaveGrad.addColorStop(1, 'rgba(4, 120, 87, 0.7)');
        ctx.fillStyle = midWaveGrad;
        ctx.fill();

        // 2C. Front Sloshing Water Wave Layer + Specular Meniscus Foam Ribbon
        const frontWavePts: Array<{ x: number; y: number }> = [];
        ctx.beginPath();
        ctx.moveTo(waveLeftX, screenBottomCenter.sy + 40);
        for (let i = 0; i <= waveSteps; i++) {
          const sx = waveLeftX + i * stepX;
          const localX = sx - cx;
          const waveY =
            screenWaterCenter.sy +
            4 +
            evalWaveOffset(localX, -60, elapsedTime, 'front', surgeAmpRef.current);
          frontWavePts.push({ x: sx, y: waveY });
          ctx.lineTo(sx, waveY);
        }
        ctx.lineTo(waveRightX, screenBottomCenter.sy + 40);
        ctx.closePath();

        const frontWaveGrad = ctx.createLinearGradient(
          cx,
          screenWaterCenter.sy - 10,
          cx,
          screenBottomCenter.sy
        );
        frontWaveGrad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
        frontWaveGrad.addColorStop(0.18, 'rgba(245, 158, 11, 0.74)');
        frontWaveGrad.addColorStop(0.52, 'rgba(16, 185, 129, 0.78)');
        frontWaveGrad.addColorStop(1, 'rgba(6, 95, 70, 0.94)');
        ctx.fillStyle = frontWaveGrad;
        ctx.fill();

        // 2D. Animated Underwater Caustic Light Rays & Effervescent Rising Bubbles
        for (let r = 0; r < 5; r++) {
          const rayAngle = rotY * 1.4 + r * 1.25;
          const rayX = cx + Math.sin(rayAngle) * 95;
          const rayGrad = ctx.createLinearGradient(
            rayX,
            screenWaterCenter.sy,
            rayX + Math.cos(rayAngle) * 35,
            screenBottomCenter.sy
          );
          rayGrad.addColorStop(0, 'rgba(254, 249, 195, 0.28)');
          rayGrad.addColorStop(1, 'rgba(254, 249, 195, 0)');
          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(rayX - 18, screenWaterCenter.sy);
          ctx.lineTo(rayX + 18, screenWaterCenter.sy);
          ctx.lineTo(rayX + 46, screenBottomCenter.sy);
          ctx.lineTo(rayX - 46, screenBottomCenter.sy);
          ctx.closePath();
          ctx.fill();
        }

        // Effervescent 3D bubbles rising through the water toward the wavy crest
        for (const b of bubbles) {
          if (motionActive) {
            b.yFrac += b.speed * dt;
            if (b.yFrac > 1) {
              b.yFrac = 0;
              b.angle = Math.random() * Math.PI * 2;
            }
          }
          const by = BASE_Y - (BASE_Y - waterLevelY) * b.yFrac;
          if (by < waterLevelY + 4) continue;
          const maxR = getCrownRadiusAtY(by) * 0.82;
          const br = maxR * b.radiusFrac;
          const wobble = Math.sin(elapsedTime * 3.2 + b.wobblePhase) * 8;
          const bPt = projectPoint(
            {
              x: Math.cos(b.angle) * br + wobble,
              y: by,
              z: Math.sin(b.angle) * br,
            },
            rotY,
            tiltX,
            cx,
            cy,
            fov
          );

          ctx.beginPath();
          ctx.arc(bPt.sx, bPt.sy, b.size * bPt.scale, 0, Math.PI * 2);
          ctx.fillStyle = b.sparkle
            ? 'rgba(254, 249, 195, 0.82)'
            : 'rgba(167, 243, 208, 0.58)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 2E. Glowing Shimmering Liquid Gold Wave Crest Line
        if (frontWavePts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(frontWavePts[0].x, frontWavePts[0].y);
          for (let i = 1; i < frontWavePts.length; i++) {
            ctx.lineTo(frontWavePts[i].x, frontWavePts[i].y);
          }
          ctx.strokeStyle = '#fef9c3';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      // ========================================================================
      // 3. FOREGROUND 3D ROYAL BASE BAND, 3D ORBITING GEMS & FRONT SPIRES
      // ========================================================================
      for (let i = 0; i < bandSegments; i++) {
        const a0 = (i / bandSegments) * Math.PI * 2;
        const a1 = ((i + 1) / bandSegments) * Math.PI * 2;
        const midA = (a0 + a1) * 0.5;
        const pMid = projectPoint(
          { x: Math.cos(midA) * 144, y: (BASE_Y + BAND_TOP_Y) * 0.5, z: Math.sin(midA) * 144 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        if (pMid.z > 0) continue; // Only front-facing segments

        const p0Top = projectPoint(
          { x: Math.cos(a0) * 150, y: BAND_TOP_Y, z: Math.sin(a0) * 150 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const p1Top = projectPoint(
          { x: Math.cos(a1) * 150, y: BAND_TOP_Y, z: Math.sin(a1) * 150 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const p1Bot = projectPoint(
          { x: Math.cos(a1) * 138, y: BASE_Y, z: Math.sin(a1) * 138 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        const p0Bot = projectPoint(
          { x: Math.cos(a0) * 138, y: BASE_Y, z: Math.sin(a0) * 138 },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );

        // Specular directional shading across the 3D curved cylinder
        const normalX = Math.sin(midA + rotY);
        const spec = Math.max(0, Math.cos(midA + rotY - 0.35));
        const rCol = Math.round(125 + spec * 95);
        const gCol = Math.round(18 + spec * 38);
        const bCol = Math.round(24 + spec * 20);

        ctx.beginPath();
        ctx.moveTo(p0Top.sx, p0Top.sy);
        ctx.lineTo(p1Top.sx, p1Top.sy);
        ctx.lineTo(p1Bot.sx, p1Bot.sy);
        ctx.lineTo(p0Bot.sx, p0Bot.sy);
        ctx.closePath();
        ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, 0.88)`;
        ctx.fill();

        // Top and bottom 3D metallic gold rim segments
        ctx.beginPath();
        ctx.moveTo(p0Top.sx, p0Top.sy);
        ctx.lineTo(p1Top.sx, p1Top.sy);
        ctx.strokeStyle = normalX > -0.2 ? '#fef08a' : '#d97706';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p0Bot.sx, p0Bot.sy);
        ctx.lineTo(p1Bot.sx, p1Bot.sy);
        ctx.strokeStyle = normalX > -0.2 ? '#fde047' : '#b45309';
        ctx.lineWidth = 4.2;
        ctx.stroke();
      }

      // 12 3D Royal Base Band Gemstones rotating around the cylinder
      const numBaseGems = 12;
      for (let g = 0; g < numBaseGems; g++) {
        const ga = (g / numBaseGems) * Math.PI * 2;
        const gemPt = projectPoint(
          {
            x: Math.cos(ga) * 147,
            y: (BASE_Y + BAND_TOP_Y) * 0.5,
            z: Math.sin(ga) * 147,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        if (gemPt.z > 10) continue; // Occluded on back side of band

        const gemColors = ['#ef4444', '#10b981', '#f59e0b', '#38bdf8'];
        const gemColor = gemColors[g % gemColors.length];
        const gr = (g % 3 === 0 ? 10.5 : 8.2) * gemPt.scale;

        ctx.beginPath();
        ctx.arc(gemPt.sx, gemPt.sy, gr, 0, Math.PI * 2);
        ctx.fillStyle = gemColor;
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(gemPt.sx - gr * 0.28, gemPt.sy - gr * 0.28, gr * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Render Front-Facing 3D Spires & Arches
      for (const sp of frontSpires) {
        drawSpire(sp, false);
      }

      // 4. 3D Royal Monde (Golden Globe) & 3D Multi-Axis Rotating Star of Bethlehem at the Apex
      const starCenter = projectPoint(
        { x: 0, y: STAR_CENTER_Y, z: 0 },
        rotY,
        tiltX,
        cx,
        cy,
        fov
      );
      const starLit = fillPct >= 95;

      // Royal Orb at the convergence of the 4 Crown Arches
      ctx.beginPath();
      ctx.arc(royalOrbTop.sx, royalOrbTop.sy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Radiant Star Halo
      const starHaloR = starLit ? 64 : 44;
      const starHalo = ctx.createRadialGradient(
        starCenter.sx,
        starCenter.sy,
        2,
        starCenter.sx,
        starCenter.sy,
        starHaloR
      );
      starHalo.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
      starHalo.addColorStop(0.4, 'rgba(250, 204, 21, 0.45)');
      starHalo.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = starHalo;
      ctx.beginPath();
      ctx.arc(starCenter.sx, starCenter.sy, starHaloR, 0, Math.PI * 2);
      ctx.fill();

      // 3D 8-Pointed Star of Bethlehem rotating with foreshortened 3D rays
      ctx.save();
      ctx.translate(starCenter.sx, starCenter.sy);
      const starSpin = Math.cos(rotY * 2);
      const outerR = 32;
      const innerR = 10;
      ctx.beginPath();
      for (let p = 0; p < 16; p++) {
        const a = (p / 16) * Math.PI * 2 - Math.PI * 0.5;
        const r = p % 2 === 0 ? outerR : innerR;
        const px = Math.cos(a) * r * (0.72 + 0.28 * Math.abs(starSpin));
        const py = Math.sin(a) * r;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#fef08a';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // 5. Orbiting 3D Christmas Starlight Motes around the Rotating Crown
      for (const orb of orbiters) {
        if (motionActive) {
          orb.angle += orb.speed * dt;
        }
        const oPt = projectPoint(
          {
            x: Math.cos(orb.angle) * orb.radius,
            y: orb.y + Math.sin(elapsedTime * 2 + orb.angle) * 8,
            z: Math.sin(orb.angle) * orb.radius,
          },
          rotY,
          tiltX,
          cx,
          cy,
          fov
        );
        ctx.beginPath();
        ctx.arc(oPt.sx, oPt.sy, orb.size * oPt.scale, 0, Math.PI * 2);
        ctx.fillStyle = orb.color;
        ctx.fill();
      }

      // 6. Royal Inscription Footer inside the 3D Stage
      ctx.font = '900 13.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(
        '👑 3D KING OF GLORY · LIVING WATER CROWN OF SOULS 🎄',
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
    surgeAmpRef.current = 15;
    dragVelocityRef.current = 2.4;
  };

  const clampedPct = Math.min(100, Math.max(0, Math.round(fillPercentage * 10) / 10));

  return (
    <div className={`crown-art-wrap ${compact ? 'crown-art-wrap--compact' : ''}`}>
      <canvas
        ref={canvasRef}
        id={`crown-3d-canvas-${uid}`}
        role="img"
        aria-label={`3D Rotating King of Glory Christmas Crown with Wavy Water Progress: ${currentSouls} of ${targetSouls} souls registered (${clampedPct}% full)`}
        className="crown-art-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {!compact && (
        <div className="crown-art-controls no-print">
          <span className="crown-art-controls__hint">
            🔄 3D Auto-Rotating · Drag Crown to Spin
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

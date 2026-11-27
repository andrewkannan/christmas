import { useCallback, useEffect, useRef, useState } from 'react';
import { KING_OF_GLORY_INVITE } from '../invite/kingOfGloryInvite.ts';
import { playArcadeTone } from '../lib/sound.ts';

interface ChristmasCastleMagicProps {
  /** 'arcade' for the main page (/), 'register' for the invitation sign-up page (/register). */
  variant: 'arcade' | 'register';
}

interface SnowMote {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
  phase: number;
  isGold: boolean;
}

interface TouchSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  hue: 'gold' | 'crimson' | 'cream';
  rotation: number;
  vRot: number;
}

type GateState = 'closed' | 'opening' | 'opened';

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  rotation: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 4;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders:
 * 1. A cinematic Disney-inspired Fairytale Christmas Castle intro that waits for the guest's
 *    click/tap, then swings open the grand castle doors as a brilliant golden-white light
 *    blooms outward and the camera flies through the doorway into the page.
 * 2. A 60fps ambient Golden Snowfall, Candlelight Bokeh & Touch-Sparkle Trail canvas.
 * 3. A floating "🏰 Castle Intro" button so guests can replay the movie entrance anytime.
 */
export function ChristmasCastleMagic({ variant }: ChristmasCastleMagicProps) {
  const [gateState, setGateState] = useState<GateState>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return 'opened';
    }
    return 'closed';
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparklesRef = useRef<TouchSparkle[]>([]);
  const gateStateRef = useRef<GateState>(gateState);
  gateStateRef.current = gateState;

  const spawnSparkleBurst = useCallback((clientX: number, clientY: number, count = 14) => {
    const list = sparklesRef.current;
    if (list.length > 160) list.splice(0, count);
    const hues: ReadonlyArray<TouchSparkle['hue']> = ['gold', 'gold', 'cream', 'crimson'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 1 + Math.random() * 3.8;
      list.push({
        x: clientX,
        y: clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.7,
        size: 3.5 + Math.random() * 6,
        alpha: 1,
        decay: 0.016 + Math.random() * 0.016,
        hue: hues[i % hues.length],
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.12,
      });
    }
  }, []);

  const triggerOpenDoors = useCallback(() => {
    if (gateStateRef.current !== 'closed') return;
    setGateState('opening');
    playArcadeTone('fanfare');
    if (typeof window !== 'undefined') {
      spawnSparkleBurst(window.innerWidth / 2, window.innerHeight * 0.62, 36);
    }
  }, [spawnSparkleBurst]);

  const handleReplayEntrance = useCallback(() => {
    setGateState('closed');
    playArcadeTone('star');
    if (typeof window !== 'undefined') {
      spawnSparkleBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
    }
  }, [spawnSparkleBurst]);

  // Transition from 'opening' (door swing + camera fly-in + bright light bloom) -> 'opened'
  useEffect(() => {
    if (gateState === 'opening') {
      const timer = window.setTimeout(() => {
        setGateState('opened');
      }, 1750);
      return () => window.clearTimeout(timer);
    }
  }, [gateState]);

  // Global touch / pointer sparkle trail + keyboard support to open castle doors
  useEffect(() => {
    let lastMoveSparkleMs = 0;

    const onPointerDown = (e: PointerEvent) => {
      spawnSparkleBurst(e.clientX, e.clientY, 12);
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveSparkleMs < 55) return;
      lastMoveSparkleMs = now;
      spawnSparkleBurst(e.clientX, e.clientY, 2);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (gateStateRef.current === 'closed' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
        triggerOpenDoors();
      }
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [spawnSparkleBurst, triggerOpenDoors]);

  // 60fps ambient Golden Snowfall, Candlelight Bokeh & Touch-Sparkle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize, { passive: true });

    const moteCount = Math.min(48, Math.max(26, Math.floor(width / 30)));
    const motes: SnowMote[] = Array.from({ length: moteCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.5 + Math.random() * 2.8,
      vy: 0.3 + Math.random() * 0.55,
      vx: (Math.random() - 0.5) * 0.35,
      alpha: 0.28 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      isGold: i % 2 === 0,
    }));

    let rafId = 0;
    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = now * 0.001;

      for (const m of motes) {
        m.y += m.vy;
        m.x += m.vx + Math.sin(t + m.phase) * 0.24;
        if (m.y > height + 10) {
          m.y = -10;
          m.x = Math.random() * width;
        }
        if (m.x < -10) m.x = width + 10;
        if (m.x > width + 10) m.x = -10;

        const twinkle = 0.65 + 0.35 * Math.sin(t * 2.2 + m.phase);
        ctx.save();
        ctx.globalAlpha = m.alpha * twinkle;
        if (m.isGold) {
          ctx.fillStyle = '#f5d27b';
          drawFourPointStar(ctx, m.x, m.y, m.r * 1.9, m.r * 0.65, t * 0.5 + m.phase);
        } else {
          ctx.fillStyle = '#fff9eb';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const sparkles = sparklesRef.current;
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;
        s.rotation += s.vRot;
        s.alpha -= s.decay;
        if (s.alpha <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.fillStyle =
          s.hue === 'gold' ? '#f5d27b' : s.hue === 'crimson' ? '#d70015' : '#fffbeb';
        drawFourPointStar(ctx, s.x, s.y, s.size, s.size * 0.35, s.rotation);
        ctx.restore();
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const subtitle =
    variant === 'register'
      ? 'Christmas Eve Celebration · Save Your Seats'
      : 'Christmas Celebration Arcade & VIP Invitation';

  return (
    <>
      {/* Ambient 60fps Golden Snow, Bokeh & Touch-Sparkle Canvas */}
      <canvas
        ref={canvasRef}
        className="castle-ambient-canvas no-print"
        aria-hidden="true"
      />

      {/* Replay Castle Intro Floating Pill (visible after doors open) */}
      {gateState === 'opened' && (
        <button
          type="button"
          className="castle-replay-pill no-print"
          onClick={handleReplayEntrance}
          aria-label="Replay Christmas Castle movie intro"
          title="Replay Christmas Castle Movie Intro"
        >
          <span className="castle-replay-pill__spark" aria-hidden="true">
            🏰
          </span>
          <span>Castle Intro</span>
        </button>
      )}

      {/* Cinematic Disney-Style Fairytale Christmas Castle Intro */}
      {gateState !== 'opened' && (
        <div
          className={`disney-castle-intro disney-castle-intro--${gateState} no-print`}
          role="dialog"
          aria-modal="false"
          aria-label="Christmas Castle Entrance — Tap to Open the Castle Doors"
          onClick={triggerOpenDoors}
        >
          {/* Night Sky Aurora, Shooting Star Arc & Twinkling Stars */}
          <div className="disney-castle-intro__sky" aria-hidden="true">
            <div className="disney-castle-intro__aurora" />
            <div className="disney-castle-intro__firework disney-castle-intro__firework--left" />
            <div className="disney-castle-intro__firework disney-castle-intro__firework--right" />
          </div>

          {/* Top Church Title Banner */}
          <header className="disney-castle-intro__header" aria-hidden="true">
            <span className="disney-castle-intro__eyebrow">
              {KING_OF_GLORY_INVITE.churchShortName} · {KING_OF_GLORY_INVITE.churchFullName}
            </span>
            <h2 className="disney-castle-intro__title">
              {KING_OF_GLORY_INVITE.title}
            </h2>
            <p className="disney-castle-intro__sub">{subtitle}</p>
          </header>

          {/* Centerpiece Disney-Inspired Fairytale Christmas Castle Stage */}
          <div className="disney-castle-stage" aria-hidden="true">
            {/* Volumetric Golden God-Rays & Full-Screen Light Bloom emerging from the doorway */}
            <div className="disney-castle-stage__godrays" />
            <div className="disney-castle-stage__light-bloom" />

            <div className="disney-castle-stage__figure">
              {/* Detailed Fairytale Christmas Castle SVG */}
              <svg
                className="disney-castle-svg"
                viewBox="0 0 800 760"
                preserveAspectRatio="xMidYMax meet"
              >
                <defs>
                  {/* Sweeping Disney-style Shooting Star Arc Gradient */}
                  <linearGradient id="shootingStarArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f5d27b" stopOpacity="0" />
                    <stop offset="35%" stopColor="#f5d27b" stopOpacity="0.55" />
                    <stop offset="75%" stopColor="#fffbeb" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                  </linearGradient>

                  {/* Star of Bethlehem Radial Aura */}
                  <radialGradient id="topStarGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="32%" stopColor="#fde68a" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </radialGradient>

                  {/* Warm Ivory/Cream Castle Stone Walls */}
                  <linearGradient id="castleWallIvory" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff9eb" />
                    <stop offset="55%" stopColor="#f5e6c8" />
                    <stop offset="100%" stopColor="#dec292" />
                  </linearGradient>

                  {/* Shaded Side Tower Stone */}
                  <linearGradient id="castleWallShade" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f3e2c0" />
                    <stop offset="100%" stopColor="#cba770" />
                  </linearGradient>

                  {/* Royal Crimson & Gold Conical Spire Roofs */}
                  <linearGradient id="crimsonSpireRoof" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5c0709" />
                    <stop offset="38%" stopColor="#b8141a" />
                    <stop offset="68%" stopColor="#8d0e13" />
                    <stop offset="100%" stopColor="#480406" />
                  </linearGradient>

                  {/* 24k Gold Trim & Accents */}
                  <linearGradient id="royalGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fffbeb" />
                    <stop offset="45%" stopColor="#f5d27b" />
                    <stop offset="100%" stopColor="#b47b1c" />
                  </linearGradient>

                  {/* Warm Glowing Palace Windows */}
                  <radialGradient id="warmWindowGlow" cx="50%" cy="50%" r="55%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="45%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </radialGradient>

                  {/* Snowy Courtyard Ground */}
                  <linearGradient id="snowCourtyardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fffdf7" />
                    <stop offset="45%" stopColor="#f4ead5" />
                    <stop offset="100%" stopColor="#d9c39e" />
                  </linearGradient>
                </defs>

                {/* ============================================================
                    1. SWEEPING DISNEY-STYLE SHOOTING STAR ARC & BETHLEHEM STAR
                   ============================================================ */}
                <path
                  className="disney-castle-svg__arc"
                  d="M 75 340 C 170 110, 490 35, 685 205"
                  fill="none"
                  stroke="url(#shootingStarArcGrad)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  className="disney-castle-svg__arc-sub"
                  d="M 95 360 C 195 140, 485 65, 670 225"
                  fill="none"
                  stroke="url(#shootingStarArcGrad)"
                  strokeWidth="2"
                  strokeDasharray="6 10"
                  strokeLinecap="round"
                  opacity="0.75"
                />

                {/* Shooting Star Head at right end of arc */}
                <g className="disney-castle-svg__arc-star" transform="translate(685, 205)">
                  <circle cx="0" cy="0" r="26" fill="url(#topStarGlow)" />
                  <path
                    d="M0 -18 L4 -4 L18 0 L4 4 L0 18 L-4 4 L-18 0 L-4 -4 Z"
                    fill="#ffffff"
                  />
                </g>

                {/* Grand Star of Bethlehem crowning the tallest center spire */}
                <g className="disney-castle-svg__crown-star" transform="translate(400, 44)">
                  <circle cx="0" cy="0" r="54" fill="url(#topStarGlow)" />
                  <path
                    d="M0 -30 L5.5 -6 L30 0 L5.5 6 L0 30 L-5.5 6 L-30 0 L-5.5 -6 Z"
                    fill="#fffbeb"
                  />
                  <path
                    d="M-16 -16 L-3 -3 L16 -16 L3 -3 L16 16 L3 3 L-16 16 L-3 3 Z"
                    fill="#f5d27b"
                  />
                </g>

                {/* Twinkling Sky Stars around the spires */}
                <g className="disney-castle-svg__twinkles" fill="#fffbeb">
                  <circle cx="145" cy="140" r="2.5" />
                  <circle cx="225" cy="88" r="3" />
                  <circle cx="310" cy="64" r="2.2" />
                  <circle cx="495" cy="68" r="2.5" />
                  <circle cx="575" cy="108" r="3" />
                  <circle cx="645" cy="148" r="2.2" />
                  <path d="M225 78 L227 86 L235 88 L227 90 L225 98 L223 90 L215 88 L223 86 Z" />
                  <path d="M575 98 L577 106 L585 108 L577 110 L575 118 L573 110 L565 108 L573 106 Z" />
                </g>

                {/* ============================================================
                    2. SOARING UPPER FAIRYTALE SPIRES & TOWERS (BACK LAYER)
                   ============================================================ */}
                {/* Tallest Central Grand Spire */}
                <g>
                  {/* Spire Gold Finial & Flag */}
                  <line x1="400" y1="62" x2="400" y2="95" stroke="url(#royalGoldGrad)" strokeWidth="4" />
                  <path d="M400 66 L428 74 L400 82 Z" fill="#d70015" stroke="#f5d27b" strokeWidth="1.2" />
                  {/* Conical Royal Crimson Roof */}
                  <polygon
                    points="400,90 364,215 436,215"
                    fill="url(#crimsonSpireRoof)"
                    stroke="url(#royalGoldGrad)"
                    strokeWidth="2.2"
                  />
                  {/* Snow cap trim at base of spire roof */}
                  <path
                    d="M361 215 Q380 223 400 215 Q420 223 439 215"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  {/* Central Upper Tower Shaft */}
                  <rect
                    x="368"
                    y="215"
                    width="64"
                    height="125"
                    fill="url(#castleWallIvory)"
                    stroke="#c8922a"
                    strokeWidth="2"
                  />
                  {/* Tall Gothic Double Window in Center Spire */}
                  <rect x="384" y="236" width="12" height="42" rx="6" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />
                  <rect x="404" y="236" width="12" height="42" rx="6" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />
                </g>

                {/* Inner Left & Right High Turrets */}
                <g>
                  {/* Left High Turret */}
                  <line x1="305" y1="126" x2="305" y2="152" stroke="url(#royalGoldGrad)" strokeWidth="3.5" />
                  <path d="M305 128 L282 135 L305 142 Z" fill="#f5d27b" />
                  <polygon
                    points="305,148 274,252 336,252"
                    fill="url(#crimsonSpireRoof)"
                    stroke="url(#royalGoldGrad)"
                    strokeWidth="2"
                  />
                  <path d="M272 252 Q305 260 338 252" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
                  <rect x="278" y="252" width="54" height="145" fill="url(#castleWallShade)" stroke="#c8922a" strokeWidth="2" />
                  <rect x="296" y="274" width="18" height="42" rx="9" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />

                  {/* Right High Turret */}
                  <line x1="495" y1="126" x2="495" y2="152" stroke="url(#royalGoldGrad)" strokeWidth="3.5" />
                  <path d="M495 128 L518 135 L495 142 Z" fill="#f5d27b" />
                  <polygon
                    points="495,148 464,252 526,252"
                    fill="url(#crimsonSpireRoof)"
                    stroke="url(#royalGoldGrad)"
                    strokeWidth="2"
                  />
                  <path d="M462 252 Q495 260 528 252" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
                  <rect x="468" y="252" width="54" height="145" fill="url(#castleWallShade)" stroke="#c8922a" strokeWidth="2" />
                  <rect x="486" y="274" width="18" height="42" rx="9" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />
                </g>

                {/* Outer Left & Right Fairytale Flank Towers */}
                <g>
                  {/* Outer Left Tower */}
                  <line x1="210" y1="184" x2="210" y2="208" stroke="url(#royalGoldGrad)" strokeWidth="3" />
                  <polygon
                    points="210,204 176,305 244,305"
                    fill="url(#crimsonSpireRoof)"
                    stroke="url(#royalGoldGrad)"
                    strokeWidth="2"
                  />
                  <path d="M174 305 Q210 313 246 305" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
                  <rect x="180" y="305" width="60" height="245" fill="url(#castleWallShade)" stroke="#c8922a" strokeWidth="2" />
                  <rect x="200" y="330" width="20" height="46" rx="10" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />
                  <rect x="200" y="405" width="20" height="46" rx="10" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />

                  {/* Outer Right Tower */}
                  <line x1="590" y1="184" x2="590" y2="208" stroke="url(#royalGoldGrad)" strokeWidth="3" />
                  <polygon
                    points="590,204 556,305 624,305"
                    fill="url(#crimsonSpireRoof)"
                    stroke="url(#royalGoldGrad)"
                    strokeWidth="2"
                  />
                  <path d="M554 305 Q590 313 626 305" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
                  <rect x="560" y="305" width="60" height="245" fill="url(#castleWallShade)" stroke="#c8922a" strokeWidth="2" />
                  <rect x="580" y="330" width="20" height="46" rx="10" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />
                  <rect x="580" y="405" width="20" height="46" rx="10" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="1.5" />
                </g>

                {/* Extreme Far-Left & Far-Right Mini Watchtowers */}
                <g>
                  <polygon
                    points="135,280 108,362 162,362"
                    fill="url(#crimsonSpireRoof)"
                    stroke="url(#royalGoldGrad)"
                    strokeWidth="1.8"
                  />
                  <rect x="112" y="362" width="46" height="190" fill="url(#castleWallShade)" stroke="#c8922a" strokeWidth="1.8" />
                  <rect x="127" y="392" width="16" height="36" rx="8" fill="url(#warmWindowGlow)" />

                  <polygon
                    points="665,280 638,362 692,362"
                    fill="url(#crimsonSpireRoof)"
                    stroke="url(#royalGoldGrad)"
                    strokeWidth="1.8"
                  />
                  <rect x="642" y="362" width="46" height="190" fill="url(#castleWallShade)" stroke="#c8922a" strokeWidth="1.8" />
                  <rect x="657" y="392" width="16" height="36" rx="8" fill="url(#warmWindowGlow)" />
                </g>

                {/* ============================================================
                    3. MAIN PALACE KEEP, ROSE WINDOW, BATTLEMENTS & GARLANDS
                   ============================================================ */}
                {/* Main Central Keep Body */}
                <rect
                  x="232"
                  y="335"
                  width="336"
                  height="230"
                  fill="url(#castleWallIvory)"
                  stroke="#c8922a"
                  strokeWidth="2.5"
                />

                {/* Crenellated Battlements along the top of the Main Keep */}
                <path
                  d="M228 335 L228 318 L248 318 L248 328 L266 328 L266 318 L286 318 L286 328 L304 328 L304 318 L324 318 L324 328 L342 328 L342 318 L362 318 L362 328 L438 328 L438 318 L458 318 L458 328 L476 328 L476 318 L496 318 L496 328 L514 328 L514 318 L534 318 L534 328 L552 328 L552 318 L572 318 L572 335 Z"
                  fill="url(#castleWallIvory)"
                  stroke="#c8922a"
                  strokeWidth="2"
                />
                {/* Snow along the Main Keep Battlements */}
                <path
                  d="M228 318 L572 318"
                  stroke="#ffffff"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray="18 18"
                />

                {/* Central Gabled Pediment Roof above the Grand Archway */}
                <polygon
                  points="400,278 324,352 476,352"
                  fill="url(#crimsonSpireRoof)"
                  stroke="url(#royalGoldGrad)"
                  strokeWidth="2.5"
                />
                <path
                  d="M324 352 L400 278 L476 352"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Royal Rose Window / Christmas Clock Medallion inside Pediment */}
                <circle
                  cx="400"
                  cy="326"
                  r="22"
                  fill="url(#warmWindowGlow)"
                  stroke="url(#royalGoldGrad)"
                  strokeWidth="3"
                />
                <path
                  d="M400 306 L400 346 M380 326 L420 326 M386 312 L414 340 M414 312 L386 340"
                  stroke="#7c0c0f"
                  strokeWidth="1.6"
                />

                {/* Side Arched Stained-Glass Windows on the Main Keep */}
                <g>
                  <rect x="260" y="370" width="32" height="68" rx="16" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="2" />
                  <path d="M276 370 L276 438 M260 404 L292 404" stroke="#9a6b18" strokeWidth="1.4" />

                  <rect x="508" y="370" width="32" height="68" rx="16" fill="url(#warmWindowGlow)" stroke="#9a6b18" strokeWidth="2" />
                  <path d="M524 370 L524 438 M508 404 L540 404" stroke="#9a6b18" strokeWidth="1.4" />
                </g>

                {/* Festive Pine Garlands, Red Ribbons & Fairy Lights across the Keep */}
                <path
                  d="M235 356 Q280 378 325 356 M475 356 Q520 378 565 356"
                  fill="none"
                  stroke="#15803d"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M235 356 Q280 378 325 356 M475 356 Q520 378 565 356"
                  fill="none"
                  stroke="#fde047"
                  strokeWidth="2.5"
                  strokeDasharray="2 12"
                  strokeLinecap="round"
                />

                {/* Decorated Christmas Trees flanking the Castle Gate */}
                <g transform="translate(262, 545)">
                  <polygon points="0,-70 -28,0 28,0" fill="#14532d" stroke="#166534" strokeWidth="1.5" />
                  <polygon points="0,-52 -22,-8 22,-8" fill="#15803d" />
                  <polygon points="0,-34 -16,-16 16,-16" fill="#16a34a" />
                  <circle cx="0" cy="-73" r="5" fill="#fde047" />
                  <circle cx="-10" cy="-35" r="3" fill="#ef4444" />
                  <circle cx="8" cy="-22" r="3" fill="#fde047" />
                  <circle cx="-6" cy="-12" r="3" fill="#38bdf8" />
                  <circle cx="11" cy="-8" r="3" fill="#ef4444" />
                </g>
                <g transform="translate(538, 545)">
                  <polygon points="0,-70 -28,0 28,0" fill="#14532d" stroke="#166534" strokeWidth="1.5" />
                  <polygon points="0,-52 -22,-8 22,-8" fill="#15803d" />
                  <polygon points="0,-34 -16,-16 16,-16" fill="#16a34a" />
                  <circle cx="0" cy="-73" r="5" fill="#fde047" />
                  <circle cx="10" cy="-35" r="3" fill="#ef4444" />
                  <circle cx="-8" cy="-22" r="3" fill="#fde047" />
                  <circle cx="6" cy="-12" r="3" fill="#38bdf8" />
                  <circle cx="-11" cy="-8" r="3" fill="#ef4444" />
                </g>

                {/* ============================================================
                    4. SNOWY COURTYARD, GRAND STAIRCASE & GOLDEN LANTERNS
                   ============================================================ */}
                {/* Snow hills at base of castle */}
                <path
                  d="M0 560 Q180 538 330 555 L470 555 Q620 538 800 560 L800 760 L0 760 Z"
                  fill="url(#snowCourtyardGrad)"
                />

                {/* Royal Crimson Carpet & Golden Steps leading up to the Castle Doors */}
                <polygon
                  points="328,558 472,558 545,760 255,760"
                  fill="#7c0c0f"
                  stroke="url(#royalGoldGrad)"
                  strokeWidth="3"
                />
                <line x1="316" y1="590" x2="484" y2="590" stroke="url(#royalGoldGrad)" strokeWidth="2.2" />
                <line x1="302" y1="628" x2="498" y2="628" stroke="url(#royalGoldGrad)" strokeWidth="2.2" />
                <line x1="286" y1="672" x2="514" y2="672" stroke="url(#royalGoldGrad)" strokeWidth="2.2" />
                <line x1="270" y1="720" x2="530" y2="720" stroke="url(#royalGoldGrad)" strokeWidth="2.2" />

                {/* Outer Stone & Gold Archway Frame around the Castle Doors */}
                <path
                  d="M320 560 L320 436 A80 80 0 0 1 480 436 L480 560 Z"
                  fill="#fffbeb"
                  stroke="url(#royalGoldGrad)"
                  strokeWidth="8"
                />
                {/* Brilliant Sanctuary Light inside the open doorway */}
                <path
                  className="disney-castle-svg__inner-light"
                  d="M328 558 L328 438 A72 72 0 0 1 472 438 L472 558 Z"
                  fill="url(#warmWindowGlow)"
                />
              </svg>

              {/* ============================================================
                  5. 3D ANIMATED DOUBLE PALACE DOORS POSITIONED IN THE ARCHWAY
                 ============================================================ */}
              <div className="disney-castle-doorway">
                {/* Intense Golden Sanctuary Core behind the doors */}
                <div className="disney-castle-doorway__light-core" />

                {/* Left Arched Palace Door */}
                <div className="disney-door disney-door--left">
                  <div className="disney-door__filigree" />
                  <div className="disney-door__ring" />
                </div>

                {/* Right Arched Palace Door */}
                <div className="disney-door disney-door--right">
                  <div className="disney-door__filigree" />
                  <div className="disney-door__ring" />
                </div>

                {/* Glowing Manger & Crown Seal on the Doors */}
                <div className="disney-doorway-seal">
                  <img src="/favicon.svg" alt="" width="44" height="44" />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Call-to-Action Prompt waiting for the user's click */}
          <div className="disney-castle-intro__footer">
            <button
              type="button"
              className="disney-castle-intro__open-btn"
              onClick={(e) => {
                e.stopPropagation();
                triggerOpenDoors();
              }}
            >
              <span className="disney-castle-intro__open-spark" aria-hidden="true">
                ✨
              </span>
              <span>
                {gateState === 'opening'
                  ? 'Entering the Christmas Celebration…'
                  : 'Tap to Open the Castle Doors'}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Interactive Christmas Castle & Star of Bethlehem Skyline Banner shown at the top of
 * the Main Arcade Lobby (/) and the Guest Registration Page (/register) so the page
 * feels alive with twinkling castle windows and starlight throughout their visit.
 */
export function CastleSkylineCrest({ label }: { label?: string }) {
  return (
    <div className="castle-crest-banner no-print" aria-hidden="true">
      <svg
        className="castle-crest-banner__svg"
        viewBox="0 0 680 96"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <radialGradient id="crestStarAura" cx="50%" cy="28%" r="48%">
            <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#f5d27b" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#f5d27b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="crestCastleFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c0c0f" />
            <stop offset="100%" stopColor="#4f0507" />
          </linearGradient>
        </defs>

        {/* Sweeping Disney-style Starlight Arc */}
        <path
          d="M 110 78 C 210 14, 470 14, 570 78"
          fill="none"
          stroke="rgba(245, 210, 123, 0.55)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Star of Bethlehem Aura */}
        <circle cx="340" cy="24" r="46" fill="url(#crestStarAura)" />

        {/* Twinkling Background Stars */}
        <g className="castle-crest-banner__stars" fill="#e9b65c">
          <circle cx="88" cy="24" r="1.8" />
          <circle cx="148" cy="16" r="2.2" />
          <circle cx="222" cy="28" r="1.6" />
          <circle cx="458" cy="28" r="1.6" />
          <circle cx="532" cy="16" r="2.2" />
          <circle cx="592" cy="24" r="1.8" />
        </g>

        {/* Star of Bethlehem */}
        <path
          className="castle-crest-banner__north-star"
          d="M340 4 L343.5 20 L362 24 L343.5 28 L340 46 L336.5 28 L318 24 L336.5 20 Z"
          fill="#fffbeb"
        />

        {/* Christmas Castle Spires & Archways */}
        <path
          fill="url(#crestCastleFill)"
          stroke="#e9b65c"
          strokeWidth="1.3"
          d="M40 94 L40 76 L92 76 L92 60 L110 38 L128 60 L128 74 L176 74 L176 54 L196 28 L216 54 L216 68 L266 68 L266 44 L290 16 L314 44 L314 58 L328 58 L340 36 L352 58 L366 58 L366 44 L390 16 L414 44 L414 68 L464 68 L464 54 L484 28 L504 54 L504 74 L552 74 L552 60 L570 38 L588 60 L588 76 L640 76 L640 94 Z"
        />

        {/* Twinkling Warm Golden Castle Windows */}
        <g className="castle-crest-banner__windows" fill="#fde68a">
          <rect x="192" y="56" width="8" height="14" rx="4" />
          <rect x="285" y="48" width="10" height="18" rx="5" />
          <rect x="334" y="62" width="12" height="22" rx="6" />
          <rect x="385" y="48" width="10" height="18" rx="5" />
          <rect x="480" y="56" width="8" height="14" rx="4" />
          <circle cx="290" cy="36" r="3" />
          <circle cx="390" cy="36" r="3" />
        </g>
      </svg>
      {label && <span className="castle-crest-banner__tag">{label}</span>}
    </div>
  );
}

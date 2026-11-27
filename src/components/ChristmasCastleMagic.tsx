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
 * 1. The 3D Royal Crimson & 24k Gold Christmas Castle Doors entrance reveal on page launch.
 * 2. The 60fps ambient Golden Snowfall, Candlelight Bokeh & Touch-Sparkle Trail canvas.
 * 3. A floating "Replay Castle Doors" button so guests can replay the magic anytime.
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

  const spawnSparkleBurst = useCallback((clientX: number, clientY: number, count = 12) => {
    const list = sparklesRef.current;
    if (list.length > 140) list.splice(0, count);
    const hues: ReadonlyArray<TouchSparkle['hue']> = ['gold', 'gold', 'cream', 'crimson'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 0.8 + Math.random() * 3.2;
      list.push({
        x: clientX,
        y: clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        size: 3.5 + Math.random() * 5.5,
        alpha: 1,
        decay: 0.018 + Math.random() * 0.018,
        hue: hues[i % hues.length],
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.12,
      });
    }
  }, []);

  const triggerOpenDoors = useCallback(
    (withSound = false) => {
      if (gateStateRef.current !== 'closed') return;
      setGateState('opening');
      if (withSound) {
        playArcadeTone('fanfare');
      }
      if (typeof window !== 'undefined') {
        spawnSparkleBurst(window.innerWidth / 2, window.innerHeight / 2, 24);
      }
    },
    [spawnSparkleBurst]
  );

  const handleReplayEntrance = useCallback(() => {
    setGateState('closed');
    playArcadeTone('star');
    if (typeof window !== 'undefined') {
      spawnSparkleBurst(window.innerWidth / 2, window.innerHeight / 2, 18);
    }
  }, [spawnSparkleBurst]);

  // Auto-open the castle doors after 0.95s so guests enjoy the reveal without ever being stuck,
  // and transition from 'opening' -> 'opened' after the 1.25s 3D door swing finishes.
  useEffect(() => {
    if (gateState === 'closed') {
      const timer = window.setTimeout(() => {
        triggerOpenDoors(false);
      }, 950);
      return () => window.clearTimeout(timer);
    }
    if (gateState === 'opening') {
      const timer = window.setTimeout(() => {
        setGateState('opened');
      }, 1250);
      return () => window.clearTimeout(timer);
    }
  }, [gateState, triggerOpenDoors]);

  // Global touch / pointer sparkle trail + instant door open on first interaction
  useEffect(() => {
    let lastMoveSparkleMs = 0;

    const onPointerDown = (e: PointerEvent) => {
      spawnSparkleBurst(e.clientX, e.clientY, 11);
      if (gateStateRef.current === 'closed') {
        triggerOpenDoors(true);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveSparkleMs < 55) return;
      lastMoveSparkleMs = now;
      spawnSparkleBurst(e.clientX, e.clientY, 2);
    };

    const onFocusIn = () => {
      if (gateStateRef.current === 'closed') {
        triggerOpenDoors(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('focusin', onFocusIn, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('focusin', onFocusIn);
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

    const moteCount = Math.min(42, Math.max(22, Math.floor(width / 34)));
    const motes: SnowMote[] = Array.from({ length: moteCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.4 + Math.random() * 2.8,
      vy: 0.28 + Math.random() * 0.55,
      vx: (Math.random() - 0.5) * 0.35,
      alpha: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      isGold: i % 2 === 0,
    }));

    let rafId = 0;
    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = now * 0.001;

      // 1. Ambient drifting golden bokeh & snowflakes
      for (const m of motes) {
        m.y += m.vy;
        m.x += m.vx + Math.sin(t + m.phase) * 0.22;
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
          ctx.fillStyle = '#e9b65c';
          drawFourPointStar(ctx, m.x, m.y, m.r * 1.9, m.r * 0.65, t * 0.5 + m.phase);
        } else {
          ctx.fillStyle = '#fff9eb';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Interactive touch/cursor sparkles
      const sparkles = sparklesRef.current;
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05; // gentle gravity
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
      ? 'Christmas Eve Invitation & Seat Reservation'
      : 'Christmas Celebration Pocket Arcade & VIP Pass';

  return (
    <>
      {/* Ambient 60fps Golden Snow, Bokeh & Touch-Sparkle Canvas */}
      <canvas
        ref={canvasRef}
        className="castle-ambient-canvas no-print"
        aria-hidden="true"
      />

      {/* Replay Castle Doors Floating Pill (visible after doors open) */}
      {gateState === 'opened' && (
        <button
          type="button"
          className="castle-replay-pill no-print"
          onClick={handleReplayEntrance}
          aria-label="Replay Christmas Castle door opening animation"
          title="Replay Christmas Castle Entrance"
        >
          <span className="castle-replay-pill__spark" aria-hidden="true">
            ✨
          </span>
          <span>Castle Doors</span>
        </button>
      )}

      {/* 3D Royal Crimson & 24k Gold Christmas Castle Doors Reveal Overlay */}
      {gateState !== 'opened' && (
        <div
          className={`castle-portal castle-portal--${gateState} no-print`}
          aria-hidden="true"
        >
          {/* Warm Inner Sanctuary Light Burst when doors swing open */}
          <div className="castle-portal__sanctuary-glow" />

          {/* Starlit Christmas Castle Skyline Backdrop above the gates */}
          <div className="castle-portal__sky">
            <svg
              className="castle-portal__skyline-svg"
              viewBox="0 0 800 220"
              preserveAspectRatio="xMidYMax slice"
            >
              <defs>
                <radialGradient id="bethlehemStarGlow" cx="50%" cy="35%" r="45%">
                  <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#f5d27b" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#f5d27b" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="castleSilhouetteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a0609" />
                  <stop offset="100%" stopColor="#260204" />
                </linearGradient>
              </defs>

              {/* Star of Bethlehem & Rays */}
              <circle cx="400" cy="48" r="78" fill="url(#bethlehemStarGlow)" />
              <path
                d="M400 10 L405 38 L442 48 L405 58 L400 92 L395 58 L358 48 L395 38 Z"
                fill="#fffbeb"
              />
              <path
                d="M400 24 L403 42 L422 48 L403 54 L400 72 L397 54 L378 48 L397 42 Z"
                fill="#f5d27b"
              />

              {/* Distant Christmas Castle Spires, Battlements & Glowing Windows */}
              <path
                fill="url(#castleSilhouetteGrad)"
                stroke="rgba(245, 210, 123, 0.35)"
                strokeWidth="1.2"
                d="M0 220 L0 165 L55 165 L55 140 L75 110 L95 140 L95 165 L140 165 L140 128 L165 88 L190 128 L190 155 L245 155 L245 120 L270 120 L270 140 L310 140 L310 95 L340 52 L370 95 L370 125 L385 125 L400 78 L415 125 L430 125 L430 95 L460 52 L490 95 L490 140 L530 140 L530 120 L555 120 L555 155 L610 155 L610 128 L635 88 L660 128 L660 165 L705 165 L705 140 L725 110 L745 140 L745 165 L800 165 L800 220 Z"
              />

              {/* Warm Lit Castle Windows */}
              <g fill="#f5d27b" opacity="0.9">
                <rect x="160" y="132" width="10" height="18" rx="5" />
                <rect x="333" y="102" width="14" height="24" rx="7" />
                <rect x="393" y="134" width="14" height="24" rx="7" />
                <rect x="453" y="102" width="14" height="24" rx="7" />
                <rect x="630" y="132" width="10" height="18" rx="5" />
                <circle cx="340" cy="84" r="4" />
                <circle cx="460" cy="84" r="4" />
                <circle cx="400" cy="114" r="4.5" />
              </g>
            </svg>
          </div>

          {/* 3D Perspective Stage holding Left & Right Castle Doors */}
          <div className="castle-portal__stage">
            {/* Left Arched Castle Door */}
            <div className="castle-door castle-door--left">
              <div className="castle-door__panel">
                <div className="castle-door__arch-tracery" />
                <div className="castle-door__filigree-box">
                  <span className="castle-door__stud castle-door__stud--tl" />
                  <span className="castle-door__stud castle-door__stud--tr" />
                  <span className="castle-door__stud castle-door__stud--bl" />
                  <span className="castle-door__stud castle-door__stud--br" />
                  <div className="castle-door__rosette" />
                </div>
                <div className="castle-door__filigree-box castle-door__filigree-box--lower">
                  <span className="castle-door__stud castle-door__stud--tl" />
                  <span className="castle-door__stud castle-door__stud--tr" />
                  <span className="castle-door__stud castle-door__stud--bl" />
                  <span className="castle-door__stud castle-door__stud--br" />
                </div>
                <div className="castle-door__handle castle-door__handle--left" />
              </div>
            </div>

            {/* Right Arched Castle Door */}
            <div className="castle-door castle-door--right">
              <div className="castle-door__panel">
                <div className="castle-door__arch-tracery" />
                <div className="castle-door__filigree-box">
                  <span className="castle-door__stud castle-door__stud--tl" />
                  <span className="castle-door__stud castle-door__stud--tr" />
                  <span className="castle-door__stud castle-door__stud--bl" />
                  <span className="castle-door__stud castle-door__stud--br" />
                  <div className="castle-door__rosette" />
                </div>
                <div className="castle-door__filigree-box castle-door__filigree-box--lower">
                  <span className="castle-door__stud castle-door__stud--tl" />
                  <span className="castle-door__stud castle-door__stud--tr" />
                  <span className="castle-door__stud castle-door__stud--bl" />
                  <span className="castle-door__stud castle-door__stud--br" />
                </div>
                <div className="castle-door__handle castle-door__handle--right" />
              </div>
            </div>

            {/* Center Glowing 24k Gold Manger & Crown Wax Seal */}
            <div className="castle-seal">
              <div className="castle-seal__halo" />
              <div className="castle-seal__medallion">
                <img src="/favicon.svg" alt="" width="76" height="76" className="castle-seal__img" />
              </div>
              <div className="castle-seal__plaque">
                <span className="castle-seal__eyebrow">
                  {KING_OF_GLORY_INVITE.churchShortName} · {KING_OF_GLORY_INVITE.churchFullName}
                </span>
                <strong className="castle-seal__title">
                  {KING_OF_GLORY_INVITE.title}
                </strong>
                <span className="castle-seal__sub">{subtitle}</span>
                <span className="castle-seal__cta">✨ Opening the Christmas Castle Doors…</span>
              </div>
            </div>
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

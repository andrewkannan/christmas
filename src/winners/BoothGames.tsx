import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoothGameId } from '../types.ts';
import { playArcadeTone, triggerHaptic } from '../lib/sound.ts';

export interface BoothGameProps {
  gameId: BoothGameId;
  onFinish: (score: number) => void;
  onBack: () => void;
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  radius: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  fill: string,
  stroke?: string
) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// GAME 1: STAR OF BETHLEHEM DROP (1-Tap Plinko — Seniors, Kids & All Ages)
// ============================================================================

interface PlinkoPeg {
  x: number;
  y: number;
  hitTimer: number;
}

interface ActiveStarBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  doubled: boolean;
}

const PLINKO_BUCKETS = [
  { label: 'JOY', points: 20, bg: '#15803d', accent: '#86efac' },
  { label: 'HOPE', points: 30, bg: '#b45309', accent: '#fde68a' },
  { label: 'VIP SEAT', points: 50, bg: '#d70015', accent: '#fef08a' },
  { label: 'PEACE', points: 30, bg: '#b45309', accent: '#fde68a' },
  { label: 'LOVE', points: 20, bg: '#15803d', accent: '#86efac' },
] as const;

function StarPlinkoGame({ onFinish }: { onFinish: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dropsLeft, setDropsLeft] = useState(3);
  const [score, setScore] = useState(0);
  const [ballActive, setBallActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Tap DROP STAR (or tap anywhere at the top) to release your 1st Christmas Star!'
  );

  const stateRef = useRef<{
    aimX: number;
    aimDir: number;
    dropsRemaining: number;
    totalScore: number;
    ball: ActiveStarBall | null;
    bellX: number;
    bellDir: number;
    pegs: PlinkoPeg[];
    popups: FloatingPopup[];
    particles: SparkleParticle[];
    finished: boolean;
  }>({
    aimX: 180,
    aimDir: 1,
    dropsRemaining: 3,
    totalScore: 0,
    ball: null,
    bellX: 180,
    bellDir: 1,
    pegs: [],
    popups: [],
    particles: [],
    finished: false,
  });

  // Build pegs once
  useEffect(() => {
    const pegs: PlinkoPeg[] = [];
    const rows = 6;
    for (let r = 0; r < rows; r += 1) {
      const y = 112 + r * 42;
      const count = r % 2 === 0 ? 6 : 5;
      const spacing = 54;
      const totalW = (count - 1) * spacing;
      const startX = (360 - totalW) / 2;
      for (let c = 0; c < count; c += 1) {
        pegs.push({
          x: startX + c * spacing,
          y,
          hitTimer: 0,
        });
      }
    }
    stateRef.current.pegs = pegs;
  }, []);

  const triggerDrop = useCallback((customX?: number) => {
    const st = stateRef.current;
    if (st.ball || st.dropsRemaining <= 0 || st.finished) return;

    if (typeof customX === 'number') {
      st.aimX = Math.max(44, Math.min(316, customX));
    }

    st.dropsRemaining -= 1;
    setDropsLeft(st.dropsRemaining);
    setBallActive(true);

    // Slight nudge so it never balances infinitely on a peg
    const jitter = (Math.random() - 0.5) * 28;
    st.ball = {
      x: st.aimX,
      y: 58,
      vx: jitter,
      vy: 35,
      doubled: false,
    };

    playArcadeTone('star');
    triggerHaptic(18);
    setStatusMessage('Watch the Star of Bethlehem bounce toward the Golden VIP Buckets!');
  }, []);

  const nudgeAim = useCallback((delta: number) => {
    const st = stateRef.current;
    if (st.ball || st.finished) return;
    st.aimX = Math.max(44, Math.min(316, st.aimX + delta));
    playArcadeTone('tap');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeAim(-26);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeAim(26);
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        triggerDrop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudgeAim, triggerDrop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const st = stateRef.current;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== 360 * dpr || canvas.height !== 440 * dpr) {
        canvas.width = 360 * dpr;
        canvas.height = 440 * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Gentle auto-sway of aim star when idle
      if (!st.ball && !st.finished) {
        st.aimX += st.aimDir * 48 * dt;
        if (st.aimX > 304) {
          st.aimX = 304;
          st.aimDir = -1;
        } else if (st.aimX < 56) {
          st.aimX = 56;
          st.aimDir = 1;
        }
      }

      // Move 2x Blessing Bell bumper
      st.bellX += st.bellDir * 68 * dt;
      if (st.bellX > 268) {
        st.bellX = 268;
        st.bellDir = -1;
      } else if (st.bellX < 92) {
        st.bellX = 92;
        st.bellDir = 1;
      }

      // Update ball physics
      if (st.ball) {
        const b = st.ball;
        b.vy += 470 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Side walls
        if (b.x < 26) {
          b.x = 26;
          b.vx = Math.abs(b.vx) * 0.75 + 25;
        } else if (b.x > 334) {
          b.x = 334;
          b.vx = -Math.abs(b.vx) * 0.75 - 25;
        }

        // Check 2x Blessing Bell bumper (at y=216)
        const bellDx = b.x - st.bellX;
        const bellDy = b.y - 216;
        const bellDist = Math.hypot(bellDx, bellDy);
        if (!b.doubled && bellDist < 28) {
          b.doubled = true;
          b.vy = -Math.abs(b.vy) * 0.55 - 60;
          b.vx += (bellDx / (bellDist || 1)) * 90;
          playArcadeTone('fanfare');
          triggerHaptic(30);
          st.popups.push({
            x: b.x,
            y: b.y - 12,
            text: '🔔 2× DOUBLE BLESSING!',
            color: '#f59e0b',
            alpha: 1,
            vy: -38,
          });
          for (let i = 0; i < 12; i += 1) {
            const ang = (Math.PI * 2 * i) / 12;
            st.particles.push({
              x: st.bellX,
              y: 216,
              vx: Math.cos(ang) * 95,
              vy: Math.sin(ang) * 95,
              color: '#facc15',
              alpha: 1,
              radius: 3.5,
            });
          }
        }

        // Peg collisions
        for (const peg of st.pegs) {
          if (peg.hitTimer > 0) peg.hitTimer = Math.max(0, peg.hitTimer - dt);
          const dx = b.x - peg.x;
          const dy = b.y - peg.y;
          const dist = Math.hypot(dx, dy);
          const minDist = 19;
          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            b.x = peg.x + nx * minDist;
            b.y = peg.y + ny * minDist;
            const dot = b.vx * nx + b.vy * ny;
            if (dot < 0) {
              b.vx = (b.vx - 1.75 * dot * nx) * 0.78 + (Math.random() - 0.5) * 34;
              b.vy = Math.max(-150, (b.vy - 1.75 * dot * ny) * 0.74);
            }
            if (peg.hitTimer <= 0) {
              peg.hitTimer = 0.25;
              playArcadeTone('tap');
              for (let i = 0; i < 5; i += 1) {
                const ang = Math.random() * Math.PI * 2;
                st.particles.push({
                  x: peg.x,
                  y: peg.y,
                  vx: Math.cos(ang) * 55,
                  vy: Math.sin(ang) * 55,
                  color: '#fde047',
                  alpha: 1,
                  radius: 2.5,
                });
              }
            }
          }
        }

        // Check landing in bottom buckets
        if (b.y >= 376) {
          const bucketIdx = Math.min(
            PLINKO_BUCKETS.length - 1,
            Math.max(0, Math.floor(((b.x - 16) / 328) * PLINKO_BUCKETS.length))
          );
          const bucket = PLINKO_BUCKETS[bucketIdx]!;
          const earned = bucket.points * (b.doubled ? 2 : 1);
          st.totalScore += earned;
          setScore(st.totalScore);
          st.popups.push({
            x: Math.max(65, Math.min(295, b.x)),
            y: 358,
            text: `+${earned} ${bucket.label}!`,
            color: '#fef08a',
            alpha: 1,
            vy: -45,
          });
          for (let i = 0; i < 16; i += 1) {
            const ang = -Math.PI + Math.random() * Math.PI;
            st.particles.push({
              x: b.x,
              y: 374,
              vx: Math.cos(ang) * (40 + Math.random() * 80),
              vy: Math.sin(ang) * (50 + Math.random() * 90),
              color: i % 2 === 0 ? '#facc15' : '#ffffff',
              alpha: 1,
              radius: 3.2,
            });
          }
          playArcadeTone('pickup');
          triggerHaptic(28);
          st.ball = null;
          setBallActive(false);

          if (st.dropsRemaining > 0) {
            setStatusMessage(
              `Awesome! +${earned} pts (${bucket.label})! Tap DROP STAR for star #${4 - st.dropsRemaining}!`
            );
          } else if (!st.finished) {
            st.finished = true;
            setStatusMessage(`🎉 All 3 Stars Landed! Total Score: ${st.totalScore} pts!`);
            playArcadeTone('fanfare');
            const finalTotal = st.totalScore;
            setTimeout(() => {
              onFinish(finalTotal);
            }, 850);
          }
        }
      } else {
        for (const peg of st.pegs) {
          if (peg.hitTimer > 0) peg.hitTimer = Math.max(0, peg.hitTimer - dt);
        }
      }

      // Update particles & popups
      for (const p of st.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= 1.6 * dt;
      }
      st.particles = st.particles.filter((p) => p.alpha > 0);

      for (const pop of st.popups) {
        pop.y += pop.vy * dt;
        pop.alpha -= 0.85 * dt;
      }
      st.popups = st.popups.filter((pop) => pop.alpha > 0);

      // ---- DRAW ----
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 440);
      bgGrad.addColorStop(0, '#0f291e');
      bgGrad.addColorStop(0.55, '#133829');
      bgGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 360, 440);

      // Top HUD banner inside canvas
      drawRoundedRect(ctx, 14, 10, 332, 34, 10);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⭐ Stars Left: ${st.dropsRemaining}`, 26, 31);
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${st.totalScore} pts`, 334, 31);

      // Aim track at y=60
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 62);
      ctx.lineTo(320, 62);
      ctx.stroke();
      ctx.setLineDash([]);

      // Preview Star when ready to drop
      if (!st.ball && st.dropsRemaining > 0) {
        drawFivePointStar(ctx, st.aimX, 62, 16, 7.5, '#facc15', '#ffffff');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO DROP', st.aimX, 88);
      }

      // Draw 2x Blessing Bell bumper
      drawRoundedRect(ctx, st.bellX - 34, 202, 68, 26, 13);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔔 2× BELL', st.bellX, 219);

      // Draw Pegs
      for (const peg of st.pegs) {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.hitTimer > 0 ? 8.5 : 6, 0, Math.PI * 2);
        ctx.fillStyle = peg.hitTimer > 0 ? '#fef08a' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw Active Falling Star
      if (st.ball) {
        drawFivePointStar(
          ctx,
          st.ball.x,
          st.ball.y,
          16,
          7.5,
          st.ball.doubled ? '#fbbf24' : '#fde047',
          '#d70015'
        );
      }

      // Draw Bottom Prize Buckets
      const bucketW = 62;
      const gap = 4.5;
      for (let i = 0; i < PLINKO_BUCKETS.length; i += 1) {
        const b = PLINKO_BUCKETS[i]!;
        const bx = 16 + i * (bucketW + gap);
        drawRoundedRect(ctx, bx, 376, bucketW, 52, 10);
        ctx.fillStyle = b.bg;
        ctx.fill();
        ctx.strokeStyle = b.accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${b.points}`, bx + bucketW / 2, 398);

        ctx.fillStyle = b.accent;
        ctx.font = '700 10px Inter, system-ui, sans-serif';
        ctx.fillText(b.label, bx + bucketW / 2, 416);
      }

      // Particles
      for (const p of st.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }

      // Popups
      for (const pop of st.popups) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.alpha);
        ctx.font = '800 15px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = pop.color;
        ctx.strokeStyle = '#091510';
        ctx.lineWidth = 3;
        ctx.strokeText(pop.text, pop.x, pop.y);
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [onFinish]);

  return (
    <div className="booth-playfield">
      <p className="booth-playfield__status" role="status" aria-live="polite">
        {statusMessage}
      </p>

      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Star of Bethlehem Plinko board. Score ${score} points, ${dropsLeft} stars left.`}
          className="game-canvas"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const logicalX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 360;
            triggerDrop(logicalX);
          }}
        />
      </div>

      <div className="booth-controls-row" role="group" aria-label="Plinko controls">
        <button
          type="button"
          className="btn btn--subtle booth-big-btn"
          disabled={ballActive || dropsLeft <= 0}
          onClick={() => nudgeAim(-32)}
        >
          ◀ Aim Left
        </button>
        <button
          type="button"
          className="btn btn--primary booth-big-btn booth-big-btn--hero"
          disabled={ballActive || dropsLeft <= 0}
          onClick={() => triggerDrop()}
        >
          🌟 DROP STAR ({dropsLeft} Left)
        </button>
        <button
          type="button"
          className="btn btn--subtle booth-big-btn"
          disabled={ballActive || dropsLeft <= 0}
          onClick={() => nudgeAim(32)}
        >
          Aim Right ▶
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// GAME 2: 3 WISE GIFTS SHUFFLE (Gentle / Festive / Turbo — All Generations)
// ============================================================================

type ShuffleSpeed = 'gentle' | 'festive' | 'turbo';

const SHUFFLE_SPEED_CONFIG: Record<
  ShuffleSpeed,
  { label: string; swaps: number; swapDurationMs: number; winPoints: number }
> = {
  gentle: {
    label: '🐢 Gentle (Seniors & Kids)',
    swaps: 4,
    swapDurationMs: 520,
    winPoints: 30,
  },
  festive: {
    label: '🎄 Festive (All Ages)',
    swaps: 6,
    swapDurationMs: 360,
    winPoints: 35,
  },
  turbo: {
    label: '⚡ Turbo (Youth +Bonus)',
    swaps: 9,
    swapDurationMs: 230,
    winPoints: 45,
  },
};

const GIFT_BOX_THEMES = [
  { name: 'Crimson Gift', body: '#d70015', ribbon: '#fde047' },
  { name: 'Emerald Gift', body: '#15803d', ribbon: '#fde047' },
  { name: 'Royal Gold Gift', body: '#b45309', ribbon: '#ffffff' },
] as const;

function WiseGiftsShuffleGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [speed, setSpeed] = useState<ShuffleSpeed>('gentle');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'reveal' | 'shuffling' | 'choose' | 'round-won'>('reveal');
  const [starSlot, setStarSlot] = useState<number>(1);
  // boxSlots[slotIndex] = themeIndex (0,1,2) so colors visually swap when boxes swap
  const [boxSlots, setBoxSlots] = useState<[number, number, number]>([0, 1, 2]);
  const [highlightedSwap, setHighlightedSwap] = useState<[number, number] | null>(null);
  const [openedSlots, setOpenedSlots] = useState<number[]>([]);
  const [banner, setBanner] = useState(
    'Watch closely! The Christmas Star is hiding inside the middle box…'
  );

  const scoreRef = useRef(0);

  const startShuffleForRound = useCallback(
    (roundNum: number, chosenSpeed: ShuffleSpeed) => {
      const cfg = SHUFFLE_SPEED_CONFIG[chosenSpeed];
      const initialSlot = (roundNum + Math.floor(Math.random() * 3)) % 3;
      setStarSlot(initialSlot);
      setOpenedSlots([initialSlot]);
      setPhase('reveal');
      setBanner(
        `Round ${roundNum}/3: Remember where the 🌟 Christmas Star is! Shuffling in a moment…`
      );

      let currentStar = initialSlot;
      let currentThemes: [number, number, number] = [0, 1, 2];

      const revealTimer = setTimeout(() => {
        setOpenedSlots([]);
        setPhase('shuffling');
        setBanner('Keep your eyes on the box with the Star!');

        let stepIdx = 0;
        const runSwap = () => {
          if (stepIdx >= cfg.swaps) {
            setHighlightedSwap(null);
            setPhase('choose');
            setBanner('Tap the Gift Box that holds the 🌟 Christmas Star!');
            return;
          }

          const a = Math.floor(Math.random() * 3);
          let b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
          if (b === a) b = (a + 1) % 3;

          if (currentStar === a) currentStar = b;
          else if (currentStar === b) currentStar = a;

          const nextThemes: [number, number, number] = [...currentThemes] as [
            number,
            number,
            number,
          ];
          const tmp = nextThemes[a]!;
          nextThemes[a] = nextThemes[b]!;
          nextThemes[b] = tmp;
          currentThemes = nextThemes;

          setStarSlot(currentStar);
          setBoxSlots(currentThemes);
          setHighlightedSwap([a, b]);
          playArcadeTone('tap');

          stepIdx += 1;
          setTimeout(runSwap, cfg.swapDurationMs);
        };

        runSwap();
      }, 1150);

      return () => clearTimeout(revealTimer);
    },
    []
  );

  useEffect(() => {
    const cleanup = startShuffleForRound(1, speed);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSlot = (slotIdx: number) => {
    if (phase !== 'choose') return;
    if (openedSlots.includes(slotIdx)) return;

    const cfg = SHUFFLE_SPEED_CONFIG[speed];
    const isFirstGuess = openedSlots.length === 0;

    if (slotIdx === starSlot) {
      const pts = isFirstGuess ? cfg.winPoints : 20;
      const nextScore = scoreRef.current + pts;
      scoreRef.current = nextScore;
      setScore(nextScore);
      setOpenedSlots([0, 1, 2]);
      setPhase('round-won');
      playArcadeTone('fanfare');
      triggerHaptic(30);

      if (round < 3) {
        setBanner(`🎉 Spot on! +${pts} pts! Getting Round ${round + 1} ready…`);
        const nextRound = round + 1;
        setTimeout(() => {
          setRound(nextRound);
          startShuffleForRound(nextRound, speed);
        }, 1150);
      } else {
        setBanner(`🏆 You found all 3 Wise Gifts! Final Score: ${nextScore} pts!`);
        setTimeout(() => {
          onFinish(nextScore);
        }, 950);
      }
    } else {
      // Grace second chance so seniors & kids never lose!
      const gracePts = 10;
      const nextScore = scoreRef.current + gracePts;
      scoreRef.current = nextScore;
      setScore(nextScore);
      setOpenedSlots((prev) => [...prev, slotIdx]);
      playArcadeTone('pickup');
      triggerHaptic(15);
      setBanner(
        `✨ Christmas Grace Bonus (+${gracePts} pts)! Try another box to find the 🌟 Star!`
      );
    }
  };

  return (
    <div className="booth-playfield">
      <div className="booth-speed-bar" role="group" aria-label="Shuffle speed for your age group">
        {(Object.keys(SHUFFLE_SPEED_CONFIG) as ShuffleSpeed[]).map((key) => {
          const active = speed === key;
          return (
            <button
              key={key}
              type="button"
              className={`quick-tag-chip${active ? ' quick-tag-chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => {
                setSpeed(key);
                if (phase === 'choose' || phase === 'reveal') {
                  startShuffleForRound(round, key);
                }
              }}
            >
              {SHUFFLE_SPEED_CONFIG[key].label}
            </button>
          );
        })}
      </div>

      <p className="booth-playfield__status" role="status" aria-live="polite">
        {banner}
      </p>

      <div className="wise-gifts-stage">
        <div className="wise-gifts-hud">
          <span>Round {round} of 3</span>
          <strong>Score: {score} pts</strong>
        </div>

        <div className="wise-gifts-grid" role="group" aria-label="Three Christmas gift boxes">
          {[0, 1, 2].map((slotIdx) => {
            const themeIdx = boxSlots[slotIdx] ?? 0;
            const theme = GIFT_BOX_THEMES[themeIdx]!;
            const isOpen = openedSlots.includes(slotIdx);
            const hasStar = slotIdx === starSlot;
            const isSwapping =
              highlightedSwap !== null &&
              (highlightedSwap[0] === slotIdx || highlightedSwap[1] === slotIdx);

            return (
              <button
                key={slotIdx}
                type="button"
                className={`wise-gift-card${isOpen ? ' wise-gift-card--open' : ''}${
                  isSwapping ? ' wise-gift-card--swapping' : ''
                }`}
                disabled={phase !== 'choose' || isOpen}
                onClick={() => handleSelectSlot(slotIdx)}
                style={
                  {
                    '--gift-body': theme.body,
                    '--gift-ribbon': theme.ribbon,
                  } as React.CSSProperties
                }
              >
                <span className="wise-gift-card__num">Box #{slotIdx + 1}</span>
                <span className="wise-gift-card__visual" aria-hidden="true">
                  {isOpen ? (hasStar ? '🌟' : '🍪') : '🎁'}
                </span>
                <span className="wise-gift-card__label">
                  {isOpen
                    ? hasStar
                      ? 'NATIVITY STAR!'
                      : '+10 Grace Cookie'
                    : phase === 'choose'
                      ? 'Tap to Open!'
                      : theme.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GAME 3: OVERFLOWING BLESSING BASKET (20s Forgiving Catch — Kids & Families)
// ============================================================================

interface FallingBlessing {
  id: number;
  x: number;
  y: number;
  vy: number;
  emoji: string;
  word: string;
  points: number;
}

const BLESSING_TYPES = [
  { emoji: '🌟', word: 'HOPE FOR YOUR VIP!', points: 10 },
  { emoji: '🎁', word: 'GIFT OF GRACE!', points: 8 },
  { emoji: '🕊️', word: 'PEACE!', points: 8 },
  { emoji: '❤️', word: 'CHRISTMAS LOVE!', points: 8 },
  { emoji: '☕', word: 'WARM WELCOME!', points: 6 },
  { emoji: '🍪', word: 'SWEET JOY!', points: 6 },
] as const;

function BlessingBasketGame({ onFinish }: { onFinish: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);

  const stateRef = useRef<{
    basketX: number;
    moveDir: number;
    score: number;
    elapsed: number;
    spawnTimer: number;
    nextId: number;
    items: FallingBlessing[];
    popups: FloatingPopup[];
    finished: boolean;
  }>({
    basketX: 180,
    moveDir: 0,
    score: 0,
    elapsed: 0,
    spawnTimer: 0.15,
    nextId: 1,
    items: [],
    popups: [],
    finished: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        stateRef.current.moveDir = -1;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        stateRef.current.moveDir = 1;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 'd' ||
        e.key === 'D'
      ) {
        stateRef.current.moveDir = 0;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const st = stateRef.current;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== 360 * dpr || canvas.height !== 420 * dpr) {
        canvas.width = 360 * dpr;
        canvas.height = 420 * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!st.finished) {
        st.elapsed += dt;
        const rem = Math.max(0, Math.ceil(20 - st.elapsed));
        setTimeLeft(rem);

        if (st.moveDir !== 0) {
          st.basketX = Math.max(54, Math.min(306, st.basketX + st.moveDir * 260 * dt));
        }

        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          st.spawnTimer = 0.42;
          const kind = BLESSING_TYPES[st.nextId % BLESSING_TYPES.length]!;
          st.items.push({
            id: st.nextId++,
            x: 42 + Math.random() * 276,
            y: 44,
            vy: 145 + Math.random() * 55,
            emoji: kind.emoji,
            word: kind.word,
            points: kind.points,
          });
        }

        const remainingItems: FallingBlessing[] = [];
        for (const item of st.items) {
          item.y += item.vy * dt;
          const caught =
            item.y >= 336 &&
            item.y <= 392 &&
            Math.abs(item.x - st.basketX) <= 62; // Extra-wide forgiving catch zone!

          if (caught) {
            st.score += item.points;
            setScore(st.score);
            playArcadeTone('pickup');
            triggerHaptic(14);
            st.popups.push({
              x: Math.max(70, Math.min(290, item.x)),
              y: 330,
              text: `+${item.points} ${item.word}`,
              color: '#fef08a',
              alpha: 1,
              vy: -42,
            });
          } else if (item.y < 415) {
            remainingItems.push(item);
          }
        }
        st.items = remainingItems;

        if (st.elapsed >= 20) {
          st.finished = true;
          const finalPts = Math.max(30, st.score);
          playArcadeTone('fanfare');
          setTimeout(() => onFinish(finalPts), 650);
        }
      }

      for (const pop of st.popups) {
        pop.y += pop.vy * dt;
        pop.alpha -= 0.9 * dt;
      }
      st.popups = st.popups.filter((p) => p.alpha > 0);

      // ---- DRAW ----
      const grad = ctx.createLinearGradient(0, 0, 0, 420);
      grad.addColorStop(0, '#0f291e');
      grad.addColorStop(1, '#14532d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 360, 420);

      // Top HUD
      drawRoundedRect(ctx, 14, 10, 332, 34, 10);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⏱ ${ Math.max(0, Math.ceil(20 - st.elapsed)) }s`, 26, 31);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`Blessings: ${st.score} pts`, 334, 31);

      // Falling items
      ctx.textAlign = 'center';
      ctx.font = '28px sans-serif';
      for (const item of st.items) {
        ctx.fillText(item.emoji, item.x, item.y);
      }

      // Forgiving Christmas Basket
      const bx = st.basketX;
      drawRoundedRect(ctx, bx - 52, 352, 104, 38, 14);
      ctx.fillStyle = '#d97706';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 12px Inter, system-ui, sans-serif';
      ctx.fillText('🧺 VIP BASKET', bx, 375);

      for (const pop of st.popups) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.alpha);
        ctx.font = '800 13px Inter, system-ui, sans-serif';
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [onFinish]);

  return (
    <div className="booth-playfield">
      <p className="booth-playfield__status" role="status" aria-live="polite">
        Slide your finger on the screen or use the buttons below to catch falling blessings for your
        friend! ({timeLeft}s left · {score} pts)
      </p>

      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Overflowing Blessing Basket game. Score ${score} points, ${timeLeft} seconds left.`}
          className="game-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            const logicalX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 360;
            stateRef.current.basketX = Math.max(54, Math.min(306, logicalX));
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0 && e.pressure === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const logicalX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 360;
            stateRef.current.basketX = Math.max(54, Math.min(306, logicalX));
          }}
        />
      </div>

      <div className="booth-controls-row" role="group" aria-label="Basket movement controls">
        <button
          type="button"
          className="btn btn--subtle booth-big-btn"
          onPointerDown={() => {
            stateRef.current.moveDir = -1;
          }}
          onPointerUp={() => {
            stateRef.current.moveDir = 0;
          }}
          onPointerLeave={() => {
            stateRef.current.moveDir = 0;
          }}
          onClick={() => {
            stateRef.current.basketX = Math.max(54, stateRef.current.basketX - 42);
          }}
        >
          ◀ Slide Left
        </button>
        <button
          type="button"
          className="btn btn--primary booth-big-btn"
          onClick={() => onFinish(Math.max(35, stateRef.current.score))}
        >
          🎉 Claim VIP Seat ({score} pts)
        </button>
        <button
          type="button"
          className="btn btn--subtle booth-big-btn"
          onPointerDown={() => {
            stateRef.current.moveDir = 1;
          }}
          onPointerUp={() => {
            stateRef.current.moveDir = 0;
          }}
          onPointerLeave={() => {
            stateRef.current.moveDir = 0;
          }}
          onClick={() => {
            stateRef.current.basketX = Math.min(306, stateRef.current.basketX + 42);
          }}
        >
          Slide Right ▶
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// GAME 4: LIGHT UP THE CHRISTMAS TREE (Youth, Young Adults & Duos)
// ============================================================================

function TreeLightRelayGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [bulbsLit, setBulbsLit] = useState(0);
  const [score, setScore] = useState(0);
  const [triviaAnswered, setTriviaAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);

  const TOTAL_BULBS = 20;

  const completeGame = useCallback(
    (finalScore: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      playArcadeTone('fanfare');
      triggerHaptic(35);
      onFinish(Math.max(40, finalScore));
    },
    [onFinish]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          completeGame(scoreRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [completeGame]);

  const handleRingBell = () => {
    if (finishedRef.current) return;
    playArcadeTone('tap');
    triggerHaptic(12);
    setBulbsLit((prev) => {
      const next = Math.min(TOTAL_BULBS, prev + 1);
      if (next === TOTAL_BULBS && prev < TOTAL_BULBS) {
        playArcadeTone('star');
      }
      return next;
    });
    const nextPts = scoreRef.current + 5;
    scoreRef.current = nextPts;
    setScore(nextPts);
  };

  const handleAnswerTrivia = () => {
    if (triviaAnswered || finishedRef.current) return;
    setTriviaAnswered(true);
    const nextPts = scoreRef.current + 30;
    scoreRef.current = nextPts;
    setScore(nextPts);
    setBulbsLit(TOTAL_BULBS);
    playArcadeTone('fanfare');
    triggerHaptic(28);
  };

  const treePercent = Math.min(100, Math.round((bulbsLit / TOTAL_BULBS) * 100));

  return (
    <div className="booth-playfield">
      <div className="wise-gifts-hud">
        <span>⏱ {timeLeft}s Left · Tree Lit: {treePercent}%</span>
        <strong>Score: {score} pts</strong>
      </div>

      <div className="tree-relay-stage">
        <div
          className={`tree-relay-star${bulbsLit >= TOTAL_BULBS ? ' tree-relay-star--lit' : ''}`}
          aria-hidden="true"
        >
          🌟
        </div>

        <div className="tree-relay-tiers" aria-label={`Christmas tree ${treePercent}% lit`}>
          {[0, 1, 2, 3, 4].map((tier) => {
            const tierStart = tier * 4;
            return (
              <div
                key={tier}
                className="tree-relay-row"
                style={{ width: `${46 + tier * 13}%` }}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const bulbIndex = tierStart + idx;
                  const isLit = bulbIndex < bulbsLit;
                  return (
                    <button
                      key={bulbIndex}
                      type="button"
                      className={`tree-bulb-btn${isLit ? ' tree-bulb-btn--lit' : ''}`}
                      onClick={handleRingBell}
                      aria-label={`Light ornament ${bulbIndex + 1}`}
                    >
                      {isLit ? '✨' : '🔴'}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="booth-controls-row" style={{ marginBlockStart: '0.85rem' }}>
          <button
            type="button"
            className="btn btn--primary booth-big-btn booth-big-btn--hero"
            onClick={handleRingBell}
          >
            🔔 RING LEFT BELL (+5)
          </button>
          <button
            type="button"
            className="btn btn--gold-light booth-big-btn booth-big-btn--hero"
            onClick={handleRingBell}
          >
            🔔 RING RIGHT BELL (+5)
          </button>
        </div>

        <div className="tree-trivia-box">
          <div className="tree-trivia-box__title">
            🌟 Instant +30 Pt Star Bonus (Share This With Your Friend!):
          </div>
          <p className="tree-trivia-box__question">
            What did the Wise Men follow to find the newborn King Jesus?
          </p>
          {triviaAnswered ? (
            <div className="tree-trivia-box__success">
              ✅ +30 Bonus Points Unlocked! The Star of Bethlehem led them to Jesus!
            </div>
          ) : (
            <div className="tree-trivia-box__choices">
              <button
                type="button"
                className="btn btn--subtle btn--sm"
                onClick={handleAnswerTrivia}
              >
                🌟 The Star of Bethlehem
              </button>
              <button
                type="button"
                className="btn btn--subtle btn--sm"
                onClick={handleAnswerTrivia}
              >
                🕯️ A Guiding Light of Hope
              </button>
            </div>
          )}
        </div>

        {bulbsLit >= 8 && (
          <button
            type="button"
            className="btn btn--primary btn--lg btn--full"
            style={{ marginBlockStart: '0.75rem' }}
            onClick={() => completeGame(scoreRef.current)}
          >
            🎉 Tree Lit! Claim VIP Seat &amp; Gift Token ({score} pts)
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN BOOTH GAME SWITCHER
// ============================================================================

export function BoothGameRunner({ gameId, onFinish, onBack }: BoothGameProps) {
  return (
    <div className="booth-runner-shell">
      <div className="booth-runner-shell__top">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Back to 4 Booth Games
        </button>
        <span className="marquee-pill marquee-pill--gold">
          <span>🎁 Every Play Wins a VIP Seat &amp; Gift Token!</span>
        </span>
      </div>

      {gameId === 'star-plinko' && <StarPlinkoGame onFinish={onFinish} />}
      {gameId === 'wise-gifts' && <WiseGiftsShuffleGame onFinish={onFinish} />}
      {gameId === 'blessing-basket' && <BlessingBasketGame onFinish={onFinish} />}
      {gameId === 'tree-light' && <TreeLightRelayGame onFinish={onFinish} />}
    </div>
  );
}

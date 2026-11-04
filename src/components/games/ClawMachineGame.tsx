import { useCallback, useEffect, useRef, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface ClawMachineGameProps {
  targetScore: number;
  onBack: () => void;
  onFinish: (score: number) => void;
}

interface PrizeItem {
  id: number;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  points: number;
  kind: 'bear' | 'gift' | 'bell' | 'ginger' | 'candy' | 'star';
  color: string;
  accent: string;
  phase: number;
  grabbed: boolean;
}

interface FloatingPop {
  x: number;
  y: number;
  text: string;
  alpha: number;
  color: string;
}

const ROUND_SECONDS = 22;
const STAGE_W = 360;
const STAGE_H = 480;
const CHUTE_X = 52;
const RAIL_Y = 66;

function createPrizePool(): PrizeItem[] {
  const templates: Array<{
    kind: PrizeItem['kind'];
    points: number;
    color: string;
    accent: string;
    radius: number;
  }> = [
    { kind: 'bear', points: 6, color: '#d70015', accent: '#ffd369', radius: 22 },
    { kind: 'gift', points: 6, color: '#0f6840', accent: '#f5b942', radius: 21 },
    { kind: 'bell', points: 7, color: '#f59e0b', accent: '#fffbeb', radius: 20 },
    { kind: 'ginger', points: 5, color: '#b45309', accent: '#ffffff', radius: 20 },
    { kind: 'candy', points: 5, color: '#e11d48', accent: '#ffffff', radius: 19 },
    { kind: 'star', points: 10, color: '#f5b942', accent: '#fff7ed', radius: 23 },
  ];

  const items: PrizeItem[] = [];
  for (let i = 0; i < 13; i++) {
    const t = templates[i % templates.length];
    const row = i < 7 ? 0 : 1;
    const colIdx = row === 0 ? i : i - 7;
    const x = 108 + colIdx * 38 + (row === 1 ? 16 : 0);
    const y = row === 0 ? 416 : 368;
    items.push({
      id: i + 1,
      x: Math.min(STAGE_W - 34, x),
      y,
      baseY: y,
      radius: t.radius,
      points: t.points,
      kind: t.kind,
      color: t.color,
      accent: t.accent,
      phase: i * 0.7,
      grabbed: false,
    });
  }
  return items;
}

export function ClawMachineGame({ targetScore, onBack, onFinish }: ClawMachineGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);

  const stateRef = useRef({
    clawX: 215,
    targetClawX: 215,
    cableLen: 38,
    jawOpen: 1, // 1 = open, 0.25 = closed
    phase: 'aim' as 'aim' | 'drop' | 'grab' | 'lift' | 'return' | 'release',
    phaseTimer: 0,
    heldPrize: null as PrizeItem | null,
    prizes: createPrizePool(),
    pops: [] as FloatingPop[],
    score: 0,
    elapsed: 0,
    nextId: 50,
  });

  const triggerDrop = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== 'aim' || finishedRef.current) return;
    st.phase = 'drop';
    playArcadeTone('tap');
    triggerHaptic(12);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = stateRef.current;
      if (e.key === 'ArrowLeft') {
        st.targetClawX = Math.max(102, st.targetClawX - 26);
      } else if (e.key === 'ArrowRight') {
        st.targetClawX = Math.min(STAGE_W - 32, st.targetClawX + 26);
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        triggerDrop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerDrop]);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const drawPrize = (ctx: CanvasRenderingContext2D, p: PrizeItem) => {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Soft shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.beginPath();
      ctx.ellipse(0, p.radius * 0.85, p.radius * 0.8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (p.kind === 'star') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const outer = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const inner = outer + Math.PI / 5;
          ctx.lineTo(Math.cos(outer) * p.radius, Math.sin(outer) * p.radius);
          ctx.lineTo(Math.cos(inner) * (p.radius * 0.46), Math.sin(inner) * (p.radius * 0.46));
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (p.kind === 'gift') {
        const s = p.radius * 1.55;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(-s / 2, -s / 2, s, s, 7);
        ctx.fill();
        ctx.fillStyle = p.accent;
        ctx.fillRect(-3.5, -s / 2, 7, s);
        ctx.fillRect(-s / 2, -3.5, s, 7);
      } else {
        // Glossy capsule / ornament plush
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();

        if (p.kind === 'bear') {
          ctx.beginPath();
          ctx.arc(-p.radius * 0.65, -p.radius * 0.65, 7, 0, Math.PI * 2);
          ctx.arc(p.radius * 0.65, -p.radius * 0.65, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        // Specular highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
        ctx.beginPath();
        ctx.arc(-p.radius * 0.32, -p.radius * 0.32, p.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Festive center dot / stripe
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.arc(0, 3, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      const st = stateRef.current;

      st.elapsed += dt;
      const rem = Math.max(0, ROUND_SECONDS - st.elapsed);
      setSecondsLeft(Math.ceil(rem));

      if (rem <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        // Mercy Christmas Bonus Star if just shy of a great score
        const finalPts = Math.max(st.score, Math.min(targetScore, st.score + 6));
        playArcadeTone('win');
        triggerHaptic(35);
        onFinishRef.current(finalPts);
        return;
      }

      const goldenMagnet = rem <= 5.5;

      // Replenish prizes if running low so cabinet stays lush
      if (st.prizes.length < 7) {
        st.prizes.push({
          id: st.nextId++,
          x: 115 + Math.random() * 205,
          y: 385 + Math.random() * 35,
          baseY: 400,
          radius: 22,
          points: goldenMagnet ? 10 : 7,
          kind: goldenMagnet ? 'star' : 'bell',
          color: '#f5b942',
          accent: '#ffffff',
          phase: Math.random() * 4,
          grabbed: false,
        });
      }

      // Gentle bobbing for ungrabbed prizes
      for (const p of st.prizes) {
        if (!p.grabbed) {
          p.y = p.baseY + Math.sin(st.elapsed * 2.6 + p.phase) * 2.2;
        }
      }

      // Claw state machine (snappy arcade speed)
      if (st.phase === 'aim') {
        st.clawX += (st.targetClawX - st.clawX) * Math.min(1, dt * 15);
        st.jawOpen = 1;
      } else if (st.phase === 'drop') {
        st.cableLen += 340 * dt;
        const tipY = RAIL_Y + st.cableLen + 22;
        const grabRadius = goldenMagnet ? 46 : 36;

        let hitPrize: PrizeItem | null = null;
        let bestDist = Infinity;
        for (const p of st.prizes) {
          const d = Math.hypot(p.x - st.clawX, p.y - tipY);
          if (d < grabRadius && d < bestDist) {
            bestDist = d;
            hitPrize = p;
          }
        }

        if (hitPrize || tipY >= 425) {
          st.phase = 'grab';
          st.phaseTimer = 0.14;
          if (hitPrize) {
            hitPrize.grabbed = true;
            st.heldPrize = hitPrize;
            playArcadeTone('pickup');
            triggerHaptic(20);
          } else {
            playArcadeTone('hit');
          }
        }
      } else if (st.phase === 'grab') {
        st.jawOpen = Math.max(0.28, st.jawOpen - dt * 5.5);
        st.phaseTimer -= dt;
        if (st.heldPrize) {
          st.heldPrize.x = st.clawX;
          st.heldPrize.y = RAIL_Y + st.cableLen + 24;
        }
        if (st.phaseTimer <= 0) {
          st.phase = 'lift';
        }
      } else if (st.phase === 'lift') {
        st.cableLen = Math.max(38, st.cableLen - 360 * dt);
        if (st.heldPrize) {
          st.heldPrize.x = st.clawX;
          st.heldPrize.y = RAIL_Y + st.cableLen + 24;
        }
        if (st.cableLen <= 38.5) {
          st.phase = st.heldPrize ? 'return' : 'aim';
        }
      } else if (st.phase === 'return') {
        const dir = Math.sign(CHUTE_X - st.clawX);
        st.clawX += dir * 340 * dt;
        if (st.heldPrize) {
          st.heldPrize.x = st.clawX;
          st.heldPrize.y = RAIL_Y + st.cableLen + 24;
        }
        if (Math.abs(st.clawX - CHUTE_X) < 8) {
          st.clawX = CHUTE_X;
          st.phase = 'release';
          st.phaseTimer = 0.18;
          st.jawOpen = 1;
          if (st.heldPrize) {
            const pts = st.heldPrize.points + (goldenMagnet ? 3 : 0);
            st.score += pts;
            setScore(st.score);
            st.pops.push({
              x: CHUTE_X + 22,
              y: 280,
              text: `+${pts}`,
              alpha: 1,
              color: st.heldPrize.kind === 'star' ? '#b45309' : '#d70015',
            });
            playArcadeTone(st.heldPrize.kind === 'star' ? 'star' : 'pickup');
            triggerHaptic(25);
            st.prizes = st.prizes.filter((item) => item.id !== st.heldPrize?.id);
            st.heldPrize = null;
          }
        }
      } else if (st.phase === 'release') {
        st.phaseTimer -= dt;
        if (st.phaseTimer <= 0) {
          st.targetClawX = Math.max(125, st.targetClawX);
          st.phase = 'aim';
        }
      }

      for (const pop of st.pops) {
        pop.y -= 48 * dt;
        pop.alpha -= 1.3 * dt;
      }
      st.pops = st.pops.filter((p) => p.alpha > 0);

      // Render Canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);

        // Snow-glass arcade backdrop
        const bg = ctx.createLinearGradient(0, 0, 0, STAGE_H);
        bg.addColorStop(0, '#fffdf9');
        bg.addColorStop(0.75, '#f5f7fa');
        bg.addColorStop(1, '#e8edf5');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);

        // Top Crimson Arcade Canopy
        ctx.fillStyle = '#d70015';
        ctx.fillRect(0, 0, STAGE_W, 44);
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#d70015';
          ctx.beginPath();
          ctx.arc(20 + i * 40, 44, 20, 0, Math.PI);
          ctx.fill();
        }

        if (goldenMagnet) {
          ctx.fillStyle = 'rgba(245, 185, 66, 0.22)';
          ctx.fillRect(0, 56, STAGE_W, STAGE_H - 56);
          ctx.fillStyle = '#b45309';
          ctx.font = '800 13px -apple-system, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✨ GOLDEN MAGNET CLAW ACTIVE ✨', STAGE_W / 2, 86);
        }

        // Gantry Rail
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(28, RAIL_Y);
        ctx.lineTo(STAGE_W - 24, RAIL_Y);
        ctx.stroke();

        // Laser Aim Line while aiming
        if (st.phase === 'aim') {
          ctx.save();
          ctx.strokeStyle = goldenMagnet ? 'rgba(245, 158, 11, 0.5)' : 'rgba(215, 0, 21, 0.25)';
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(st.clawX, RAIL_Y + st.cableLen + 26);
          ctx.lineTo(st.clawX, 438);
          ctx.stroke();
          ctx.restore();
        }

        // Prize Chute Box on Left
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#d70015';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(14, 344, 76, 120, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d70015';
        ctx.font = '800 11px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PRIZE', CHUTE_X, 368);
        ctx.fillText('CHUTE', CHUTE_X, 382);

        // Cabinet Floor
        ctx.fillStyle = '#dfe6f0';
        ctx.fillRect(92, 438, STAGE_W - 92, 42);

        // Prizes
        for (const p of st.prizes) {
          drawPrize(ctx, p);
        }

        // Claw Carriage + Cable + Prongs
        ctx.fillStyle = '#1d1d1f';
        ctx.beginPath();
        ctx.roundRect(st.clawX - 18, RAIL_Y - 10, 36, 18, 6);
        ctx.fill();

        const pivotY = RAIL_Y + st.cableLen;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(st.clawX, RAIL_Y + 8);
        ctx.lineTo(st.clawX, pivotY);
        ctx.stroke();

        // Gold Claw Hub & Articulated Prongs
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(st.clawX, pivotY, 8, 0, Math.PI * 2);
        ctx.fill();

        const spread = 10 + st.jawOpen * 16;
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        // Left prong
        ctx.beginPath();
        ctx.moveTo(st.clawX - 4, pivotY + 2);
        ctx.quadraticCurveTo(st.clawX - spread - 6, pivotY + 16, st.clawX - spread + 4, pivotY + 30);
        ctx.stroke();
        // Right prong
        ctx.beginPath();
        ctx.moveTo(st.clawX + 4, pivotY + 2);
        ctx.quadraticCurveTo(st.clawX + spread + 6, pivotY + 16, st.clawX + spread - 4, pivotY + 30);
        ctx.stroke();

        // Floating Score Pops
        for (const pop of st.pops) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, pop.alpha);
          ctx.fillStyle = pop.color;
          ctx.font = '900 22px -apple-system, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(pop.text, pop.x, pop.y);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetScore]);

  const updateAimFromPointer = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * STAGE_W;
    stateRef.current.targetClawX = Math.max(104, Math.min(STAGE_W - 30, relX));
  };

  return (
    <section className="game-stage" aria-label="Claw Grab">
      <div className="game-hud">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Arcade
        </button>
        <span className="hud-pill hud-pill--score">
          ★ {score} <span style={{ opacity: 0.65 }}>/ {targetScore}</span>
        </span>
        <span className="hud-pill hud-pill--timer">{secondsLeft}s</span>
      </div>

      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={STAGE_W}
          height={STAGE_H}
          className="game-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            updateAimFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') {
              updateAimFromPointer(e.clientX);
            }
          }}
        />
      </div>

      <div className="arcade-pad" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
        <button
          type="button"
          className="arcade-pad__btn"
          aria-label="Move claw left"
          onPointerDown={() => {
            stateRef.current.targetClawX = Math.max(104, stateRef.current.targetClawX - 30);
          }}
        >
          ◀
        </button>
        <button
          type="button"
          className="arcade-pad__btn arcade-pad__btn--action"
          onClick={triggerDrop}
        >
          ⬇ DROP CLAW
        </button>
        <button
          type="button"
          className="arcade-pad__btn"
          aria-label="Move claw right"
          onPointerDown={() => {
            stateRef.current.targetClawX = Math.min(STAGE_W - 30, stateRef.current.targetClawX + 30);
          }}
        >
          ▶
        </button>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface SantaStreetDashProps {
  targetScore: number;
  onBack: () => void;
  onFinish: (score: number) => void;
}

interface TrackEntity {
  id: number;
  lane: 0 | 1 | 2;
  z: number; // 0 (horizon) -> 1 (player plane) -> 1.15 (passed)
  kind: 'coin' | 'gift' | 'magnet' | 'barrier';
  collected: boolean;
}

const ROUND_SECONDS = 20;
const STAGE_W = 360;
const STAGE_H = 480;
const HORIZON_Y = 108;
const PLAYER_Y = 418;

export function SantaStreetDash({ targetScore, onBack, onFinish }: SantaStreetDashProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);

  const stateRef = useRef({
    lane: 1 as 0 | 1 | 2,
    visualX: STAGE_W / 2,
    hopTime: 0,
    magnetTimer: 0,
    hitFlash: 0,
    spawnTimer: 0,
    stripeOffset: 0,
    nextId: 1,
    entities: [] as TrackEntity[],
    score: 0,
    elapsed: 0,
    touchStartX: null as number | null,
  });

  const shiftLane = (delta: -1 | 1) => {
    const st = stateRef.current;
    const next = Math.max(0, Math.min(2, st.lane + delta)) as 0 | 1 | 2;
    if (next !== st.lane) {
      st.lane = next;
      st.hopTime = 0.16;
      playArcadeTone('tap');
      triggerHaptic(10);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        shiftLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        shiftLane(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const laneCenterX = (lane: number, z: number) => {
      const topSpread = 34;
      const bottomSpread = 104;
      const spread = topSpread + (bottomSpread - topSpread) * z;
      return STAGE_W / 2 + (lane - 1) * spread;
    };

    const zToY = (z: number) => {
      const curved = z * z * 0.65 + z * 0.35;
      return HORIZON_Y + (PLAYER_Y - HORIZON_Y) * curved;
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
        const finalPts = Math.max(st.score, Math.min(targetScore, st.score + 5));
        playArcadeTone('win');
        triggerHaptic(35);
        onFinishRef.current(finalPts);
        return;
      }

      if (rem <= 4.5 && st.magnetTimer < 1) {
        st.magnetTimer = 4.5; // Finale Star Magnet Rush
      }
      if (st.magnetTimer > 0) st.magnetTimer -= dt;
      if (st.hitFlash > 0) st.hitFlash -= dt;
      if (st.hopTime > 0) st.hopTime -= dt;

      const speed = 0.68 + Math.min(0.32, st.elapsed * 0.015);
      st.stripeOffset = (st.stripeOffset + speed * dt * 8) % 1;

      // Spawn waves of coins, gifts, magnets, and single-lane snow barriers
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 0.34;
        const blockedLane = Math.random() < 0.45 ? (Math.floor(Math.random() * 3) as 0 | 1 | 2) : -1;
        if (blockedLane !== -1) {
          st.entities.push({
            id: st.nextId++,
            lane: blockedLane as 0 | 1 | 2,
            z: 0.02,
            kind: 'barrier',
            collected: false,
          });
        }
        const openLanes = ([0, 1, 2] as const).filter((l) => l !== blockedLane);
        const pickLane = openLanes[Math.floor(Math.random() * openLanes.length)];
        const roll = Math.random();
        const kind: TrackEntity['kind'] =
          roll < 0.12 ? 'magnet' : roll < 0.38 ? 'gift' : 'coin';
        st.entities.push({
          id: st.nextId++,
          lane: pickLane,
          z: 0.02,
          kind,
          collected: false,
        });
      }

      const targetPlayerX = laneCenterX(st.lane, 1);
      st.visualX += (targetPlayerX - st.visualX) * Math.min(1, dt * 18);

      for (const ent of st.entities) {
        ent.z += speed * dt;
        // Magnet pulls nearby coins & gifts toward Santa's lane!
        if (st.magnetTimer > 0 && ent.kind !== 'barrier' && ent.z > 0.52 && !ent.collected) {
          ent.lane = st.lane;
        }

        if (!ent.collected && ent.z >= 0.9 && ent.z <= 1.04) {
          const sameLane = ent.lane === st.lane || (st.magnetTimer > 0 && ent.kind !== 'barrier');
          if (sameLane) {
            ent.collected = true;
            if (ent.kind === 'barrier') {
              st.score = Math.max(0, st.score - 2);
              st.hitFlash = 0.25;
              playArcadeTone('hit');
              triggerHaptic(28);
            } else if (ent.kind === 'magnet') {
              st.magnetTimer = 4.2;
              st.score += 5;
              playArcadeTone('star');
              triggerHaptic(22);
            } else if (ent.kind === 'gift') {
              st.score += 4;
              playArcadeTone('pickup');
              triggerHaptic(14);
            } else {
              st.score += 2;
              playArcadeTone('tap');
            }
            setScore(st.score);
          }
        }
      }

      st.entities = st.entities.filter((e) => !e.collected && e.z < 1.15);

      // Draw Pseudo-3D Festive Street
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);

        // Crisp winter sky
        const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 20);
        sky.addColorStop(0, '#dbeafe');
        sky.addColorStop(1, '#ffffff');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, STAGE_W, HORIZON_Y + 20);

        // Snowy side banks
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, HORIZON_Y, STAGE_W, STAGE_H - HORIZON_Y);

        // 3-Lane Road Trapezoid
        ctx.fillStyle = st.hitFlash > 0 ? '#fee2e2' : '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(STAGE_W / 2 - 56, HORIZON_Y);
        ctx.lineTo(STAGE_W / 2 + 56, HORIZON_Y);
        ctx.lineTo(STAGE_W / 2 + 162, STAGE_H);
        ctx.lineTo(STAGE_W / 2 - 162, STAGE_H);
        ctx.closePath();
        ctx.fill();

        // Crimson Candy-Cane Curbs
        ctx.strokeStyle = '#d70015';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(STAGE_W / 2 - 56, HORIZON_Y);
        ctx.lineTo(STAGE_W / 2 - 162, STAGE_H);
        ctx.moveTo(STAGE_W / 2 + 56, HORIZON_Y);
        ctx.lineTo(STAGE_W / 2 + 162, STAGE_H);
        ctx.stroke();

        // Perspective Lane Dividers
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 14]);
        ctx.lineDashOffset = -st.stripeOffset * 28;
        ctx.beginPath();
        ctx.moveTo(STAGE_W / 2 - 19, HORIZON_Y);
        ctx.lineTo(STAGE_W / 2 - 54, STAGE_H);
        ctx.moveTo(STAGE_W / 2 + 19, HORIZON_Y);
        ctx.lineTo(STAGE_W / 2 + 54, STAGE_H);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pine trees along snowy avenue
        for (let i = 0; i < 4; i++) {
          const tz = ((i * 0.25 + st.stripeOffset * 0.25) % 1);
          const ty = zToY(tz);
          const scale = 0.35 + tz * 0.85;
          for (const side of [-1, 1]) {
            const tx = STAGE_W / 2 + side * (72 + tz * 118);
            ctx.fillStyle = '#0f6840';
            ctx.beginPath();
            ctx.moveTo(tx, ty - 34 * scale);
            ctx.lineTo(tx - 15 * scale, ty);
            ctx.lineTo(tx + 15 * scale, ty);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Draw Track Entities back-to-front
        const sorted = [...st.entities].sort((a, b) => a.z - b.z);
        for (const ent of sorted) {
          const ex = laneCenterX(ent.lane, ent.z);
          const ey = zToY(ent.z);
          const sc = 0.35 + ent.z * 0.78;

          ctx.save();
          ctx.translate(ex, ey);
          ctx.scale(sc, sc);

          if (ent.kind === 'barrier') {
            // Red & White Striped Snow Barrier
            ctx.fillStyle = '#1d1d1f';
            ctx.beginPath();
            ctx.roundRect(-28, -24, 56, 26, 6);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-24, -20, 48, 12);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-10, -20, 10, 12);
            ctx.fillRect(10, -20, 10, 12);
          } else if (ent.kind === 'gift') {
            ctx.fillStyle = '#0f6840';
            ctx.beginPath();
            ctx.roundRect(-18, -32, 36, 34, 7);
            ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-4, -32, 8, 34);
            ctx.fillRect(-18, -18, 36, 7);
          } else if (ent.kind === 'magnet') {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(0, -18, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★', 0, -12);
          } else {
            // Golden Bell Coin
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(0, -15, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }
          ctx.restore();
        }

        // Santa Sleigh Runner
        const hopLift = st.hopTime > 0 ? Math.sin((st.hopTime / 0.16) * Math.PI) * 14 : 0;
        ctx.save();
        ctx.translate(st.visualX, PLAYER_Y - hopLift);

        if (st.magnetTimer > 0) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, -14, 34 + Math.sin(st.elapsed * 12) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Sleigh body
        ctx.fillStyle = '#d70015';
        ctx.beginPath();
        ctx.roundRect(-24, -28, 48, 28, 10);
        ctx.fill();
        // Gold rails
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-26, -3, 52, 5);
        // Santa hat pom
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -34, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d70015';
        ctx.beginPath();
        ctx.moveTo(-11, -34);
        ctx.lineTo(11, -34);
        ctx.lineTo(3, -50);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(3, -51, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (st.magnetTimer > 0) {
          ctx.fillStyle = '#b45309';
          ctx.font = '800 13px -apple-system, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('★ STAR MAGNET RUSH ★', STAGE_W / 2, 28);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetScore]);

  return (
    <section className="game-stage" aria-label="Santa Dash">
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
            stateRef.current.touchStartX = e.clientX;
          }}
          onPointerUp={(e) => {
            const startX = stateRef.current.touchStartX;
            stateRef.current.touchStartX = null;
            if (startX !== null) {
              const dx = e.clientX - startX;
              if (Math.abs(dx) > 22) {
                shiftLane(dx < 0 ? -1 : 1);
                return;
              }
            }
            // Tap left / center / right third of canvas to jump directly to lane
            const rect = e.currentTarget.getBoundingClientRect();
            const rel = (e.clientX - rect.left) / rect.width;
            const tappedLane = (rel < 0.34 ? 0 : rel > 0.66 ? 2 : 1) as 0 | 1 | 2;
            if (tappedLane < stateRef.current.lane) shiftLane(-1);
            else if (tappedLane > stateRef.current.lane) shiftLane(1);
          }}
        />
      </div>

      <div className="arcade-pad" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button
          type="button"
          className="arcade-pad__btn"
          onPointerDown={() => shiftLane(-1)}
        >
          ◀ Left Lane
        </button>
        <button
          type="button"
          className="arcade-pad__btn"
          onPointerDown={() => shiftLane(1)}
        >
          Right Lane ▶
        </button>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface FruitSlashGameProps {
  targetScore: number;
  onBack: () => void;
  onFinish: (score: number) => void;
}

interface FlyingOrb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rot: number;
  vrot: number;
  kind: 'berry' | 'pine' | 'goldstar' | 'candy' | 'bomb';
  color: string;
  points: number;
  sliced: boolean;
}

interface SplitHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  side: -1 | 1;
  rot: number;
  alpha: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

interface PopLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

const ROUND_SECONDS = 20;
const STAGE_W = 360;
const STAGE_H = 480;
const GRAVITY = 560;

export function FruitSlashGame({ targetScore, onBack, onFinish }: FruitSlashGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);

  const stateRef = useRef({
    orbs: [] as FlyingOrb[],
    halves: [] as SplitHalf[],
    trail: [] as TrailPoint[],
    pops: [] as PopLabel[],
    spawnTimer: 0.15,
    nextId: 1,
    score: 0,
    elapsed: 0,
    swiping: false,
    strokeHits: 0,
  });

  const sliceOrb = useCallback((orb: FlyingOrb, comboCount: number) => {
    const st = stateRef.current;
    orb.sliced = true;

    if (orb.kind === 'bomb') {
      st.score = Math.max(0, st.score - 2);
      setScore(st.score);
      st.pops.push({
        x: orb.x,
        y: orb.y,
        text: '-2 ❄',
        color: '#64748b',
        alpha: 1,
      });
      playArcadeTone('hit');
      triggerHaptic(28);
      return;
    }

    const bonus = comboCount >= 3 ? 3 : comboCount === 2 ? 2 : 0;
    const pts = orb.points + bonus;
    st.score += pts;
    setScore(st.score);

    st.halves.push(
      {
        x: orb.x - 6,
        y: orb.y,
        vx: orb.vx - 85,
        vy: orb.vy - 40,
        radius: orb.radius,
        color: orb.color,
        side: -1,
        rot: orb.rot - 0.3,
        alpha: 1,
      },
      {
        x: orb.x + 6,
        y: orb.y,
        vx: orb.vx + 85,
        vy: orb.vy - 40,
        radius: orb.radius,
        color: orb.color,
        side: 1,
        rot: orb.rot + 0.3,
        alpha: 1,
      }
    );

    st.pops.push({
      x: orb.x,
      y: orb.y - 12,
      text: comboCount >= 2 ? `COMBO ×${comboCount}! +${pts}` : `+${pts}`,
      color: orb.kind === 'goldstar' || comboCount >= 2 ? '#b45309' : '#d70015',
      alpha: 1,
    });

    playArcadeTone(orb.kind === 'goldstar' || comboCount >= 2 ? 'star' : 'pickup');
    triggerHaptic(14);
  }, []);

  // Keyboard accessibility: Space / Enter unleashes a horizontal Starlight Slash across screen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const st = stateRef.current;
        for (let i = 0; i <= 8; i++) {
          st.trail.push({ x: 30 + i * 38, y: 235, life: 1 });
        }
        let hits = 0;
        for (const orb of st.orbs) {
          if (!orb.sliced && orb.kind !== 'bomb' && orb.y < 410) {
            hits += 1;
            sliceOrb(orb, hits);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sliceOrb]);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const spawnWave = (frenzy: boolean) => {
      const st = stateRef.current;
      const count = frenzy ? 3 : 2 + (Math.random() < 0.45 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        let kind: FlyingOrb['kind'] = 'berry';
        let color = '#d70015';
        let points = 2;
        let radius = 24;

        if (!frenzy && roll < 0.12) {
          kind = 'bomb';
          color = '#1e293b';
          points = 0;
          radius = 22;
        } else if (roll < 0.28 || frenzy) {
          kind = 'goldstar';
          color = '#f59e0b';
          points = 5;
          radius = 26;
        } else if (roll < 0.55) {
          kind = 'pine';
          color = '#0f6840';
          points = 3;
          radius = 24;
        } else if (roll < 0.78) {
          kind = 'candy';
          color = '#e11d48';
          points = 3;
          radius = 23;
        }

        const startX = 56 + Math.random() * (STAGE_W - 112);
        const targetCenter = STAGE_W / 2 + (Math.random() - 0.5) * 90;
        const vx = (targetCenter - startX) * 1.15;
        const vy = -(540 + Math.random() * 115);

        st.orbs.push({
          id: st.nextId++,
          x: startX,
          y: STAGE_H + 24,
          vx,
          vy,
          radius,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 5,
          kind,
          color,
          points,
          sliced: false,
        });
      }
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

      const frenzy = rem <= 4.5;
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = frenzy ? 0.45 : 0.78;
        spawnWave(frenzy);
      }

      for (const orb of st.orbs) {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.vy += GRAVITY * dt;
        orb.rot += orb.vrot * dt;
      }
      st.orbs = st.orbs.filter((o) => !o.sliced && o.y < STAGE_H + 60);

      for (const h of st.halves) {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.vy += GRAVITY * dt;
        h.rot += h.side * 4 * dt;
        h.alpha -= 1.4 * dt;
      }
      st.halves = st.halves.filter((h) => h.alpha > 0);

      for (const pt of st.trail) {
        pt.life -= dt * 4.8;
      }
      st.trail = st.trail.filter((pt) => pt.life > 0);

      for (const p of st.pops) {
        p.y -= 42 * dt;
        p.alpha -= 1.25 * dt;
      }
      st.pops = st.pops.filter((p) => p.alpha > 0);

      // Render Canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        const bg = ctx.createLinearGradient(0, 0, 0, STAGE_H);
        bg.addColorStop(0, '#fffdf9');
        bg.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);

        if (frenzy) {
          ctx.fillStyle = 'rgba(245, 185, 66, 0.16)';
          ctx.fillRect(0, 0, STAGE_W, STAGE_H);
          ctx.fillStyle = '#b45309';
          ctx.font = '800 13px -apple-system, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('★ STARLIGHT FRENZY — SLICE EVERYTHING! ★', STAGE_W / 2, 26);
        }

        // Split tumbling halves
        for (const h of st.halves) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, h.alpha);
          ctx.translate(h.x, h.y);
          ctx.rotate(h.rot);
          ctx.fillStyle = h.color;
          ctx.beginPath();
          ctx.arc(0, 0, h.radius, h.side === -1 ? Math.PI / 2 : -Math.PI / 2, h.side === -1 ? (Math.PI * 3) / 2 : Math.PI / 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Flying Ornaments & Candies
        for (const orb of st.orbs) {
          ctx.save();
          ctx.translate(orb.x, orb.y);
          ctx.rotate(orb.rot);

          if (orb.kind === 'bomb') {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.fillStyle = '#f87171';
            ctx.font = '800 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('✕', 0, 6);
          } else if (orb.kind === 'goldstar') {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
              const b = a + Math.PI / 5;
              ctx.lineTo(Math.cos(a) * orb.radius, Math.sin(a) * orb.radius);
              ctx.lineTo(Math.cos(b) * (orb.radius * 0.48), Math.sin(b) * (orb.radius * 0.48));
            }
            ctx.closePath();
            ctx.fill();
          } else {
            // Ornament cap
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-6, -orb.radius - 5, 12, 7);

            ctx.fillStyle = orb.color;
            ctx.beginPath();
            ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
            ctx.fill();

            // Gloss shine
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(-orb.radius * 0.32, -orb.radius * 0.32, orb.radius * 0.28, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Glowing Blade Ribbon Trail
        if (st.trail.length > 1) {
          for (let i = 1; i < st.trail.length; i++) {
            const p0 = st.trail[i - 1];
            const p1 = st.trail[i];
            ctx.save();
            ctx.strokeStyle = `rgba(215, 0, 21, ${Math.max(0, p1.life)})`;
            ctx.lineWidth = 8 * p1.life;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();

            ctx.strokeStyle = `rgba(255, 211, 105, ${Math.max(0, p1.life)})`;
            ctx.lineWidth = 3 * p1.life;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Popups
        for (const pop of st.pops) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, pop.alpha);
          ctx.fillStyle = pop.color;
          ctx.font = '900 19px -apple-system, system-ui, sans-serif';
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

  const handleSlashPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * STAGE_W;
    const y = ((clientY - rect.top) / rect.height) * STAGE_H;

    const st = stateRef.current;
    st.trail.push({ x, y, life: 1 });

    for (const orb of st.orbs) {
      if (orb.sliced) continue;
      if (Math.hypot(orb.x - x, orb.y - y) <= orb.radius + 16) {
        st.strokeHits += 1;
        sliceOrb(orb, st.strokeHits);
      }
    }
  };

  return (
    <section className="game-stage" aria-label="Berry Slash">
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
            stateRef.current.swiping = true;
            stateRef.current.strokeHits = 0;
            handleSlashPoint(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (stateRef.current.swiping || e.pointerType === 'mouse') {
              handleSlashPoint(e.clientX, e.clientY);
            }
          }}
          onPointerUp={() => {
            stateRef.current.swiping = false;
            stateRef.current.strokeHits = 0;
          }}
        />
      </div>

      <div className="game-hint-pill">Swipe across ornaments · Avoid dark bombs</div>
    </section>
  );
}

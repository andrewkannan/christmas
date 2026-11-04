import { useEffect, useRef, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface GiftStarRushProps {
  volunteerName: string;
  targetScore: number;
  onBack: () => void;
  onFinish: (score: number) => void;
}

interface FallingItem {
  x: number;
  y: number;
  vy: number;
  kind: 'gift' | 'candy' | 'star' | 'snow';
  radius: number;
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const GAME_DURATION_SEC = 20;
const CANVAS_W = 360;
const CANVAS_H = 480;

export function GiftStarRush({ volunteerName, targetScore, onBack, onFinish }: GiftStarRushProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
  const [displayScore, setDisplayScore] = useState(0);
  const [feverActive, setFeverActive] = useState(false);

  const stateRef = useRef({
    sleighX: CANVAS_W / 2,
    score: 0,
    feverUntil: 0,
    stunUntil: 0,
    items: [] as FallingItem[],
    popups: [] as FloatingPopup[],
    keys: { left: false, right: false },
    finished: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') stateRef.current.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        stateRef.current.keys.right = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        stateRef.current.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        stateRef.current.keys.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startTime = performance.now();
    let lastSpawn = startTime;
    let rafId = 0;

    const loop = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;
      const remaining = Math.max(0, GAME_DURATION_SEC - elapsedSec);
      setTimeLeft(Math.ceil(remaining));

      const st = stateRef.current;
      const isFever = now < st.feverUntil;
      setFeverActive(isFever);

      if (remaining <= 0 && !st.finished) {
        st.finished = true;
        playArcadeTone('win');
        triggerHaptic(45);
        onFinish(Math.max(st.score, 6));
        return;
      }

      // Keyboard movement support
      const speed = now < st.stunUntil ? 3.2 : 6.5;
      if (st.keys.left) st.sleighX = Math.max(38, st.sleighX - speed);
      if (st.keys.right) st.sleighX = Math.min(CANVAS_W - 38, st.sleighX + speed);

      // Mercy rubber-banding: faster & richer spawns in final 7 seconds if behind target
      const behindTarget = remaining < 7.5 && st.score < targetScore;
      const spawnInterval = isFever || behindTarget ? 250 : 390;

      if (now - lastSpawn > spawnInterval) {
        lastSpawn = now;
        const roll = Math.random();
        let kind: FallingItem['kind'] = 'gift';
        if (behindTarget && roll < 0.28) {
          kind = 'star';
        } else if (roll < 0.14) {
          kind = 'star';
        } else if (roll < 0.3) {
          kind = 'snow';
        } else if (roll < 0.58) {
          kind = 'candy';
        }
        st.items.push({
          x: 28 + Math.random() * (CANVAS_W - 56),
          y: -24,
          vy: 3.1 + Math.random() * 2.1 + (GAME_DURATION_SEC - remaining) * 0.08,
          kind,
          radius: kind === 'star' ? 20 : 17,
        });
      }

      // Background render
      ctx.fillStyle = isFever ? '#182b16' : '#081510';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Subtle snowfield dots
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 0; i < 16; i++) {
        const sx = ((i * 67) % CANVAS_W);
        const sy = ((i * 53 + Math.floor(now * 0.05)) % CANVAS_H);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update & draw falling items
      const sleighY = CANVAS_H - 54;
      const nextItems: FallingItem[] = [];
      for (const item of st.items) {
        item.y += item.vy;
        const dx = Math.abs(item.x - st.sleighX);
        const dy = Math.abs(item.y - sleighY);

        if (dx < 42 && dy < 30) {
          const mult = isFever ? 2 : 1;
          if (item.kind === 'snow') {
            st.stunUntil = now + 700;
            playArcadeTone('hit');
            triggerHaptic(25);
            st.popups.push({ x: item.x, y: item.y, text: 'Frost!', color: '#9ad8ff', life: 26 });
          } else if (item.kind === 'star') {
            const pts = 5 * mult;
            st.score += pts;
            st.feverUntil = now + 4000;
            playArcadeTone('star');
            triggerHaptic(35);
            st.popups.push({
              x: item.x,
              y: item.y,
              text: `★ +${pts} 2x FEVER!`,
              color: '#ffd369',
              life: 36,
            });
          } else {
            const base = item.kind === 'gift' ? 2 : 1;
            const pts = base * mult;
            st.score += pts;
            playArcadeTone('pickup');
            triggerHaptic(12);
            st.popups.push({
              x: item.x,
              y: item.y,
              text: `+${pts}`,
              color: isFever ? '#ffd369' : '#63f2a7',
              life: 24,
            });
          }
          setDisplayScore(st.score);
          continue;
        }

        if (item.y < CANVAS_H + 30) {
          nextItems.push(item);
          ctx.font = item.kind === 'star' ? '30px sans-serif' : '26px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const emoji =
            item.kind === 'star'
              ? '🌟'
              : item.kind === 'gift'
                ? '🎁'
                : item.kind === 'candy'
                  ? '🍬'
                  : '❄️';
          ctx.fillText(emoji, item.x, item.y);
        }
      }
      st.items = nextItems;

      // Draw Player Sleigh
      ctx.fillStyle = now < st.stunUntil ? '#7cc4ff' : isFever ? '#ffd369' : '#d93829';
      ctx.beginPath();
      ctx.roundRect(st.sleighX - 38, sleighY - 14, 76, 26, 10);
      ctx.fill();
      ctx.strokeStyle = '#fbf6ec';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fbf6ec';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isFever ? '2x STAR!' : 'CATCH', st.sleighX, sleighY + 3);

      // Draw floating score popups
      const nextPopups: FloatingPopup[] = [];
      for (const p of st.popups) {
        p.y -= 1.2;
        p.life -= 1;
        if (p.life > 0) {
          nextPopups.push(p);
          ctx.fillStyle = p.color;
          ctx.font = '800 16px system-ui, sans-serif';
          ctx.fillText(p.text, p.x, p.y);
        }
      }
      st.popups = nextPopups;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [started, targetScore, onFinish]);

  const updatePointerX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rel = ((clientX - rect.left) / rect.width) * CANVAS_W;
    stateRef.current.sleighX = Math.max(38, Math.min(CANVAS_W - 38, rel));
  };

  return (
    <section className="game-stage" aria-labelledby="rush-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Games
        </button>
        <h1 id="rush-title" className="section-title">
          ⚡ Gift &amp; Star Rush
        </h1>
      </div>

      <div className="game-hud" aria-live="off">
        <div>
          <span className="subtle-text">Score: </span>
          <strong style={{ fontSize: '1.2rem', color: 'var(--accent-gold-bright)' }}>
            {displayScore}
          </strong>
          <span className="subtle-text"> / {targetScore} goal</span>
        </div>
        {feverActive && <span className="challenger-tag">2x Star Fever!</span>}
        <div>
          <span className="subtle-text">Time: </span>
          <strong style={{ fontSize: '1.2rem' }}>{timeLeft}s</strong>
        </div>
      </div>

      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="game-canvas"
          aria-label="Gift and Star Rush arcade canvas. Slide finger left or right or use Left and Right Arrow keys to catch gifts."
          onPointerDown={(e) => {
            if (!started) setStarted(true);
            updatePointerX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (started) updatePointerX(e.clientX);
          }}
        />
        {!started && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(8, 20, 16, 0.86)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              textAlign: 'center',
              gap: '0.85rem',
            }}
          >
            <div style={{ fontSize: '2.7rem' }} aria-hidden="true">
              🌟🎁🛷
            </div>
            <h2 className="section-title">Slide to Catch Gifts!</h2>
            <p className="subtle-text">
              {volunteerName
                ? `Beat ${volunteerName}'s ${targetScore} pts in 20 seconds!`
                : `Score ${targetScore}+ pts in 20 seconds! Catch 🌟 for 2x points.`}
            </p>
            <button
              type="button"
              className="btn btn--gold"
              onClick={() => {
                playArcadeTone('tap');
                setStarted(true);
              }}
            >
              Tap to Start (20s)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

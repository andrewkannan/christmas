import { useEffect, useRef, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface StarlightDropProps {
  onBack: () => void;
  onFinish: (score: number) => void;
}

interface TokenBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  settled: boolean;
}

interface TriviaItem {
  question: string;
  choices: string[];
  reveal: string;
}

const TRIVIA_POOL: TriviaItem[] = [
  {
    question: 'What was the very first Christmas song played from outer space (Gemini 6, 1965)?',
    choices: ['Jingle Bells', 'Silent Night', 'Joy to the World'],
    reveal:
      'Astronauts surprised Mission Control with "Jingle Bells" on a tiny harmonica & sleigh bells—proof that Christmas joy reaches everywhere!',
  },
  {
    question: 'In the original Christmas story, who followed a mysterious bright star to bring gifts?',
    choices: ['Wise travellers from the East', 'Roman soldiers', 'Local fishermen'],
    reveal:
      'Wise seekers followed the Star of Bethlehem to celebrate the birth of Jesus—why we still give gifts of love at Christmas today!',
  },
  {
    question: 'Why were traditional Christmas candy canes shaped like a hook / letter "J"?',
    choices: ["A shepherd's staff & Jesus", 'To hang on mugs', 'Made by accident'],
    reveal:
      "They were shaped like a shepherd's crook (and 'J') as a sweet reminder of the Good Shepherd welcoming everyone on Christmas night!",
  },
];

const CANVAS_W = 340;
const CANVAS_H = 360;
const SLOT_POINTS = [6, 9, 12, 9, 6];

export function StarlightDrop({ onBack, onFinish }: StarlightDropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dropsRemaining, setDropsRemaining] = useState(3);
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState<'plinko' | 'trivia'>('plinko');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [trivia] = useState<TriviaItem>(
    () => TRIVIA_POOL[Math.floor(Math.random() * TRIVIA_POOL.length)]
  );

  const ballsRef = useRef<TokenBall[]>([]);
  const resolvedCountRef = useRef(0);
  const scoreRef = useRef(0);

  const spawnDropAtX = (x: number) => {
    if (dropsRemaining <= 0 || stage !== 'plinko') return;
    playArcadeTone('tap');
    triggerHaptic(14);
    setDropsRemaining((d) => d - 1);
    const clampedX = Math.max(36, Math.min(CANVAS_W - 36, x));
    ballsRef.current.push({
      x: clampedX + (Math.random() - 0.5) * 6,
      y: 26,
      vx: (Math.random() - 0.5) * 1.4,
      vy: 1.2,
      settled: false,
    });
  };

  useEffect(() => {
    if (stage !== 'plinko') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pegs: Array<{ x: number; y: number }> = [];
    for (let row = 0; row < 5; row++) {
      const cols = row % 2 === 0 ? 5 : 4;
      const offsetX = row % 2 === 0 ? 50 : 80;
      for (let col = 0; col < cols; col++) {
        pegs.push({ x: offsetX + col * 60, y: 78 + row * 44 });
      }
    }

    let raf = 0;
    const render = () => {
      ctx.fillStyle = '#081510';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Prize slots at bottom
      const slotW = CANVAS_W / SLOT_POINTS.length;
      for (let i = 0; i < SLOT_POINTS.length; i++) {
        ctx.fillStyle = i === 2 ? 'rgba(245, 185, 66, 0.28)' : 'rgba(255, 255, 255, 0.07)';
        ctx.fillRect(i * slotW + 3, CANVAS_H - 48, slotW - 6, 44);
        ctx.fillStyle = i === 2 ? '#ffd369' : '#bed0c5';
        ctx.font = '800 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${SLOT_POINTS[i]}`, i * slotW + slotW / 2, CANVAS_H - 21);
      }

      // Pegs
      ctx.fillStyle = '#f5b942';
      for (const peg of pegs) {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Balls physics
      for (const ball of ballsRef.current) {
        if (!ball.settled) {
          ball.vy += 0.24;
          ball.x += ball.vx;
          ball.y += ball.vy;

          if (ball.x < 18) {
            ball.x = 18;
            ball.vx = Math.abs(ball.vx) * 0.75;
          } else if (ball.x > CANVAS_W - 18) {
            ball.x = CANVAS_W - 18;
            ball.vx = -Math.abs(ball.vx) * 0.75;
          }

          for (const peg of pegs) {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 16.5 && dist > 0.01) {
              const nx = dx / dist;
              const ny = dy / dist;
              ball.x = peg.x + nx * 17;
              ball.y = peg.y + ny * 17;
              ball.vx = nx * 2.3 + (Math.random() - 0.5) * 0.6;
              ball.vy = Math.max(-2.6, ny * 2.2);
              playArcadeTone('tap');
            }
          }

          if (ball.y >= CANVAS_H - 34) {
            ball.y = CANVAS_H - 28;
            ball.settled = true;
            const slotIdx = Math.min(
              SLOT_POINTS.length - 1,
              Math.max(0, Math.floor(ball.x / slotW))
            );
            const pts = SLOT_POINTS[slotIdx];
            scoreRef.current += pts;
            setScore(scoreRef.current);
            resolvedCountRef.current += 1;
            playArcadeTone(pts >= 12 ? 'star' : 'pickup');
            triggerHaptic(22);

            if (resolvedCountRef.current >= 3) {
              setTimeout(() => setStage('trivia'), 550);
            }
          }
        }

        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌟', ball.x, ball.y + 6);
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  return (
    <section className="game-stage" aria-labelledby="drop-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Games
        </button>
        <h1 id="drop-title" className="section-title">
          🎯 Starlight Drop &amp; Spark
        </h1>
      </div>

      <div className="game-hud">
        <div>
          <span className="subtle-text">Stars Left: </span>
          <strong>{dropsRemaining}</strong>
        </div>
        <div>
          <span className="subtle-text">Score: </span>
          <strong style={{ color: 'var(--accent-gold-bright)', fontSize: '1.15rem' }}>
            {score} pts
          </strong>
        </div>
      </div>

      {stage === 'plinko' ? (
        <>
          <div className="game-canvas-wrap" style={{ aspectRatio: '340 / 360' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="game-canvas"
              aria-label="Starlight Plinko board. Tap anywhere near the top or use the drop buttons below to drop 3 stars."
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
                spawnDropAtX(x);
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={dropsRemaining <= 0}
              onClick={() => spawnDropAtX(75)}
            >
              Drop Left 🌟
            </button>
            <button
              type="button"
              className="btn btn--gold btn--sm"
              disabled={dropsRemaining <= 0}
              onClick={() => spawnDropAtX(CANVAS_W / 2)}
            >
              Drop Center 🌟
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={dropsRemaining <= 0}
              onClick={() => spawnDropAtX(CANVAS_W - 75)}
            >
              Drop Right 🌟
            </button>
          </div>
        </>
      ) : (
        <div className="card-panel">
          <span className="challenger-tag">Bonus Spark (+6 pts)</span>
          <h2 className="section-title" style={{ marginBlock: '0.6rem 0.9rem' }}>
            {trivia.question}
          </h2>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {trivia.choices.map((choice, idx) => {
              const isPicked = selectedChoice === idx;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={selectedChoice !== null}
                  onClick={() => {
                    setSelectedChoice(idx);
                    const finalPts = scoreRef.current + 6;
                    setScore(finalPts);
                    playArcadeTone('win');
                    triggerHaptic(35);
                  }}
                  className={`btn ${isPicked ? 'btn--gold' : 'btn--ghost'} btn--full`}
                  style={{ justifyContent: 'flex-start', textAlign: 'start' }}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {selectedChoice !== null && (
            <div
              role="status"
              style={{
                marginBlockStart: '1rem',
                padding: '0.9rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 185, 66, 0.14)',
                border: '1px solid var(--border-strong)',
              }}
            >
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.95rem' }}>✨ {trivia.reveal}</p>
              <button
                type="button"
                className="btn btn--primary btn--full"
                onClick={() => onFinish(score)}
              >
                Unlock My Gift &amp; Christmas Invite →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

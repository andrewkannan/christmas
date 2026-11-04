import { useCallback, useEffect, useRef, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface CandyMatchGameProps {
  targetScore: number;
  onBack: () => void;
  onFinish: (score: number) => void;
}

const GRID = 6;
const CANDY_TYPES = 5;
const ROUND_SECONDS = 25;

interface CandyVisual {
  emoji: string;
  bg: string;
  border: string;
  label: string;
}

const CANDY_STYLES: CandyVisual[] = [
  { emoji: '🍬', bg: '#ffe4e6', border: '#e11d48', label: 'Peppermint' },
  { emoji: '⭐', bg: '#fef3c7', border: '#d97706', label: 'Gold Star' },
  { emoji: '🎄', bg: '#dcfce7', border: '#15803d', label: 'Pine Jelly' },
  { emoji: '🔔', bg: '#f3e8ff', border: '#9333ea', label: 'Jingle Bell' },
  { emoji: '❄️', bg: '#e0f2fe', border: '#0284c7', label: 'Ice Gem' },
];

function findMatches(board: number[][]): Set<string> {
  const matched = new Set<string>();

  // Horizontal
  for (let r = 0; r < GRID; r++) {
    let run = 1;
    for (let c = 1; c <= GRID; c++) {
      if (c < GRID && board[r][c] === board[r][c - 1]) {
        run += 1;
      } else {
        if (run >= 3) {
          for (let k = c - run; k < c; k++) matched.add(`${r},${k}`);
        }
        run = 1;
      }
    }
  }

  // Vertical
  for (let c = 0; c < GRID; c++) {
    let run = 1;
    for (let r = 1; r <= GRID; r++) {
      if (r < GRID && board[r][c] === board[r - 1][c]) {
        run += 1;
      } else {
        if (run >= 3) {
          for (let k = r - run; k < r; k++) matched.add(`${k},${c}`);
        }
        run = 1;
      }
    }
  }

  return matched;
}

function findFirstValidMove(board: number[][]): [number, number, number, number] | null {
  const trySwap = (r1: number, c1: number, r2: number, c2: number): boolean => {
    const copy = board.map((row) => [...row]);
    [copy[r1][c1], copy[r2][c2]] = [copy[r2][c2], copy[r1][c1]];
    return findMatches(copy).size > 0;
  };

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (c + 1 < GRID && trySwap(r, c, r, c + 1)) return [r, c, r, c + 1];
      if (r + 1 < GRID && trySwap(r, c, r + 1, c)) return [r, c, r + 1, c];
    }
  }
  return null;
}

function generatePlayableBoard(): number[][] {
  for (let attempt = 0; attempt < 30; attempt++) {
    const board: number[][] = Array.from({ length: GRID }, () => Array(GRID).fill(0));
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        let pick = Math.floor(Math.random() * CANDY_TYPES);
        while (
          (c >= 2 && board[r][c - 1] === pick && board[r][c - 2] === pick) ||
          (r >= 2 && board[r - 1][c] === pick && board[r - 2][c] === pick)
        ) {
          pick = (pick + 1) % CANDY_TYPES;
        }
        board[r][c] = pick;
      }
    }
    if (findFirstValidMove(board)) return board;
  }
  return Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (__, c) => (r + c) % CANDY_TYPES)
  );
}

export function CandyMatchGame({ targetScore, onBack, onFinish }: CandyMatchGameProps) {
  const [board, setBoard] = useState<number[][]>(() => generatePlayableBoard());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [poppingKeys, setPoppingKeys] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [comboText, setComboText] = useState<string>('');
  const [hintCell, setHintCell] = useState<string | null>(null);

  const scoreRef = useRef(0);
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const dragOriginRef = useRef<{ r: number; c: number; x: number; y: number } | null>(null);
  const lastMoveAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const rem = Math.max(0, ROUND_SECONDS - elapsed);
      setSecondsLeft(Math.ceil(rem));

      if (Date.now() - lastMoveAtRef.current > 2400) {
        const move = findFirstValidMove(board);
        if (move) setHintCell(`${move[0]},${move[1]}`);
      }

      if (rem <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        clearInterval(timer);
        const finalPts = Math.max(scoreRef.current, Math.min(targetScore, scoreRef.current + 6));
        playArcadeTone('win');
        triggerHaptic(35);
        onFinishRef.current(finalPts);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [board, targetScore]);

  const resolveCascades = useCallback(async (working: number[][]) => {
    busyRef.current = true;
    let chain = 0;
    let current = working.map((r) => [...r]);

    while (true) {
      const matches = findMatches(current);
      if (matches.size === 0) break;

      chain += 1;
      // 4+ match triggers festive Row Sparkler Bonus!
      if (matches.size >= 4) {
        const firstKey = Array.from(matches)[0];
        const bonusRow = Number(firstKey.split(',')[0]);
        for (let c = 0; c < GRID; c++) matches.add(`${bonusRow},${c}`);
      }

      setPoppingKeys(new Set(matches));
      const gained = matches.size * 2 + (chain > 1 ? chain * 3 : 0);
      scoreRef.current += gained;
      setScore(scoreRef.current);
      setComboText(
        chain > 1
          ? `✨ CASCADE ×${chain}! +${gained}`
          : matches.size >= 5
            ? `🎄 ROW SPARKLER! +${gained}`
            : `+${gained} pts`
      );
      playArcadeTone(chain > 1 || matches.size >= 4 ? 'star' : 'pickup');
      triggerHaptic(16);

      await new Promise((res) => setTimeout(res, 170));

      // Collapse columns downward & refill top
      const nextGrid = current.map((r) => [...r]);
      for (let c = 0; c < GRID; c++) {
        const survivors: number[] = [];
        for (let r = GRID - 1; r >= 0; r--) {
          if (!matches.has(`${r},${c}`)) {
            survivors.push(nextGrid[r][c]);
          }
        }
        for (let r = GRID - 1; r >= 0; r--) {
          const idx = GRID - 1 - r;
          nextGrid[r][c] =
            idx < survivors.length
              ? survivors[idx]
              : Math.floor(Math.random() * CANDY_TYPES);
        }
      }

      setPoppingKeys(new Set());
      current = nextGrid;
      setBoard(current);
      await new Promise((res) => setTimeout(res, 120));
    }

    if (!findFirstValidMove(current)) {
      current = generatePlayableBoard();
      setBoard(current);
      setComboText('✨ Fresh Candies!');
    }

    busyRef.current = false;
  }, []);

  const attemptSwap = useCallback(
    (r1: number, c1: number, r2: number, c2: number) => {
      if (busyRef.current || finishedRef.current) return;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

      lastMoveAtRef.current = Date.now();
      setHintCell(null);
      setSelected(null);

      const candidate = board.map((row) => [...row]);
      [candidate[r1][c1], candidate[r2][c2]] = [candidate[r2][c2], candidate[r1][c1]];

      if (findMatches(candidate).size === 0) {
        playArcadeTone('hit');
        return;
      }

      setBoard(candidate);
      void resolveCascades(candidate);
    },
    [board, resolveCascades]
  );

  const handleCellTap = (r: number, c: number) => {
    if (busyRef.current) return;
    if (!selected) {
      setSelected([r, c]);
      playArcadeTone('tap');
      return;
    }
    const [sr, sc] = selected;
    if (sr === r && sc === c) {
      setSelected(null);
      return;
    }
    if (Math.abs(sr - r) + Math.abs(sc - c) === 1) {
      attemptSwap(sr, sc, r, c);
    } else {
      setSelected([r, c]);
      playArcadeTone('tap');
    }
  };

  return (
    <section className="game-stage" aria-label="Candy Match">
      <div className="game-hud">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Arcade
        </button>
        <span className="hud-pill hud-pill--score">
          ★ {score} <span style={{ opacity: 0.65 }}>/ {targetScore}</span>
        </span>
        <span className="hud-pill hud-pill--timer">{secondsLeft}s</span>
      </div>

      <div
        className="card-panel"
        style={{
          maxInlineSize: '25.5rem',
          inlineSize: '100%',
          marginInline: 'auto',
          padding: '0.85rem',
        }}
      >
        <div
          style={{
            minBlockSize: '1.5rem',
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '0.9rem',
            color: 'var(--accent-crimson)',
            marginBlockEnd: '0.45rem',
          }}
          aria-live="polite"
        >
          {comboText || 'Swap 3 matching candies'}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID}, 1fr)`,
            gap: '0.38rem',
            touchAction: 'none',
          }}
        >
          {board.map((row, r) =>
            row.map((candyIdx, c) => {
              const key = `${r},${c}`;
              const style = CANDY_STYLES[candyIdx];
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isPop = poppingKeys.has(key);
              const isHint = hintCell === key;

              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${style.label} row ${r + 1} col ${c + 1}`}
                  onClick={() => handleCellTap(r, c)}
                  onPointerDown={(e) => {
                    dragOriginRef.current = { r, c, x: e.clientX, y: e.clientY };
                  }}
                  onPointerUp={(e) => {
                    const orig = dragOriginRef.current;
                    dragOriginRef.current = null;
                    if (!orig) return;
                    const dx = e.clientX - orig.x;
                    const dy = e.clientY - orig.y;
                    if (Math.hypot(dx, dy) >= 20) {
                      if (Math.abs(dx) > Math.abs(dy)) {
                        const nc = orig.c + (dx > 0 ? 1 : -1);
                        if (nc >= 0 && nc < GRID) attemptSwap(orig.r, orig.c, orig.r, nc);
                      } else {
                        const nr = orig.r + (dy > 0 ? 1 : -1);
                        if (nr >= 0 && nr < GRID) attemptSwap(orig.r, orig.c, nr, orig.c);
                      }
                    }
                  }}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: '0.8rem',
                    border: isSel
                      ? '2.5px solid #1d1d1f'
                      : isHint
                        ? '2.5px solid #d70015'
                        : `1.5px solid ${style.border}`,
                    background: style.bg,
                    fontSize: '1.55rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    transform: isPop ? 'scale(0.65)' : isSel ? 'scale(1.07)' : 'scale(1)',
                    opacity: isPop ? 0.35 : 1,
                    transition: 'transform 130ms ease, opacity 130ms ease',
                  }}
                >
                  <span aria-hidden="true">{style.emoji}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="game-hint-pill">Swipe or tap adjacent candies to match 3+</div>
    </section>
  );
}

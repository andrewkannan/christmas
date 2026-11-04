import { useCallback, useEffect, useRef, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface ChristmasTetrisProps {
  targetScore: number;
  onBack: () => void;
  onFinish: (score: number) => void;
}

const COLS = 8;
const ROWS = 12;
const ROUND_SECONDS = 25;
const STAGE_W = 360;
const STAGE_H = 480;
const CELL = 36;
const BOARD_X = (STAGE_W - COLS * CELL) / 2;
const BOARD_Y = 24;

interface TetrominoDef {
  matrix: number[][];
  color: string;
}

const SHAPES: TetrominoDef[] = [
  { matrix: [[1, 1, 1, 1]], color: '#d70015' }, // Crimson I
  {
    matrix: [
      [1, 1],
      [1, 1],
    ],
    color: '#f59e0b',
  }, // Gold O
  {
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: '#0f6840',
  }, // Pine T
  {
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: '#0284c7',
  }, // Ice L
  {
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: '#e11d48',
  }, // Berry J
  {
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: '#15803d',
  }, // Holly S
];

function createStarterBoard(): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );
  // Pre-seed bottom 2 rows with 1-cell festive gaps so first drops trigger instant satisfying line clears!
  const palette = ['#d70015', '#0f6840', '#f59e0b', '#0284c7'];
  for (let r = ROWS - 2; r < ROWS; r++) {
    const gapCol = r === ROWS - 1 ? 3 : 4;
    for (let c = 0; c < COLS; c++) {
      if (c !== gapCol) {
        grid[r][c] = palette[(r + c) % palette.length];
      }
    }
  }
  return grid;
}

function rotateCW(mat: number[][]): number[][] {
  const rows = mat.length;
  const cols = mat[0].length;
  const out: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[c][rows - 1 - r] = mat[r][c];
    }
  }
  return out;
}

export function ChristmasTetris({ targetScore, onBack, onFinish }: ChristmasTetrisProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);

  const pickNextPiece = () => {
    const def = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return {
      matrix: def.matrix.map((r) => [...r]),
      color: def.color,
      row: 0,
      col: Math.floor((COLS - def.matrix[0].length) / 2),
    };
  };

  const stateRef = useRef({
    board: createStarterBoard(),
    piece: pickNextPiece(),
    fallAccum: 0,
    score: 0,
    elapsed: 0,
    bannerText: '',
    bannerAlpha: 0,
    touchStart: null as { x: number; y: number; moved: boolean } | null,
  });

  const fits = (
    board: (string | null)[][],
    matrix: number[][],
    row: number,
    col: number
  ): boolean => {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const nr = row + r;
        const nc = col + c;
        if (nc < 0 || nc >= COLS || nr >= ROWS) return false;
        if (nr >= 0 && board[nr][nc]) return false;
      }
    }
    return true;
  };

  const lockCurrentPiece = useCallback(() => {
    const st = stateRef.current;
    const { matrix, color, row, col } = st.piece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          st.board[nr][nc] = color;
        }
      }
    }

    // Check full lines
    let cleared = 0;
    const keptRows = st.board.filter((line) => {
      const full = line.every((cell) => cell !== null);
      if (full) cleared += 1;
      return !full;
    });
    while (keptRows.length < ROWS) {
      keptRows.unshift(Array.from({ length: COLS }, () => null));
    }
    st.board = keptRows;

    const gained = 2 + (cleared === 1 ? 10 : cleared === 2 ? 24 : cleared >= 3 ? 40 : 0);
    st.score += gained;
    setScore(st.score);

    if (cleared > 0) {
      st.bannerText = cleared > 1 ? `🎄 ${cleared}× LINE CLEAR! +${gained}` : `✨ LINE CLEAR! +${gained}`;
      st.bannerAlpha = 1;
      playArcadeTone('star');
      triggerHaptic(28);
    } else {
      playArcadeTone('tap');
      triggerHaptic(10);
    }

    const next = pickNextPiece();
    if (!fits(st.board, next.matrix, next.row, next.col)) {
      // Clear top rows gracefully so arcade blitz never halts early
      st.board = createStarterBoard();
    }
    st.piece = next;
  }, []);

  const moveHorizontal = useCallback((dir: -1 | 1) => {
    const st = stateRef.current;
    if (fits(st.board, st.piece.matrix, st.piece.row, st.piece.col + dir)) {
      st.piece.col += dir;
      playArcadeTone('tap');
    }
  }, []);

  const rotatePiece = useCallback(() => {
    const st = stateRef.current;
    const rotated = rotateCW(st.piece.matrix);
    for (const kick of [0, -1, 1, -2]) {
      if (fits(st.board, rotated, st.piece.row, st.piece.col + kick)) {
        st.piece.matrix = rotated;
        st.piece.col += kick;
        playArcadeTone('tap');
        triggerHaptic(10);
        return;
      }
    }
  }, []);

  const hardDrop = useCallback(() => {
    const st = stateRef.current;
    while (fits(st.board, st.piece.matrix, st.piece.row + 1, st.piece.col)) {
      st.piece.row += 1;
    }
    lockCurrentPiece();
  }, [lockCurrentPiece]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveHorizontal(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveHorizontal(1);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        rotatePiece();
      } else if (e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        hardDrop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hardDrop, moveHorizontal, rotatePiece]);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const drawGiftBlock = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      alpha = 1
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 7);
      ctx.fill();

      // Subtle glossy highlight + festive ribbon cross
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(x + CELL / 2 - 2, y + 3, 4, CELL - 6);
      ctx.fillRect(x + 3, y + CELL / 2 - 2, CELL - 6, 4);
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
        const finalPts = Math.max(st.score, Math.min(targetScore, st.score + 6));
        playArcadeTone('win');
        triggerHaptic(35);
        onFinishRef.current(finalPts);
        return;
      }

      st.fallAccum += dt;
      if (st.fallAccum >= 0.55) {
        st.fallAccum = 0;
        if (fits(st.board, st.piece.matrix, st.piece.row + 1, st.piece.col)) {
          st.piece.row += 1;
        } else {
          lockCurrentPiece();
        }
      }

      if (st.bannerAlpha > 0) {
        st.bannerAlpha = Math.max(0, st.bannerAlpha - dt * 1.1);
      }

      // Compute Ghost Row
      let ghostRow = st.piece.row;
      while (fits(st.board, st.piece.matrix, ghostRow + 1, st.piece.col)) {
        ghostRow += 1;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        ctx.fillStyle = '#fafafc';
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);

        // Matrix Card Frame
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(29, 29, 31, 0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(BOARD_X - 4, BOARD_Y - 4, COLS * CELL + 8, ROWS * CELL + 8, 14);
        ctx.fill();
        ctx.stroke();

        // Subtle Grid Cells
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const cx = BOARD_X + c * CELL;
            const cy = BOARD_Y + r * CELL;
            ctx.strokeRect(cx, cy, CELL, CELL);
            const cellColor = st.board[r][c];
            if (cellColor) {
              drawGiftBlock(ctx, cx, cy, cellColor);
            }
          }
        }

        // Ghost Preview
        for (let r = 0; r < st.piece.matrix.length; r++) {
          for (let c = 0; c < st.piece.matrix[r].length; c++) {
            if (!st.piece.matrix[r][c]) continue;
            drawGiftBlock(
              ctx,
              BOARD_X + (st.piece.col + c) * CELL,
              BOARD_Y + (ghostRow + r) * CELL,
              st.piece.color,
              0.2
            );
          }
        }

        // Active Piece
        for (let r = 0; r < st.piece.matrix.length; r++) {
          for (let c = 0; c < st.piece.matrix[r].length; c++) {
            if (!st.piece.matrix[r][c]) continue;
            drawGiftBlock(
              ctx,
              BOARD_X + (st.piece.col + c) * CELL,
              BOARD_Y + (st.piece.row + r) * CELL,
              st.piece.color,
              1
            );
          }
        }

        if (st.bannerAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = st.bannerAlpha;
          ctx.fillStyle = '#d70015';
          ctx.font = '900 18px -apple-system, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(st.bannerText, STAGE_W / 2, 18);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [lockCurrentPiece, targetScore]);

  return (
    <section className="game-stage" aria-label="Block Stack">
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
            stateRef.current.touchStart = { x: e.clientX, y: e.clientY, moved: false };
          }}
          onPointerMove={(e) => {
            const ts = stateRef.current.touchStart;
            if (!ts) return;
            const dx = e.clientX - ts.x;
            if (Math.abs(dx) >= 28) {
              moveHorizontal(dx > 0 ? 1 : -1);
              ts.x = e.clientX;
              ts.moved = true;
            }
          }}
          onPointerUp={(e) => {
            const ts = stateRef.current.touchStart;
            stateRef.current.touchStart = null;
            if (!ts) return;
            const dy = e.clientY - ts.y;
            if (dy > 38) {
              hardDrop();
            } else if (!ts.moved) {
              rotatePiece();
            }
          }}
        />
      </div>

      <div className="arcade-pad">
        <button type="button" className="arcade-pad__btn" onPointerDown={() => moveHorizontal(-1)}>
          ◀
        </button>
        <button type="button" className="arcade-pad__btn" onPointerDown={rotatePiece}>
          ↻
        </button>
        <button
          type="button"
          className="arcade-pad__btn arcade-pad__btn--action"
          onClick={hardDrop}
        >
          ⬇ Drop
        </button>
        <button type="button" className="arcade-pad__btn" onPointerDown={() => moveHorizontal(1)}>
          ▶
        </button>
      </div>
    </section>
  );
}

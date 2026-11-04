import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { createRng, randomSeed, type Rng } from '../../games/rng.ts';
import {
  PIECE_COLOR_INDEX,
  TETRIS_COLS,
  TETRIS_ROWS,
  clearLines,
  clearTopRows,
  collides,
  createBag,
  createStarterGrid,
  dropDistance,
  fullRowIndices,
  gravityInterval,
  hardDropPosition,
  isAboveTop,
  lineClearPoints,
  lockPiece,
  pieceCells,
  shapeOffsets,
  spawnPiece,
  tryMove,
  tryRotate,
  type Grid,
  type Piece,
  type PieceType,
} from '../../games/tetrisLogic.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

// ── Layout (logical canvas pixels; the backing store is scaled by devicePixelRatio) ──
const STAGE_W = 360;
const STAGE_H = 480;
const CELL = 32;
const BOARD_X = 14;
const BOARD_Y = 16;
const BOARD_W = TETRIS_COLS * CELL;
const BOARD_H = TETRIS_ROWS * CELL;
const SIDE_X = BOARD_X + BOARD_W + 10;
const SIDE_W = STAGE_W - SIDE_X - 10;
const PREVIEW_CELL = 13;
const MAX_DPR = 2;

// ── Timing ──
const MAX_DT_SEC = 0.05;
const LOCK_DELAY_SEC = 0.4;
/** Moves/rotations that may reset the lock delay per piece, so a piece can't be stalled forever. */
const MAX_LOCK_RESETS = 15;
const POPUP_LIFE_SEC = 0.9;
const POPUP_RISE_PX = 36;
const FLASH_SEC = 0.3;
const STARTER_ROWS = 2;
const TOP_OUT_CLEAR_ROWS = 7;

// ── Input ──
const PAD_REPEAT_DELAY_MS = 170;
const PAD_REPEAT_INTERVAL_MS = 65;
const DRAG_STEP_CELLS = 0.85; // fraction of a displayed cell the finger must travel per column
const TAP_MAX_PX = 10;
const TAP_MAX_MS = 300;
const SWIPE_MIN_PX = 44;
const SWIPE_MIN_SPEED = 0.45; // px per ms

/** Gift-box colours indexed by grid value (1..7). */
const BLOCK_COLORS: readonly string[] = [
  'transparent',
  '#d70015', // I — crimson
  '#f59e0b', // O — gold
  '#0f6840', // T — pine
  '#65a30d', // S — holly lime
  '#db2777', // Z — berry
  '#0284c7', // J — ice
  '#7c3aed', // L — plum
];

const CANVAS_LABEL =
  'Block Stack playfield. Stack falling gift boxes and fill rows to clear them. ' +
  'Arrow keys move, Up or X rotates, Down soft-drops, Space hard-drops.';

type Action = 'left' | 'right' | 'rotate' | 'rotateBack' | 'softDrop' | 'hardDrop';

interface Popup {
  x: number;
  y: number;
  text: string;
  age: number;
}

interface GameState {
  rng: Rng;
  grid: Grid;
  piece: Piece;
  /** Upcoming pieces; queue[0] is the next-piece preview. */
  queue: PieceType[];
  fallAccum: number;
  lockTimer: number;
  lockResets: number;
  lines: number;
  popups: Popup[];
  flashRows: number[];
  flashAge: number;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  startTime: number;
  moved: boolean;
}

// ── Game state transitions (mutate the per-mount state object; no React state per frame) ──

function takeNext(queue: PieceType[], rng: Rng): PieceType {
  if (queue.length < 2) queue.push(...createBag(rng));
  const next = queue[0];
  queue.shift();
  return next;
}

function createGameState(): GameState {
  const rng = createRng(randomSeed());
  const queue: PieceType[] = [];
  const piece = spawnPiece(takeNext(queue, rng));
  return {
    rng,
    grid: createStarterGrid(rng, STARTER_ROWS),
    piece,
    queue,
    fallAccum: 0,
    lockTimer: 0,
    lockResets: 0,
    lines: 0,
    popups: [],
    flashRows: [],
    flashAge: FLASH_SEC,
  };
}

function resetPieceTimers(s: GameState): void {
  s.fallAccum = 0;
  s.lockTimer = 0;
  s.lockResets = 0;
}

/**
 * Top-out recovery: lose a life, clear the top of the stack and spawn a fresh piece.
 * The shell pauses (isLive() → false) or ends the round on the last life.
 */
function topOut(s: GameState, api: PlayfieldApi): void {
  api.loseLife();
  s.grid = clearTopRows(s.grid, TOP_OUT_CLEAR_ROWS);
  // Spawn rows (0–1) are inside the cleared band, so this piece can never collide.
  s.piece = spawnPiece(takeNext(s.queue, s.rng));
  resetPieceTimers(s);
}

function spawnNext(s: GameState, api: PlayfieldApi): void {
  s.piece = spawnPiece(takeNext(s.queue, s.rng));
  resetPieceTimers(s);
  if (collides(s.grid, s.piece)) topOut(s, api);
}

function lockActive(s: GameState, api: PlayfieldApi): void {
  const lockedOut = isAboveTop(s.piece);
  const cells = pieceCells(s.piece);
  const locked = lockPiece(s.grid, s.piece);
  const fullRows = fullRowIndices(locked);
  const { grid, cleared } = clearLines(locked);
  s.grid = grid;

  const points = 1 + lineClearPoints(cleared);
  api.addScore(points);

  const avgX = cells.reduce((sum, [x]) => sum + x, 0) / cells.length;
  const minY = Math.min(...cells.map(([, y]) => y));
  s.popups.push({
    x: BOARD_X + (avgX + 0.5) * CELL,
    y: BOARD_Y + Math.max(0, minY) * CELL,
    text: `+${points}`,
    age: 0,
  });

  if (cleared > 0) {
    s.lines += cleared;
    s.flashRows = fullRows;
    s.flashAge = 0;
    playArcadeTone(cleared >= 3 ? 'win' : 'star');
    triggerHaptic(28);
  } else {
    playArcadeTone('tap');
    triggerHaptic(8);
  }

  if (lockedOut) {
    topOut(s, api);
  } else {
    spawnNext(s, api);
  }
}

/** A successful move/rotation while grounded restarts the lock delay (a limited number of times). */
function onPieceAdjusted(s: GameState): void {
  if (s.lockTimer > 0 && s.lockResets < MAX_LOCK_RESETS) {
    s.lockTimer = 0;
    s.lockResets += 1;
  }
}

function applyAction(s: GameState, api: PlayfieldApi, action: Action): void {
  switch (action) {
    case 'left':
    case 'right': {
      const moved = tryMove(s.grid, s.piece, action === 'left' ? -1 : 1, 0);
      if (moved) {
        s.piece = moved;
        onPieceAdjusted(s);
      }
      return;
    }
    case 'rotate':
    case 'rotateBack': {
      const rotated = tryRotate(s.grid, s.piece, action === 'rotate' ? 1 : -1);
      if (rotated) {
        s.piece = rotated;
        onPieceAdjusted(s);
        playArcadeTone('tap');
        triggerHaptic(6);
      }
      return;
    }
    case 'softDrop': {
      const moved = tryMove(s.grid, s.piece, 0, 1);
      if (moved) {
        s.piece = moved;
        s.fallAccum = 0;
        s.lockTimer = 0;
      }
      return;
    }
    case 'hardDrop':
      s.piece = hardDropPosition(s.grid, s.piece);
      lockActive(s, api);
      return;
  }
}

function stepSimulation(s: GameState, api: PlayfieldApi, dt: number): void {
  const interval = gravityInterval(api.elapsedSec());
  s.fallAccum += dt;
  while (s.fallAccum >= interval) {
    const moved = tryMove(s.grid, s.piece, 0, 1);
    if (!moved) {
      s.fallAccum = 0;
      break;
    }
    s.piece = moved;
    s.fallAccum -= interval;
    s.lockTimer = 0;
  }

  if (dropDistance(s.grid, s.piece) === 0) {
    s.lockTimer += dt;
    if (s.lockTimer >= LOCK_DELAY_SEC) lockActive(s, api);
  } else {
    s.lockTimer = 0;
  }
}

function stepEffects(s: GameState, dt: number): void {
  if (s.popups.length > 0) {
    for (const popup of s.popups) popup.age += dt;
    s.popups = s.popups.filter((popup) => popup.age < POPUP_LIFE_SEC);
  }
  if (s.flashAge < FLASH_SEC) s.flashAge = Math.min(FLASH_SEC, s.flashAge + dt);
}

// ── Rendering ──

function drawGiftBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha = 1
): void {
  const inset = Math.max(1, size * 0.06);
  const inner = size - inset * 2;
  const ribbon = Math.max(2, size * 0.12);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, inner, inner, size * 0.2);
  ctx.fill();

  // Festive ribbon cross + glossy highlight (the original gift-box art).
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x + size / 2 - ribbon / 2, y + inset + 1, ribbon, inner - 2);
  ctx.fillRect(x + inset + 1, y + size / 2 - ribbon / 2, inner - 2, ribbon);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.roundRect(x + inset + 2, y + inset + 2, inner * 0.35, inner * 0.2, size * 0.08);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, s: GameState, reducedMotion: boolean): void {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = '#fafafc';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  // Board card.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(29, 29, 31, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(BOARD_X - 4, BOARD_Y - 4, BOARD_W + 8, BOARD_H + 8, 14);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
  ctx.clip();

  // Grid lines.
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < TETRIS_COLS; c += 1) {
    ctx.moveTo(BOARD_X + c * CELL + 0.5, BOARD_Y);
    ctx.lineTo(BOARD_X + c * CELL + 0.5, BOARD_Y + BOARD_H);
  }
  for (let r = 1; r < TETRIS_ROWS; r += 1) {
    ctx.moveTo(BOARD_X, BOARD_Y + r * CELL + 0.5);
    ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * CELL + 0.5);
  }
  ctx.stroke();

  // Locked gifts.
  for (let r = 0; r < TETRIS_ROWS; r += 1) {
    for (let c = 0; c < TETRIS_COLS; c += 1) {
      const value = s.grid[r][c];
      if (value) drawGiftBlock(ctx, BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, BLOCK_COLORS[value]);
    }
  }

  // Line-clear flash over the rows that were just cleared.
  if (s.flashAge < FLASH_SEC && s.flashRows.length > 0) {
    const strength = 1 - s.flashAge / FLASH_SEC;
    ctx.save();
    ctx.globalAlpha = strength * (reducedMotion ? 0.35 : 0.85);
    ctx.fillStyle = '#fff7d6';
    for (const row of s.flashRows) {
      ctx.fillRect(BOARD_X, BOARD_Y + row * CELL, BOARD_W, CELL);
    }
    ctx.restore();
  }

  // Ghost + active piece.
  const color = BLOCK_COLORS[PIECE_COLOR_INDEX[s.piece.type]];
  const ghost = hardDropPosition(s.grid, s.piece);
  if (ghost.y !== s.piece.y) {
    for (const [x, y] of pieceCells(ghost)) {
      drawGiftBlock(ctx, BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, color, 0.2);
    }
  }
  for (const [x, y] of pieceCells(s.piece)) {
    drawGiftBlock(ctx, BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, color);
  }
  ctx.restore();

  if (s.flashAge < FLASH_SEC && s.flashRows.length > 0) {
    ctx.save();
    ctx.globalAlpha = 1 - s.flashAge / FLASH_SEC;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(BOARD_X - 4, BOARD_Y - 4, BOARD_W + 8, BOARD_H + 8, 14);
    ctx.stroke();
    ctx.restore();
  }

  drawSidePanel(ctx, s);

  // '+N' popups.
  if (s.popups.length > 0) {
    ctx.save();
    ctx.font = '900 18px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillStyle = '#d70015';
    for (const popup of s.popups) {
      const t = popup.age / POPUP_LIFE_SEC;
      const y = popup.y - (reducedMotion ? 0 : t * POPUP_RISE_PX);
      ctx.globalAlpha = 1 - t;
      ctx.strokeText(popup.text, popup.x, y);
      ctx.fillText(popup.text, popup.x, y);
    }
    ctx.restore();
  }
}

function drawSidePanel(ctx: CanvasRenderingContext2D, s: GameState): void {
  const centerX = SIDE_X + SIDE_W / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(29, 29, 31, 0.55)';
  ctx.font = '800 11px -apple-system, system-ui, sans-serif';
  ctx.fillText('NEXT', centerX, BOARD_Y + 10);

  // Preview card.
  const boxY = BOARD_Y + 18;
  const boxSize = SIDE_W;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(29, 29, 31, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(SIDE_X, boxY, boxSize, boxSize, 12);
  ctx.fill();
  ctx.stroke();

  const nextType = s.queue[0];
  if (nextType) {
    const offsets = shapeOffsets(nextType, 0);
    const xs = offsets.map(([dx]) => dx);
    const ys = offsets.map(([, dy]) => dy);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = (Math.max(...xs) - minX + 1) * PREVIEW_CELL;
    const h = (Math.max(...ys) - minY + 1) * PREVIEW_CELL;
    const originX = SIDE_X + (boxSize - w) / 2;
    const originY = boxY + (boxSize - h) / 2;
    const color = BLOCK_COLORS[PIECE_COLOR_INDEX[nextType]];
    for (const [dx, dy] of offsets) {
      drawGiftBlock(
        ctx,
        originX + (dx - minX) * PREVIEW_CELL,
        originY + (dy - minY) * PREVIEW_CELL,
        PREVIEW_CELL,
        color
      );
    }
  }

  // Lines cleared.
  const linesY = boxY + boxSize + 28;
  ctx.fillStyle = 'rgba(29, 29, 31, 0.55)';
  ctx.font = '800 11px -apple-system, system-ui, sans-serif';
  ctx.fillText('LINES', centerX, linesY);
  ctx.fillStyle = '#1d1d1f';
  ctx.font = '900 22px -apple-system, system-ui, sans-serif';
  ctx.fillText(String(s.lines), centerX, linesY + 24);
  ctx.restore();
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

function isActivatable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && /^(BUTTON|A|SUMMARY)$/.test(target.tagName);
}

/**
 * Block Stack — Christmas gift Tetris playfield. The shared GameShell owns the countdown,
 * HUD, lives, time cap and results; this component owns only the board, canvas and controls.
 */
export function ChristmasTetris({ api }: PlayfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef(api);
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = createGameState();
  const gestureRef = useRef<Gesture | null>(null);
  const repeatRef = useRef<{ timeout: number; interval: number }>({ timeout: 0, interval: 0 });

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const act = (action: Action): void => {
    const s = stateRef.current;
    const liveApi = apiRef.current;
    if (!s || !liveApi.isLive()) return;
    applyAction(s, liveApi, action);
  };

  const stopRepeat = (): void => {
    window.clearTimeout(repeatRef.current.timeout);
    window.clearInterval(repeatRef.current.interval);
    repeatRef.current = { timeout: 0, interval: 0 };
  };

  // Main loop: one rAF for simulation + drawing; simulation freezes while the shell isn't live.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedMotionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    reducedMotionQuery.addEventListener('change', onMotionChange);

    let dpr = 0;
    const syncCanvasSize = () => {
      const nextDpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
      if (nextDpr === dpr) return;
      dpr = nextDpr;
      canvas.width = Math.round(STAGE_W * dpr);
      canvas.height = Math.round(STAGE_H * dpr);
    };

    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(MAX_DT_SEC, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;
      const s = stateRef.current;
      const liveApi = apiRef.current;
      if (s) {
        if (liveApi.isLive()) stepSimulation(s, liveApi, dt);
        stepEffects(s, dt);
        syncCanvasSize();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(ctx, s, reducedMotion);
      }
      rafId = requestAnimationFrame(tick);
    };

    syncCanvasSize();
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      reducedMotionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  // Keyboard controls while mounted.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTextEntry(e.target)) return;

      let action: Action | null = null;
      let allowRepeat = true;
      switch (e.key) {
        case 'ArrowLeft':
          action = 'left';
          break;
        case 'ArrowRight':
          action = 'right';
          break;
        case 'ArrowDown':
          action = 'softDrop';
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          action = 'rotate';
          allowRepeat = false;
          break;
        case 'z':
        case 'Z':
          action = 'rotateBack';
          allowRepeat = false;
          break;
        case ' ':
        case 'Spacebar':
          // Let Space activate a focused button (e.g. a pad button or the shell's controls).
          if (isActivatable(e.target)) return;
          action = 'hardDrop';
          allowRepeat = false;
          break;
        default:
          return;
      }

      if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
      if (e.repeat && !allowRepeat) return;
      act(action);
    };

    const onBlur = () => stopRepeat();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      stopRepeat();
    };
    // `act`/`stopRepeat` only read refs, so binding them once on mount is safe.
  }, []);

  // ── Canvas gestures: drag = move by column, tap = rotate, fast downward swipe = hard drop ──
  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (!apiRef.current.isLive()) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail if the pointer is already gone; the gesture still works without it.
    }
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      startTime: e.timeStamp,
      moved: false,
    };
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cellPx = (rect.width / STAGE_W) * CELL;
    const stepPx = Math.max(12, cellPx * DRAG_STEP_CELLS);
    const dx = e.clientX - g.lastX;
    const steps = Math.trunc(dx / stepPx);
    if (steps !== 0) {
      const action: Action = steps > 0 ? 'right' : 'left';
      for (let i = 0; i < Math.abs(steps); i += 1) act(action);
      g.lastX += steps * stepPx;
      g.moved = true;
    }
    if (Math.abs(e.clientY - g.startY) > TAP_MAX_PX) g.moved = true;
  };

  const onCanvasPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const elapsedMs = Math.max(1, e.timeStamp - g.startTime);
    if (dy >= SWIPE_MIN_PX && dy > Math.abs(dx) * 1.2 && dy / elapsedMs >= SWIPE_MIN_SPEED) {
      act('hardDrop');
    } else if (
      !g.moved &&
      Math.abs(dx) <= TAP_MAX_PX &&
      Math.abs(dy) <= TAP_MAX_PX &&
      elapsedMs <= TAP_MAX_MS
    ) {
      act('rotate');
    }
  };

  const onCanvasPointerCancel = () => {
    gestureRef.current = null;
  };

  // ── Pad: act on pointerdown for responsiveness (with hold-to-repeat for moves);
  //    keyboard activation (Enter/Space on a focused button) arrives as a click with detail 0. ──
  const padHandlers = (action: Action, repeat: boolean) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stopRepeat();
      act(action);
      if (repeat) {
        repeatRef.current.timeout = window.setTimeout(() => {
          repeatRef.current.interval = window.setInterval(() => act(action), PAD_REPEAT_INTERVAL_MS);
        }, PAD_REPEAT_DELAY_MS);
      }
    },
    onPointerUp: stopRepeat,
    onPointerCancel: stopRepeat,
    onPointerLeave: stopRepeat,
    // Keep focus off the pad for mouse/touch so Space still hard-drops afterwards.
    onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) => e.preventDefault(),
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) act(action);
    },
  });

  return (
    <>
      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          role="img"
          aria-label={CANVAS_LABEL}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerCancel}
          onLostPointerCapture={onCanvasPointerCancel}
        />
      </div>

      <div className="arcade-pad" role="group" aria-label="Block Stack controls">
        <button type="button" className="arcade-pad__btn" aria-label="Move left" {...padHandlers('left', true)}>
          ◀
        </button>
        <button type="button" className="arcade-pad__btn" aria-label="Rotate" {...padHandlers('rotate', false)}>
          ⟳
        </button>
        <button type="button" className="arcade-pad__btn" aria-label="Move right" {...padHandlers('right', true)}>
          ▶
        </button>
        <button
          type="button"
          className="arcade-pad__btn arcade-pad__btn--action"
          aria-label="Hard drop"
          {...padHandlers('hardDrop', false)}
        >
          ⤓ Drop
        </button>
      </div>
    </>
  );
}

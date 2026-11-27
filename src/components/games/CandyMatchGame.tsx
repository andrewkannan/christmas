import { useEffect, useRef } from 'react';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { createRng, randomSeed, type Rng } from '../../games/rng.ts';
import {
  CANDY_COLS,
  CANDY_ROWS,
  createBoard,
  findFirstValidMove,
  isAdjacent,
  isInBounds,
  isValidSwap,
  resolveBoard,
  swapCells,
  type Board,
  type Candy,
  type Pos,
  type ResolveResult,
} from '../../games/candyLogic.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

// ---------------------------------------------------------------------------------------------
// Layout (logical canvas units; the canvas is scaled to its CSS size × devicePixelRatio)
// ---------------------------------------------------------------------------------------------

const VIEW_W = 360;
const VIEW_H = 480;
const CELL = 54;
const BOARD_W = CELL * CANDY_COLS;
const BOARD_H = CELL * CANDY_ROWS;
const BOARD_X = (VIEW_W - BOARD_W) / 2;
const BOARD_Y = (VIEW_H - BOARD_H) / 2;
const MAX_DPR = 2;
const MAX_DT = 0.05;
const HINT_DELAY_SEC = 3;
/** Pointer travel (logical px) that turns a press into a drag-swap. */
const DRAG_THRESHOLD = CELL * 0.35;

interface Timings {
  swap: number;
  clear: number;
  fall: number;
  reshuffle: number;
  popup: number;
  combo: number;
  /** Bouncy/pulsing motion allowed (false under prefers-reduced-motion). */
  motion: boolean;
}

const NORMAL_TIMINGS: Timings = { swap: 0.13, clear: 0.2, fall: 0.21, reshuffle: 0.34, popup: 0.95, combo: 1.2, motion: true };
const REDUCED_TIMINGS: Timings = { swap: 0.08, clear: 0.14, fall: 0.14, reshuffle: 0.2, popup: 0.95, combo: 1.2, motion: false };

/** The five Christmas candies — each has a distinct colour AND shape (colour-blind friendly). */
const CANDY_STYLES = [
  { label: 'Peppermint', bg: '#ffe4e6', border: '#e11d48' },
  { label: 'Gold Star', bg: '#fef3c7', border: '#d97706' },
  { label: 'Pine Jelly', bg: '#dcfce7', border: '#15803d' },
  { label: 'Jingle Bell', bg: '#f3e8ff', border: '#9333ea' },
  { label: 'Ice Gem', bg: '#e0f2fe', border: '#0284c7' },
] as const;

const ARROW_DIRS: Record<string, Pos> = {
  ArrowUp: { r: -1, c: 0 },
  ArrowDown: { r: 1, c: 0 },
  ArrowLeft: { r: 0, c: -1 },
  ArrowRight: { r: 0, c: 1 },
};

const CANVAS_LABEL =
  'Candy Match board: a 6 by 6 grid of Christmas candies. Tap two neighbouring candies or drag one to swap them and line up 3 or more. ' +
  'Match 4 for a Striped Row/Column Blaster, L/T for a Wrapped Gift Bomb, or 5 for a Rainbow Color Star! ' +
  'Keyboard: arrow keys move the cursor, Enter or Space selects, then an arrow key swaps in that direction.';

// ---------------------------------------------------------------------------------------------
// Easing / geometry helpers
// ---------------------------------------------------------------------------------------------

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeIn = (t: number) => t * t;
const cellX = (c: number) => BOARD_X + c * CELL + CELL / 2;
const cellY = (r: number) => BOARD_Y + r * CELL + CELL / 2;
const samePos = (a: Pos | null, b: Pos | null) => !!a && !!b && a.r === b.r && a.c === b.c;
const posKey = (p: Pos) => p.r * CANDY_COLS + p.c;

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------------------------
// Candy sprites (vector-drawn once per kind/special at the current pixel scale, then blitted)
// ---------------------------------------------------------------------------------------------

/** Draws one candy into a CELL×CELL logical box at the origin. */
function paintCandy(ctx: CanvasRenderingContext2D, candy: Candy): void {
  const style = CANDY_STYLES[candy.kind] ?? CANDY_STYLES[0];
  const mid = CELL / 2;

  roundedRectPath(ctx, 3, 3, CELL - 6, CELL - 6, 12);
  ctx.fillStyle = candy.special === 'star' ? '#1e1b4b' : style.bg;
  ctx.fill();
  ctx.lineWidth = candy.special === 'none' ? 2 : 2.6;
  ctx.strokeStyle = candy.special === 'star' ? '#fbbf24' : candy.special === 'bomb' ? '#d97706' : style.border;
  ctx.stroke();

  ctx.lineJoin = 'round';
  switch (candy.kind) {
    case 0: {
      // Peppermint: wrapped swirl.
      const R = 13;
      ctx.fillStyle = '#e11d48';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(mid + side * (R - 2), mid);
        ctx.lineTo(mid + side * (R + 8), mid - 6);
        ctx.lineTo(mid + side * (R + 8), mid + 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(mid, mid, R, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#e11d48';
      for (let i = 0; i < 8; i += 2) {
        const a0 = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(mid, mid);
        ctx.arc(mid, mid, R, a0, a0 + Math.PI / 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(mid, mid, R, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#9f1239';
      ctx.stroke();
      break;
    }
    case 1: {
      // Gold star.
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 17 : 7.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = mid + Math.cos(a) * radius;
        const y = mid + 1.5 + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#b45309';
      ctx.stroke();
      break;
    }
    case 2: {
      // Pine tree.
      ctx.fillStyle = '#92400e';
      ctx.fillRect(mid - 3, 36, 6, 7);
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.5;
      for (const [apex, base, half] of [
        [17, 37, 15],
        [9, 26, 11],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(mid, apex);
        ctx.lineTo(mid + half, base);
        ctx.lineTo(mid - half, base);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mid - 5, 31, 2, 0, Math.PI * 2);
      ctx.arc(mid + 6, 22, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 3: {
      // Jingle bell.
      ctx.beginPath();
      ctx.moveTo(13, 36);
      ctx.quadraticCurveTo(17, 32, 17.5, 23);
      ctx.bezierCurveTo(18, 11, 36, 11, 36.5, 23);
      ctx.quadraticCurveTo(37, 32, 41, 36);
      ctx.closePath();
      ctx.fillStyle = '#c084fc';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#6b21a8';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mid, 39, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#6b21a8';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mid, 11, 2.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    default: {
      // Ice gem: faceted diamond.
      ctx.beginPath();
      ctx.moveTo(15, 21);
      ctx.lineTo(21, 13);
      ctx.lineTo(33, 13);
      ctx.lineTo(39, 21);
      ctx.lineTo(mid, 42);
      ctx.closePath();
      ctx.fillStyle = '#7dd3fc';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#075985';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(15, 21);
      ctx.lineTo(39, 21);
      ctx.moveTo(21, 13);
      ctx.lineTo(24, 21);
      ctx.lineTo(mid, 42);
      ctx.moveTo(33, 13);
      ctx.lineTo(30, 21);
      ctx.lineTo(mid, 42);
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
  }

  if (candy.special === 'row') {
    // Horizontal Striped Blaster: bright horizontal double arrow across the candy.
    roundedRectPath(ctx, 7, mid - 3.5, CELL - 14, 7, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#b45309';
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(mid + side * 24, mid);
      ctx.lineTo(mid + side * 16, mid - 7);
      ctx.lineTo(mid + side * 16, mid + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (candy.special === 'col') {
    // Vertical Striped Blaster: bright vertical double arrow across the candy.
    roundedRectPath(ctx, mid - 3.5, 7, 7, CELL - 14, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#b45309';
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(mid, mid + side * 24);
      ctx.lineTo(mid - 7, mid + side * 16);
      ctx.lineTo(mid + 7, mid + side * 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (candy.special === 'bomb') {
    // Wrapped Gift Bomb: golden cross-ribbon frame + pulsing corner bow badge.
    ctx.save();
    roundedRectPath(ctx, 4.5, 4.5, CELL - 9, CELL - 9, 10);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.88)';
    ctx.fillRect(mid - 2.5, 4, 5, CELL - 8);
    ctx.fillRect(4, mid - 2.5, CELL - 8, 5);
    // Corner bomb badge
    ctx.beginPath();
    ctx.arc(CELL - 11, 11, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#be123c';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fde68a';
    ctx.stroke();
    ctx.fillStyle = '#fffbeb';
    ctx.font = '800 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3×3', CELL - 11, 11.5);
    ctx.restore();
  } else if (candy.special === 'star') {
    // Rainbow Color Star: multi-color sprinkle segments + glowing gold star core.
    const ringColors = ['#e11d48', '#fbbf24', '#22c55e', '#38bdf8', '#c084fc', '#fb7185'];
    for (let i = 0; i < ringColors.length; i++) {
      const a = (i * Math.PI * 2) / ringColors.length;
      const sx = mid + Math.cos(a) * 16;
      const sy = mid + Math.sin(a) * 16;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = ringColors[i];
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? 13 : 6;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = mid + Math.cos(a) * radius;
      const y = mid + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}

class SpriteCache {
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private scale = 1;

  setScale(scale: number): void {
    if (scale !== this.scale) {
      this.scale = scale;
      this.sprites.clear();
    }
  }

  get(candy: Candy): HTMLCanvasElement {
    const id = `${candy.kind}:${candy.special}`;
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = document.createElement('canvas');
      const px = Math.max(1, Math.ceil(CELL * this.scale));
      sprite.width = px;
      sprite.height = px;
      const sctx = sprite.getContext('2d');
      if (sctx) {
        sctx.scale(px / CELL, px / CELL);
        paintCandy(sctx, candy);
      }
      this.sprites.set(id, sprite);
    }
    return sprite;
  }
}

// ---------------------------------------------------------------------------------------------
// Controller: all game/animation state lives here (mutated from rAF and input; never React state)
// ---------------------------------------------------------------------------------------------

type Phase =
  | { kind: 'idle' }
  | { kind: 'swap'; a: Pos; b: Pos; t: number; returning: boolean; result: ResolveResult | null }
  | { kind: 'clear'; result: ResolveResult; index: number; t: number }
  | { kind: 'fall'; result: ResolveResult; index: number; t: number }
  | { kind: 'reshuffle'; from: Board; result: ResolveResult; t: number };

interface Popup {
  x: number;
  y: number;
  text: string;
  age: number;
}

interface DragState {
  pointerId: number;
  cell: Pos;
  x: number;
  y: number;
  consumed: boolean;
}

interface ControllerDeps {
  getApi: () => PlayfieldApi;
  announce: (message: string) => void;
  rng: Rng;
  reducedMotion: boolean;
}

class CandyController {
  private board: Board;
  private phase: Phase = { kind: 'idle' };
  private hint: [Pos, Pos] | null;
  private idleSec = 0;
  private clock = 0;
  private selected: Pos | null = null;
  private cursor: Pos = { r: 0, c: 0 };
  private drag: DragState | null = null;
  private popups: Popup[] = [];
  private combo: { text: string; age: number } | null = null;
  private timings: Timings;
  keyboardActive = false;
  focused = false;

  constructor(private readonly deps: ControllerDeps) {
    this.board = createBoard(deps.rng);
    this.hint = findFirstValidMove(this.board);
    this.timings = deps.reducedMotion ? REDUCED_TIMINGS : NORMAL_TIMINGS;
  }

  setReducedMotion(reduced: boolean): void {
    this.timings = reduced ? REDUCED_TIMINGS : NORMAL_TIMINGS;
  }

  // ----- input -----

  pointerDown(pointerId: number, x: number, y: number): boolean {
    if (!this.deps.getApi().isLive()) return false;
    this.keyboardActive = false;
    this.idleSec = 0;
    const cell = cellAt(x, y);
    if (!cell) {
      this.selected = null;
      return false;
    }
    this.drag = { pointerId, cell, x, y, consumed: false };
    return true;
  }

  pointerMove(pointerId: number, x: number, y: number): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== pointerId || drag.consumed) return;
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.consumed = true;
    const dir = Math.abs(dx) > Math.abs(dy) ? { r: 0, c: Math.sign(dx) } : { r: Math.sign(dy), c: 0 };
    const target = { r: drag.cell.r + dir.r, c: drag.cell.c + dir.c };
    if (isInBounds(target)) this.attemptSwap(drag.cell, target);
  }

  pointerUp(pointerId: number): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== pointerId) return;
    this.drag = null;
    if (!drag.consumed) this.tapCell(drag.cell);
  }

  pointerCancel(): void {
    this.drag = null;
  }

  /** Returns true when the key was handled (caller should preventDefault). */
  keyDown(key: string): boolean {
    const dir = ARROW_DIRS[key];
    const isSelectKey = key === 'Enter' || key === ' ' || key === 'Spacebar';
    if (!dir && !isSelectKey && key !== 'Escape') return false;
    if (!this.deps.getApi().isLive()) return true;
    this.keyboardActive = true;
    this.idleSec = 0;

    if (key === 'Escape') {
      if (this.selected) {
        this.selected = null;
        this.deps.announce('Selection cleared.');
      }
      return true;
    }
    if (isSelectKey) {
      this.tapCell(this.cursor);
      return true;
    }
    if (this.selected) {
      const from = this.selected;
      const target = { r: from.r + dir.r, c: from.c + dir.c };
      if (!isInBounds(target)) {
        this.deps.announce('Edge of the board.');
        return true;
      }
      if (this.attemptSwap(from, target) === 'valid') this.cursor = target;
      return true;
    }
    const next = {
      r: Math.min(CANDY_ROWS - 1, Math.max(0, this.cursor.r + dir.r)),
      c: Math.min(CANDY_COLS - 1, Math.max(0, this.cursor.c + dir.c)),
    };
    this.cursor = next;
    this.deps.announce(this.describeCell(next));
    return true;
  }

  private tapCell(p: Pos): void {
    if (!this.deps.getApi().isLive() || this.phase.kind !== 'idle') return;
    this.cursor = p;
    const selected = this.selected;
    if (!selected) {
      this.selected = p;
      playArcadeTone('tap');
      this.deps.announce(`${this.describeCell(p)}, selected. Choose a neighbour to swap.`);
    } else if (samePos(selected, p)) {
      this.selected = null;
      this.deps.announce('Selection cleared.');
    } else if (isAdjacent(selected, p)) {
      this.attemptSwap(selected, p);
    } else {
      this.selected = p;
      playArcadeTone('tap');
      this.deps.announce(`${this.describeCell(p)}, selected.`);
    }
  }

  private attemptSwap(a: Pos, b: Pos): 'valid' | 'invalid' | 'ignored' {
    const api = this.deps.getApi();
    if (!api.isLive() || this.phase.kind !== 'idle') return 'ignored';
    const moves = api.movesLeft();
    if (moves !== null && moves <= 0) return 'ignored';
    if (!isInBounds(a) || !isInBounds(b) || !isAdjacent(a, b)) return 'ignored';

    this.selected = null;
    this.idleSec = 0;
    if (isValidSwap(this.board, a, b)) {
      api.spendMove();
      // Prefer placing any special candy where the player's candy landed.
      const result = resolveBoard(swapCells(this.board, a, b), this.deps.rng, [b, a]);
      this.phase = { kind: 'swap', a, b, t: 0, returning: false, result };
      return 'valid';
    }
    this.phase = { kind: 'swap', a, b, t: 0, returning: false, result: null };
    playArcadeTone('hit');
    triggerHaptic(12);
    this.deps.announce('No match, candies swapped back. No move used.');
    return 'invalid';
  }

  private describeCell(p: Pos): string {
    const candy = this.board[p.r][p.c];
    const name = CANDY_STYLES[candy.kind]?.label ?? 'Candy';
    const specialName =
      candy.special === 'row'
        ? ' row blaster'
        : candy.special === 'col'
          ? ' column blaster'
          : candy.special === 'bomb'
            ? ' gift bomb'
            : candy.special === 'star'
              ? ' rainbow star'
              : '';
    return `Row ${p.r + 1}, column ${p.c + 1}: ${name}${specialName}`;
  }

  // ----- simulation -----

  update(dt: number): void {
    this.clock += dt;
    // Cosmetic overlays keep fading even when the round is paused/over.
    for (const popup of this.popups) popup.age += dt;
    this.popups = this.popups.filter((p) => p.age < this.timings.popup);
    if (this.combo) {
      this.combo.age += dt;
      if (this.combo.age >= this.timings.combo) this.combo = null;
    }

    if (!this.deps.getApi().isLive()) return;

    const phase = this.phase;
    switch (phase.kind) {
      case 'idle':
        if (!this.drag) this.idleSec += dt;
        break;
      case 'swap':
        phase.t += dt / this.timings.swap;
        if (phase.t < 1) break;
        if (phase.result) {
          this.board = swapCells(this.board, phase.a, phase.b);
          this.startStep(phase.result, 0);
        } else if (!phase.returning) {
          phase.returning = true;
          phase.t = 0;
        } else {
          this.phase = { kind: 'idle' };
        }
        break;
      case 'clear':
        phase.t += dt / this.timings.clear;
        if (phase.t >= 1) this.phase = { kind: 'fall', result: phase.result, index: phase.index, t: 0 };
        break;
      case 'fall': {
        phase.t += dt / this.timings.fall;
        if (phase.t < 1) break;
        const { result, index } = phase;
        this.board = result.steps[index].after;
        if (index + 1 < result.steps.length) {
          this.startStep(result, index + 1);
        } else if (result.reshuffled) {
          this.phase = { kind: 'reshuffle', from: this.board, result, t: 0 };
          this.deps.announce('No moves left, candies reshuffled.');
        } else {
          this.settle(result.board);
        }
        break;
      }
      case 'reshuffle':
        phase.t += dt / this.timings.reshuffle;
        if (phase.t >= 1) this.settle(phase.result.board);
        break;
    }
  }

  private startStep(result: ResolveResult, index: number): void {
    const step = result.steps[index];
    if (!step) {
      this.settle(result.board);
      return;
    }
    const api = this.deps.getApi();
    api.addScore(step.points);

    const n = Math.max(1, step.cleared.length);
    const cx = step.cleared.reduce((sum, p) => sum + cellX(p.c), 0) / n;
    const cy = step.cleared.reduce((sum, p) => sum + cellY(p.r), 0) / n;
    this.popups.push({ x: cx, y: cy, text: `+${step.points}`, age: 0 });

    const specialFired =
      step.blastRows.length > 0 ||
      step.blastCols.length > 0 ||
      step.blastBombs.length > 0 ||
      step.blastStars.length > 0;
    const specialCreated = step.created.length > 0;

    if (step.blastStars.length > 0 || step.level >= 4 || step.points >= 250) {
      this.combo = { text: `SUGAR CRUSH! 💥 ×${step.level}`, age: 0 };
    } else if (step.level >= 3 || step.blastBombs.length > 0 || step.points >= 140) {
      this.combo = { text: `DIVINE! 👑 ×${step.level}`, age: 0 };
    } else if (step.level >= 2 || specialFired) {
      this.combo = { text: `TASTY! 🍬 ×${step.level}`, age: 0 };
    } else if (specialCreated || step.cleared.length >= 4) {
      this.combo = { text: 'SWEET! ✨', age: 0 };
    }

    playArcadeTone(specialFired || specialCreated || step.level >= 2 ? 'star' : 'pickup');
    triggerHaptic(specialFired ? 30 : specialCreated ? 22 : 14);

    const parts = [`Plus ${step.points}`];
    if (step.level >= 2) parts.push(`combo times ${step.level}`);
    if (specialCreated) parts.push('bonus candy created');
    if (specialFired) parts.push('power-up blasted');
    this.deps.announce(`${parts.join(', ')}.`);

    this.phase = { kind: 'clear', result, index, t: 0 };
  }

  private settle(board: Board): void {
    this.board = board;
    this.phase = { kind: 'idle' };
    this.hint = findFirstValidMove(board);
    this.idleSec = 0;
    const api = this.deps.getApi();
    if (api.movesLeft() === 0) api.endRound('moves');
  }

  // ----- rendering -----

  draw(ctx: CanvasRenderingContext2D, sprites: SpriteCache, font: string): void {
    const motion = this.timings.motion;

    const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    bg.addColorStop(0, '#fff7ed');
    bg.addColorStop(1, '#fef2f2');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    roundedRectPath(ctx, BOARD_X - 6, BOARD_Y - 6, BOARD_W + 12, BOARD_H + 12, 18);
    ctx.fillStyle = '#fffbeb';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
    ctx.stroke();

    const drawCandy = (candy: Candy, x: number, y: number, scale = 1, alpha = 1) => {
      if (alpha <= 0 || scale <= 0) return;
      const size = CELL * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprites.get(candy), x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = 1;
    };
    const drawBoard = (board: Board, skip?: (r: number, c: number) => boolean) => {
      for (let r = 0; r < CANDY_ROWS; r++) {
        for (let c = 0; c < CANDY_COLS; c++) {
          if (skip?.(r, c)) continue;
          drawCandy(board[r][c], cellX(c), cellY(r));
        }
      }
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.clip();

    const phase = this.phase;
    switch (phase.kind) {
      case 'idle':
        drawBoard(this.board);
        break;
      case 'swap': {
        const { a, b } = phase;
        const e = phase.returning ? 1 - easeInOut(clamp01(phase.t)) : easeInOut(clamp01(phase.t));
        drawBoard(this.board, (r, c) => (r === a.r && c === a.c) || (r === b.r && c === b.c));
        drawCandy(this.board[b.r][b.c], cellX(b.c) + (cellX(a.c) - cellX(b.c)) * e, cellY(b.r) + (cellY(a.r) - cellY(b.r)) * e);
        drawCandy(this.board[a.r][a.c], cellX(a.c) + (cellX(b.c) - cellX(a.c)) * e, cellY(a.r) + (cellY(b.r) - cellY(a.r)) * e);
        break;
      }
      case 'clear': {
        const step = phase.result.steps[phase.index];
        const t = clamp01(phase.t);
        const clearedKeys = new Set(step.cleared.map(posKey));
        const createdByKey = new Map(step.created.map((entry) => [posKey(entry.pos), entry.candy]));
        for (let r = 0; r < CANDY_ROWS; r++) {
          for (let c = 0; c < CANDY_COLS; c++) {
            const k = r * CANDY_COLS + c;
            const created = createdByKey.get(k);
            if (clearedKeys.has(k)) {
              drawCandy(step.before[r][c], cellX(c), cellY(r), motion ? 1 - 0.65 * t : 1, 1 - t);
            } else if (created) {
              const pop = motion ? 1 + 0.22 * Math.sin(Math.PI * t) : 1;
              drawCandy(t < 0.45 ? step.before[r][c] : created, cellX(c), cellY(r), pop);
            } else {
              drawCandy(step.before[r][c], cellX(c), cellY(r));
            }
          }
        }
        // Horizontal row laser beams
        for (const row of step.blastRows) {
          const beamH = CELL * (motion ? 0.55 + 0.55 * t : 0.8);
          const beam = ctx.createLinearGradient(0, cellY(row) - beamH / 2, 0, cellY(row) + beamH / 2);
          beam.addColorStop(0, 'rgba(251,191,36,0)');
          beam.addColorStop(0.5, 'rgba(255,251,235,0.96)');
          beam.addColorStop(1, 'rgba(251,191,36,0)');
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = beam;
          ctx.fillRect(BOARD_X, cellY(row) - beamH / 2, BOARD_W, beamH);
          ctx.globalAlpha = 1;
        }
        // Vertical column laser beams
        for (const col of step.blastCols) {
          const beamW = CELL * (motion ? 0.55 + 0.55 * t : 0.8);
          const beam = ctx.createLinearGradient(cellX(col) - beamW / 2, 0, cellX(col) + beamW / 2, 0);
          beam.addColorStop(0, 'rgba(251,191,36,0)');
          beam.addColorStop(0.5, 'rgba(255,251,235,0.96)');
          beam.addColorStop(1, 'rgba(251,191,36,0)');
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = beam;
          ctx.fillRect(cellX(col) - beamW / 2, BOARD_Y, beamW, BOARD_H);
          ctx.globalAlpha = 1;
        }
        // 3x3 Wrapped Gift Bomb shockwaves
        for (const bomb of step.blastBombs) {
          const bx = cellX(bomb.c);
          const by = cellY(bomb.r);
          const radius = CELL * (0.6 + 1.35 * t);
          ctx.save();
          ctx.globalAlpha = 1 - t;
          const grad = ctx.createRadialGradient(bx, by, radius * 0.15, bx, by, radius);
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
          grad.addColorStop(0.6, 'rgba(249, 115, 22, 0.65)');
          grad.addColorStop(1, 'rgba(225, 29, 72, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Rainbow Color Star lightning rays to all cleared candies
        for (const star of step.blastStars) {
          const sx = cellX(star.c);
          const sy = cellY(star.r);
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#fde047';
          for (const target of step.cleared) {
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(cellX(target.c), cellY(target.r));
            ctx.stroke();
          }
          ctx.restore();
        }
        break;
      }
      case 'fall': {
        const step = phase.result.steps[phase.index];
        const p = clamp01(phase.t);
        const landAt = motion ? 0.8 : 1;
        const progress = easeIn(clamp01(p / landAt));
        const bounce = motion && p > landAt ? -Math.sin(((p - landAt) / (1 - landAt)) * Math.PI) * CELL * 0.07 : 0;
        for (let r = 0; r < CANDY_ROWS; r++) {
          for (let c = 0; c < CANDY_COLS; c++) {
            const from = step.fallFrom[r][c];
            const y = from === r ? cellY(r) : cellY(from) + (cellY(r) - cellY(from)) * progress + bounce;
            drawCandy(step.after[r][c], cellX(c), y);
          }
        }
        break;
      }
      case 'reshuffle': {
        const t = clamp01(phase.t);
        const outgoing = t < 0.5;
        const k = outgoing ? 1 - t * 2 : (t - 0.5) * 2;
        const board = outgoing ? phase.from : phase.result.board;
        for (let r = 0; r < CANDY_ROWS; r++) {
          for (let c = 0; c < CANDY_COLS; c++) {
            drawCandy(board[r][c], cellX(c), cellY(r), motion ? 0.4 + 0.6 * k : 1, k);
          }
        }
        break;
      }
    }
    ctx.restore();

    const live = this.deps.getApi().isLive();
    const ring = (p: Pos, color: string, width: number, dash: number[] = []) => {
      roundedRectPath(ctx, BOARD_X + p.c * CELL + 1.5, BOARD_Y + p.r * CELL + 1.5, CELL - 3, CELL - 3, 13);
      ctx.setLineDash(dash);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (phase.kind === 'idle') {
      // Idle hint: gently pulse the first valid move.
      if (live && this.hint && this.idleSec >= HINT_DELAY_SEC && !this.selected) {
        const wave = 0.5 + 0.5 * Math.sin(this.clock * 5);
        for (const p of this.hint) {
          if (motion) drawCandy(this.board[p.r][p.c], cellX(p.c), cellY(p.r), 1 + 0.06 * wave);
          ctx.globalAlpha = motion ? 0.45 + 0.55 * wave : 0.9;
          ring(p, '#f59e0b', 3);
          ctx.globalAlpha = 1;
        }
      }
      const active = this.selected ?? (this.drag && !this.drag.consumed ? this.drag.cell : null);
      if (active) {
        drawCandy(this.board[active.r][active.c], cellX(active.c), cellY(active.r), 1.08);
        ring(active, '#1d1d1f', 3);
      }
    }

    if (this.keyboardActive && this.focused) {
      ring(this.cursor, '#ffffff', 5);
      ring(this.cursor, '#0f172a', 2.5, [5, 4]);
    }

    // Labels above / below the board.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (this.combo) {
      const { age } = this.combo;
      const fadeStart = this.timings.combo * 0.6;
      const alpha = age < fadeStart ? 1 : 1 - (age - fadeStart) / (this.timings.combo - fadeStart);
      const scale = motion ? 1 + 0.28 * Math.max(0, 1 - age * 6) : 1;
      ctx.save();
      ctx.translate(VIEW_W / 2, BOARD_Y - 36);
      ctx.scale(scale, scale);
      ctx.globalAlpha = clamp01(alpha);
      ctx.font = `900 24px ${font}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(this.combo.text, 0, 0);
      ctx.fillStyle = '#b91c1c';
      ctx.fillText(this.combo.text, 0, 0);
      ctx.restore();
    } else {
      ctx.font = `700 13.5px ${font}`;
      ctx.fillStyle = '#7c2d12';
      ctx.fillText('12 Quick Moves · Big Combos Drop Bonus Bombs!', VIEW_W / 2, BOARD_Y - 36);
    }
    ctx.font = `600 12.5px ${font}`;
    ctx.fillStyle = '#92400e';
    ctx.fillText('4 = Row/Col Blaster · L/T = 3×3 Gift Bomb · 5 = Rainbow Star', VIEW_W / 2, BOARD_Y + BOARD_H + 36);

    for (const popup of this.popups) {
      const k = popup.age / this.timings.popup;
      const y = popup.y - (motion ? popup.age * 38 : 0);
      ctx.globalAlpha = clamp01(1 - k);
      ctx.font = `900 22px ${font}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(popup.text, popup.x, y);
      ctx.fillStyle = '#be123c';
      ctx.fillText(popup.text, popup.x, y);
    }
    ctx.globalAlpha = 1;
  }
}

function cellAt(x: number, y: number): Pos | null {
  const p = { r: Math.floor((y - BOARD_Y) / CELL), c: Math.floor((x - BOARD_X) / CELL) };
  return isInBounds(p) ? p : null;
}

// ---------------------------------------------------------------------------------------------
// Component (playfield only — the shared GameShell owns HUD, countdown, timer and results)
// ---------------------------------------------------------------------------------------------

export function CandyMatchGame({ api }: PlayfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRegionRef = useRef<HTMLParagraphElement>(null);
  const apiRef = useRef(api);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const controller = new CandyController({
      getApi: () => apiRef.current,
      announce: (message) => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = message;
      },
      rng: createRng(randomSeed()),
      reducedMotion: motionQuery?.matches ?? false,
    });
    const sprites = new SpriteCache();
    const font = getComputedStyle(canvas).fontFamily || 'system-ui, sans-serif';

    let scaleX = 1;
    let scaleY = 1;
    const resize = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth || VIEW_W;
      const cssH = canvas.clientHeight || VIEW_H;
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      scaleX = w / VIEW_W;
      scaleY = h / VIEW_H;
      sprites.setScale(Math.max(scaleX, scaleY));
    };
    resize();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', resize);

    const toLogical = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / (rect.width || 1)) * VIEW_W,
        y: ((e.clientY - rect.top) / (rect.height || 1)) * VIEW_H,
      };
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const { x, y } = toLogical(e);
      if (controller.pointerDown(e.pointerId, x, y)) {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // Capture is best-effort (e.g. pointer already released).
        }
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const { x, y } = toLogical(e);
      controller.pointerMove(e.pointerId, x, y);
    };
    const onPointerUp = (e: PointerEvent) => controller.pointerUp(e.pointerId);
    const onPointerCancel = () => controller.pointerCancel();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (controller.keyDown(e.key)) e.preventDefault();
    };
    const onFocus = () => {
      controller.focused = true;
      try {
        if (canvas.matches(':focus-visible')) controller.keyboardActive = true;
      } catch {
        // :focus-visible unsupported — the cursor appears on the first arrow key instead.
      }
    };
    const onBlur = () => {
      controller.focused = false;
      controller.pointerCancel();
    };
    const onMotionChange = (e: MediaQueryListEvent) => controller.setReducedMotion(e.matches);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('lostpointercapture', onPointerCancel);
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('focus', onFocus);
    canvas.addEventListener('blur', onBlur);
    motionQuery?.addEventListener?.('change', onMotionChange);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
      last = now;
      controller.update(dt);
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      controller.draw(ctx, sprites, font);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('lostpointercapture', onPointerCancel);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('focus', onFocus);
      canvas.removeEventListener('blur', onBlur);
      motionQuery?.removeEventListener?.('change', onMotionChange);
    };
  }, []);

  return (
    <div className="game-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={VIEW_W}
        height={VIEW_H}
        role="img"
        aria-label={CANVAS_LABEL}
        tabIndex={0}
      />
      <p ref={liveRegionRef} className="visually-hidden" aria-live="polite" />
    </div>
  );
}

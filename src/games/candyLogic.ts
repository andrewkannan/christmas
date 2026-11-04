import { randInt, type Rng } from './rng.ts';

/**
 * Pure Candy Match rules — no DOM, no Math.random (every random choice comes from the injected Rng),
 * so boards and cascades are reproducible from a seed and can be property-tested.
 *
 * Coordinates: boards are indexed `[row][col]`, row 0 is the TOP row; gravity pulls towards higher rows.
 */

export const CANDY_ROWS = 6;
export const CANDY_COLS = 6;
export const CANDY_KINDS = 5;

/** Shortest run that clears. */
export const MIN_MATCH = 3;
/** A run at least this long leaves a 'row' sparkler behind. */
export const SPARKLER_RUN = 4;
/**
 * Safety valve: refills are random, so a cascade could in theory go on for a long time.
 * After this many steps the board is regenerated instead (practically never reached).
 */
export const MAX_CASCADE_STEPS = 40;

export type CandySpecial = 'none' | 'row';

export interface Candy {
  /** Candy type in [0, CANDY_KINDS). Matching compares `kind` only. */
  kind: number;
  /** 'row' = sparkler: when it is cleared, its whole row is cleared too. */
  special: CandySpecial;
}

export type Board = Candy[][];

export type Pos = { r: number; c: number };

/** A sparkler created by a 4+ run. It replaces the candy at `pos` instead of that cell being cleared. */
export interface CreatedCandy {
  pos: Pos;
  candy: Candy;
}

/**
 * One clear → gravity → refill pass of a cascade. Designed so a renderer can animate it in two phases:
 *
 * 1. **Clear phase** — draw `before`; fade out every cell in `cleared`; flash every row in `blastRows`;
 *    morph each `created[i].pos` into `created[i].candy`.
 * 2. **Fall phase** — draw `after`; each cell `after[r][c]` starts at row `fallFrom[r][c]` and slides down to
 *    row `r`. `fallFrom` is a row of `before` for surviving candies (`fallFrom[r][c] <= r`), or a negative
 *    virtual row above the board for refilled candies (-1 is the row just above the top edge).
 */
export interface CascadeStep {
  /** 1 for the clear caused by the swap, 2 for the first cascade, ... (also the points multiplier). */
  level: number;
  /** Board at the start of this step (contains the matches). */
  before: Board;
  /** Every 3+ run found in `before`. */
  groups: Pos[][];
  /** Positions in `before` of sparklers that fired (each clears its whole row). */
  sparklersFired: Pos[];
  /** Rows cleared completely by sparklers, ascending. */
  blastRows: number[];
  /** Positions in `before` removed by this step (excludes `created` cells), row-major order. */
  cleared: Pos[];
  /** Sparklers created by 4+ runs (they stay on the board and fall with gravity). */
  created: CreatedCandy[];
  /** `cleared.length * level`. */
  points: number;
  /** Board after gravity and refill. */
  after: Board;
  /** Source row for every cell of `after` — see the interface docs. */
  fallFrom: number[][];
}

export interface ResolveResult {
  /** Final stable board: no matches and at least one valid move. */
  board: Board;
  /** Cascade steps in order; empty when the input board had no matches. */
  steps: CascadeStep[];
  /** Sum of `steps[i].points`. */
  points: number;
  /** Sum of `steps[i].cleared.length`. */
  cleared: number;
  /** True when the settled board was shuffled/regenerated (no valid move left). `board` then differs from the last step's `after`. */
  reshuffled: boolean;
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

export function isInBounds(p: Pos): boolean {
  return (
    Number.isInteger(p.r) &&
    Number.isInteger(p.c) &&
    p.r >= 0 &&
    p.r < CANDY_ROWS &&
    p.c >= 0 &&
    p.c < CANDY_COLS
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((candy) => ({ kind: candy.kind, special: candy.special })));
}

function key(r: number, c: number): number {
  return r * CANDY_COLS + c;
}

function plainCandy(kind: number): Candy {
  return { kind, special: 'none' };
}

// ---------------------------------------------------------------------------------------------
// Matching and moves
// ---------------------------------------------------------------------------------------------

/** Every maximal horizontal run, then every maximal vertical run, of 3+ candies of the same kind. */
export function findMatchGroups(board: Board): Pos[][] {
  const groups: Pos[][] = [];

  for (let r = 0; r < CANDY_ROWS; r++) {
    let start = 0;
    for (let c = 1; c <= CANDY_COLS; c++) {
      if (c < CANDY_COLS && board[r][c].kind === board[r][start].kind) continue;
      if (c - start >= MIN_MATCH) {
        const run: Pos[] = [];
        for (let k = start; k < c; k++) run.push({ r, c: k });
        groups.push(run);
      }
      start = c;
    }
  }

  for (let c = 0; c < CANDY_COLS; c++) {
    let start = 0;
    for (let r = 1; r <= CANDY_ROWS; r++) {
      if (r < CANDY_ROWS && board[r][c].kind === board[start][c].kind) continue;
      if (r - start >= MIN_MATCH) {
        const run: Pos[] = [];
        for (let k = start; k < r; k++) run.push({ r: k, c });
        groups.push(run);
      }
      start = r;
    }
  }

  return groups;
}

function hasMatch(board: Board): boolean {
  return findMatchGroups(board).length > 0;
}

/** True when the two cells share an edge. */
export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

/** Returns a new board with the two cells exchanged; the input is not modified. */
export function swapCells(board: Board, a: Pos, b: Pos): Board {
  const next = cloneBoard(board);
  const tmp = next[a.r][a.c];
  next[a.r][a.c] = next[b.r][b.c];
  next[b.r][b.c] = tmp;
  return next;
}

/** In bounds, adjacent, and the swap creates at least one match. */
export function isValidSwap(board: Board, a: Pos, b: Pos): boolean {
  if (!isInBounds(a) || !isInBounds(b) || !isAdjacent(a, b)) return false;
  return hasMatch(swapCells(board, a, b));
}

/** First valid move in row-major order (trying right, then down), or null when the board is stuck. */
export function findFirstValidMove(board: Board): [Pos, Pos] | null {
  for (let r = 0; r < CANDY_ROWS; r++) {
    for (let c = 0; c < CANDY_COLS; c++) {
      const here = { r, c };
      const right = { r, c: c + 1 };
      if (right.c < CANDY_COLS && isValidSwap(board, here, right)) return [here, right];
      const down = { r: r + 1, c };
      if (down.r < CANDY_ROWS && isValidSwap(board, here, down)) return [here, down];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Board generation
// ---------------------------------------------------------------------------------------------

const BOARD_ATTEMPTS = 200;
const SHUFFLE_ATTEMPTS = 100;

/**
 * Last-resort board (no matches; swapping (0,2)↔(1,2) makes a row of 0s). Only used if hundreds of
 * random attempts all fail, which is practically impossible — but it guarantees termination.
 */
const FALLBACK_KINDS: readonly (readonly number[])[] = [
  [0, 0, 2, 3, 4, 0],
  [2, 3, 0, 0, 1, 2],
  [4, 0, 1, 2, 3, 4],
  [1, 2, 3, 4, 0, 1],
  [3, 4, 0, 1, 2, 3],
  [0, 1, 2, 3, 4, 0],
];

/** The deterministic fallback board (exported for tests). */
export function fallbackBoard(): Board {
  return FALLBACK_KINDS.map((row) => row.map(plainCandy));
}

/** Random board with no pre-existing matches (it may still have no valid move). */
function generateMatchFreeBoard(rng: Rng): Board {
  const board: Board = [];
  for (let r = 0; r < CANDY_ROWS; r++) {
    const row: Candy[] = [];
    board.push(row);
    for (let c = 0; c < CANDY_COLS; c++) {
      const allowed: number[] = [];
      for (let kind = 0; kind < CANDY_KINDS; kind++) {
        const makesRow = c >= 2 && row[c - 1].kind === kind && row[c - 2].kind === kind;
        const makesCol = r >= 2 && board[r - 1][c].kind === kind && board[r - 2][c].kind === kind;
        if (!makesRow && !makesCol) allowed.push(kind);
      }
      row.push(plainCandy(allowed[randInt(rng, allowed.length)]));
    }
  }
  return board;
}

function isPlayable(board: Board): boolean {
  return !hasMatch(board) && findFirstValidMove(board) !== null;
}

/** A fresh board with no matches and at least one valid move. */
export function createBoard(rng: Rng): Board {
  for (let attempt = 0; attempt < BOARD_ATTEMPTS; attempt++) {
    const board = generateMatchFreeBoard(rng);
    if (findFirstValidMove(board)) return board;
  }
  return fallbackBoard();
}

/**
 * Rearranges the existing candies (keeping sparklers) into a playable layout; falls back to a brand-new
 * board if no shuffle works.
 */
export function shuffleBoard(board: Board, rng: Rng): Board {
  const pool = board.flat().map((candy) => ({ kind: candy.kind, special: candy.special }));
  for (let attempt = 0; attempt < SHUFFLE_ATTEMPTS; attempt++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1);
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    const next: Board = [];
    for (let r = 0; r < CANDY_ROWS; r++) {
      next.push(pool.slice(r * CANDY_COLS, (r + 1) * CANDY_COLS).map((candy) => ({ ...candy })));
    }
    if (isPlayable(next)) return next;
  }
  return createBoard(rng);
}

// ---------------------------------------------------------------------------------------------
// Cascades
// ---------------------------------------------------------------------------------------------

/** Order in which a run's cells are tried for a new sparkler: preferred cells first, then middle-out. */
function sparklerCandidates(group: Pos[], preferred: readonly Pos[]): Pos[] {
  const inGroup = (p: Pos) => group.some((g) => g.r === p.r && g.c === p.c);
  const firstChoices = preferred.filter(inGroup);
  const mid = Math.floor((group.length - 1) / 2);
  const middleOut = [...group].sort(
    (a, b) => Math.abs(group.indexOf(a) - mid) - Math.abs(group.indexOf(b) - mid)
  );
  return [...firstChoices, ...middleOut];
}

function resolveStep(before: Board, groups: Pos[][], level: number, rng: Rng, preferred: readonly Pos[]): CascadeStep {
  const removed = new Set<number>();
  for (const group of groups) for (const p of group) removed.add(key(p.r, p.c));

  // Sparklers caught in a match fire and clear their row; that can catch more sparklers (same rows), so iterate.
  const fired = new Set<number>();
  const blastRows = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of removed) {
      if (fired.has(k)) continue;
      const r = Math.floor(k / CANDY_COLS);
      const c = k % CANDY_COLS;
      if (before[r][c].special !== 'row') continue;
      fired.add(k);
      if (!blastRows.has(r)) {
        blastRows.add(r);
        for (let cc = 0; cc < CANDY_COLS; cc++) removed.add(key(r, cc));
        changed = true;
      }
    }
  }

  // Each 4+ run leaves a sparkler of its kind behind at one of its cells (that cell is not cleared).
  const created = new Map<number, Candy>();
  for (const group of groups) {
    if (group.length < SPARKLER_RUN) continue;
    const kind = before[group[0].r][group[0].c].kind;
    const spot = sparklerCandidates(group, preferred).find((p) => !created.has(key(p.r, p.c)));
    if (spot) created.set(key(spot.r, spot.c), { kind, special: 'row' });
  }
  for (const k of created.keys()) removed.delete(k);

  const cleared: Pos[] = [];
  for (let r = 0; r < CANDY_ROWS; r++) {
    for (let c = 0; c < CANDY_COLS; c++) if (removed.has(key(r, c))) cleared.push({ r, c });
  }

  // Gravity + refill, column by column.
  const after: Board = Array.from({ length: CANDY_ROWS }, () => new Array<Candy>(CANDY_COLS));
  const fallFrom: number[][] = Array.from({ length: CANDY_ROWS }, () => new Array<number>(CANDY_COLS).fill(0));
  for (let c = 0; c < CANDY_COLS; c++) {
    let write = CANDY_ROWS - 1;
    for (let r = CANDY_ROWS - 1; r >= 0; r--) {
      const k = key(r, c);
      if (removed.has(k)) continue;
      const source = created.get(k) ?? before[r][c];
      after[write][c] = { kind: source.kind, special: source.special };
      fallFrom[write][c] = r;
      write -= 1;
    }
    const missing = write + 1;
    for (let r = write; r >= 0; r--) {
      after[r][c] = plainCandy(randInt(rng, CANDY_KINDS));
      fallFrom[r][c] = r - missing;
    }
  }

  return {
    level,
    before: cloneBoard(before),
    groups: groups.map((g) => g.map((p) => ({ ...p }))),
    sparklersFired: [...fired].sort((a, b) => a - b).map((k) => ({ r: Math.floor(k / CANDY_COLS), c: k % CANDY_COLS })),
    blastRows: [...blastRows].sort((a, b) => a - b),
    cleared,
    created: [...created.entries()].map(([k, candy]) => ({
      pos: { r: Math.floor(k / CANDY_COLS), c: k % CANDY_COLS },
      candy,
    })),
    points: cleared.length * level,
    after,
    fallFrom,
  };
}

/**
 * Settles a board (typically right after a valid swap): clears matches, applies gravity, refills from the top
 * with `rng`, and repeats until stable. If the stable board has no valid move it is reshuffled.
 *
 * @param preferred cells to prefer when placing a new sparkler in the FIRST step (pass the swapped cells so the
 *   sparkler appears where the player made the move).
 */
export function resolveBoard(board: Board, rng: Rng, preferred: readonly Pos[] = []): ResolveResult {
  let current = cloneBoard(board);
  const steps: CascadeStep[] = [];
  let points = 0;
  let cleared = 0;

  for (let level = 1; level <= MAX_CASCADE_STEPS; level++) {
    const groups = findMatchGroups(current);
    if (groups.length === 0) break;
    const step = resolveStep(current, groups, level, rng, level === 1 ? preferred : []);
    steps.push(step);
    points += step.points;
    cleared += step.cleared.length;
    current = step.after;
  }

  let reshuffled = false;
  if (!isPlayable(current)) {
    current = shuffleBoard(current, rng);
    reshuffled = true;
  }

  return { board: cloneBoard(current), steps, points, cleared, reshuffled };
}

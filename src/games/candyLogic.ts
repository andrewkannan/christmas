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
/** A run of 4 leaves a 'row' or 'col' striped blaster behind. */
export const SPARKLER_RUN = 4;
/** A run of 5+ leaves a 'star' rainbow color bomb behind. */
export const STAR_RUN = 5;

/** Scoring constants — Candy Crush style high-energy points! */
export const POINTS_PER_CANDY = 10;
export const SPECIAL_FIRE_BONUS = 30;
export const SPECIAL_CREATE_BONUS = 20;

/**
 * Safety valve: refills are random, so a cascade could in theory go on for a long time.
 * After this many steps the board is regenerated instead (practically never reached).
 */
export const MAX_CASCADE_STEPS = 40;

/**
 * Bonus Special Candies:
 * - 'none': regular candy
 * - 'row': horizontal striped blaster (clears its entire row)
 * - 'col': vertical striped blaster (clears its entire column)
 * - 'bomb': wrapped gift bomb (blasts a 3×3 area around it)
 * - 'star': rainbow star bomb (zaps every candy of that colour across the whole board)
 */
export type CandySpecial = 'none' | 'row' | 'col' | 'bomb' | 'star';

export interface Candy {
  /** Candy type in [0, CANDY_KINDS). Matching compares `kind` only. */
  kind: number;
  /** Special power-up attached to this candy. */
  special: CandySpecial;
}

export type Board = Candy[][];

export type Pos = { r: number; c: number };

/** A special bonus candy created by a match or cascade. It replaces the candy at `pos` instead of that cell being cleared. */
export interface CreatedCandy {
  pos: Pos;
  candy: Candy;
}

/**
 * One clear → gravity → refill pass of a cascade.
 */
export interface CascadeStep {
  /** 1 for the clear caused by the swap, 2 for the first cascade, ... (also the points multiplier). */
  level: number;
  /** Board at the start of this step (contains the matches). */
  before: Board;
  /** Every 3+ run found in `before`. */
  groups: Pos[][];
  /** Positions in `before` of special candies that fired during this step. */
  sparklersFired: Pos[];
  /** Rows cleared completely by 'row' blasters, ascending. */
  blastRows: number[];
  /** Columns cleared completely by 'col' blasters, ascending. */
  blastCols: number[];
  /** 3×3 bomb centres that detonated in this step. */
  blastBombs: Pos[];
  /** Rainbow star positions that zapped a colour across the board in this step. */
  blastStars: Pos[];
  /** Positions in `before` removed by this step (excludes `created` cells), row-major order. */
  cleared: Pos[];
  /** Special candies created by 4+/5+/L/T or cascade bonus runs (they stay on the board and fall with gravity). */
  created: CreatedCandy[];
  /** `(cleared.length * POINTS_PER_CANDY + sparklersFired.length * SPECIAL_FIRE_BONUS + created.length * SPECIAL_CREATE_BONUS) * level`. */
  points: number;
  /** Board after gravity and refill. */
  after: Board;
  /** Source row for every cell of `after`. */
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
  /** True when the settled board was shuffled/regenerated (no valid move left). */
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

/**True if swapping `a` and `b` triggers a special-candy combo directly (Rainbow Star or dual-special swap). */
export function isSpecialComboSwap(board: Board, a: Pos, b: Pos): boolean {
  if (!isInBounds(a) || !isInBounds(b) || !isAdjacent(a, b)) return false;
  const ca = board[a.r][a.c];
  const cb = board[b.r][b.c];
  if (ca.special === 'star' || cb.special === 'star') return true;
  if (ca.special !== 'none' && cb.special !== 'none') return true;
  return false;
}

/** In bounds, adjacent, and the swap creates at least one match (or activates a special combo). */
export function isValidSwap(board: Board, a: Pos, b: Pos): boolean {
  if (!isInBounds(a) || !isInBounds(b) || !isAdjacent(a, b)) return false;
  if (isSpecialComboSwap(board, a, b)) return true;
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
 * Rearranges the existing candies (keeping specials) into a playable layout; falls back to a brand-new
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
// Cascades & Special Power-Ups
// ---------------------------------------------------------------------------------------------

function sparklerCandidates(group: Pos[], preferred: readonly Pos[]): Pos[] {
  const inGroup = (p: Pos) => group.some((g) => g.r === p.r && g.c === p.c);
  const firstChoices = preferred.filter(inGroup);
  const mid = Math.floor((group.length - 1) / 2);
  const middleOut = [...group].sort(
    (a, b) => Math.abs(group.indexOf(a) - mid) - Math.abs(group.indexOf(b) - mid)
  );
  return [...firstChoices, ...middleOut];
}

function resolveStep(
  before: Board,
  groups: Pos[][],
  level: number,
  rng: Rng,
  preferred: readonly Pos[],
  comboSeedCells: readonly Pos[] = []
): CascadeStep {
  const removed = new Set<number>();
  for (const group of groups) for (const p of group) removed.add(key(p.r, p.c));
  for (const p of comboSeedCells) removed.add(key(p.r, p.c));

  // If a Rainbow Star was directly swapped with a neighbour, zap every candy of that neighbour's kind!
  const starPartnerKind = new Map<number, number>();
  if (comboSeedCells.length === 2) {
    const [p0, p1] = comboSeedCells;
    const c0 = before[p0.r][p0.c];
    const c1 = before[p1.r][p1.c];
    if (c0.special === 'star') starPartnerKind.set(key(p0.r, p0.c), c1.kind);
    if (c1.special === 'star') starPartnerKind.set(key(p1.r, p1.c), c0.kind);
  }

  // Chain reaction loop: any special candy in `removed` fires its blast and can trigger other specials!
  const fired = new Set<number>();
  const blastRows = new Set<number>();
  const blastCols = new Set<number>();
  const blastBombs: Pos[] = [];
  const blastStars: Pos[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const k of [...removed]) {
      if (fired.has(k)) continue;
      const r = Math.floor(k / CANDY_COLS);
      const c = k % CANDY_COLS;
      const spec = before[r][c].special;
      if (spec === 'none') continue;

      fired.add(k);
      if (spec === 'row') {
        if (!blastRows.has(r)) {
          blastRows.add(r);
          for (let cc = 0; cc < CANDY_COLS; cc++) {
            if (!removed.has(key(r, cc))) {
              removed.add(key(r, cc));
              changed = true;
            }
          }
        }
      } else if (spec === 'col') {
        if (!blastCols.has(c)) {
          blastCols.add(c);
          for (let rr = 0; rr < CANDY_ROWS; rr++) {
            if (!removed.has(key(rr, c))) {
              removed.add(key(rr, c));
              changed = true;
            }
          }
        }
      } else if (spec === 'bomb') {
        blastBombs.push({ r, c });
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < CANDY_ROWS && nc >= 0 && nc < CANDY_COLS) {
              if (!removed.has(key(nr, nc))) {
                removed.add(key(nr, nc));
                changed = true;
              }
            }
          }
        }
      } else if (spec === 'star') {
        blastStars.push({ r, c });
        const targetKind = starPartnerKind.get(k) ?? before[r][c].kind;
        for (let rr = 0; rr < CANDY_ROWS; rr++) {
          for (let cc = 0; cc < CANDY_COLS; cc++) {
            if (before[rr][cc].kind === targetKind && !removed.has(key(rr, cc))) {
              removed.add(key(rr, cc));
              changed = true;
            }
          }
        }
      }
    }
  }

  // Detect L / T intersections (a cell shared by 2+ groups) -> creates a 3×3 Wrapped Gift Bomb ('bomb')!
  const cellGroupCount = new Map<number, number>();
  for (const group of groups) {
    for (const p of group) {
      const k = key(p.r, p.c);
      cellGroupCount.set(k, (cellGroupCount.get(k) ?? 0) + 1);
    }
  }

  const created = new Map<number, Candy>();
  for (const [k, cnt] of cellGroupCount.entries()) {
    if (cnt >= 2) {
      const r = Math.floor(k / CANDY_COLS);
      const c = k % CANDY_COLS;
      created.set(k, { kind: before[r][c].kind, special: 'bomb' });
    }
  }

  // 4-runs create a Striped Blaster ('row' for horizontal, 'col' for vertical), 5+ runs create a Rainbow Star ('star')!
  for (const group of groups) {
    if (group.length < SPARKLER_RUN) continue;
    const alreadyHasCreated = group.some((p) => created.has(key(p.r, p.c)));
    if (alreadyHasCreated) continue;

    const kind = before[group[0].r][group[0].c].kind;
    if (group.length >= STAR_RUN) {
      const spot = sparklerCandidates(group, preferred).find((p) => !created.has(key(p.r, p.c)));
      if (spot) created.set(key(spot.r, spot.c), { kind, special: 'star' });
    } else {
      const isHorizontal = group.every((p) => p.r === group[0].r);
      const special: CandySpecial = isHorizontal ? 'row' : 'col';
      const spot = sparklerCandidates(group, preferred).find((p) => !created.has(key(p.r, p.c)));
      if (spot) created.set(key(spot.r, spot.c), { kind, special });
    }
  }

  for (const k of created.keys()) removed.delete(k);

  const cleared: Pos[] = [];
  for (let r = 0; r < CANDY_ROWS; r++) {
    for (let c = 0; c < CANDY_COLS; c++) if (removed.has(key(r, c))) cleared.push({ r, c });
  }

  // Gravity + refill, column by column (with lucky Candy Crush bonus drops on cascades!).
  const after: Board = Array.from({ length: CANDY_ROWS }, () => new Array<Candy>(CANDY_COLS));
  const fallFrom: number[][] = Array.from({ length: CANDY_ROWS }, () => new Array<number>(CANDY_COLS).fill(0));
  let bonusDroppedThisStep = false;
  const bonusPool: readonly CandySpecial[] = ['bomb', 'row', 'col'];

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
      const kind = randInt(rng, CANDY_KINDS);
      if (!bonusDroppedThisStep && (level >= 2 || cleared.length >= 4)) {
        bonusDroppedThisStep = true;
        const bonusSpecial = bonusPool[(level + c + kind) % bonusPool.length];
        after[r][c] = { kind, special: bonusSpecial };
      } else {
        after[r][c] = plainCandy(kind);
      }
      fallFrom[r][c] = r - missing;
    }
  }

  const sparklersFired = [...fired]
    .sort((a, b) => a - b)
    .map((k) => ({ r: Math.floor(k / CANDY_COLS), c: k % CANDY_COLS }));
  const createdList = [...created.entries()].map(([k, candy]) => ({
    pos: { r: Math.floor(k / CANDY_COLS), c: k % CANDY_COLS },
    candy,
  }));

  const stepPoints =
    (cleared.length * POINTS_PER_CANDY +
      sparklersFired.length * SPECIAL_FIRE_BONUS +
      createdList.length * SPECIAL_CREATE_BONUS) *
    level;

  return {
    level,
    before: cloneBoard(before),
    groups: groups.map((g) => g.map((p) => ({ ...p }))),
    sparklersFired,
    blastRows: [...blastRows].sort((a, b) => a - b),
    blastCols: [...blastCols].sort((a, b) => a - b),
    blastBombs,
    blastStars,
    cleared,
    created: createdList,
    points: stepPoints,
    after,
    fallFrom,
  };
}

/**
 * Settles a board (typically right after a valid swap): clears matches, applies gravity, refills from the top
 * with `rng`, and repeats until stable. If the stable board has no valid move it is reshuffled.
 */
export function resolveBoard(board: Board, rng: Rng, preferred: readonly Pos[] = []): ResolveResult {
  let current = cloneBoard(board);
  const steps: CascadeStep[] = [];
  let points = 0;
  let cleared = 0;

  for (let level = 1; level <= MAX_CASCADE_STEPS; level++) {
    const groups = findMatchGroups(current);
    const isDirectSpecialSwap =
      level === 1 &&
      preferred.length >= 2 &&
      isSpecialComboSwap(current, preferred[0], preferred[1]);

    if (groups.length === 0 && !isDirectSpecialSwap) break;

    const step = resolveStep(
      current,
      groups,
      level,
      rng,
      level === 1 ? preferred : [],
      isDirectSpecialSwap ? [preferred[0], preferred[1]] : []
    );
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

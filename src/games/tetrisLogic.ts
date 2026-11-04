import { randInt, type Rng } from './rng.ts';

/**
 * Pure game logic for Block Stack (Christmas gift Tetris).
 *
 * No DOM, no timers and no Math.random — randomness comes from an injected {@link Rng}, so every
 * function here is deterministic and covered by property tests (tests/tetrisLogic.property.test.ts).
 *
 * Coordinates: `grid[row][col]`, row 0 is the top. A piece's `x`/`y` is the top-left corner of its
 * rotation box; {@link pieceCells} turns that into absolute board cells.
 *
 * Hidden rows: cells ABOVE row 0 (y < 0) are allowed for the falling piece (so pieces can rotate
 * right after spawning), but they are never written to the grid. A piece that locks with any cell
 * above row 0 is a "lock-out" — see {@link isAboveTop}; the playfield treats it as a top-out.
 */

export const TETRIS_COLS = 8;
export const TETRIS_ROWS = 14;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Rotation = 0 | 1 | 2 | 3;
/** `[row][col]`; 0 = empty, 1..7 = piece colour index (see {@link PIECE_COLOR_INDEX}). */
export type Grid = number[][];

export interface Piece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export const PIECE_TYPES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Colour index written into the grid when a piece locks (1..7, never 0). */
export const PIECE_COLOR_INDEX: Readonly<Record<PieceType, number>> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

/** Rotation-0 shapes inside their rotation box (I: 4×4, O: 2×2, others: 3×3). */
const BASE_SHAPES: Readonly<Record<PieceType, number[][]>> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

type Offset = readonly [dx: number, dy: number];

function rotateMatrixCW(matrix: number[][]): number[][] {
  const size = matrix.length;
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => matrix[size - 1 - c][r])
  );
}

function matrixToOffsets(matrix: number[][]): Offset[] {
  const offsets: Offset[] = [];
  matrix.forEach((row, r) =>
    row.forEach((filled, c) => {
      if (filled) offsets.push([c, r]);
    })
  );
  return offsets;
}

/** Precomputed cell offsets for every piece type and rotation (rotation box coordinates). */
const SHAPE_OFFSETS: Readonly<Record<PieceType, readonly (readonly Offset[])[]>> = (() => {
  const table = {} as Record<PieceType, Offset[][]>;
  for (const type of PIECE_TYPES) {
    const rotations: Offset[][] = [];
    let matrix = BASE_SHAPES[type];
    for (let r = 0; r < 4; r += 1) {
      rotations.push(matrixToOffsets(matrix));
      matrix = rotateMatrixCW(matrix);
    }
    table[type] = rotations;
  }
  return table;
})();

/** Horizontal wall-kick offsets tried, in order, when rotating. */
const WALL_KICKS: readonly number[] = [0, -1, 1, -2, 2];

/** Points per simultaneous line clear (index = lines cleared). */
const LINE_CLEAR_POINTS: readonly number[] = [0, 5, 12, 20, 30];

/** Gravity ramp: seconds per row at the start, at full speed, and when full speed is reached. */
const GRAVITY_START_SEC = 0.8;
const GRAVITY_END_SEC = 0.25;
const GRAVITY_RAMP_SEC = 75;

function gridCols(grid: Grid): number {
  return grid[0]?.length ?? 0;
}

function emptyRow(cols: number): number[] {
  return new Array<number>(cols).fill(0);
}

export function createEmptyGrid(): Grid {
  return Array.from({ length: TETRIS_ROWS }, () => emptyRow(TETRIS_COLS));
}

/**
 * Empty grid with the bottom `rows` rows pre-filled, each with exactly one gap, so the first
 * line clear can happen within a few pieces.
 */
export function createStarterGrid(rng: Rng, rows = 2): Grid {
  const grid = createEmptyGrid();
  const count = Math.max(0, Math.min(Math.floor(rows), TETRIS_ROWS));
  for (let r = TETRIS_ROWS - count; r < TETRIS_ROWS; r += 1) {
    // Keep gaps off the outer walls so they are easy to reach.
    const gap = 1 + randInt(rng, TETRIS_COLS - 2);
    for (let c = 0; c < TETRIS_COLS; c += 1) {
      grid[r][c] = c === gap ? 0 : 1 + randInt(rng, PIECE_TYPES.length);
    }
  }
  return grid;
}

/** 7-bag randomiser: a uniformly shuffled permutation of all seven piece types (Fisher–Yates). */
export function createBag(rng: Rng): PieceType[] {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, randInt(rng, i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** Offsets of a piece type at a rotation, relative to its rotation box. */
export function shapeOffsets(type: PieceType, rotation: Rotation): ReadonlyArray<Offset> {
  return SHAPE_OFFSETS[type][rotation];
}

/** New piece, horizontally centred, with its top-most cell on row 0. */
export function spawnPiece(type: PieceType): Piece {
  const offsets = SHAPE_OFFSETS[type][0];
  const boxSize = BASE_SHAPES[type].length;
  const minDy = Math.min(...offsets.map(([, dy]) => dy));
  return {
    type,
    rotation: 0,
    x: Math.floor((TETRIS_COLS - boxSize) / 2),
    y: -minDy,
  };
}

/** Absolute board cells occupied by a piece. */
export function pieceCells(piece: Piece): Array<[x: number, y: number]> {
  return SHAPE_OFFSETS[piece.type][piece.rotation].map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
}

/** True if any cell of the piece is above the visible board (y < 0). */
export function isAboveTop(piece: Piece): boolean {
  return pieceCells(piece).some(([, y]) => y < 0);
}

/**
 * True when the piece is out of bounds (left, right or bottom) or overlaps a filled cell.
 * Cells above row 0 are allowed (hidden spawn area) and never collide.
 */
export function collides(grid: Grid, piece: Piece): boolean {
  const rows = grid.length;
  const cols = gridCols(grid);
  for (const [x, y] of pieceCells(piece)) {
    if (x < 0 || x >= cols || y >= rows) return true;
    if (y >= 0 && grid[y][x] !== 0) return true;
  }
  return false;
}

/** The piece shifted by (dx, dy), or null if that position collides. */
export function tryMove(grid: Grid, piece: Piece, dx: number, dy: number): Piece | null {
  const moved: Piece = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return collides(grid, moved) ? null : moved;
}

/**
 * The piece rotated clockwise (1) or counter-clockwise (-1), trying simple horizontal wall kicks
 * (x offsets 0, -1, +1, -2, +2). Null if every kick collides.
 */
export function tryRotate(grid: Grid, piece: Piece, dir: 1 | -1): Piece | null {
  const rotation = ((((piece.rotation + dir) % 4) + 4) % 4) as Rotation;
  for (const kick of WALL_KICKS) {
    const rotated: Piece = { ...piece, rotation, x: piece.x + kick };
    if (!collides(grid, rotated)) return rotated;
  }
  return null;
}

/** How many rows the piece can fall before landing (0 if grounded or already colliding). */
export function dropDistance(grid: Grid, piece: Piece): number {
  if (collides(grid, piece)) return 0;
  let distance = 0;
  while (!collides(grid, { ...piece, y: piece.y + distance + 1 })) {
    distance += 1;
  }
  return distance;
}

/** The piece moved to its landing position (also the ghost-piece position). */
export function hardDropPosition(grid: Grid, piece: Piece): Piece {
  return { ...piece, y: piece.y + dropDistance(grid, piece) };
}

/** New grid with the piece written in. Cells outside the board (incl. above row 0) are dropped. */
export function lockPiece(grid: Grid, piece: Piece): Grid {
  const next = grid.map((row) => row.slice());
  const cols = gridCols(grid);
  const color = PIECE_COLOR_INDEX[piece.type];
  for (const [x, y] of pieceCells(piece)) {
    if (y >= 0 && y < next.length && x >= 0 && x < cols) {
      next[y][x] = color;
    }
  }
  return next;
}

function isFullRow(row: number[]): boolean {
  return row.length > 0 && row.every((cell) => cell !== 0);
}

/** Indices of completely filled rows, top to bottom. */
export function fullRowIndices(grid: Grid): number[] {
  const indices: number[] = [];
  grid.forEach((row, r) => {
    if (isFullRow(row)) indices.push(r);
  });
  return indices;
}

/** Removes full rows, shifting the rest down (order preserved) and adding empty rows on top. */
export function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const kept = grid.filter((row) => !isFullRow(row)).map((row) => row.slice());
  const cleared = grid.length - kept.length;
  const cols = gridCols(grid);
  const fresh = Array.from({ length: cleared }, () => emptyRow(cols));
  return { grid: [...fresh, ...kept], cleared };
}

/** 0 / 5 / 12 / 20 / 30 points for clearing 0..4 lines at once (more than 4 is capped). */
export function lineClearPoints(cleared: number): number {
  if (!Number.isFinite(cleared) || cleared <= 0) return 0;
  return LINE_CLEAR_POINTS[Math.min(Math.floor(cleared), LINE_CLEAR_POINTS.length - 1)];
}

/** New grid with the top `rows` rows emptied (used to recover from a top-out). */
export function clearTopRows(grid: Grid, rows: number): Grid {
  const cols = gridCols(grid);
  const count = Math.max(0, Math.min(Math.floor(rows), grid.length));
  return grid.map((row, r) => (r < count ? emptyRow(cols) : row.slice()));
}

/** Seconds per gravity row: 0.8s at the start, easing linearly to 0.25s by 75s of live play. */
export function gravityInterval(elapsedSec: number): number {
  const t = Number.isFinite(elapsedSec)
    ? Math.max(0, Math.min(1, elapsedSec / GRAVITY_RAMP_SEC))
    : 0;
  return GRAVITY_START_SEC + (GRAVITY_END_SEC - GRAVITY_START_SEC) * t;
}

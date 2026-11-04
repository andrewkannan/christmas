import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng } from '../src/games/rng.ts';
import {
  PIECE_TYPES,
  TETRIS_COLS,
  TETRIS_ROWS,
  clearLines,
  clearTopRows,
  collides,
  createBag,
  createEmptyGrid,
  createStarterGrid,
  dropDistance,
  gravityInterval,
  lineClearPoints,
  lockPiece,
  pieceCells,
  spawnPiece,
  tryMove,
  tryRotate,
  type Grid,
  type Piece,
  type PieceType,
  type Rotation,
} from '../src/games/tetrisLogic.ts';

const NUM_RUNS = 200;

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const pieceTypeArb = fc.constantFrom<PieceType>(...PIECE_TYPES);
const rotationArb = fc.constantFrom<Rotation>(0, 1, 2, 3);
const dirArb = fc.constantFrom<1 | -1>(1, -1);

const cellArb = fc.oneof(
  { weight: 3, arbitrary: fc.constant(0) },
  { weight: 2, arbitrary: fc.integer({ min: 1, max: 7 }) }
);
const randomRowArb = fc.array(cellArb, { minLength: TETRIS_COLS, maxLength: TETRIS_COLS });
const fullRowArb = fc.array(fc.integer({ min: 1, max: 7 }), {
  minLength: TETRIS_COLS,
  maxLength: TETRIS_COLS,
});
/** Random grids biased to contain some full rows. */
const gridArb: fc.Arbitrary<Grid> = fc.array(
  fc.oneof({ weight: 3, arbitrary: randomRowArb }, { weight: 1, arbitrary: fullRowArb }),
  { minLength: TETRIS_ROWS, maxLength: TETRIS_ROWS }
);

const filledCount = (grid: Grid): number =>
  grid.reduce((sum, row) => sum + row.filter((cell) => cell !== 0).length, 0);

const sortedCells = (piece: Piece): string[] =>
  pieceCells(piece)
    .map(([x, y]) => `${x},${y}`)
    .sort();

const isFull = (row: number[]): boolean => row.every((cell) => cell !== 0);

describe('tetrisLogic properties', () => {
  it('createBag always returns a permutation of all 7 piece types', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const rng = createRng(seed);
        for (let i = 0; i < 3; i += 1) {
          const bag = createBag(rng);
          expect(bag).toHaveLength(7);
          expect([...bag].sort()).toEqual([...PIECE_TYPES].sort());
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('spawnPiece never collides on an empty grid and starts on the visible top rows', () => {
    fc.assert(
      fc.property(pieceTypeArb, (type) => {
        const piece = spawnPiece(type);
        expect(collides(createEmptyGrid(), piece)).toBe(false);
        const ys = pieceCells(piece).map(([, y]) => y);
        expect(Math.min(...ys)).toBe(0);
        expect(Math.max(...ys)).toBeLessThanOrEqual(1);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('rotating 4 times in the same direction in the centre returns the same cells', () => {
    fc.assert(
      fc.property(
        pieceTypeArb,
        rotationArb,
        dirArb,
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 2, max: 8 }),
        (type, rotation, dir, x, y) => {
          const grid = createEmptyGrid();
          const start: Piece = { type, rotation, x, y };
          let piece: Piece = start;
          for (let i = 0; i < 4; i += 1) {
            const rotated = tryRotate(grid, piece, dir);
            expect(rotated).not.toBeNull();
            piece = rotated as Piece;
          }
          expect(piece.rotation).toBe(start.rotation);
          expect(sortedCells(piece)).toEqual(sortedCells(start));
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('hard drop then lock adds exactly 4 filled cells and lands the piece', () => {
    fc.assert(
      fc.property(
        gridArb,
        pieceTypeArb,
        rotationArb,
        fc.integer({ min: -2, max: TETRIS_COLS }),
        fc.integer({ min: 0, max: 3 }),
        (rawGrid, type, rotation, x, y) => {
          // Empty the top rows so a non-colliding start position is common.
          const grid = clearTopRows(rawGrid, 4);
          const piece: Piece = { type, rotation, x, y };
          fc.pre(!collides(grid, piece));

          const distance = dropDistance(grid, piece);
          const landed: Piece = { ...piece, y: piece.y + distance };
          expect(collides(grid, landed)).toBe(false);
          expect(tryMove(grid, landed, 0, 1)).toBeNull();

          const locked = lockPiece(grid, landed);
          expect(filledCount(locked)).toBe(filledCount(grid) + 4);
          // lockPiece is pure.
          expect(grid).toEqual(clearTopRows(rawGrid, 4));
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('clearLines removes every full row, keeps dimensions and preserves row order', () => {
    fc.assert(
      fc.property(gridArb, (grid) => {
        const snapshot = grid.map((row) => row.slice());
        const { grid: result, cleared } = clearLines(grid);

        expect(result).toHaveLength(TETRIS_ROWS);
        for (const row of result) expect(row).toHaveLength(TETRIS_COLS);
        expect(result.some(isFull)).toBe(false);

        const fullInInput = grid.filter(isFull).length;
        expect(cleared).toBe(fullInInput);

        const keptInput = grid.filter((row) => !isFull(row));
        // Top `cleared` rows are new empty rows; the rest are the kept rows in their original order.
        expect(result.slice(0, cleared).every((row) => row.every((cell) => cell === 0))).toBe(true);
        expect(result.slice(cleared)).toEqual(keptInput);

        // Pure: input untouched.
        expect(grid).toEqual(snapshot);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('pieces moved by tryMove / tryRotate never collide', () => {
    type Action = 'left' | 'right' | 'down' | 'cw' | 'ccw';
    const actionArb = fc.constantFrom<Action>('left', 'right', 'down', 'cw', 'ccw');
    fc.assert(
      fc.property(
        gridArb,
        pieceTypeArb,
        fc.array(actionArb, { minLength: 1, maxLength: 40 }),
        (rawGrid, type, actions) => {
          // A top-out recovery clears the top rows, so spawning must be valid afterwards.
          const grid = clearTopRows(rawGrid, 7);
          let piece = spawnPiece(type);
          expect(collides(grid, piece)).toBe(false);

          for (const action of actions) {
            const next =
              action === 'left'
                ? tryMove(grid, piece, -1, 0)
                : action === 'right'
                  ? tryMove(grid, piece, 1, 0)
                  : action === 'down'
                    ? tryMove(grid, piece, 0, 1)
                    : tryRotate(grid, piece, action === 'cw' ? 1 : -1);
            if (next) {
              expect(collides(grid, next)).toBe(false);
              piece = next;
            }
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});

describe('tetrisLogic examples', () => {
  it('lineClearPoints follows the 0/5/12/20/30 table', () => {
    expect([0, 1, 2, 3, 4].map(lineClearPoints)).toEqual([0, 5, 12, 20, 30]);
    expect(lineClearPoints(-1)).toBe(0);
    expect(lineClearPoints(Number.NaN)).toBe(0);
  });

  it('clearTopRows empties exactly the requested rows', () => {
    const full: Grid = Array.from({ length: TETRIS_ROWS }, () => new Array(TETRIS_COLS).fill(3));
    const result = clearTopRows(full, 7);
    expect(result.slice(0, 7).every((row) => row.every((c) => c === 0))).toBe(true);
    expect(result.slice(7).every((row) => row.every((c) => c === 3))).toBe(true);
    expect(full[0][0]).toBe(3);
  });

  it('starter grid has two bottom rows with exactly one gap each', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const grid = createStarterGrid(createRng(seed));
        expect(filledCount(grid.slice(0, TETRIS_ROWS - 2))).toBe(0);
        for (const row of grid.slice(TETRIS_ROWS - 2)) {
          expect(row.filter((c) => c === 0)).toHaveLength(1);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('gravity ramps from 0.8s to 0.25s per row by 75s', () => {
    expect(gravityInterval(0)).toBeCloseTo(0.8);
    expect(gravityInterval(75)).toBeCloseTo(0.25);
    expect(gravityInterval(200)).toBeCloseTo(0.25);
    expect(gravityInterval(-5)).toBeCloseTo(0.8);
    expect(gravityInterval(30)).toBeLessThan(gravityInterval(10));
  });
});

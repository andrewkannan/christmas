import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng } from '../src/games/rng.ts';
import {
  CANDY_COLS,
  CANDY_KINDS,
  CANDY_ROWS,
  createBoard,
  fallbackBoard,
  findFirstValidMove,
  findMatchGroups,
  isAdjacent,
  isValidSwap,
  resolveBoard,
  swapCells,
  type Board,
  type Pos,
} from '../src/games/candyLogic.ts';

const NUM_RUNS = 200;
const seedArb = fc.integer();
const posArb: fc.Arbitrary<Pos> = fc.record({
  r: fc.integer({ min: 0, max: CANDY_ROWS - 1 }),
  c: fc.integer({ min: 0, max: CANDY_COLS - 1 }),
});
/** Arbitrary boards — usually full of matches, which is what findMatchGroups needs to be tested on. */
const boardArb: fc.Arbitrary<Board> = fc
  .array(
    fc.array(
      fc.record({
        kind: fc.integer({ min: 0, max: CANDY_KINDS - 1 }),
        special: fc.constantFrom('none' as const, 'row' as const),
      }),
      { minLength: CANDY_COLS, maxLength: CANDY_COLS }
    ),
    { minLength: CANDY_ROWS, maxLength: CANDY_ROWS }
  );

function expectWellFormed(board: Board): void {
  expect(board).toHaveLength(CANDY_ROWS);
  for (const row of board) {
    expect(row).toHaveLength(CANDY_COLS);
    for (const candy of row) {
      expect(Number.isInteger(candy.kind)).toBe(true);
      expect(candy.kind).toBeGreaterThanOrEqual(0);
      expect(candy.kind).toBeLessThan(CANDY_KINDS);
      expect(['none', 'row']).toContain(candy.special);
    }
  }
}

function expectPlayable(board: Board): void {
  expectWellFormed(board);
  expect(findMatchGroups(board)).toEqual([]);
  expect(findFirstValidMove(board)).not.toBeNull();
}

function allValidMoves(board: Board): [Pos, Pos][] {
  const moves: [Pos, Pos][] = [];
  for (let r = 0; r < CANDY_ROWS; r++) {
    for (let c = 0; c < CANDY_COLS; c++) {
      if (isValidSwap(board, { r, c }, { r, c: c + 1 })) moves.push([{ r, c }, { r, c: c + 1 }]);
      if (isValidSwap(board, { r, c }, { r: r + 1, c })) moves.push([{ r, c }, { r: r + 1, c }]);
    }
  }
  return moves;
}

/** Board from a kind grid (all plain candies). */
function boardOf(kinds: number[][]): Board {
  return kinds.map((row) => row.map((kind) => ({ kind, special: 'none' as const })));
}

/** Match-free base pattern: horizontal neighbours differ by 1 (mod 5), vertical by 2. */
function basePattern(): number[][] {
  return Array.from({ length: CANDY_ROWS }, (_, r) =>
    Array.from({ length: CANDY_COLS }, (__, c) => (2 * r + c) % CANDY_KINDS)
  );
}

describe('candyLogic properties', () => {
  it('(1) createBoard: correct dimensions, kinds in range, no matches, has a valid move', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const board = createBoard(createRng(seed));
        expectPlayable(board);
        for (const row of board) for (const candy of row) expect(candy.special).toBe('none');
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('(2) resolveBoard after a valid move settles to a playable board with consistent scoring', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 8 }), (seed, moveCount) => {
        const rng = createRng(seed);
        let board = createBoard(rng);
        for (let m = 0; m < moveCount; m++) {
          // First move uses findFirstValidMove; later moves pick any valid move to explore more boards.
          const moves = allValidMoves(board);
          const move = m === 0 ? findFirstValidMove(board) : moves[Math.floor(rng() * moves.length)];
          expect(move).not.toBeNull();
          const [a, b] = move!;
          expect(isValidSwap(board, a, b)).toBe(true);

          const result = resolveBoard(swapCells(board, a, b), rng, [b, a]);
          expectPlayable(result.board);
          expect(result.cleared).toBeGreaterThanOrEqual(3);
          expect(result.points).toBeGreaterThanOrEqual(result.cleared);
          expect(result.steps.length).toBeGreaterThanOrEqual(1);

          // Step data is internally consistent (what the renderer relies on).
          let pointSum = 0;
          let clearedSum = 0;
          result.steps.forEach((step, i) => {
            expect(step.level).toBe(i + 1);
            expect(step.cleared.length).toBeGreaterThanOrEqual(3);
            expect(step.points).toBe(step.cleared.length * step.level);
            expectWellFormed(step.after);
            if (i > 0) expect(step.before).toEqual(result.steps[i - 1].after);
            for (let c = 0; c < CANDY_COLS; c++) {
              for (let r = 0; r < CANDY_ROWS; r++) {
                const from = step.fallFrom[r][c];
                expect(from).toBeLessThanOrEqual(r);
                if (r > 0) expect(from).toBeGreaterThan(step.fallFrom[r - 1][c]);
              }
            }
            pointSum += step.points;
            clearedSum += step.cleared.length;
          });
          expect(pointSum).toBe(result.points);
          expect(clearedSum).toBe(result.cleared);
          if (!result.reshuffled) expect(result.board).toEqual(result.steps[result.steps.length - 1].after);

          board = result.board;
        }
      }),
      { numRuns: NUM_RUNS }
    );
  }, 30_000);

  it('(3) isValidSwap is false for non-adjacent positions', () => {
    fc.assert(
      fc.property(seedArb, posArb, posArb, (seed, a, b) => {
        fc.pre(!isAdjacent(a, b));
        expect(isValidSwap(createBoard(createRng(seed)), a, b)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('(4) swapCells is pure and swapping twice restores the original', () => {
    fc.assert(
      fc.property(boardArb, posArb, posArb, (board, a, b) => {
        const snapshot = structuredClone(board);
        const once = swapCells(board, a, b);
        expect(board).toEqual(snapshot);
        expect(once).not.toBe(board);
        expect(once[a.r][a.c]).toEqual(snapshot[b.r][b.c]);
        expect(once[b.r][b.c]).toEqual(snapshot[a.r][a.c]);
        expect(swapCells(once, a, b)).toEqual(snapshot);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('(5) findMatchGroups only returns straight, maximal runs of 3+ identical kinds', () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        for (const group of findMatchGroups(board)) {
          expect(group.length).toBeGreaterThanOrEqual(3);
          const kind = board[group[0].r][group[0].c].kind;
          const horizontal = group.every((p) => p.r === group[0].r);
          const vertical = group.every((p) => p.c === group[0].c);
          expect(horizontal || vertical).toBe(true);
          group.forEach((p, i) => {
            expect(board[p.r][p.c].kind).toBe(kind);
            if (i > 0) {
              // Contiguous, in order.
              expect(horizontal ? p.c - group[i - 1].c : p.r - group[i - 1].r).toBe(1);
            }
          });
          // Maximal: the cells just beyond each end are a different kind (or off the board).
          const first = group[0];
          const last = group[group.length - 1];
          const before = horizontal ? { r: first.r, c: first.c - 1 } : { r: first.r - 1, c: first.c };
          const after = horizontal ? { r: last.r, c: last.c + 1 } : { r: last.r + 1, c: last.c };
          for (const p of [before, after]) {
            if (p.r >= 0 && p.r < CANDY_ROWS && p.c >= 0 && p.c < CANDY_COLS) {
              expect(board[p.r][p.c].kind).not.toBe(kind);
            }
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

describe('candyLogic examples', () => {
  it('fallback board is playable', () => {
    expectPlayable(fallbackBoard());
  });

  it('a run of 4 leaves a row sparkler at the preferred cell', () => {
    const kinds = basePattern();
    kinds[1] = [2, 2, 2, 2, 1, 2];
    const board = boardOf(kinds);
    expect(findMatchGroups(board)).toHaveLength(1);

    const result = resolveBoard(board, createRng(7), [{ r: 1, c: 2 }]);
    const first = result.steps[0];
    expect(first.created).toEqual([{ pos: { r: 1, c: 2 }, candy: { kind: 2, special: 'row' } }]);
    expect(first.cleared).toHaveLength(3);
    expect(first.points).toBe(3);
    expect(first.after[1][2]).toEqual({ kind: 2, special: 'row' });
  });

  it('matching a sparkler clears its whole row', () => {
    const kinds = basePattern();
    kinds[3][0] = 3;
    kinds[5][0] = 3; // column 0, rows 3–5 are all kind 3
    const board = boardOf(kinds);
    board[4][0] = { kind: 3, special: 'row' };

    const result = resolveBoard(board, createRng(11));
    const first = result.steps[0];
    expect(first.blastRows).toEqual([4]);
    expect(first.sparklersFired).toEqual([{ r: 4, c: 0 }]);
    expect(first.cleared).toHaveLength(CANDY_COLS + 2);
    expect(first.points).toBe(CANDY_COLS + 2);
  });

  it('is deterministic for a given seed', () => {
    const a = createBoard(createRng(42));
    const b = createBoard(createRng(42));
    expect(a).toEqual(b);
    const [p, q] = findFirstValidMove(a)!;
    expect(resolveBoard(swapCells(a, p, q), createRng(1))).toEqual(resolveBoard(swapCells(b, p, q), createRng(1)));
  });
});

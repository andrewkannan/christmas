import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatBoardName } from '../src/games/boardName.ts';
import { GAME_RULES, MIN_ROUND_SEC, isPlausibleScore } from '../src/games/rules.ts';
import type { ActiveGameId } from '../src/types.ts';

const GAME_IDS = Object.keys(GAME_RULES) as ActiveGameId[];

describe('formatBoardName (privacy-preserving leaderboard names)', () => {
  it.each([
    ['Mei Ling Tan', 'Mei T.'],
    ['Siti Nurhaliza binti Ahmad', 'Siti A.'],
    ['andrew', 'Andrew'],
    ['  muthu   a/l   raju ', 'Muthu R.'],
    ['李美玲', '李**'],
    ['김민', '김*'],
    ['', 'Player'],
    ['0123456789', 'Player'],
    ['Wei 0123', 'Wei'],
  ])('%j -> %j', (input, expected) => {
    expect(formatBoardName(input)).toBe(expected);
  });

  it('never leaks digits, never returns a multi-part full name, and stays short', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), (raw) => {
        const out = formatBoardName(raw);
        expect(out).not.toMatch(/\d/);
        expect(Array.from(out).length).toBeLessThanOrEqual(15);
        const words = raw.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
        if (words.length >= 2 && words.every((w) => w.length >= 2)) {
          expect(out).not.toBe(raw.trim());
        }
      }),
      { numRuns: 500 }
    );
  });
});

describe('isPlausibleScore (server-side round verification)', () => {
  it('always accepts a zero score', () => {
    fc.assert(
      fc.property(fc.constantFrom(...GAME_IDS), fc.double({ min: 0, max: 3600, noNaN: true }), (game, secs) => {
        expect(isPlausibleScore(game, 0, secs)).toBe(true);
      })
    );
  });

  it('rejects any non-zero score from a round shorter than the minimum', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GAME_IDS),
        fc.integer({ min: 1, max: 5000 }),
        fc.double({ min: 0, max: MIN_ROUND_SEC - 0.001, noNaN: true }),
        (game, score, secs) => {
          expect(isPlausibleScore(game, score, secs)).toBe(false);
        }
      )
    );
  });

  it('rejects anything above the per-game cap, however long the round', () => {
    fc.assert(
      fc.property(fc.constantFrom(...GAME_IDS), fc.integer({ min: 1, max: 10_000 }), (game, extra) => {
        expect(isPlausibleScore(game, GAME_RULES[game].maxScore + extra, 10_000)).toBe(false);
      })
    );
  });

  it('accepts honest scores within the rate limit for the time actually played', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GAME_IDS),
        fc.double({ min: MIN_ROUND_SEC, max: 90, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (game, secs, fraction) => {
          const rules = GAME_RULES[game];
          const ceiling = Math.min(rules.maxScore, Math.floor(rules.maxPointsPerSec * Math.min(secs, rules.timeLimitSec)));
          const score = Math.floor(ceiling * fraction);
          expect(isPlausibleScore(game, score, secs)).toBe(true);
        }
      )
    );
  });

  it('rejects non-integer or negative scores', () => {
    expect(isPlausibleScore('santa-dash', -1, 30)).toBe(false);
    expect(isPlausibleScore('santa-dash', 2.5, 30)).toBe(false);
    expect(isPlausibleScore('santa-dash', Number.NaN, 30)).toBe(false);
  });
});

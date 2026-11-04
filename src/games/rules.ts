import type { ActiveGameId } from '../types.ts';

/**
 * Single source of truth for every round's limits AND the server's score plausibility checks.
 * Imported by the browser (game shell HUD) and by the server (run verification).
 *
 * Scoring is deliberately kept on a similar scale across games (a good round ≈ 30–100 pts)
 * so a volunteer's QR "target" stays meaningful whichever game a guest picks.
 */
export interface GameRules {
  /** Lives per round, or null when the game uses a different fail mechanic. */
  lives: number | null;
  /** Move budget per round (Candy Match), or null. */
  moves: number | null;
  /** Hard cap on live play time so a round always ends on the street. */
  timeLimitSec: number;
  /** Generous upper bound on points a legitimate player can earn per live second. */
  maxPointsPerSec: number;
  /** Absolute upper bound for a single round. */
  maxScore: number;
  /** One-line control hint shown during the 3-2-1 countdown. */
  controlHint: string;
}

export const GAME_RULES: Record<ActiveGameId, GameRules> = {
  'ice-hockey': {
    lives: null,
    moves: null,
    timeLimitSec: 45,
    maxPointsPerSec: 25,
    maxScore: 450,
    controlHint: 'Drag striker on your ice · smash the puck upward into their goal!',
  },
  'santa-dash': {
    lives: 3,
    moves: null,
    timeLimitSec: 60,
    maxPointsPerSec: 10,
    maxScore: 600,
    controlHint: 'Swipe or tap left / right · dodge the barriers',
  },
  'gift-tetris': {
    lives: 3,
    moves: null,
    timeLimitSec: 90,
    maxPointsPerSec: 20,
    maxScore: 1500,
    controlHint: 'Drag to move · tap to rotate · swipe down to drop',
  },
  'gift-slash': {
    lives: 3,
    moves: null,
    timeLimitSec: 60,
    maxPointsPerSec: 12,
    maxScore: 700,
    controlHint: 'Swipe to slice · avoid frost bombs · don’t let any fall',
  },
  'candy-match': {
    lives: null,
    moves: 20,
    timeLimitSec: 90,
    maxPointsPerSec: 80,
    maxScore: 2000,
    controlHint: 'Swap two neighbours to line up 3 · 20 moves',
  },
};

/** Countdown before live play, plus pause after each lost life. Shared so the server can allow for them. */
export const COUNTDOWN_SEC = 3;
export const LIFE_LOST_PAUSE_MS = 900;

/** Rounds shorter than this cannot post a non-zero score. */
export const MIN_ROUND_SEC = 3;

/** Unfinished runs older than this are rejected. */
export const RUN_EXPIRY_MS = 30 * 60 * 1000;

export type RoundEndReason = 'time' | 'lives' | 'moves' | 'knockout';

/**
 * Server-side plausibility check for a finished run.
 * `elapsedSec` is measured by the SERVER between run start and finish, so it already includes
 * the countdown and life-lost pauses (making the rate check slightly more lenient, never stricter).
 */
export function isPlausibleScore(gameId: ActiveGameId, score: number, elapsedSec: number): boolean {
  const rules = GAME_RULES[gameId];
  if (!rules) return false;
  if (!Number.isInteger(score) || score < 0) return false;
  if (score === 0) return true;
  if (!Number.isFinite(elapsedSec) || elapsedSec < MIN_ROUND_SEC) return false;
  if (score > rules.maxScore) return false;

  const pauseAllowanceSec = COUNTDOWN_SEC + ((rules.lives ?? 0) * LIFE_LOST_PAUSE_MS) / 1000 + 5;
  const countedSec = Math.min(elapsedSec, rules.timeLimitSec + pauseAllowanceSec);
  return score <= Math.ceil(rules.maxPointsPerSec * countedSec);
}

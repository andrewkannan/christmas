import type { RoundEndReason } from './rules.ts';

/**
 * Contract between the shared GameShell (owns countdown, lives, moves, timer, HUD, results)
 * and each game's playfield (owns only its own rules, canvas and controls).
 *
 * The shell remounts the playfield (new React `key`) for every round, so a playfield
 * never needs its own reset logic — initialise state once on mount.
 */
export interface PlayfieldApi {
  /** True only while the round is live. Freeze simulation (keep drawing) when false. Check every frame. */
  isLive(): boolean;
  /** Seconds of LIVE play so far (excludes countdown and life-lost pauses). Use for difficulty ramps. */
  elapsedSec(): number;
  /** Seconds left on the round's time cap. */
  timeLeftSec(): number;
  /** Add points (positive integers only; the shell ignores anything else). */
  addScore(points: number): void;
  /**
   * Lose one life. The shell pauses for a moment and resumes, or ends the round on the last life.
   * The playfield should clear the immediate danger (e.g. remove the barrier it hit) before resuming.
   */
  loseLife(): void;
  /** Lives left (null when the game has no lives). */
  livesLeft(): number | null;
  /** Spend one move (Candy Match). Does NOT end the round by itself. */
  spendMove(): void;
  /** Moves left (null when the game has no move limit). */
  movesLeft(): number | null;
  /** End the round now (e.g. Candy Match after the last move's cascade settles). Ignored if already over. */
  endRound(reason: RoundEndReason): void;
}

export interface PlayfieldProps {
  api: PlayfieldApi;
}

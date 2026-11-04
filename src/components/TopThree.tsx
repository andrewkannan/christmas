import type { LeaderboardEntry } from '../types.ts';
import { MedalEmblem } from './Icons.tsx';

interface TopThreeProps {
  entries: LeaderboardEntry[];
  /** Accessible label, e.g. "Claw Grab top 3". */
  label: string;
  compact?: boolean;
  /** Optional projected rank (1..3) for an unregistered player who hasn't claimed yet. */
  projectedRank?: number | null;
  projectedScore?: number;
}

const SLOT_NAMES = ['Gold #1 Spot', 'Silver #2 Spot', 'Bronze #3 Spot'] as const;

/**
 * 3-Spot Championship Podium for one game.
 * Always displays the Gold, Silver, and Bronze podium slots so even a fresh board
 * invites the player to claim the #1 crown instead of showing flat empty text.
 */
export function TopThree({
  entries,
  label,
  compact = false,
  projectedRank = null,
  projectedScore = 0,
}: TopThreeProps) {
  const ranks = [1, 2, 3] as const;

  return (
    <ol className={`top3-list${compact ? ' top3-list--compact' : ''}`} aria-label={label}>
      {ranks.map((rank) => {
        const entry = entries.find((e) => e.rank === rank);
        const isProjectedSlot =
          !entry && projectedRank === rank && projectedScore > 0;
        const isProjectedBump =
          Boolean(entry) && projectedRank === rank && projectedScore > 0;

        if (entry) {
          return (
            <li
              key={rank}
              className={`top3-row top3-row--rank-${rank}${entry.isMe ? ' top3-row--me' : ''}`}
            >
              <span className="top3-medal">
                <MedalEmblem rank={rank} size={28} />
              </span>
              <span className="visually-hidden">Rank {rank}: </span>
              <span className="top3-name">
                {entry.name}
                {entry.isMe && <span className="top3-you">YOU</span>}
                {isProjectedBump && (
                  <span className="top3-projected-tag">Beat by you ({projectedScore})</span>
                )}
              </span>
              <span className="top3-score">{entry.score}</span>
            </li>
          );
        }

        return (
          <li
            key={rank}
            className={`top3-row top3-row--open${isProjectedSlot ? ' top3-row--projected' : ''}`}
          >
            <span className="top3-medal">
              <MedalEmblem rank={rank} open={!isProjectedSlot} size={28} />
            </span>
            <span className="visually-hidden">Rank {rank}: </span>
            <span className="top3-name">
              {isProjectedSlot ? (
                <>
                  <strong>Your Score Ready!</strong>
                  <span className="top3-projected-tag">Claim to lock #{rank}</span>
                </>
              ) : (
                <span className="top3-open-label">
                  {SLOT_NAMES[rank - 1]} · {rank === 1 && entries.length === 0 ? 'Be first!' : 'Open'}
                </span>
              )}
            </span>
            <span className="top3-score top3-score--open">
              {isProjectedSlot ? projectedScore : '—'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

import type { LeaderboardEntry } from '../types.ts';

const MEDALS = ['🥇', '🥈', '🥉'] as const;

interface TopThreeProps {
  entries: LeaderboardEntry[];
  /** Accessible label, e.g. "Claw Grab top 3". */
  label: string;
  compact?: boolean;
}

/** All-time top 3 for one game. Names arrive pre-formatted by the server ("Mei L."). */
export function TopThree({ entries, label, compact = false }: TopThreeProps) {
  if (entries.length === 0) {
    return <p className="top3-empty">No one on the board yet — be the first!</p>;
  }

  return (
    <ol className={`top3-list${compact ? ' top3-list--compact' : ''}`} aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.rank} className={`top3-row${entry.isMe ? ' top3-row--me' : ''}`}>
          <span className="top3-medal" aria-hidden="true">
            {MEDALS[entry.rank - 1] ?? `#${entry.rank}`}
          </span>
          <span className="visually-hidden">Rank {entry.rank}: </span>
          <span className="top3-name">
            {entry.name}
            {entry.isMe && <span className="top3-you"> · You</span>}
          </span>
          <span className="top3-score">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}

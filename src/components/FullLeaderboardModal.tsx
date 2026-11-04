import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ACTIVE_ARCADE_GAMES,
  type ActiveGameId,
  type FullGameLeaderboard,
  type GameLeaderboard,
} from '../types.ts';
import { fetchFullGameLeaderboard } from '../lib/api.ts';
import {
  CloseIcon,
  CrownIcon,
  GameEmblem,
  MedalEmblem,
  PlayTriangleIcon,
  SparkleIcon,
  TrophyBoardIcon,
} from './Icons.tsx';

interface FullLeaderboardModalProps {
  open: boolean;
  initialGameId: ActiveGameId;
  claimToken?: string;
  summaryBoards?: GameLeaderboard[] | null;
  onClose: () => void;
  onPlayGame?: (gameId: ActiveGameId) => void;
}

const supportsDiscreteExit =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('transition-behavior: allow-discrete') &&
  CSS.supports('overlay: auto');

async function closeDialogWithAnimation(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open) return;
  if (!supportsDiscreteExit) {
    dialog.dataset.closing = '';
    const animations = dialog.getAnimations();
    if (animations.length > 0) {
      await Promise.allSettled(animations.map((a) => a.finished));
    }
    delete dialog.dataset.closing;
  }
  if (dialog.open) {
    dialog.close();
  }
}

export function FullLeaderboardModal({
  open,
  initialGameId,
  claimToken,
  summaryBoards,
  onClose,
  onPlayGame,
}: FullLeaderboardModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closingRef = useRef(false);

  const [activeGameId, setActiveGameId] = useState<ActiveGameId>(initialGameId);
  const [boardCache, setBoardCache] = useState<Partial<Record<ActiveGameId, FullGameLeaderboard>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveGameId(initialGameId);
      setBoardCache({});
    }
  }, [open, initialGameId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      closingRef.current = false;
      delete dialog.dataset.closing;
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open && !closingRef.current) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (boardCache[activeGameId]) {
      setError(false);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);

    fetchFullGameLeaderboard(activeGameId, claimToken)
      .then((data) => {
        if (!active) return;
        setBoardCache((prev) => ({ ...prev, [activeGameId]: data }));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, activeGameId, claimToken, boardCache]);

  const requestClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const dialog = dialogRef.current;
    if (dialog && dialog.open) {
      await closeDialogWithAnimation(dialog);
    }
    closingRef.current = false;
    onClose();
  }, [onClose]);

  const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      void requestClose();
    }
  };

  const handlePlaySelected = async () => {
    const targetGame = activeGameId;
    await requestClose();
    onPlayGame?.(targetGame);
  };

  const activeGame =
    ACTIVE_ARCADE_GAMES.find((g) => g.id === activeGameId) ?? ACTIVE_ARCADE_GAMES[0];
  const activeBoard = boardCache[activeGameId] ?? null;
  const leader = activeBoard?.entries[0] ?? null;
  const me = activeBoard?.me ?? null;

  let playLabel = `Play ${activeGame.title}`;
  if (me?.rank === 1) {
    playLabel = `Defend #1 Crown · Play ${activeGame.title}`;
  } else if (leader && me) {
    const needed = Math.max(1, leader.score - me.score + 1);
    playLabel = `Score +${needed} pts for #1 · Play ${activeGame.title}`;
  } else if (leader) {
    playLabel = `Beat ${leader.score} pts for #1 · Play Now`;
  } else {
    playLabel = `Claim #1 Spot · Play ${activeGame.title}`;
  }

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="leaderboard-dialog"
      aria-labelledby={titleId}
      onClick={handleDialogClick}
      onClose={() => {
        if (!closingRef.current) {
          onClose();
        }
      }}
    >
      <div className="leaderboard-dialog__sheet">
        <div className="leaderboard-dialog__header">
          <div className="leaderboard-dialog__title-wrap">
            <span className="leaderboard-dialog__kicker">
              <TrophyBoardIcon size={13} />
              <span>All-Time Hall of Champions</span>
            </span>
            <h2 id={titleId} className="leaderboard-dialog__title">
              {activeGame.title} Rankings
            </h2>
            <p className="leaderboard-dialog__subtitle">
              Best personal score per player · Unlimited full history
            </p>
          </div>

          <button
            type="button"
            className="icon-round-btn leaderboard-dialog__close"
            onClick={() => void requestClose()}
            aria-label="Close rankings"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="leaderboard-game-tabs" role="tablist" aria-label="Choose arcade game rankings">
          {ACTIVE_ARCADE_GAMES.map((g) => {
            const isSelected = g.id === activeGameId;
            const cachedMe = boardCache[g.id]?.me;
            const summaryMe = summaryBoards?.find((b) => b.gameId === g.id)?.me;
            const myRank = cachedMe?.rank ?? summaryMe?.rank ?? null;

            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`leaderboard-game-tab${isSelected ? ' leaderboard-game-tab--active' : ''}${
                  myRank !== null && myRank <= 3 ? ' leaderboard-game-tab--podium' : ''
                }`}
                onClick={() => setActiveGameId(g.id)}
              >
                <span
                  className="leaderboard-game-tab__icon"
                  style={{ background: g.accentBg, color: g.accentFg }}
                >
                  <GameEmblem gameId={g.id} size={18} />
                </span>
                <span className="leaderboard-game-tab__name">{g.title.split(' ')[0]}</span>
                {myRank !== null && myRank <= 3 && (
                  <span className="leaderboard-game-tab__rank">#{myRank}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="leaderboard-dialog__body">
          {activeBoard && (
            <div className="leaderboard-meta-strip">
              <span className="leaderboard-meta-strip__count">
                <CrownIcon size={13} />
                <span>
                  {activeBoard.totalPlayers}{' '}
                  {activeBoard.totalPlayers === 1 ? 'Ranked Player' : 'Ranked Players'}
                </span>
              </span>

              {me ? (
                <span className="leaderboard-meta-strip__me">
                  Your Best: <strong>#{me.rank}</strong> · {me.score} pts
                </span>
              ) : (
                <span className="leaderboard-meta-strip__unranked">Not ranked yet — play to join!</span>
              )}
            </div>
          )}

          {loading && !activeBoard && (
            <div className="podium-skeleton podium-skeleton--tall" aria-hidden="true" />
          )}

          {error && !activeBoard && (
            <p className="top3-empty">Could not load full rankings right now. Please try again.</p>
          )}

          {activeBoard && activeBoard.entries.length === 0 && (
            <div className="full-board-empty">
              <CrownIcon size={26} />
              <strong>#1 All-Time Spot Is Wide Open!</strong>
              <span>Play a quick round to put the very first record on {activeGame.title}.</span>
            </div>
          )}

          {activeBoard && activeBoard.entries.length > 0 && (
            <ol className="full-board__list" aria-label={`${activeGame.title} full player rankings`}>
              {activeBoard.entries.map((entry) => {
                const isTop3 = entry.rank <= 3;
                const rowClasses = [
                  'full-board__row',
                  isTop3 ? `full-board__row--rank-${entry.rank}` : '',
                  entry.isMe ? 'full-board__row--me' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <li key={`${entry.rank}-${entry.name}`} className={rowClasses}>
                    <span className="full-board__rank-cell">
                      {isTop3 ? (
                        <MedalEmblem rank={entry.rank as 1 | 2 | 3} size={28} />
                      ) : (
                        <span className="full-board__rank-num">#{entry.rank}</span>
                      )}
                    </span>

                    <span className="full-board__player">
                      <span className="full-board__name">{entry.name}</span>
                      {entry.isMe && (
                        <span className={`top3-you${isTop3 ? ` top3-you--rank-${entry.rank}` : ''}`}>
                          {entry.rank === 1 ? <CrownIcon size={10} /> : <SparkleIcon size={9} />}
                          <span>{entry.rank === 1 ? 'CHAMPION · YOU' : 'YOU'}</span>
                        </span>
                      )}
                    </span>

                    <span className="full-board__score">
                      {entry.score}
                      <span className="top3-pts">pts</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {onPlayGame && (
          <div className="leaderboard-dialog__footer">
            <button
              type="button"
              className="btn btn--primary btn--shimmer btn--full"
              onClick={() => void handlePlaySelected()}
            >
              <PlayTriangleIcon size={14} />
              <span>{playLabel}</span>
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

import {
  ACTIVE_ARCADE_GAMES,
  type ActiveGameId,
  type EventSettings,
  type GameLeaderboard,
  type PublicClaimResult,
} from '../types.ts';
import {
  CheckCircleIcon,
  CrownIcon,
  GameEmblem,
  GiftBoxIcon,
  PlayTriangleIcon,
  SparkleIcon,
  TicketPassIcon,
} from './Icons.tsx';

interface ArcadeLobbyProps {
  volunteerName: string;
  targetScore: number;
  settings: EventSettings;
  savedPass: PublicClaimResult | null;
  boards: GameLeaderboard[] | null;
  onOpenSavedPass: () => void;
  onSelectGame: (game: ActiveGameId) => void;
}

export function ArcadeLobby({
  volunteerName,
  targetScore,
  settings,
  savedPass,
  boards,
  onOpenSavedPass,
  onSelectGame,
}: ArcadeLobbyProps) {
  const conqueredCount = savedPass
    ? ACTIVE_ARCADE_GAMES.filter((g) => (savedPass.bestScores?.[g.id] ?? 0) > 0).length
    : 0;

  return (
    <section aria-labelledby="lobby-heading" className="lobby-stage stage-enter">
      <div className="hero-marquee">
        <div className="hero-marquee__glow" aria-hidden="true" />
        <div className="hero-marquee__top">
          {savedPass ? (
            <span className="marquee-pill marquee-pill--gold">
              <CheckCircleIcon size={14} />
              <span>VIP Invitation Unlocked</span>
            </span>
          ) : volunteerName ? (
            <span className="marquee-pill marquee-pill--gold">
              <CrownIcon size={14} />
              <span>Challenge · Beat {volunteerName} ({targetScore} pts)</span>
            </span>
          ) : (
            <span className="marquee-pill marquee-pill--gold">
              <SparkleIcon size={14} />
              <span>Play &amp; Win Free Gift</span>
            </span>
          )}

          {savedPass && (
            <span className="marquee-count">
              {conqueredCount}/{ACTIVE_ARCADE_GAMES.length} Scored
            </span>
          )}
        </div>

        <h1 id="lobby-heading" className="hero-marquee__title">
          Christmas Arcade
        </h1>

        <p className="hero-marquee__subtitle">
          {savedPass
            ? `Welcome back, ${savedPass.name}. Defend your Top 3 trophies or conquer a new cabinet!`
            : 'Pick any cabinet, chase the #1 trophy & unlock your gift in 45 seconds.'}
        </p>

        {savedPass ? (
          <div className="hero-marquee__pass-row">
            <div className="cabinet-dots" aria-hidden="true">
              {ACTIVE_ARCADE_GAMES.map((g) => {
                const played = (savedPass.bestScores?.[g.id] ?? 0) > 0;
                return (
                  <span
                    key={g.id}
                    className={`cabinet-dot${played ? ' cabinet-dot--done' : ''}`}
                  />
                );
              })}
            </div>
            <button
              type="button"
              className="btn btn--gold-light btn--sm"
              onClick={onOpenSavedPass}
            >
              <TicketPassIcon size={15} />
              <span>VIP Invitation</span>
            </button>
          </div>
        ) : (
          <div className="hero-reward-strip">
            <span className="hero-reward-strip__icon">
              <GiftBoxIcon size={18} />
            </span>
            <div className="hero-reward-strip__text">
              <strong>
                {(settings.giftDescription || 'Christmas Blessing Gift').replace(/\s+Pack$/i, '')}
              </strong>
              <span>+ {settings.eventTitle} VIP Invitation</span>
            </div>
          </div>
        )}
      </div>

      <ul role="list" className="arcade-shelf">
        {ACTIVE_ARCADE_GAMES.map((game) => {
          const best = savedPass?.bestScores?.[game.id];
          const board = boards?.find((b) => b.gameId === game.id);
          const leader = board?.top[0];
          const myRank = board?.me?.rank ?? null;
          const tilePodiumClass =
            myRank !== null && myRank <= 3
              ? ` arcade-tile--champion arcade-tile--rank-${myRank}`
              : '';

          return (
            <li key={game.id}>
              <button
                type="button"
                className={`arcade-tile${tilePodiumClass}`}
                onClick={() => onSelectGame(game.id)}
              >
                <div
                  className="arcade-tile__icon"
                  style={{ background: game.accentBg, color: game.accentFg }}
                >
                  <GameEmblem gameId={game.id} size={36} />
                </div>

                <div className="arcade-tile__meta">
                  <div className="arcade-tile__title-row">
                    <h2 className="arcade-tile__title">{game.title}</h2>
                    {myRank !== null && myRank <= 3 ? (
                      <span className={`podium-tier-tag podium-tier-tag--${myRank}`}>
                        <CrownIcon size={10} />
                        <span>#{myRank} HELD</span>
                      </span>
                    ) : (
                      <span className="arcade-tile__tag">
                        {game.shortTag} · {game.durationLabel}
                      </span>
                    )}
                  </div>

                  <div className="arcade-tile__sub">
                    {leader ? (
                      <span
                        className={`arcade-tile__leader${leader.isMe ? ' arcade-tile__leader--me' : ''}`}
                      >
                        <CrownIcon size={12} />
                        <span className="visually-hidden">Top score:</span>
                        <span>
                          #1 {leader.isMe ? 'You' : leader.name} · {leader.score}
                        </span>
                      </span>
                    ) : boards ? (
                      <span className="arcade-tile__leader arcade-tile__leader--open">
                        <CrownIcon size={12} />
                        <span>#1 Spot Open</span>
                      </span>
                    ) : (
                      <span className="arcade-tile__hint">{game.controlHint}</span>
                    )}

                    {typeof best === 'number' && best > 0 && (
                      <span className="arcade-tile__best">
                        <SparkleIcon size={11} />
                        <span>Best {best}</span>
                      </span>
                    )}
                  </div>
                </div>

                <span className="arcade-tile__play">
                  <span>{myRank === 1 ? 'Defend' : 'Play'}</span>
                  <PlayTriangleIcon size={11} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

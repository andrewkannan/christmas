import {
  ACTIVE_ARCADE_GAMES,
  type ActiveGameId,
  type EventSettings,
  type PublicClaimResult,
} from '../types.ts';

interface ArcadeLobbyProps {
  volunteerName: string;
  targetScore: number;
  settings: EventSettings;
  savedPass: PublicClaimResult | null;
  onOpenSavedPass: () => void;
  onSelectGame: (game: ActiveGameId) => void;
}

export function ArcadeLobby({
  volunteerName,
  targetScore,
  settings,
  savedPass,
  onOpenSavedPass,
  onSelectGame,
}: ArcadeLobbyProps) {
  return (
    <section aria-labelledby="lobby-heading">
      {savedPass ? (
        <div className="saved-pass-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="challenger-tag" style={{ background: 'var(--accent-emerald-soft)', color: 'var(--accent-emerald)' }}>
              ✓ Saved Pass
            </span>
            <strong style={{ fontSize: '0.95rem' }}>
              {savedPass.name} · {savedPass.redemptionCode}
            </strong>
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={onOpenSavedPass}>
            🎟 Open Pass
          </button>
        </div>
      ) : (
        <div className="status-strip">
          <span className="challenger-tag">
            {volunteerName ? `🎄 Beat ${volunteerName} · ${targetScore} pts` : '🎄 Free Gift'}
          </span>
          <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
            🎁 {settings.giftDescription}
          </span>
        </div>
      )}

      <div style={{ paddingInline: '0.15rem' }}>
        <h1 id="lobby-heading" className="hero-title">
          Christmas Arcade
        </h1>
        <p className="subtle-text" style={{ marginBlockStart: '0.25rem' }}>
          {savedPass ? 'Tap any game · Beat your best score' : 'Tap any game · Win your gift & pass'}
        </p>
      </div>

      <ul role="list" className="arcade-shelf">
        {ACTIVE_ARCADE_GAMES.map((game) => {
          const best = savedPass?.bestScores?.[game.id];
          return (
            <li key={game.id}>
              <button
                type="button"
                className="arcade-tile"
                onClick={() => onSelectGame(game.id)}
              >
                <div
                  className="arcade-tile__icon"
                  style={{ background: game.accentBg, color: game.accentFg }}
                  aria-hidden="true"
                >
                  {game.emoji}
                </div>

                <div className="arcade-tile__meta">
                  <h2 className="arcade-tile__title">{game.title}</h2>
                  <div className="arcade-tile__sub">
                    <span>
                      {game.shortTag} · {game.durationLabel}
                    </span>
                    {typeof best === 'number' && (
                      <span className="arcade-tile__best">★ {best}</span>
                    )}
                  </div>
                </div>

                <span className="arcade-tile__play">Play</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

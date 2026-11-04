import type { EventSettings, GameId, PublicClaimResult } from '../types.ts';

interface ArcadeLobbyProps {
  volunteerName: string;
  targetScore: number;
  settings: EventSettings;
  savedPass: PublicClaimResult | null;
  onOpenSavedPass: () => void;
  onSelectGame: (game: GameId) => void;
}

export function ArcadeLobby({
  volunteerName,
  targetScore,
  settings,
  savedPass,
  onOpenSavedPass,
  onSelectGame,
}: ArcadeLobbyProps) {
  const challengerLabel = volunteerName || `${settings.churchName} Team`;
  const bestRush = savedPass?.bestScores?.['gift-rush'];
  const bestDuel = savedPass?.bestScores?.['tap-duel'];
  const bestDrop = savedPass?.bestScores?.['starlight-drop'];

  return (
    <section aria-labelledby="lobby-heading">
      {savedPass ? (
        <div className="saved-pass-banner">
          <div>
            <span className="challenger-tag">Session Saved on Your Phone</span>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 800, fontSize: '1.02rem' }}>
              👋 Welcome back, {savedPass.name}! ({savedPass.totalGamesPlayed || 1} games played)
            </p>
            <p className="subtle-text" style={{ fontSize: '0.84rem' }}>
              Keep playing any game below to beat your high scores—your Christmas E-Invitation is
              always ready!
            </p>
          </div>
          <button type="button" className="btn btn--gold btn--sm" onClick={onOpenSavedPass}>
            🎟 My E-Invitation &amp; Pass
          </button>
        </div>
      ) : (
        <div className="challenger-banner">
          <div>
            <span className="challenger-tag">Street Challenge</span>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 800, fontSize: '1.05rem' }}>
              {volunteerName
                ? `🎄 ${volunteerName} challenges you! Beat ${targetScore} pts`
                : `🎄 Win any 15–20s game to claim your free gift!`}
            </p>
          </div>
          <span aria-hidden="true" style={{ fontSize: '1.9rem' }}>
            🎁
          </span>
        </div>
      )}

      <h1 id="lobby-heading" className="hero-title">
        {savedPass
          ? 'Play More Christmas Arcade Games!'
          : 'Pick Any Game, Win a Gift & Christmas Pass'}
      </h1>
      <p className="subtle-text" style={{ marginBlockStart: '0.45rem' }}>
        {savedPass ? (
          <>
            Your pass <strong>{savedPass.redemptionCode}</strong> for{' '}
            <strong>{settings.eventTitle}</strong> is saved—try all 3 games or challenge a friend!
          </>
        ) : (
          <>
            Zero rules to read—each game takes under 20 seconds. Unlock your{' '}
            <strong style={{ color: 'var(--accent-gold-bright)' }}>
              {settings.giftDescription}
            </strong>{' '}
            and personal invite to <strong>{settings.eventTitle}</strong>.
          </>
        )}
      </p>

      <ul role="list" className="arcade-list">
        <li>
          <button
            type="button"
            className="arcade-card"
            onClick={() => onSelectGame('gift-rush')}
          >
            <div className="arcade-card__top">
              <span className="arcade-card__rule">Rule: Slide to Catch!</span>
              <span className="arcade-card__pill">
                {typeof bestRush === 'number'
                  ? `🏆 Best: ${bestRush} pts`
                  : `20s · Solo vs ${challengerLabel}`}
              </span>
            </div>
            <h2 className="arcade-card__title">
              <span aria-hidden="true">⚡</span> Gift &amp; Star Rush
            </h2>
            <p className="subtle-text">
              Catch falling gifts and grab the glowing Bethlehem Star for 2x Golden Fever to beat{' '}
              {targetScore} pts.
            </p>
            <span className="arcade-card__cta">
              {savedPass ? 'Replay Gift & Star Rush →' : 'Play Gift & Star Rush →'}
            </span>
          </button>
        </li>

        <li>
          <button
            type="button"
            className="arcade-card"
            onClick={() => onSelectGame('tap-duel')}
          >
            <div className="arcade-card__top">
              <span className="arcade-card__rule">Rule: Tap Your Side Fastest!</span>
              <span className="arcade-card__pill">
                {typeof bestDuel === 'number'
                  ? `🏆 Best: ${bestDuel} pts`
                  : '15s · 2 Players · 1 Phone'}
              </span>
            </div>
            <h2 className="arcade-card__title">
              <span aria-hidden="true">🥊</span> Sleigh Tap Duel
            </h2>
            <p className="subtle-text">
              Hold one phone between you and {volunteerName || 'a friend'}—tap your side &amp; hit
              golden bells to pull the Christmas sleigh across!
            </p>
            <span className="arcade-card__cta">Start 2-Player Duel →</span>
          </button>
        </li>

        <li>
          <button
            type="button"
            className="arcade-card"
            onClick={() => onSelectGame('starlight-drop')}
          >
            <div className="arcade-card__top">
              <span className="arcade-card__rule">Rule: Tap to Drop 3 Stars!</span>
              <span className="arcade-card__pill">
                {typeof bestDrop === 'number'
                  ? `🏆 Best: ${bestDrop} pts`
                  : '15s · Chill + 1 Trivia'}
              </span>
            </div>
            <h2 className="arcade-card__title">
              <span aria-hidden="true">🎯</span> Starlight Drop &amp; Spark
            </h2>
            <p className="subtle-text">
              Drop 3 glowing starlight tokens down the festive pegboard + unlock 1 fun Christmas
              bonus question.
            </p>
            <span className="arcade-card__cta">
              {savedPass ? 'Replay Starlight Drop →' : 'Play Starlight Drop →'}
            </span>
          </button>
        </li>
      </ul>
    </section>
  );
}

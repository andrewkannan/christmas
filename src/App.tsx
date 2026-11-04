import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveGameId, EventSettings, GameId, PublicClaimResult } from './types.ts';
import { checkTeamSession, fetchPublicConfig, fetchSavedPass } from './lib/api.ts';
import {
  clearSavedPassLocally,
  loadSavedPass,
  resetVisitorIdForNewFriend,
  savePassLocally,
  trackArcadeEvent,
} from './lib/playerSession.ts';
import { isSoundMuted, toggleSoundMuted } from './lib/sound.ts';
import { ArcadeLobby } from './components/ArcadeLobby.tsx';
import { ClawMachineGame } from './components/games/ClawMachineGame.tsx';
import { SantaStreetDash } from './components/games/SantaStreetDash.tsx';
import { ChristmasTetris } from './components/games/ChristmasTetris.tsx';
import { FruitSlashGame } from './components/games/FruitSlashGame.tsx';
import { CandyMatchGame } from './components/games/CandyMatchGame.tsx';
import { ClaimForm } from './components/ClaimForm.tsx';
import { WinnerPass } from './components/WinnerPass.tsx';
import { TeamLogin } from './team/TeamLogin.tsx';
import { TeamDashboard } from './team/TeamDashboard.tsx';

const FALLBACK_SETTINGS: EventSettings = {
  churchName: 'Hope Community',
  eventTitle: 'Christmas Night of Wonder',
  eventSubtitle: 'Live Acoustic Carols, Hot Cocoa, Festive Games & A Story of Hope',
  eventDateIso: '2026-12-24T19:30',
  timezoneOffset: '+08:00',
  durationMinutes: 120,
  venueName: 'Starlight Atrium Hall, Level 3',
  venueAddress: '18 Central Walk (2 mins from Central Station)',
  mapsUrl: 'https://maps.google.com',
  defaultCountryCode: '60',
  giftDescription: 'Christmas Blessing Gift Pack',
  whatsappTemplate:
    'Hey {name}! 🎄 So fun playing the Christmas Arcade with you earlier ({volunteer} here!).\n\nHere is your personal invite to *{eventTitle}*:\n📅 {eventDate}\n📍 {venueName} ({venueAddress})\n\n🎟 Open your E-Ticket & play more games anytime: {inviteUrl}\n\nBring a friend along—we would love to host you! ✨',
};

type PlayerStep =
  | { kind: 'lobby' }
  | { kind: 'playing'; game: ActiveGameId }
  | { kind: 'claim'; game: ActiveGameId; score: number }
  | {
      kind: 'winner';
      claim: PublicClaimResult;
      replay?: { gameId: GameId; score: number } | null;
    };

export function App() {
  const [routeMode, setRouteMode] = useState<'player' | 'team'>(() =>
    window.location.pathname.startsWith('/team') ? 'team' : 'player'
  );
  const [teamAuthed, setTeamAuthed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<EventSettings>(FALLBACK_SETTINGS);
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState(
    'https://calendar.google.com/calendar/render?action=TEMPLATE'
  );
  const [soundMuted, setSoundMuted] = useState(() => isSoundMuted());
  const [savedPass, setSavedPass] = useState<PublicClaimResult | null>(() => loadSavedPass());
  const [step, setStep] = useState<PlayerStep>({ kind: 'lobby' });
  const initialViewLoggedRef = useRef(false);

  const { volunteerName, targetScore, urlPassToken } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const vs = (params.get('vs') || params.get('challenger') || '').trim().slice(0, 40);
    const rawTarget = Number(params.get('target'));
    const validTarget =
      Number.isFinite(rawTarget) && rawTarget >= 5 && rawTarget <= 60 ? Math.round(rawTarget) : 18;
    const passToken = (params.get('pass') || '').trim();
    return { volunteerName: vs, targetScore: validTarget, urlPassToken: passToken };
  }, []);

  useEffect(() => {
    fetchPublicConfig()
      .then((res) => {
        setSettings(res.settings);
        setGoogleCalendarUrl(res.googleCalendarUrl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (window.location.pathname.startsWith('/team')) return;

    const existingLocal = loadSavedPass();
    const tokenToSync = urlPassToken || existingLocal?.claimToken || '';
    const isReturnPlayer = Boolean(urlPassToken || existingLocal);

    if (!initialViewLoggedRef.current) {
      initialViewLoggedRef.current = true;
      void trackArcadeEvent({
        eventType: 'page_view',
        claimToken: tokenToSync || undefined,
        isPostInteraction: isReturnPlayer,
        volunteerName: volunteerName || existingLocal?.volunteerName || undefined,
      });
    }

    if (tokenToSync) {
      fetchSavedPass(tokenToSync)
        .then(({ claim }) => {
          savePassLocally(claim);
          setSavedPass(claim);
          if (urlPassToken) {
            void trackArcadeEvent({
              eventType: 'e_invite_view',
              claimToken: claim.claimToken,
              isPostInteraction: true,
              volunteerName: claim.volunteerName,
            });
            setStep({ kind: 'winner', claim, replay: null });
          }
        })
        .catch(() => {
          if (!urlPassToken && existingLocal) {
            clearSavedPassLocally();
            setSavedPass(null);
          }
        });
    }
  }, [urlPassToken, volunteerName]);

  useEffect(() => {
    if (routeMode === 'team') {
      checkTeamSession()
        .then((res) => setTeamAuthed(res.authenticated))
        .catch(() => setTeamAuthed(false));
    }
  }, [routeMode]);

  useEffect(() => {
    const onPopState = () => {
      setRouteMode(window.location.pathname.startsWith('/team') ? 'team' : 'player');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (routeMode === 'team') {
      document.title = `Master Console | ${settings.churchName}`;
      return;
    }
    switch (step.kind) {
      case 'lobby':
        document.title = `Christmas Arcade | ${settings.churchName}`;
        break;
      case 'playing':
        document.title = `Playing | Christmas Arcade`;
        break;
      case 'claim':
        document.title = `Claim Gift | ${settings.churchName}`;
        break;
      case 'winner':
        document.title = `Pass ${step.claim.redemptionCode} | ${settings.eventTitle}`;
        break;
    }
  }, [routeMode, step, settings.churchName, settings.eventTitle]);

  const navigateMode = (nextMode: 'player' | 'team') => {
    const targetPath = nextMode === 'team' ? '/team' : `/${window.location.search}`;
    window.history.pushState({}, '', targetPath);
    setRouteMode(nextMode);
  };

  const handleSelectGame = (game: ActiveGameId) => {
    void trackArcadeEvent(
      {
        eventType: 'game_start',
        gameId: game,
        claimToken: savedPass?.claimToken,
        isPostInteraction: Boolean(savedPass),
        volunteerName: volunteerName || savedPass?.volunteerName || undefined,
      },
      (updated) => setSavedPass(updated)
    );
    setStep({ kind: 'playing', game });
  };

  const handleGameFinished = (game: ActiveGameId, score: number) => {
    if (savedPass) {
      const optimisticClaim: PublicClaimResult = {
        ...savedPass,
        totalGamesPlayed: (savedPass.totalGamesPlayed || 1) + 1,
        gamesAfterInteraction: (savedPass.gamesAfterInteraction || 0) + 1,
        bestScores: {
          ...savedPass.bestScores,
          [game]: Math.max(savedPass.bestScores?.[game] || 0, score),
        },
      };
      savePassLocally(optimisticClaim);
      setSavedPass(optimisticClaim);
      setStep({
        kind: 'winner',
        claim: optimisticClaim,
        replay: { gameId: game, score },
      });

      void trackArcadeEvent(
        {
          eventType: 'game_complete',
          gameId: game,
          score,
          claimToken: savedPass.claimToken,
          isPostInteraction: true,
          volunteerName: volunteerName || savedPass.volunteerName || undefined,
        },
        (refreshed) => {
          setSavedPass(refreshed);
          setStep((curr) =>
            curr.kind === 'winner' ? { ...curr, claim: refreshed } : curr
          );
        }
      );
      return;
    }

    void trackArcadeEvent({
      eventType: 'game_complete',
      gameId: game,
      score,
      isPostInteraction: false,
      volunteerName: volunteerName || undefined,
    });
    setStep({ kind: 'claim', game, score });
  };

  const handleOpenSavedInvite = () => {
    if (!savedPass) return;
    void trackArcadeEvent(
      {
        eventType: 'e_invite_view',
        claimToken: savedPass.claimToken,
        isPostInteraction: true,
        volunteerName: savedPass.volunteerName || volunteerName || undefined,
      },
      (updated) => setSavedPass(updated)
    );
    setStep({ kind: 'winner', claim: savedPass, replay: null });
  };

  const handleStartFreshFriend = () => {
    clearSavedPassLocally();
    resetVisitorIdForNewFriend();
    setSavedPass(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('pass');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `/?${qs}` : '/');
    void trackArcadeEvent({
      eventType: 'page_view',
      isPostInteraction: false,
      volunteerName: volunteerName || undefined,
    });
    setStep({ kind: 'lobby' });
  };

  return (
    <div className={`app-shell ${routeMode === 'team' ? 'app-shell--wide' : ''}`}>
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <header className="top-bar no-print">
        <a
          href={`/${window.location.search}`}
          className="brand-mark"
          onClick={(e) => {
            e.preventDefault();
            navigateMode('player');
            setStep({ kind: 'lobby' });
          }}
        >
          <span className="brand-badge" aria-hidden="true">
            🎄
          </span>
          <span>{settings.churchName}</span>
        </a>

        <nav aria-label="Controls" style={{ display: 'flex', gap: '0.38rem', alignItems: 'center' }}>
          {routeMode === 'player' && savedPass && step.kind !== 'winner' && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleOpenSavedInvite}
            >
              🎟 Pass
            </button>
          )}
          {routeMode === 'player' && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-pressed={soundMuted}
              aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
              onClick={() => setSoundMuted(toggleSoundMuted())}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => navigateMode(routeMode === 'team' ? 'player' : 'team')}
          >
            {routeMode === 'team' ? 'Arcade' : 'Team'}
          </button>
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {routeMode === 'team' ? (
          teamAuthed === null ? (
            <div className="card-panel">Checking session…</div>
          ) : teamAuthed ? (
            <TeamDashboard
              settings={settings}
              onSettingsUpdated={(next) => {
                setSettings(next);
                fetchPublicConfig()
                  .then((r) => setGoogleCalendarUrl(r.googleCalendarUrl))
                  .catch(() => {});
              }}
              onLoggedOut={() => setTeamAuthed(false)}
            />
          ) : (
            <TeamLogin onAuthenticated={() => setTeamAuthed(true)} />
          )
        ) : (
          <>
            {step.kind === 'lobby' && (
              <ArcadeLobby
                volunteerName={volunteerName}
                targetScore={targetScore}
                settings={settings}
                savedPass={savedPass}
                onOpenSavedPass={handleOpenSavedInvite}
                onSelectGame={handleSelectGame}
              />
            )}

            {step.kind === 'playing' && step.game === 'claw-machine' && (
              <ClawMachineGame
                targetScore={targetScore}
                onBack={() => setStep({ kind: 'lobby' })}
                onFinish={(score) => handleGameFinished('claw-machine', score)}
              />
            )}

            {step.kind === 'playing' && step.game === 'santa-dash' && (
              <SantaStreetDash
                targetScore={targetScore}
                onBack={() => setStep({ kind: 'lobby' })}
                onFinish={(score) => handleGameFinished('santa-dash', score)}
              />
            )}

            {step.kind === 'playing' && step.game === 'gift-tetris' && (
              <ChristmasTetris
                targetScore={targetScore}
                onBack={() => setStep({ kind: 'lobby' })}
                onFinish={(score) => handleGameFinished('gift-tetris', score)}
              />
            )}

            {step.kind === 'playing' && step.game === 'gift-slash' && (
              <FruitSlashGame
                targetScore={targetScore}
                onBack={() => setStep({ kind: 'lobby' })}
                onFinish={(score) => handleGameFinished('gift-slash', score)}
              />
            )}

            {step.kind === 'playing' && step.game === 'candy-match' && (
              <CandyMatchGame
                targetScore={targetScore}
                onBack={() => setStep({ kind: 'lobby' })}
                onFinish={(score) => handleGameFinished('candy-match', score)}
              />
            )}

            {step.kind === 'claim' && (
              <ClaimForm
                gamePlayed={step.game}
                score={step.score}
                targetScore={targetScore}
                volunteerName={volunteerName}
                settings={settings}
                onClaimed={(claim) => {
                  savePassLocally(claim);
                  setSavedPass(claim);
                  void trackArcadeEvent({
                    eventType: 'e_invite_view',
                    claimToken: claim.claimToken,
                    isPostInteraction: false,
                    volunteerName: claim.volunteerName || volunteerName || undefined,
                  });
                  setStep({ kind: 'winner', claim, replay: null });
                }}
                onReplay={() => setStep({ kind: 'lobby' })}
              />
            )}

            {step.kind === 'winner' && (
              <WinnerPass
                claim={step.claim}
                settings={settings}
                googleCalendarUrl={googleCalendarUrl}
                latestReplay={step.replay}
                onPassUpdated={(next) => {
                  setSavedPass(next);
                  setStep((curr) => (curr.kind === 'winner' ? { ...curr, claim: next } : curr));
                }}
                onKeepPlayingSamePlayer={() => setStep({ kind: 'lobby' })}
                onStartFreshFriend={handleStartFreshFriend}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

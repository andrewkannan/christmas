import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  ACTIVE_ARCADE_GAMES,
  type ActiveGameId,
  type EventSettings,
  type GameLeaderboard,
  type PublicClaimResult,
  type RunFinishResult,
  type TeamSessionUser,
} from './types.ts';
import type { PlayfieldProps } from './games/playfield.ts';
import { checkTeamSession, fetchLeaderboards, fetchPublicConfig, fetchSavedPass } from './lib/api.ts';
import {
  clearLocalBests,
  clearSavedPassLocally,
  loadSavedPass,
  resetVisitorIdForNewFriend,
  savePassLocally,
  trackArcadeEvent,
} from './lib/playerSession.ts';
import { isSoundMuted, playArcadeTone, setMusicScene, toggleSoundMuted } from './lib/sound.ts';
import {
  StarMarkIcon,
  TicketPassIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from './components/Icons.tsx';
import { ArcadeLobby } from './components/ArcadeLobby.tsx';
import { GameShell } from './components/games/GameShell.tsx';
import { StarlightAirHockey } from './components/games/StarlightAirHockey.tsx';
import { SantaStreetDash } from './components/games/SantaStreetDash.tsx';
import { ChristmasTetris } from './components/games/ChristmasTetris.tsx';
import { FruitSlashGame } from './components/games/FruitSlashGame.tsx';
import { CandyMatchGame } from './components/games/CandyMatchGame.tsx';
import { ClaimForm } from './components/ClaimForm.tsx';
import { WinnerPass } from './components/WinnerPass.tsx';
import { TeamLogin } from './team/TeamLogin.tsx';
import { TeamDashboard } from './team/TeamDashboard.tsx';

const PLAYFIELDS: Record<ActiveGameId, ComponentType<PlayfieldProps>> = {
  'ice-hockey': StarlightAirHockey,
  'santa-dash': SantaStreetDash,
  'gift-tetris': ChristmasTetris,
  'gift-slash': FruitSlashGame,
  'candy-match': CandyMatchGame,
};

const FALLBACK_SETTINGS: EventSettings = {
  churchName: 'CCC JB Bilingual',
  eventTitle: 'Christmas Night of Wonder',
  eventSubtitle: 'Live Acoustic Carols, Hot Cocoa, Festive Games & A Story of Hope',
  eventDateIso: '2026-12-24T19:30',
  timezoneOffset: '+08:00',
  durationMinutes: 120,
  venueName: 'Starlight Atrium Hall, Level 3',
  venueAddress: '18 Central Walk (2 mins from Central Station)',
  mapsUrl: 'https://maps.google.com',
  wazeUrl: '',
  defaultCountryCode: '60',
  giftDescription: 'Christmas Blessing Gift',
  whatsappTemplate:
    'Hey {name}! 🎄 So fun playing the Christmas Arcade with you earlier ({volunteer} here!).\n\nHere is your personal invite to *{eventTitle}*:\n📅 {eventDate}\n📍 {venueName} ({venueAddress})\n\n🎟 Open your E-Ticket & play more games anytime: {inviteUrl}\n\nBring a friend along—we would love to host you! ✨',
};

type PlayerStep =
  | { kind: 'lobby' }
  | { kind: 'playing'; game: ActiveGameId }
  | {
      kind: 'claim';
      game: ActiveGameId;
      score: number;
      projectedRank: number | null;
      rivalVolunteerName?: string;
    }
  | { kind: 'winner'; claim: PublicClaimResult; justUnlocked?: boolean };

export function App() {
  const [routeMode, setRouteMode] = useState<'player' | 'team'>(() =>
    window.location.pathname.startsWith('/team') ? 'team' : 'player'
  );
  const [teamAuthed, setTeamAuthed] = useState<boolean | null>(null);
  const [teamUser, setTeamUser] = useState<TeamSessionUser | null>(null);
  const [settings, setSettings] = useState<EventSettings>(FALLBACK_SETTINGS);
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState(
    'https://calendar.google.com/calendar/render?action=TEMPLATE'
  );
  const [soundMuted, setSoundMuted] = useState(() => isSoundMuted());
  const [savedPass, setSavedPass] = useState<PublicClaimResult | null>(() => loadSavedPass());
  const [step, setStep] = useState<PlayerStep>({ kind: 'lobby' });
  const [boards, setBoards] = useState<GameLeaderboard[] | null>(null);
  const initialViewLoggedRef = useRef(false);

  const { volunteerName, challengerName, targetScore, urlPassToken } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const vs = (params.get('vs') || params.get('challenger') || '').trim().slice(0, 40);
    const friend = (params.get('friend') || '').trim().slice(0, 40);
    const rawTarget = Number(params.get('target'));
    const validTarget =
      Number.isFinite(rawTarget) && rawTarget >= 5 && rawTarget <= 999 ? Math.round(rawTarget) : 18;
    const passToken = (params.get('pass') || '').trim();
    return {
      volunteerName: vs,
      challengerName: vs || friend,
      targetScore: validTarget,
      urlPassToken: passToken,
    };
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
            setStep({ kind: 'winner', claim, justUnlocked: false });
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
        .then((res) => {
          setTeamAuthed(res.authenticated);
          setTeamUser(res.authenticated ? (res.user ?? null) : null);
        })
        .catch(() => {
          setTeamAuthed(false);
          setTeamUser(null);
        });
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
        document.title = `Unlock Gift & VIP Invitation | ${settings.churchName}`;
        break;
      case 'winner':
        document.title = `VIP Invitation | ${settings.eventTitle}`;
        break;
    }
  }, [routeMode, step, settings.churchName, settings.eventTitle]);

  // Background Christmas music on Lobby, Claim & VIP Invitation (GameShell manages per-game & victory scenes)
  useEffect(() => {
    if (routeMode === 'team') {
      setMusicScene('none');
      return;
    }
    if (step.kind !== 'playing') {
      setMusicScene('christmas-bg');
    }
  }, [routeMode, step.kind]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [routeMode, step.kind]);

  const navigateMode = (nextMode: 'player' | 'team') => {
    const targetPath = nextMode === 'team' ? '/team' : `/${window.location.search}`;
    window.history.pushState({}, '', targetPath);
    setRouteMode(nextMode);
  };

  // Refresh the all-time boards whenever the guest is back on the game shelf.
  useEffect(() => {
    if (routeMode !== 'player' || step.kind !== 'lobby') return;
    let active = true;
    fetchLeaderboards(savedPass?.claimToken)
      .then((res) => {
        if (active) setBoards(res.games);
      })
      .catch(() => {
        // Lobby still works without leaderboard data (e.g. offline).
      });
    return () => {
      active = false;
    };
  }, [routeMode, step.kind, savedPass?.claimToken]);

  const handleSelectGame = (game: ActiveGameId) => {
    setStep({ kind: 'playing', game });
  };

  const handleRoundRecorded = useCallback((result: RunFinishResult) => {
    if (result.claim) {
      savePassLocally(result.claim);
      setSavedPass(result.claim);
    }
  }, []);

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
    setStep({ kind: 'winner', claim: savedPass, justUnlocked: false });
  };

  const handleStartFreshFriend = () => {
    clearSavedPassLocally();
    clearLocalBests();
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

  const playingGame =
    step.kind === 'playing' ? ACTIVE_ARCADE_GAMES.find((g) => g.id === step.game) : undefined;

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
          <span className="brand-badge">
            <StarMarkIcon size={18} />
          </span>
          <span className="brand-copy">
            <span className="brand-copy__name">{settings.churchName}</span>
            <span className="brand-copy__sub">Christmas Arcade</span>
          </span>
        </a>

        <nav aria-label="Controls" className="top-bar__controls">
          {routeMode === 'player' && savedPass && step.kind !== 'winner' && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleOpenSavedInvite}
            >
              <TicketPassIcon size={15} />
              <span>VIP Invite</span>
            </button>
          )}
          {routeMode === 'player' && (
            <button
              type="button"
              className={`icon-round-btn${soundMuted ? '' : ' icon-round-btn--music-on'}`}
              aria-pressed={soundMuted}
              aria-label={soundMuted ? 'Unmute music and sound' : 'Mute music and sound'}
              onClick={() => setSoundMuted(toggleSoundMuted())}
            >
              {soundMuted ? <VolumeOffIcon size={18} /> : <VolumeOnIcon size={18} />}
            </button>
          )}
          {routeMode === 'team' && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigateMode('player')}>
              Arcade
            </button>
          )}
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="app-main"
      >
        {routeMode === 'team' ? (
          teamAuthed === null ? (
            <div className="card-panel">Checking session…</div>
          ) : teamAuthed ? (
            <TeamDashboard
              currentUser={teamUser}
              settings={settings}
              onSettingsUpdated={(next) => {
                setSettings(next);
                fetchPublicConfig()
                  .then((r) => setGoogleCalendarUrl(r.googleCalendarUrl))
                  .catch(() => {});
              }}
              onLoggedOut={() => {
                setTeamUser(null);
                setTeamAuthed(false);
              }}
            />
          ) : (
            <TeamLogin
              onAuthenticated={(user) => {
                setTeamUser(user);
                setTeamAuthed(true);
              }}
            />
          )
        ) : (
          <>
            {step.kind === 'lobby' && (
              <ArcadeLobby
                volunteerName={challengerName}
                targetScore={targetScore}
                settings={settings}
                savedPass={savedPass}
                boards={boards}
                onOpenSavedPass={handleOpenSavedInvite}
                onSelectGame={handleSelectGame}
              />
            )}

            {step.kind === 'playing' && playingGame && (
              <GameShell
                key={playingGame.id}
                game={playingGame}
                Playfield={PLAYFIELDS[playingGame.id]}
                claimToken={savedPass?.claimToken}
                guestName={savedPass?.name}
                passBest={savedPass?.bestScores?.[playingGame.id] ?? 0}
                volunteerName={volunteerName}
                challengerName={challengerName}
                targetScore={targetScore}
                onExit={() => setStep({ kind: 'lobby' })}
                onSelectGame={handleSelectGame}
                onClaim={(sessionBest, projectedRank, rivalVolunteerName) =>
                  setStep({
                    kind: 'claim',
                    game: playingGame.id,
                    score: sessionBest,
                    projectedRank,
                    rivalVolunteerName,
                  })
                }
                onOpenPass={handleOpenSavedInvite}
                onRoundRecorded={handleRoundRecorded}
              />
            )}

            {step.kind === 'claim' && (
              <ClaimForm
                gamePlayed={step.game}
                score={step.score}
                projectedRank={step.projectedRank}
                targetScore={targetScore}
                volunteerName={volunteerName || step.rivalVolunteerName || ''}
                settings={settings}
                onClaimed={(claim) => {
                  savePassLocally(claim);
                  setSavedPass(claim);
                  playArcadeTone('fanfare');
                  void trackArcadeEvent({
                    eventType: 'e_invite_view',
                    claimToken: claim.claimToken,
                    isPostInteraction: false,
                    volunteerName:
                      claim.volunteerName || volunteerName || step.rivalVolunteerName || undefined,
                  });
                  setStep({ kind: 'winner', claim, justUnlocked: true });
                }}
                onReplay={() => setStep({ kind: 'lobby' })}
              />
            )}

            {step.kind === 'winner' && (
              <WinnerPass
                claim={step.claim}
                justUnlocked={Boolean(step.justUnlocked)}
                settings={settings}
                googleCalendarUrl={googleCalendarUrl}
                onPassUpdated={(next) => {
                  setSavedPass(next);
                  setStep((curr) => (curr.kind === 'winner' ? { ...curr, claim: next } : curr));
                }}
                onSelectGame={handleSelectGame}
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

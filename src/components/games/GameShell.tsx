import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type {
  ActiveGameId,
  ArcadeGameMeta,
  HockeyMatchTallies,
  HockeySessionConfig,
  RunFinishResult,
} from '../../types.ts';
import { GAME_RULES, LIFE_LOST_PAUSE_MS, type RoundEndReason } from '../../games/rules.ts';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { finishGameRun, startGameRun } from '../../lib/api.ts';
import { getOrCreateVisitorId, loadLocalBest, saveLocalBest } from '../../lib/playerSession.ts';
import { playArcadeTone, setMusicScene, triggerHaptic } from '../../lib/sound.ts';
import { ConfettiBurst } from '../ConfettiBurst.tsx';
import { FullLeaderboardModal } from '../FullLeaderboardModal.tsx';
import {
  BoltMovesIcon,
  CloseIcon,
  CrownIcon,
  GameEmblem,
  GiftBoxIcon,
  GridGamesIcon,
  HeartIcon,
  PlayTriangleIcon,
  ReplayIcon,
  ShiningTrophy,
  SparkleIcon,
  TicketPassIcon,
  TimerClockIcon,
  TrophyBoardIcon,
  VersusPhonesIcon,
} from '../Icons.tsx';
import { TopThree } from '../TopThree.tsx';
import { HockeyMatchmaker } from './HockeyMatchmaker.tsx';

type Phase = 'matchmaking' | 'countdown' | 'playing' | 'hit' | 'paused' | 'ending' | 'results';

type RemoteResult =
  | { state: 'loading' }
  | { state: 'done'; result: RunFinishResult }
  | { state: 'offline' };

interface RoundResult {
  score: number;
  reason: RoundEndReason;
  previousBest: number;
}

interface GameShellProps {
  game: ArcadeGameMeta;
  Playfield: ComponentType<PlayfieldProps>;
  claimToken?: string;
  guestName?: string;
  /** Best score already on the player's saved pass for this game. */
  passBest: number;
  volunteerName: string;
  challengerName?: string;
  targetScore: number;
  onExit: () => void;
  onSelectGame?: (game: ActiveGameId) => void;
  onClaim: (sessionBest: number, projectedRank: number | null, rivalVolunteerName?: string) => void;
  onOpenPass: () => void;
  onRoundRecorded: (result: RunFinishResult) => void;
}

const COUNTDOWN_STEP_MS = 800;
const ENDING_BANNER_MS = 950;

const END_TITLES: Record<RoundEndReason, string> = {
  time: "Time's up!",
  lives: 'Out of lives',
  moves: 'Out of moves',
  knockout: 'Match Point!',
};

function useCountUp(target: number, durationMs = 520): number {
  const [value, setValue] = useState(() => {
    if (
      target <= 0 ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      return target;
    }
    return 0;
  });

  useEffect(() => {
    if (
      target <= 0 ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      setValue(target);
      return undefined;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / durationMs));
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

export function GameShell({
  game,
  Playfield,
  claimToken,
  guestName,
  passBest,
  volunteerName,
  challengerName,
  targetScore,
  onExit,
  onSelectGame,
  onClaim,
  onOpenPass,
  onRoundRecorded,
}: GameShellProps) {
  const rules = GAME_RULES[game.id];
  const hasPass = Boolean(claimToken);
  const isHockey = game.id === 'ice-hockey';

  const [hockeySession, setHockeySession] = useState<HockeySessionConfig | null>(null);
  const [matchmakerInitialTab, setMatchmakerInitialTab] = useState<'host' | 'join'>('host');
  const [matchTallies, setMatchTallies] = useState<HockeyMatchTallies | null>(null);

  const isJoinerRole = hockeySession?.mode === 'joiner';
  const isLiveVersus = hockeySession?.mode === 'host' || hockeySession?.mode === 'joiner';
  const livePartnerName =
    hockeySession?.mode === 'host' ? hockeySession.opponentName : '';
  const displayChallenger = challengerName || volunteerName || livePartnerName;

  const [roundKey, setRoundKey] = useState(0);
  const [phase, setPhase] = useState<Phase>(isHockey ? 'matchmaking' : 'countdown');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | null>(rules.lives);
  const [moves, setMoves] = useState<number | null>(rules.moves);
  const [timeLeft, setTimeLeft] = useState(rules.timeLimitSec);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [remote, setRemote] = useState<RemoteResult>({ state: 'loading' });

  const phaseRef = useRef<Phase>(isHockey ? 'matchmaking' : 'countdown');
  const scoreRef = useRef(0);
  const livesRef = useRef<number | null>(rules.lives);
  const movesRef = useRef<number | null>(rules.moves);
  const liveMsRef = useRef(0);
  const shownSecRef = useRef(rules.timeLimitSec);
  const endedRef = useRef(false);
  const sessionBestRef = useRef(0);
  const runRef = useRef<Promise<{ runId: string } | null> | null>(null);
  const runStartedForRoundRef = useRef(-1);
  const timersRef = useRef<number[]>([]);
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const submitRound = useCallback(
    async (finalScore: number, reason: RoundEndReason) => {
      setRemote({ state: 'loading' });
      try {
        const run = await runRef.current;
        if (!run) throw new Error('Round was not registered');
        const result = await finishGameRun(run.runId, {
          visitorId: getOrCreateVisitorId(),
          score: finalScore,
          endReason: reason,
        });
        setRemote({ state: 'done', result });
        onRoundRecorded(result);
      } catch {
        setRemote({ state: 'offline' });
      }
    },
    [onRoundRecorded]
  );

  const endRound = useCallback(
    (reason: RoundEndReason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      const finalScore = scoreRef.current;
      const previousBest = Math.max(loadLocalBest(game.id), passBest);

      // Only rank the guest (solo or room host) — evangelist/challenger joiners never pollute local/public boards.
      if (!isJoinerRole) {
        saveLocalBest(game.id, finalScore);
        sessionBestRef.current = Math.max(sessionBestRef.current, finalScore);
      }

      setRoundResult({ score: finalScore, reason, previousBest });
      setPhaseBoth('ending');
      playArcadeTone(finalScore > 0 ? 'win' : 'pickup');
      triggerHaptic(45);
      if (!isJoinerRole) {
        void submitRound(finalScore, reason);
      }
      schedule(() => {
        playArcadeTone('fanfare');
        setPhaseBoth('results');
      }, ENDING_BANNER_MS);
    },
    [game.id, isJoinerRole, passBest, schedule, setPhaseBoth, submitRound]
  );

  const endRoundRef = useRef(endRound);
  endRoundRef.current = endRound;

  // Dynamic per-game & victory soundtrack switching
  useEffect(() => {
    if (phase === 'paused') {
      setMusicScene('none');
    } else if (phase === 'ending' || phase === 'results') {
      setMusicScene('victory');
    } else if (phase === 'matchmaking') {
      setMusicScene('christmas-bg');
    } else {
      setMusicScene(game.id);
    }
  }, [phase, game.id]);

  // Start (or restart) a round: wait in 'matchmaking' for Starlight Hockey until a session is chosen,
  // then run 3-2-1 countdown and live play.
  useEffect(() => {
    if (isHockey && !hockeySession) {
      clearTimers();
      setPhaseBoth('matchmaking');
      return clearTimers;
    }

    endedRef.current = false;
    scoreRef.current = 0;
    livesRef.current = rules.lives;
    movesRef.current = rules.moves;
    liveMsRef.current = 0;
    shownSecRef.current = rules.timeLimitSec;
    setScore(0);
    setLives(rules.lives);
    setMoves(rules.moves);
    setTimeLeft(rules.timeLimitSec);
    setRoundResult(null);
    setRemote({ state: 'loading' });
    setCountdown(3);
    setPhaseBoth('countdown');

    // Guard so React StrictMode's double effect in development doesn't register two server runs.
    // Evangelist/friend code joiners ('joiner') skip server run registration so only guests rank publicly.
    if (hockeySession?.mode !== 'joiner' && runStartedForRoundRef.current !== roundKey) {
      runStartedForRoundRef.current = roundKey;
      const effectiveVolunteer =
        volunteerName || (hockeySession?.mode === 'host' ? hockeySession.opponentName : undefined);
      runRef.current = startGameRun({
        gameId: game.id,
        visitorId: getOrCreateVisitorId(),
        claimToken,
        volunteerName: effectiveVolunteer || undefined,
      }).catch(() => null);
    }

    playArcadeTone('tap');
    schedule(() => {
      setCountdown(2);
      playArcadeTone('tap');
    }, COUNTDOWN_STEP_MS);
    schedule(() => {
      setCountdown(1);
      playArcadeTone('tap');
    }, COUNTDOWN_STEP_MS * 2);
    schedule(() => {
      setCountdown(0);
      playArcadeTone('star');
      setPhaseBoth('playing');
    }, COUNTDOWN_STEP_MS * 3);

    return clearTimers;
  }, [roundKey, isHockey, hockeySession]);

  // Shell clock: runs strictly during 'playing' so countdown, pauses, life-lost beats,
  // and the Victory Stage never eat the timer or spin an idle 60fps rAF loop.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    let raf = 0;
    let last = performance.now();
    // Give live 2-phone rooms a 1.5s grace buffer so the server's authoritative 'finished' snapshot
    // (including the +15 Match Win Bonus) arrives first, while still guaranteeing local fallback completion.
    const hardCapSec = isLiveVersus ? rules.timeLimitSec + 1.5 : rules.timeLimitSec;

    const loop = (now: number) => {
      const dtMs = Math.min(100, Math.max(0, now - last));
      last = now;
      if (phaseRef.current === 'playing') {
        liveMsRef.current += dtMs;
        const left = Math.max(0, rules.timeLimitSec - liveMsRef.current / 1000);
        const shown = Math.ceil(left);
        if (shown !== shownSecRef.current) {
          shownSecRef.current = shown;
          setTimeLeft(shown);
        }
        if (liveMsRef.current / 1000 >= hardCapSec) {
          endRoundRef.current('time');
        }
      }
      if (phaseRef.current === 'playing') {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, rules.timeLimitSec, isLiveVersus]);

  // Auto-pause when the phone locks or the guest switches apps (solo games only; live 2-phone matches stay synced).
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'playing' && !isLiveVersus) {
        setPhaseBoth('paused');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [setPhaseBoth, isLiveVersus]);

  useEffect(() => {
    if (phase === 'results') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      resultsHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  const api = useMemo<PlayfieldApi>(
    () => ({
      isLive: () => phaseRef.current === 'playing',
      elapsedSec: () => liveMsRef.current / 1000,
      timeLeftSec: () => Math.max(0, rules.timeLimitSec - liveMsRef.current / 1000),
      addScore: (points: number) => {
        if (phaseRef.current !== 'playing' || !Number.isInteger(points) || points <= 0) return;
        scoreRef.current += points;
        setScore(scoreRef.current);
      },
      loseLife: () => {
        if (phaseRef.current !== 'playing' || livesRef.current === null) return;
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        playArcadeTone('hit');
        triggerHaptic(60);
        if (livesRef.current === 0) {
          endRoundRef.current('lives');
          return;
        }
        setPhaseBoth('hit');
        schedule(() => {
          if (phaseRef.current === 'hit') setPhaseBoth('playing');
        }, LIFE_LOST_PAUSE_MS);
      },
      livesLeft: () => livesRef.current,
      spendMove: () => {
        if (phaseRef.current !== 'playing' || movesRef.current === null) return;
        movesRef.current = Math.max(0, movesRef.current - 1);
        setMoves(movesRef.current);
      },
      movesLeft: () => movesRef.current,
      endRound: (reason: RoundEndReason) => endRoundRef.current(reason),
    }),
    [roundKey, rules.timeLimitSec]
  );

  const retry = () => {
    clearTimers();
    if (isHockey && (hockeySession?.mode === 'host' || hockeySession?.mode === 'joiner')) {
      setMatchmakerInitialTab(hockeySession.mode === 'joiner' ? 'join' : 'host');
      setHockeySession(null);
      setMatchTallies(null);
      setRoundKey((k) => k + 1);
      return;
    }
    setMatchTallies(null);
    setRoundKey((k) => k + 1);
  };

  const openVersusMatchmaker = (tab: 'host' | 'join' = 'host') => {
    clearTimers();
    setMatchmakerInitialTab(tab);
    setHockeySession(null);
    setMatchTallies(null);
    setRoundKey((k) => k + 1);
  };

  const lowTime = timeLeft <= 10 && (phase === 'playing' || phase === 'hit');

  return (
    <section className="game-stage" aria-label={game.title}>
      {phase === 'matchmaking' && (
        <>
          <div className="game-hud">
            <button
              type="button"
              className="hud-icon-btn"
              onClick={onExit}
              aria-label="Back to all games"
            >
              <CloseIcon size={16} />
            </button>
            <span className="hud-pill hud-pill--versus">
              <VersusPhonesIcon size={14} />
              <span>2P Live Versus · Solo</span>
            </span>
          </div>

          <HockeyMatchmaker
            guestName={guestName}
            volunteerName={volunteerName}
            initialTab={matchmakerInitialTab}
            onStartSession={(nextSession) => {
              setMatchTallies({
                myGoals: 0,
                oppGoals: 0,
                opponentName: nextSession.opponentName,
              });
              setHockeySession(nextSession);
            }}
          />
        </>
      )}

      {phase !== 'matchmaking' && phase !== 'results' && (
        <div className="game-hud">
          <button
            type="button"
            className="hud-icon-btn"
            onClick={onExit}
            aria-label="Back to all games"
          >
            <CloseIcon size={16} />
          </button>

          <span className="hud-pill hud-pill--score" aria-label={`Score ${score}`}>
            <span key={score} className="hud-score-bump">
              <SparkleIcon size={13} />
              <span>{score}</span>
            </span>
          </span>

          {isHockey && matchTallies && (
            <span
              className="hud-pill hud-pill--versus"
              aria-label={`Goals: You ${matchTallies.myGoals}, ${matchTallies.opponentName} ${matchTallies.oppGoals}`}
            >
              <span>YOU {matchTallies.myGoals}</span>
              <span className="hud-versus-sep">–</span>
              <span>{matchTallies.oppGoals} RIVAL</span>
            </span>
          )}

          {lives !== null && rules.lives !== null && (
            <span className="hud-pill hud-lives" aria-label={`${lives} of ${rules.lives} lives left`}>
              {Array.from({ length: rules.lives }, (_, i) => (
                <span key={i} className={i < lives ? 'heart' : 'heart heart--lost'}>
                  <HeartIcon filled={i < lives} size={15} />
                </span>
              ))}
            </span>
          )}

          {moves !== null && (
            <span className="hud-pill hud-moves" aria-label={`${moves} moves left`}>
              <BoltMovesIcon size={15} />
              <span>{moves}</span>
            </span>
          )}

          <span
            className={`hud-pill hud-pill--timer${lowTime ? ' hud-pill--warn' : ''}`}
            aria-label={`${timeLeft} seconds left`}
          >
            <TimerClockIcon size={13} />
            <span>{timeLeft}s</span>
          </span>
        </div>
      )}

      {phase !== 'matchmaking' && phase !== 'results' && (
        <div className="game-field">
          <Playfield
            key={`${roundKey}-${hockeySession?.mode ?? 'std'}-${hockeySession?.roomCode ?? ''}`}
            api={api}
            hockeySession={hockeySession ?? undefined}
            onMatchTallies={isHockey ? setMatchTallies : undefined}
          />

          {phase === 'countdown' && (
            <div className="game-overlay" role="status" aria-live="assertive">
              <div
                className="game-overlay__emblem"
                style={{ background: game.accentBg, color: game.accentFg }}
              >
                <GameEmblem gameId={game.id} size={40} />
              </div>
              <div className="game-overlay__title">{game.title}</div>
              {isHockey && hockeySession && (
                <div className="game-overlay__versus-pill">
                  {hockeySession.mode === 'solo'
                    ? 'Solo vs Frosty Elf Bot'
                    : `Live Room ${hockeySession.roomCode} · vs ${hockeySession.opponentName}`}
                </div>
              )}
              <div className="countdown-num" key={countdown}>
                {countdown > 0 ? countdown : 'GO!'}
              </div>
              <p className="game-overlay__hint">{rules.controlHint}</p>
            </div>
          )}

          {phase === 'hit' && (
            <div className="game-overlay game-overlay--hit" role="status" aria-live="assertive">
              <div className="life-lost">
                <HeartIcon filled={false} size={34} />
                <span>−1</span>
              </div>
              <p className="game-overlay__hint">
                {livesRef.current} {livesRef.current === 1 ? 'life' : 'lives'} left — keep going!
              </p>
            </div>
          )}

          {phase === 'paused' && (
            <div className="game-overlay" role="dialog" aria-label="Game paused">
              <div className="game-overlay__title">Game Paused</div>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setPhaseBoth('playing')}
              >
                <PlayTriangleIcon size={14} />
                <span>Resume</span>
              </button>
            </div>
          )}

          {phase === 'ending' && roundResult && (
            <div className="game-overlay game-overlay--finish" role="status" aria-live="assertive">
              <ShiningTrophy size={72} />
              <div className="game-overlay__title game-overlay__title--big">
                {END_TITLES[roundResult.reason]}
              </div>
              <div className="countdown-num countdown-num--score">{roundResult.score} pts</div>
            </div>
          )}
        </div>
      )}

      {phase === 'results' && roundResult && isJoinerRole && (
        <ChallengerRoundResults
          game={game}
          result={roundResult}
          tallies={matchTallies}
          roomCode={hockeySession?.roomCode}
          headingRef={resultsHeadingRef}
          onJoinNext={() => openVersusMatchmaker('join')}
          onPlaySolo={() => {
            clearTimers();
            setMatchTallies({
              myGoals: 0,
              oppGoals: 0,
              opponentName: 'Frosty Elf Bot',
            });
            setHockeySession({
              mode: 'solo',
              myName: guestName || 'Player 1',
              opponentName: 'Frosty Elf Bot',
            });
            setRoundKey((k) => k + 1);
          }}
          onExit={onExit}
        />
      )}

      {phase === 'results' && roundResult && !isJoinerRole && (
        <RoundResults
          game={game}
          result={roundResult}
          remote={remote}
          hasPass={hasPass}
          claimToken={claimToken}
          volunteerName={displayChallenger}
          targetScore={targetScore}
          matchTallies={isHockey ? matchTallies : null}
          hockeyMode={isHockey ? hockeySession?.mode ?? null : null}
          headingRef={resultsHeadingRef}
          onRetry={retry}
          onOpenVersusCode={isHockey ? () => openVersusMatchmaker('host') : undefined}
          onSelectGame={onSelectGame}
          onClaim={(projectedRank) =>
            onClaim(
              sessionBestRef.current,
              projectedRank,
              livePartnerName || undefined
            )
          }
          onOpenPass={onOpenPass}
          onExit={onExit}
        />
      )}
    </section>
  );
}

interface ChallengerRoundResultsProps {
  game: ArcadeGameMeta;
  result: RoundResult;
  tallies: HockeyMatchTallies | null;
  roomCode?: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onJoinNext: () => void;
  onPlaySolo: () => void;
  onExit: () => void;
}

function ChallengerRoundResults({
  game,
  result,
  tallies,
  roomCode,
  headingRef,
  onJoinNext,
  onPlaySolo,
  onExit,
}: ChallengerRoundResultsProps) {
  const displayScore = useCountUp(result.score);
  const myGoals = tallies?.myGoals ?? 0;
  const guestGoals = tallies?.oppGoals ?? 0;
  const guestLabel = tallies?.opponentName || 'Guest';

  let headline = 'Great Live Duel!';
  if (guestGoals > myGoals) {
    headline = `${guestLabel} Won ${guestGoals}–${myGoals}!`;
  } else if (myGoals > guestGoals) {
    headline = `You Won ${myGoals}–${guestGoals}!`;
  } else {
    headline = `Epic ${myGoals}–${guestGoals} Draw!`;
  }

  return (
    <div className="victory-card stage-enter">
      <ConfettiBurst intensity="medium" />

      <div className="victory-hero">
        <div className="victory-hero__glow" aria-hidden="true" />
        <ShiningTrophy tier="gold" size={86} rankBadge={null} />

        <h2 ref={headingRef} tabIndex={-1} className="victory-hero__heading">
          <span className="victory-hero__reason">{END_TITLES[result.reason]}</span>
          <span className="visually-hidden"> · </span>
          <span className="victory-hero__headline">{headline}</span>
        </h2>

        <div className="victory-score" aria-label={`You scored ${result.score} points`}>
          <span className="victory-score__num">{displayScore}</span>
          <span className="victory-score__unit">PTS</span>
        </div>

        <div className="results-chips">
          <span className="chip chip--gold-glow">
            <VersusPhonesIcon size={13} />
            <span>
              {guestLabel} {guestGoals} – {myGoals} You
            </span>
          </span>
          {roomCode && <span className="chip chip--glass">Room {roomCode}</span>}
        </div>
      </div>

      <div className="victory-body">
        <div className="rank-spotlight rank-spotlight--emerald" role="status" aria-live="polite">
          <span className="rank-spotlight__badge">
            <GiftBoxIcon size={18} />
          </span>
          <div className="rank-spotlight__copy">
            <strong>Challenger Mode · Guest Ranked Only</strong>
            <span>
              {guestLabel}&apos;s phone has their Champion Rank, Christmas Blessing Gift &amp; VIP
              Invitation!
            </span>
          </div>
        </div>

        <div className="results-actions">
          <button
            type="button"
            className="btn btn--primary btn--shimmer btn--full"
            onClick={onJoinNext}
          >
            <VersusPhonesIcon size={18} />
            <span>Join Next 4-Digit Code</span>
          </button>

          <button type="button" className="btn btn--ghost btn--full" onClick={onPlaySolo}>
            <ReplayIcon size={17} />
            <span>Play Solo on {game.title}</span>
          </button>

          <button type="button" className="btn btn--subtle btn--sm" onClick={onExit}>
            <GridGamesIcon size={15} />
            <span>All games</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface RoundResultsProps {
  game: ArcadeGameMeta;
  result: RoundResult;
  remote: RemoteResult;
  hasPass: boolean;
  claimToken?: string;
  volunteerName: string;
  targetScore: number;
  matchTallies?: HockeyMatchTallies | null;
  hockeyMode?: HockeySessionConfig['mode'] | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onOpenVersusCode?: () => void;
  onSelectGame?: (game: ActiveGameId) => void;
  onClaim: (projectedRank: number | null) => void;
  onOpenPass: () => void;
  onExit: () => void;
}

function RoundResults({
  game,
  result,
  remote,
  hasPass,
  claimToken,
  volunteerName,
  targetScore,
  matchTallies,
  hockeyMode,
  headingRef,
  onRetry,
  onOpenVersusCode,
  onSelectGame,
  onClaim,
  onOpenPass,
  onExit,
}: RoundResultsProps) {
  const [fullBoardOpen, setFullBoardOpen] = useState(false);
  const isNewBest = result.score > 0 && result.score > result.previousBest;
  const best = Math.max(result.score, result.previousBest);
  const displayScore = useCountUp(result.score);

  const effectiveRank =
    remote.state === 'done' ? (remote.result.rank ?? remote.result.wouldRank) : null;
  const projectedRank =
    remote.state === 'done' && !hasPass ? remote.result.wouldRank : null;
  const isPodiumWin = effectiveRank !== null && effectiveRank <= 3 && result.score > 0;

  const trophyTier: 'gold' | 'silver' | 'bronze' =
    effectiveRank === 2 ? 'silver' : effectiveRank === 3 ? 'bronze' : 'gold';

  let headline = 'Gift Unlocked!';
  if (effectiveRank === 1 && result.score > 0) {
    headline = hasPass ? '#1 All-Time Leader!' : '#1 Score Unlocked!';
  } else if (effectiveRank !== null && effectiveRank <= 3 && result.score > 0) {
    headline = `Top ${effectiveRank} Podium Run!`;
  } else if (matchTallies && matchTallies.myGoals > matchTallies.oppGoals) {
    headline = `Won ${matchTallies.myGoals}–${matchTallies.oppGoals} vs ${matchTallies.opponentName}!`;
  } else if (volunteerName && result.score >= targetScore) {
    headline = `You Beat ${volunteerName}!`;
  } else if (isNewBest) {
    headline = 'New Personal Best!';
  } else if (result.score > 0) {
    headline = 'Great Arcade Run!';
  }

  const claimLabel =
    projectedRank !== null && projectedRank <= 3
      ? `Claim my gift · Lock #${projectedRank}`
      : 'Claim my gift & VIP pass';

  const topLeaderScore =
    remote.state === 'done' && remote.result.board.top[0]
      ? remote.result.board.top[0].score
      : null;

  let replayLabel = hockeyMode === 'host' ? 'Play again · New 4-Digit Duel' : 'Play again';
  if (hasPass && hockeyMode !== 'host') {
    if (effectiveRank === 1 && best > 0) {
      replayLabel = `Play again · Push ${best} pts record`;
    } else if (topLeaderScore !== null && best < topLeaderScore) {
      const ptsToFirst = topLeaderScore - best + 1;
      replayLabel =
        ptsToFirst <= 35 ? `Play again · +${ptsToFirst} pts for #1!` : 'Play again · Climb higher';
    } else if (best > 0) {
      replayLabel = `Play again · Beat ${best} pts`;
    }
  }

  return (
    <div className="victory-card stage-enter">
      <ConfettiBurst intensity={effectiveRank === 1 || isNewBest ? 'high' : 'medium'} />

      <div className="victory-hero">
        <div className="victory-hero__glow" aria-hidden="true" />

        <ShiningTrophy
          tier={trophyTier}
          size={94}
          rankBadge={effectiveRank && effectiveRank <= 3 ? effectiveRank : null}
        />

        <h2 ref={headingRef} tabIndex={-1} className="victory-hero__heading">
          <span className="victory-hero__reason">{END_TITLES[result.reason]}</span>
          <span className="visually-hidden"> · </span>
          <span className="victory-hero__headline">{headline}</span>
        </h2>

        <div className="victory-score" aria-label={`You scored ${result.score} points`}>
          <span className="victory-score__num">{displayScore}</span>
          <span className="victory-score__unit">PTS</span>
        </div>

        <div className="results-chips">
          {isNewBest ? (
            <span className="chip chip--gold-glow">
              <CrownIcon size={13} />
              <span>New best!</span>
            </span>
          ) : (
            <span className="chip chip--glass">Best {best}</span>
          )}

          {matchTallies ? (
            <span
              className={`chip ${
                matchTallies.myGoals > matchTallies.oppGoals ? 'chip--emerald-glow' : 'chip--glass'
              }`}
            >
              Goals: You {matchTallies.myGoals} – {matchTallies.oppGoals} {matchTallies.opponentName}
            </span>
          ) : (
            volunteerName && (
              <span
                className={`chip ${result.score >= targetScore ? 'chip--emerald-glow' : 'chip--glass'}`}
              >
                {result.score >= targetScore
                  ? `Beat ${volunteerName}'s ${targetScore}`
                  : `${targetScore - result.score} pts to beat ${volunteerName}`}
              </span>
            )
          )}
        </div>
      </div>

      <div className="victory-body">
        <RankSpotlight remote={remote} score={result.score} gameTitle={game.title} />

        <div className={`results-board${isPodiumWin ? ' results-board--winner-glow' : ''}`}>
          <div className="results-board__header">
            <h3 className="results-board__title">
              <span
                className="results-board__emblem"
                style={{ background: game.accentBg, color: game.accentFg }}
              >
                <GameEmblem gameId={game.id} size={18} />
              </span>
              <span>{game.title} · Champion Board</span>
            </h3>

            <button
              type="button"
              className="results-board__view-all"
              onClick={() => setFullBoardOpen(true)}
            >
              <TrophyBoardIcon size={13} />
              <span>
                {remote.state === 'done' && remote.result.board.totalPlayers > 0
                  ? `All ${remote.result.board.totalPlayers} ›`
                  : 'Full Board ›'}
              </span>
            </button>
          </div>

          {remote.state === 'loading' && <div className="podium-skeleton" aria-hidden="true" />}
          {remote.state === 'offline' && (
            <p className="top3-empty">Leaderboard unavailable offline.</p>
          )}
          {remote.state === 'done' && (
            <TopThree
              entries={remote.result.board.top}
              label={`${game.title} top 3`}
              projectedRank={projectedRank}
              projectedScore={result.score}
            />
          )}
        </div>

        <div className="results-actions">
          {hasPass ? (
            <>
              <button
                type="button"
                className="btn btn--primary btn--shimmer btn--full"
                onClick={onRetry}
              >
                <ReplayIcon size={18} />
                <span>{replayLabel}</span>
              </button>
              {hockeyMode === 'solo' && onOpenVersusCode && (
                <button
                  type="button"
                  className="btn btn--ghost btn--full"
                  onClick={onOpenVersusCode}
                >
                  <VersusPhonesIcon size={17} />
                  <span>2-Phone 4-Digit Versus</span>
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--full" onClick={onOpenPass}>
                <TicketPassIcon size={18} />
                <span>VIP Invitation &amp; Ranks</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--primary btn--shimmer btn--full"
                onClick={() => onClaim(projectedRank)}
              >
                <GiftBoxIcon size={19} />
                <span>{claimLabel}</span>
              </button>
              <button type="button" className="btn btn--ghost btn--full" onClick={onRetry}>
                <ReplayIcon size={17} />
                <span>{replayLabel}</span>
              </button>
              {hockeyMode === 'solo' && onOpenVersusCode && (
                <button
                  type="button"
                  className="btn btn--subtle btn--sm"
                  onClick={onOpenVersusCode}
                >
                  <VersusPhonesIcon size={15} />
                  <span>Challenge a Friend (4-Digit Code)</span>
                </button>
              )}
            </>
          )}

          <button type="button" className="btn btn--subtle btn--sm" onClick={onExit}>
            <GridGamesIcon size={15} />
            <span>All games</span>
          </button>
        </div>
      </div>

      <FullLeaderboardModal
        open={fullBoardOpen}
        initialGameId={game.id}
        claimToken={claimToken}
        onClose={() => setFullBoardOpen(false)}
        onPlayGame={(nextGameId) => {
          if (nextGameId === game.id) {
            onRetry();
          } else if (onSelectGame) {
            onSelectGame(nextGameId);
          }
        }}
      />
    </div>
  );
}

function RankSpotlight({
  remote,
  score,
  gameTitle,
}: {
  remote: RemoteResult;
  score: number;
  gameTitle: string;
}) {
  if (remote.state === 'loading') {
    return (
      <div className="rank-spotlight rank-spotlight--neutral" role="status" aria-live="polite">
        <span className="rank-spotlight__badge">…</span>
        <div className="rank-spotlight__copy">
          <strong>Checking your rank…</strong>
          <span>Verifying {gameTitle} leaderboard</span>
        </div>
      </div>
    );
  }

  if (remote.state === 'offline') {
    return (
      <div className="rank-spotlight rank-spotlight--warn" role="status" aria-live="polite">
        <span className="rank-spotlight__badge">!</span>
        <div className="rank-spotlight__copy">
          <strong>Saved on this phone</strong>
          <span>Reconnect to post to the live leaderboard</span>
        </div>
      </div>
    );
  }

  if (remote.result.status === 'rejected') {
    return (
      <div className="rank-spotlight rank-spotlight--warn" role="status" aria-live="polite">
        <span className="rank-spotlight__badge">!</span>
        <div className="rank-spotlight__copy">
          <strong>Unverified round</strong>
          <span>Your gift is still ready — play another round to rank</span>
        </div>
      </div>
    );
  }

  if (remote.result.rank !== null) {
    const r = remote.result.rank;
    const total = remote.result.board.totalPlayers;
    return (
      <div
        className={`rank-spotlight ${r <= 3 ? 'rank-spotlight--gold' : 'rank-spotlight--emerald'}`}
        role="status"
        aria-live="polite"
      >
        <span className="rank-spotlight__badge">#{r}</span>
        <div className="rank-spotlight__copy">
          <strong>
            {r === 1 ? 'All-Time #1 Champion!' : `Official Rank #${r} of ${total}`}
          </strong>
          <span>
            {r === 1
              ? `You hold the crown on ${gameTitle}`
              : 'Score locked onto your VIP Pass'}
          </span>
        </div>
      </div>
    );
  }

  if (remote.result.wouldRank !== null) {
    const wr = remote.result.wouldRank;
    return (
      <div
        className={`rank-spotlight ${wr <= 3 ? 'rank-spotlight--gold' : 'rank-spotlight--emerald'}`}
        role="status"
        aria-live="polite"
      >
        <span className="rank-spotlight__badge">#{wr}</span>
        <div className="rank-spotlight__copy">
          <strong>
            {wr === 1 ? 'Rank #1 Spot Is Yours!' : `Rank #${wr} Ready to Lock!`}
          </strong>
          <span>Claim your gift below to put your name on the board</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rank-spotlight rank-spotlight--emerald" role="status" aria-live="polite">
      <span className="rank-spotlight__badge">
        <GiftBoxIcon size={18} />
      </span>
      <div className="rank-spotlight__copy">
        <strong>{score === 0 ? 'Free Christmas Gift Ready!' : 'Winner Gift Unlocked!'}</strong>
        <span>
          {score === 0
            ? 'Claim your gift now or play again to post a score'
            : 'Claim your gift below to join the all-time leaderboard'}
        </span>
      </div>
    </div>
  );
}

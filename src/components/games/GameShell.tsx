import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { ArcadeGameMeta, RunFinishResult } from '../../types.ts';
import { GAME_RULES, LIFE_LOST_PAUSE_MS, type RoundEndReason } from '../../games/rules.ts';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { finishGameRun, startGameRun } from '../../lib/api.ts';
import { getOrCreateVisitorId, loadLocalBest, saveLocalBest } from '../../lib/playerSession.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';
import { ConfettiBurst } from '../ConfettiBurst.tsx';
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
} from '../Icons.tsx';
import { TopThree } from '../TopThree.tsx';

type Phase = 'countdown' | 'playing' | 'hit' | 'paused' | 'ending' | 'results';

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
  /** Best score already on the player's saved pass for this game. */
  passBest: number;
  volunteerName: string;
  targetScore: number;
  onExit: () => void;
  onClaim: (sessionBest: number, projectedRank: number | null) => void;
  onOpenPass: () => void;
  onRoundRecorded: (result: RunFinishResult) => void;
}

const COUNTDOWN_STEP_MS = 800;
const ENDING_BANNER_MS = 950;

const END_TITLES: Record<RoundEndReason, string> = {
  time: "Time's up!",
  lives: 'Out of lives',
  moves: 'Out of moves',
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
  passBest,
  volunteerName,
  targetScore,
  onExit,
  onClaim,
  onOpenPass,
  onRoundRecorded,
}: GameShellProps) {
  const rules = GAME_RULES[game.id];
  const hasPass = Boolean(claimToken);

  const [roundKey, setRoundKey] = useState(0);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | null>(rules.lives);
  const [moves, setMoves] = useState<number | null>(rules.moves);
  const [timeLeft, setTimeLeft] = useState(rules.timeLimitSec);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [remote, setRemote] = useState<RemoteResult>({ state: 'loading' });

  const phaseRef = useRef<Phase>('countdown');
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
      saveLocalBest(game.id, finalScore);
      sessionBestRef.current = Math.max(sessionBestRef.current, finalScore);

      setRoundResult({ score: finalScore, reason, previousBest });
      setPhaseBoth('ending');
      playArcadeTone(finalScore > 0 ? 'win' : 'pickup');
      triggerHaptic(45);
      void submitRound(finalScore, reason);
      schedule(() => {
        playArcadeTone('fanfare');
        setPhaseBoth('results');
      }, ENDING_BANNER_MS);
    },
    [game.id, passBest, schedule, setPhaseBoth, submitRound]
  );

  const endRoundRef = useRef(endRound);
  endRoundRef.current = endRound;

  // Start (or restart) a round: countdown, then live play. Runs on mount and on every retry.
  useEffect(() => {
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
    if (runStartedForRoundRef.current !== roundKey) {
      runStartedForRoundRef.current = roundKey;
      runRef.current = startGameRun({
        gameId: game.id,
        visitorId: getOrCreateVisitorId(),
        claimToken,
        volunteerName: volunteerName || undefined,
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
    // Intentionally keyed on roundKey only: a round restarts exactly when the player taps Retry.
  }, [roundKey]);

  // Shell clock: runs strictly during 'playing' so countdown, pauses, life-lost beats,
  // and the Victory Stage never eat the timer or spin an idle 60fps rAF loop.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    let raf = 0;
    let last = performance.now();
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
        if (left <= 0) endRoundRef.current('time');
      }
      if (phaseRef.current === 'playing') {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, rules.timeLimitSec]);

  // Auto-pause when the phone locks or the guest switches apps.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'playing') setPhaseBoth('paused');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [setPhaseBoth]);

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
    setRoundKey((k) => k + 1);
  };

  const lowTime = timeLeft <= 10 && (phase === 'playing' || phase === 'hit');

  return (
    <section className="game-stage" aria-label={game.title}>
      {phase !== 'results' && (
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

      {phase !== 'results' && (
        <div className="game-field">
          <Playfield key={roundKey} api={api} />

          {phase === 'countdown' && (
            <div className="game-overlay" role="status" aria-live="assertive">
              <div
                className="game-overlay__emblem"
                style={{ background: game.accentBg, color: game.accentFg }}
              >
                <GameEmblem gameId={game.id} size={40} />
              </div>
              <div className="game-overlay__title">{game.title}</div>
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

      {phase === 'results' && roundResult && (
        <RoundResults
          game={game}
          result={roundResult}
          remote={remote}
          hasPass={hasPass}
          volunteerName={volunteerName}
          targetScore={targetScore}
          headingRef={resultsHeadingRef}
          onRetry={retry}
          onClaim={(projectedRank) => onClaim(sessionBestRef.current, projectedRank)}
          onOpenPass={onOpenPass}
          onExit={onExit}
        />
      )}
    </section>
  );
}

interface RoundResultsProps {
  game: ArcadeGameMeta;
  result: RoundResult;
  remote: RemoteResult;
  hasPass: boolean;
  volunteerName: string;
  targetScore: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onClaim: (projectedRank: number | null) => void;
  onOpenPass: () => void;
  onExit: () => void;
}

function RoundResults({
  game,
  result,
  remote,
  hasPass,
  volunteerName,
  targetScore,
  headingRef,
  onRetry,
  onClaim,
  onOpenPass,
  onExit,
}: RoundResultsProps) {
  const isNewBest = result.score > 0 && result.score > result.previousBest;
  const best = Math.max(result.score, result.previousBest);
  const displayScore = useCountUp(result.score);

  const effectiveRank =
    remote.state === 'done' ? (remote.result.rank ?? remote.result.wouldRank) : null;
  const projectedRank =
    remote.state === 'done' && !hasPass ? remote.result.wouldRank : null;

  const trophyTier: 'gold' | 'silver' | 'bronze' =
    effectiveRank === 2 ? 'silver' : effectiveRank === 3 ? 'bronze' : 'gold';

  let headline = 'Gift Unlocked!';
  if (effectiveRank === 1 && result.score > 0) {
    headline = hasPass ? '#1 All-Time Leader!' : '#1 Score Unlocked!';
  } else if (effectiveRank !== null && effectiveRank <= 3 && result.score > 0) {
    headline = `Top ${effectiveRank} Podium Run!`;
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

          {volunteerName && (
            <span
              className={`chip ${result.score >= targetScore ? 'chip--emerald-glow' : 'chip--glass'}`}
            >
              {result.score >= targetScore
                ? `Beat ${volunteerName}'s ${targetScore}`
                : `${targetScore - result.score} pts to beat ${volunteerName}`}
            </span>
          )}
        </div>
      </div>

      <div className="victory-body">
        <RankSpotlight remote={remote} score={result.score} gameTitle={game.title} />

        <div className="results-board">
          <div className="results-board__header">
            <h3 className="results-board__title">
              <span
                className="results-board__emblem"
                style={{ background: game.accentBg, color: game.accentFg }}
              >
                <GameEmblem gameId={game.id} size={18} />
              </span>
              <span>{game.title} · Top 3</span>
            </h3>
            {remote.state === 'done' && remote.result.board.totalPlayers > 0 && (
              <span className="results-board__count">
                {remote.result.board.totalPlayers}{' '}
                {remote.result.board.totalPlayers === 1 ? 'player' : 'players'}
              </span>
            )}
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
                <span>Play again</span>
              </button>
              <button type="button" className="btn btn--ghost btn--full" onClick={onOpenPass}>
                <TicketPassIcon size={18} />
                <span>My pass</span>
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
                <span>Play again</span>
              </button>
            </>
          )}

          <button type="button" className="btn btn--subtle btn--sm" onClick={onExit}>
            <GridGamesIcon size={15} />
            <span>All games</span>
          </button>
        </div>
      </div>
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

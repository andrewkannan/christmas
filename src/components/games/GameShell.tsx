import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { ArcadeGameMeta, RunFinishResult } from '../../types.ts';
import { GAME_RULES, LIFE_LOST_PAUSE_MS, type RoundEndReason } from '../../games/rules.ts';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { finishGameRun, startGameRun } from '../../lib/api.ts';
import { getOrCreateVisitorId, loadLocalBest, saveLocalBest } from '../../lib/playerSession.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';
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
  onClaim: (sessionBest: number) => void;
  onOpenPass: () => void;
  onRoundRecorded: (result: RunFinishResult) => void;
}

const COUNTDOWN_STEP_MS = 800;
const ENDING_BANNER_MS = 1100;

const END_TITLES: Record<RoundEndReason, string> = {
  time: "Time's up!",
  lives: 'Out of lives',
  moves: 'Out of moves',
};

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
      playArcadeTone(finalScore > previousBest && finalScore > 0 ? 'win' : 'pickup');
      triggerHaptic(40);
      void submitRound(finalScore, reason);
      schedule(() => setPhaseBoth('results'), ENDING_BANNER_MS);
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

  // Shell clock: counts LIVE time only, so countdown, pauses and life-lost beats never eat the timer.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dtMs = Math.min(100, now - last);
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
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rules.timeLimitSec]);

  // Auto-pause when the phone locks or the guest switches apps.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'playing') setPhaseBoth('paused');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [setPhaseBoth]);

  useEffect(() => {
    if (phase === 'results') resultsHeadingRef.current?.focus();
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
    // A fresh api object per round keeps each playfield instance isolated; methods read refs, so no other deps.
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
        <button type="button" className="hud-icon-btn" onClick={onExit} aria-label="Back to all games">
          ✕
        </button>
        <span className="hud-pill hud-pill--score" aria-label={`Score ${score}`}>
          <span key={score} className="hud-score-bump">
            ★ {score}
          </span>
        </span>
        {lives !== null && rules.lives !== null && (
          <span className="hud-pill hud-lives" aria-label={`${lives} of ${rules.lives} lives left`}>
            {Array.from({ length: rules.lives }, (_, i) => (
              <span key={i} aria-hidden="true" className={i < lives ? 'heart' : 'heart heart--lost'}>
                {i < lives ? '❤' : '♡'}
              </span>
            ))}
          </span>
        )}
        {moves !== null && (
          <span className="hud-pill hud-moves" aria-label={`${moves} moves left`}>
            🍬 {moves}
          </span>
        )}
        <span
          className={`hud-pill hud-pill--timer${lowTime ? ' hud-pill--warn' : ''}`}
          aria-label={`${timeLeft} seconds left`}
        >
          {timeLeft}s
        </span>
      </div>
      )}

      {phase !== 'results' && (
        <div className="game-field">
          <Playfield key={roundKey} api={api} />

          {phase === 'countdown' && (
            <div className="game-overlay" role="status" aria-live="assertive">
              <div className="game-overlay__title">
                <span aria-hidden="true">{game.emoji}</span> {game.title}
              </div>
              <div className="countdown-num" key={countdown}>
                {countdown > 0 ? countdown : 'Go!'}
              </div>
              <p className="game-overlay__hint">{rules.controlHint}</p>
            </div>
          )}

          {phase === 'hit' && (
            <div className="game-overlay game-overlay--hit" role="status" aria-live="assertive">
              <div className="life-lost">−1 ❤</div>
              <p className="game-overlay__hint">
                {livesRef.current} {livesRef.current === 1 ? 'life' : 'lives'} left
              </p>
            </div>
          )}

          {phase === 'paused' && (
            <div className="game-overlay" role="dialog" aria-label="Game paused">
              <div className="game-overlay__title">Paused</div>
              <button type="button" className="btn btn--primary" onClick={() => setPhaseBoth('playing')}>
                ▶ Resume
              </button>
            </div>
          )}

          {phase === 'ending' && roundResult && (
            <div className="game-overlay" role="status" aria-live="assertive">
              <div className="game-overlay__title game-overlay__title--big">{END_TITLES[roundResult.reason]}</div>
              <div className="countdown-num countdown-num--score">★ {roundResult.score}</div>
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
          onClaim={() => onClaim(sessionBestRef.current)}
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
  onClaim: () => void;
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

  return (
    <div className="results-card card-panel">
      <h2 ref={headingRef} tabIndex={-1} className="results-title">
        {END_TITLES[result.reason]}
      </h2>

      <div className="results-score" aria-label={`You scored ${result.score} points`}>
        <span className="results-score__num">{result.score}</span>
        <span className="results-score__unit">pts</span>
      </div>

      <div className="results-chips">
        {isNewBest ? (
          <span className="chip chip--gold">🏅 New best!</span>
        ) : (
          <span className="chip">Best {best}</span>
        )}
        {volunteerName && (
          <span className={`chip${result.score >= targetScore ? ' chip--green' : ''}`}>
            {result.score >= targetScore
              ? `🎯 Beat ${volunteerName}'s ${targetScore}`
              : `🎯 ${targetScore - result.score} more to beat ${volunteerName}`}
          </span>
        )}
      </div>

      <RankSummary remote={remote} score={result.score} />

      <div className="results-board">
        <h3 className="results-board__title">
          <span aria-hidden="true">{game.emoji}</span> {game.title} · Top 3
        </h3>
        {remote.state === 'loading' && <p className="top3-empty">Loading…</p>}
        {remote.state === 'offline' && <p className="top3-empty">Leaderboard unavailable offline.</p>}
        {remote.state === 'done' && (
          <TopThree entries={remote.result.board.top} label={`${game.title} top 3`} />
        )}
      </div>

      <div className="results-actions">
        {hasPass ? (
          <>
            <button type="button" className="btn btn--primary btn--full" onClick={onRetry}>
              ↻ Play again
            </button>
            <button type="button" className="btn btn--ghost btn--full" onClick={onOpenPass}>
              🎟 My pass
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--primary btn--full" onClick={onClaim}>
              🎁 Claim my gift
            </button>
            <button type="button" className="btn btn--ghost btn--full" onClick={onRetry}>
              ↻ Play again
            </button>
          </>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
          All games
        </button>
      </div>
    </div>
  );
}

function RankSummary({ remote, score }: { remote: RemoteResult; score: number }) {
  let message: string;
  let tone: 'neutral' | 'good' | 'warn' = 'neutral';

  if (remote.state === 'loading') {
    message = 'Checking your rank…';
  } else if (remote.state === 'offline') {
    message = 'Offline — score saved on this phone, not ranked.';
    tone = 'warn';
  } else if (remote.result.status === 'rejected') {
    message = "This score couldn't be verified, so it isn't ranked.";
    tone = 'warn';
  } else if (remote.result.rank !== null) {
    message = `You're #${remote.result.rank} of ${remote.result.board.totalPlayers} all-time`;
    tone = 'good';
  } else if (remote.result.wouldRank !== null) {
    message = `You'd be #${remote.result.wouldRank} — claim your gift to join the board`;
    tone = 'good';
  } else if (score === 0) {
    message = 'Score a point to join the leaderboard.';
  } else {
    message = 'Claim your gift to join the leaderboard.';
  }

  return (
    <p className={`rank-summary rank-summary--${tone}`} role="status" aria-live="polite">
      {message}
    </p>
  );
}

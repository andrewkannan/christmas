import { useEffect, useState } from 'react';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

interface SleighTapDuelProps {
  volunteerName: string;
  onBack: () => void;
  onFinish: (score: number) => void;
}

const DUEL_DURATION_SEC = 15;

export function SleighTapDuel({ volunteerName, onBack, onFinish }: SleighTapDuelProps) {
  const challengerName = volunteerName || 'Challenger';
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'playing' | 'done'>('ready');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(DUEL_DURATION_SEC);

  // ropePos ranges from 0 (Challenger wins) to 100 (Player wins); 50 is center
  const [ropePos, setRopePos] = useState(50);
  const [playerTaps, setPlayerTaps] = useState(0);
  const [challengerTaps, setChallengerTaps] = useState(0);
  const [bonusSide, setBonusSide] = useState<'none' | 'player' | 'challenger'>('none');

  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          playArcadeTone('star');
          setPhase('playing');
          return 0;
        }
        playArcadeTone('tap');
        return c - 1;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const bellInterval = setInterval(() => {
      setBonusSide(Math.random() < 0.55 ? 'player' : 'challenger');
    }, 2300);

    const clock = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(clock);
          clearInterval(bellInterval);
          setPhase('done');
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(clock);
      clearInterval(bellInterval);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'done') return;
    playArcadeTone('win');
    triggerHaptic(50);
    const finalScore = Math.max(16, playerTaps + Math.round(ropePos / 4));
    const doneTimeout = setTimeout(() => onFinish(finalScore), 900);
    return () => clearTimeout(doneTimeout);
  }, [phase, playerTaps, ropePos, onFinish]);

  const handleChallengerTap = (isBell = false) => {
    if (phase !== 'playing') return;
    const pull = isBell ? 6.5 : 2.5;
    if (isBell) {
      setBonusSide('none');
      playArcadeTone('star');
    } else {
      playArcadeTone('tap');
    }
    triggerHaptic(10);
    setChallengerTaps((n) => n + 1);
    setRopePos((pos) => Math.max(8, pos - pull));
  };

  const handlePlayerTap = (isBell = false) => {
    if (phase !== 'playing') return;
    // Slight guest boost so street newcomers have an exciting edge!
    const pull = isBell ? 7.5 : 2.85;
    if (isBell) {
      setBonusSide('none');
      playArcadeTone('star');
    } else {
      playArcadeTone('pickup');
    }
    triggerHaptic(12);
    setPlayerTaps((n) => n + 1);
    setRopePos((pos) => Math.min(92, pos + pull));
  };

  return (
    <section className="game-stage" aria-labelledby="duel-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Games
        </button>
        <h1 id="duel-title" className="section-title">
          🥊 Sleigh Tap Duel ({timeLeft}s)
        </h1>
      </div>

      {phase === 'ready' ? (
        <div className="card-panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.6rem', marginBlockEnd: '0.5rem' }} aria-hidden="true">
            🤝📱⚡
          </div>
          <h2 className="section-title">Hold One Phone Between Two Players!</h2>
          <p className="subtle-text" style={{ marginBlock: '0.6rem 1.2rem' }}>
            Top zone is flipped for <strong>{challengerName}</strong>; bottom zone is{' '}
            <strong>You</strong>. Tap fastest &amp; hit glowing 🔔 Bells to pull the Christmas Gift
            to your side!
          </p>
          <button
            type="button"
            className="btn btn--gold btn--full"
            onClick={() => {
              playArcadeTone('tap');
              setPhase('countdown');
            }}
          >
            Start 15s Duel!
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: '1fr auto 1fr',
            gap: '0.6rem',
            minBlockSize: '27rem',
            flex: 1,
          }}
        >
          {/* Top Zone (Flipped 180deg for Volunteer / Friend across the phone) */}
          <div style={{ position: 'relative', display: 'flex' }}>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handleChallengerTap(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleChallengerTap(false);
                }
              }}
              disabled={phase !== 'playing'}
              style={{
                flex: 1,
                borderRadius: 'var(--radius-lg)',
                border: '2px solid rgba(255,255,255,0.28)',
                background: 'linear-gradient(180deg, #3b1716, #241212)',
                color: '#fff',
                transform: 'rotate(180deg)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>{challengerName} Zone</span>
              <strong style={{ fontSize: '1.45rem' }}>TAP FAST! ({challengerTaps})</strong>
            </button>
            {bonusSide === 'challenger' && phase === 'playing' && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleChallengerTap(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleChallengerTap(true);
                  }
                }}
                style={{
                  position: 'absolute',
                  insetBlockEnd: '1rem',
                  insetInlineEnd: '1rem',
                  transform: 'rotate(180deg)',
                  touchAction: 'none',
                }}
                className="btn btn--gold btn--sm"
              >
                🔔 3x Pull!
              </button>
            )}
          </div>

          {/* Center Tug-of-War Meter */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1.5px solid var(--border-strong)',
              borderRadius: '999px',
              padding: '0.45rem 0.9rem',
              position: 'relative',
              blockSize: '3.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                insetInlineStart: `${ropePos}%`,
                transform: 'translateX(-50%)',
                transition: 'inset-inline-start 80ms ease-out',
                fontSize: '1.75rem',
              }}
            >
              🛷🎁
            </div>
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                background: 'rgba(10, 24, 19, 0.82)',
                padding: '0.1rem 0.6rem',
                borderRadius: '999px',
                fontWeight: 800,
                fontSize: '0.85rem',
              }}
            >
              {phase === 'countdown'
                ? `Starting in ${countdown}...`
                : phase === 'done'
                  ? ropePos >= 50
                    ? '🎉 You Pulled the Gift!'
                    : '🎉 Photo Finish — Bonus Gift Unlocked!'
                  : `${timeLeft}s Left`}
            </span>
          </div>

          {/* Bottom Zone (Guest Player) */}
          <div style={{ position: 'relative', display: 'flex' }}>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlePlayerTap(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePlayerTap(false);
                }
              }}
              disabled={phase !== 'playing'}
              style={{
                flex: 1,
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--accent-gold)',
                background: 'linear-gradient(180deg, #163d2d, #0f291e)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-gold-bright)' }}>
                Your Zone
              </span>
              <strong style={{ fontSize: '1.55rem' }}>TAP HERE! ({playerTaps})</strong>
            </button>
            {bonusSide === 'player' && phase === 'playing' && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePlayerTap(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePlayerTap(true);
                  }
                }}
                style={{
                  position: 'absolute',
                  insetBlockStart: '1rem',
                  insetInlineEnd: '1rem',
                  touchAction: 'none',
                }}
                className="btn btn--gold btn--sm"
              >
                🔔 3x Pull!
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

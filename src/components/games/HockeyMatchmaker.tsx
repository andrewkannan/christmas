import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { HockeyRoomSnapshot, HockeySessionConfig } from '../../types.ts';
import {
  createHockeyRoom,
  fetchHockeyRoomSnapshot,
  joinHockeyRoom,
  leaveHockeyRoomKeepalive,
} from '../../lib/api.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';
import {
  GameEmblem,
  PlayTriangleIcon,
  ReplayIcon,
  SparkleIcon,
  VersusPhonesIcon,
} from '../Icons.tsx';

const CHALLENGER_NAME_KEY = 'christmas_arcade_challenger_name_v1';

function loadRememberedChallenger(fallback: string): string {
  try {
    const saved = window.localStorage.getItem(CHALLENGER_NAME_KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 32);
  } catch {
    // Ignore private-mode storage errors
  }
  return fallback || 'Team Challenger';
}

function saveRememberedChallenger(name: string): void {
  try {
    const trimmed = name.trim().slice(0, 32);
    if (trimmed) {
      window.localStorage.setItem(CHALLENGER_NAME_KEY, trimmed);
    }
  } catch {
    // Ignore storage errors
  }
}

interface HockeyMatchmakerProps {
  guestName?: string;
  volunteerName?: string;
  initialTab?: 'host' | 'join';
  onStartSession: (session: HockeySessionConfig) => void;
}

export function HockeyMatchmaker({
  guestName,
  volunteerName,
  initialTab = 'host',
  onStartSession,
}: HockeyMatchmakerProps) {
  const [tab, setTab] = useState<'host' | 'join'>(initialTab);

  // Host 4-digit room state
  const [hostLoading, setHostLoading] = useState(initialTab === 'host');
  const [hostRoom, setHostRoom] = useState<{ code: string; token: string } | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);

  // Join 4-digit room form state
  const [joinCode, setJoinCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [challengerName, setChallengerName] = useState(() =>
    loadRememberedChallenger(volunteerName || '')
  );
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const codeInputId = useId();
  const codeHintId = useId();
  const codeErrorId = useId();
  const nameInputId = useId();

  const launchedRef = useRef(false);
  const activeHostRoomRef = useRef<{ code: string; token: string } | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const defaultHostName = (guestName || 'Guest Player').trim().slice(0, 32);

  const cleanupWaitingHostRoom = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    const current = activeHostRoomRef.current;
    if (current && !launchedRef.current) {
      activeHostRoomRef.current = null;
      leaveHockeyRoomKeepalive(current.code, current.token);
    }
  }, []);

  const launchHostFromSnapshot = useCallback(
    (code: string, token: string, snap: HockeyRoomSnapshot) => {
      if (launchedRef.current) return;
      launchedRef.current = true;
      activeHostRoomRef.current = null;
      playArcadeTone('star');
      triggerHaptic([35, 30, 55]);
      onStartSession({
        mode: 'host',
        roomCode: code,
        playerToken: token,
        myName: snap.myStriker.name || defaultHostName,
        opponentName: snap.oppStriker.name || 'Challenger',
        initialSnapshot: snap,
      });
    },
    [defaultHostName, onStartSession]
  );

  const allocateHostCode = useCallback(async () => {
    cleanupWaitingHostRoom();
    setHostLoading(true);
    setHostError(null);
    setHostRoom(null);

    try {
      const created = await createHockeyRoom(defaultHostName);
      if (launchedRef.current) {
        leaveHockeyRoomKeepalive(created.code, created.playerToken);
        return;
      }
      const roomInfo = { code: created.code, token: created.playerToken };
      activeHostRoomRef.current = roomInfo;
      setHostRoom(roomInfo);
      setHostLoading(false);
    } catch (err) {
      setHostLoading(false);
      setHostError(
        err instanceof Error ? err.message : 'Could not create a 4-digit room code right now.'
      );
    }
  }, [cleanupWaitingHostRoom, defaultHostName]);

  // Reserve a 4-digit room code whenever the Host tab is active
  useEffect(() => {
    if (tab !== 'host') {
      cleanupWaitingHostRoom();
      setHostRoom(null);
      return undefined;
    }
    void allocateHostCode();
    return () => {
      cleanupWaitingHostRoom();
    };
  }, [tab, allocateHostCode, cleanupWaitingHostRoom]);

  // Listen for challenger joining the 4-digit room via SSE (with automatic fallback polling)
  useEffect(() => {
    if (tab !== 'host' || !hostRoom) return undefined;
    let cancelled = false;
    let pollTimer: number | null = null;
    const { code, token } = hostRoom;

    const handleSnapshot = (snap: HockeyRoomSnapshot) => {
      if (cancelled || launchedRef.current) return;
      if (snap.status !== 'waiting') {
        launchHostFromSnapshot(code, token, snap);
      }
    };

    const startFallbackPoll = () => {
      if (cancelled || pollTimer !== null) return;
      const tick = async () => {
        if (cancelled || launchedRef.current) return;
        try {
          const { snapshot } = await fetchHockeyRoomSnapshot(code, token);
          handleSnapshot(snapshot);
        } catch {
          // Retry gently on transient mobile blip
        }
        if (!cancelled && !launchedRef.current) {
          pollTimer = window.setTimeout(tick, 1100);
        }
      };
      pollTimer = window.setTimeout(tick, 900);
    };

    if (typeof EventSource !== 'undefined') {
      const es = new EventSource(
        `/api/versus/rooms/${encodeURIComponent(code)}/stream?token=${encodeURIComponent(token)}`
      );
      esRef.current = es;
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data) as HockeyRoomSnapshot;
          handleSnapshot(parsed);
        } catch {
          // Ignore malformed frame
        }
      };
      es.onerror = () => {
        startFallbackPoll();
      };
    } else {
      startFallbackPoll();
    }

    return () => {
      cancelled = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [tab, hostRoom, launchHostFromSnapshot]);

  useEffect(() => {
    if (tab === 'join') {
      codeInputRef.current?.focus({ preventScroll: true });
    }
  }, [tab]);

  const startSoloMatch = () => {
    if (launchedRef.current) return;
    cleanupWaitingHostRoom();
    launchedRef.current = true;
    playArcadeTone('tap');
    triggerHaptic(25);
    onStartSession({
      mode: 'solo',
      myName: defaultHostName,
      opponentName: 'Frosty Elf Bot',
    });
  };

  const isCodeFormatValid = /^\d{4}$/.test(joinCode);
  const inlineCodeError =
    joinError ||
    (codeTouched && !isCodeFormatValid ? 'Please enter all 4 digits (for example, 4829).' : null);

  const handleJoinSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCodeTouched(true);
    setJoinError(null);

    const cleanCode = joinCode.trim();
    if (!/^\d{4}$/.test(cleanCode)) {
      codeInputRef.current?.focus();
      return;
    }

    setJoining(true);
    const trimmedName = challengerName.trim().slice(0, 32) || 'Team Challenger';
    saveRememberedChallenger(trimmedName);

    try {
      const joined = await joinHockeyRoom(cleanCode, trimmedName);
      if (launchedRef.current) return;
      launchedRef.current = true;
      playArcadeTone('star');
      triggerHaptic([35, 30, 55]);
      onStartSession({
        mode: 'joiner',
        roomCode: joined.code,
        playerToken: joined.playerToken,
        myName: trimmedName,
        opponentName: joined.snapshot.oppStriker.name || 'Guest Player',
        initialSnapshot: joined.snapshot,
      });
    } catch (err) {
      setJoining(false);
      setJoinError(
        err instanceof Error ? err.message : 'Could not join that 4-digit room code.'
      );
      codeInputRef.current?.focus();
    }
  };

  const digits = (hostRoom?.code || '••••').padEnd(4, '•').slice(0, 4).split('');

  return (
    <div className="hockey-matchmaker stage-enter">
      <div className="hockey-matchmaker__hero">
        <div
          className="hockey-matchmaker__emblem"
          style={{ background: 'linear-gradient(135deg, #d70015, #99000f)', color: '#ffffff' }}
        >
          <GameEmblem gameId="ice-hockey" size={38} />
        </div>
        <div className="hockey-matchmaker__headings">
          <span className="hockey-matchmaker__eyebrow">
            <VersusPhonesIcon size={14} />
            <span>2-Phone Live Rink · First to 7 or 45s</span>
          </span>
          <h2 className="hockey-matchmaker__title">Starlight Air Hockey</h2>
        </div>
      </div>

      <div className="hockey-tabs" role="tablist" aria-label="Versus connection mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'host'}
          className={`hockey-tabs__btn${tab === 'host' ? ' hockey-tabs__btn--active' : ''}`}
          onClick={() => {
            playArcadeTone('tap');
            setTab('host');
          }}
        >
          <span>Show 4-Digit Code</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'join'}
          className={`hockey-tabs__btn${tab === 'join' ? ' hockey-tabs__btn--active' : ''}`}
          onClick={() => {
            playArcadeTone('tap');
            setTab('join');
          }}
        >
          <span>Enter 4-Digit Code</span>
        </button>
      </div>

      {tab === 'host' ? (
        <div className="hockey-host-panel" role="tabpanel" aria-label="Show 4-Digit Code">
          <p className="hockey-host-panel__lead">
            Ask your challenger to tap <strong>Enter 4-Digit Code</strong> on their phone and key
            in this room number:
          </p>

          <div
            className={`hockey-code-tiles${hostLoading ? ' hockey-code-tiles--loading' : ''}`}
            data-room-code={hostRoom?.code ?? ''}
            aria-live="polite"
            aria-label={
              hostRoom
                ? `Room code ${hostRoom.code.split('').join(' ')}`
                : 'Generating room code'
            }
          >
            {digits.map((digit, idx) => (
              <span key={idx} className="hockey-code-tile">
                {digit}
              </span>
            ))}
          </div>

          {hostError ? (
            <div className="hockey-inline-error" role="alert">
              <span>{hostError}</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => void allocateHostCode()}
              >
                <ReplayIcon size={14} />
                <span>New Code</span>
              </button>
            </div>
          ) : (
            <div className="hockey-waiting-pill" role="status" aria-live="polite">
              <span className="hockey-waiting-pill__dot" aria-hidden="true" />
              <span>
                {hostLoading
                  ? 'Reserving live ice table…'
                  : 'Waiting for challenger to join — starts automatically!'}
              </span>
            </div>
          )}

          <div className="hockey-solo-divider">
            <span>Playing on 1 phone?</span>
          </div>

          <button
            type="button"
            className="btn btn--ghost btn--full hockey-solo-btn"
            onClick={startSoloMatch}
          >
            <SparkleIcon size={16} />
            <span>Play Solo vs Elf Bot</span>
            <PlayTriangleIcon size={13} />
          </button>
        </div>
      ) : (
        <form
          className="hockey-join-form"
          role="tabpanel"
          aria-label="Enter 4-Digit Code"
          method="post"
          action="/api/versus/rooms/join"
          noValidate
          onSubmit={(e) => void handleJoinSubmit(e)}
        >
          <div className="hockey-field">
            <label htmlFor={codeInputId} className="hockey-field__label">
              4-Digit Room Code
            </label>
            <p id={codeHintId} className="hockey-field__hint">
              Enter the 4 digits shown on your guest&apos;s or friend&apos;s screen (1000–9999).
            </p>
            <input
              ref={codeInputRef}
              id={codeInputId}
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="4829"
              value={joinCode}
              aria-invalid={inlineCodeError ? 'true' : 'false'}
              aria-describedby={inlineCodeError ? `${codeHintId} ${codeErrorId}` : codeHintId}
              className={`hockey-code-input${inlineCodeError ? ' hockey-code-input--invalid' : ''}`}
              onBlur={() => setCodeTouched(true)}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D+/g, '').slice(0, 4);
                setJoinCode(digitsOnly);
                if (joinError) setJoinError(null);
              }}
            />
            {inlineCodeError && (
              <p id={codeErrorId} className="hockey-field__error" role="alert">
                {inlineCodeError}
              </p>
            )}
          </div>

          <div className="hockey-field">
            <label htmlFor={nameInputId} className="hockey-field__label">
              Your Display Name <span className="hockey-field__optional">(shown on rink)</span>
            </label>
            <input
              id={nameInputId}
              name="joinerName"
              type="text"
              maxLength={32}
              autoComplete="nickname"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Team Challenger"
              value={challengerName}
              className="hockey-name-input"
              onChange={(e) => setChallengerName(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--shimmer btn--full"
            disabled={joining}
          >
            <VersusPhonesIcon size={18} />
            <span>{joining ? 'Connecting Phones…' : 'Join Live Match'}</span>
          </button>
        </form>
      )}
    </div>
  );
}

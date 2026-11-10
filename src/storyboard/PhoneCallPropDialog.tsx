import { useEffect, useId, useRef, useState } from 'react';
import { playArcadeTone } from '../lib/sound.ts';
import { StarMarkIcon } from '../components/Icons.tsx';

export type PropSceneMode = 'incoming-call' | 'final-message';

interface PhoneCallPropDialogProps {
  open: boolean;
  initialMode?: PropSceneMode;
  eventTitle: string;
  churchName: string;
  onClose: () => void;
}

export function PhoneCallPropDialog({
  open,
  initialMode = 'incoming-call',
  eventTitle,
  churchName,
  onClose,
}: PhoneCallPropDialogProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [sceneMode, setSceneMode] = useState<PropSceneMode>(initialMode);
  const [callerName, setCallerName] = useState('JESUS');
  const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [cleanCameraMode, setCleanCameraMode] = useState(false);

  useEffect(() => {
    setSceneMode(initialMode);
    setCallState('ringing');
    setElapsedSec(0);
  }, [initialMode, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Bounding-box light-dismiss fallback for browsers without native <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onDown = (e: PointerEvent) => {
      pressedOutside = e.target === dialog && isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && e.target === dialog && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('pointerup', onUp);
    return () => {
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('pointerup', onUp);
    };
  }, []);

  useEffect(() => {
    if (!open || sceneMode !== 'incoming-call' || callState !== 'connected') return;
    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, sceneMode, callState]);

  const formattedCallTimer = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(
    elapsedSec % 60
  ).padStart(2, '0')}`;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, unknown>)}
      className={`sb-prop-dialog${cleanCameraMode ? ' sb-prop-dialog--clean' : ''}`}
      aria-labelledby={`${uid}-prop-heading`}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = '';
        }
        setCleanCameraMode(false);
        onClose();
      }}
    >
      <div className="sb-prop-shell">
        {!cleanCameraMode && (
          <div className="sb-prop-toolbar">
            <div className="sb-prop-toolbar__top">
              <h2 id={`${uid}-prop-heading`} className="sb-prop-toolbar__title">
                On-Set Camera Phone Prop
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--xs sb-prop-toolbar__close"
                onClick={() => dialogRef.current?.close()}
              >
                Close Prop
              </button>
            </div>

            <div className="sb-prop-toolbar__controls">
              <div className="sb-prop-pills" role="group" aria-label="Prop scene">
                <button
                  type="button"
                  className={`sb-prop-pill${sceneMode === 'incoming-call' ? ' sb-prop-pill--active' : ''}`}
                  aria-pressed={sceneMode === 'incoming-call'}
                  onClick={() => {
                    setSceneMode('incoming-call');
                    setCallState('ringing');
                    setElapsedSec(0);
                  }}
                >
                  Shot 03 · Incoming Call
                </button>
                <button
                  type="button"
                  className={`sb-prop-pill${sceneMode === 'final-message' ? ' sb-prop-pill--active' : ''}`}
                  aria-pressed={sceneMode === 'final-message'}
                  onClick={() => setSceneMode('final-message')}
                >
                  Shot 10 · Appa Message
                </button>
              </div>

              <div className="sb-prop-caller-row">
                <label htmlFor={`${uid}-caller-input`} className="sb-prop-caller-label">
                  Caller ID:
                </label>
                <input
                  id={`${uid}-caller-input`}
                  type="text"
                  maxLength={20}
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  className="sb-prop-caller-input"
                />
                <button
                  type="button"
                  className="sb-prop-pill"
                  onClick={() => setCallerName('JESUS')}
                >
                  JESUS
                </button>
                <button
                  type="button"
                  className="sb-prop-pill"
                  onClick={() => setCallerName('APPA')}
                >
                  APPA
                </button>
                <button
                  type="button"
                  className="sb-prop-pill sb-prop-pill--gold"
                  onClick={() => setCleanCameraMode(true)}
                >
                  Hide Controls for Filming
                </button>
              </div>
            </div>
          </div>
        )}

        {cleanCameraMode && (
          <h2 id={`${uid}-prop-heading`} className="visually-hidden">
            On-Set Camera Phone Prop ({callerName})
          </h2>
        )}

        {/* Realistic Mobile Call / Lock Screen Surface */}
        <div className="sb-phone-screen">
          {cleanCameraMode && (
            <button
              type="button"
              className="sb-clean-exit-btn"
              aria-label="Show prop controls"
              onClick={() => setCleanCameraMode(false)}
            >
              Controls
            </button>
          )}

          {sceneMode === 'incoming-call' ? (
            <div className="sb-call-stage">
              <div className="sb-call-stage__top">
                <div
                  className={`sb-call-avatar${callState === 'ringing' ? ' sb-call-avatar--ringing' : ''}`}
                  aria-hidden="true"
                >
                  <StarMarkIcon size={34} />
                </div>
                <p className="sb-call-eyebrow">
                  {callState === 'ringing' ? 'Incoming Call · Direct Line' : `Connected · ${formattedCallTimer}`}
                </p>
                <p className="sb-call-name">{callerName.trim() || 'JESUS'}</p>
                {callState === 'connected' && (
                  <p className="sb-call-quote">“Yes Appa! Ready to bring Christmas joy!”</p>
                )}
              </div>

              {callState === 'ringing' ? (
                <div className="sb-call-actions">
                  <div className="sb-call-btn-wrap">
                    <button
                      type="button"
                      className="sb-call-round sb-call-round--decline"
                      aria-label="Reset or decline prop call"
                      onClick={() => playArcadeTone('tap')}
                    >
                      ✕
                    </button>
                    <span>Decline</span>
                  </div>

                  <div className="sb-call-btn-wrap">
                    <button
                      type="button"
                      className="sb-call-round sb-call-round--answer"
                      aria-label="Answer incoming call from Jesus"
                      onClick={() => {
                        playArcadeTone('star');
                        setElapsedSec(1);
                        setCallState('connected');
                      }}
                    >
                      ✓
                    </button>
                    <span>Answer</span>
                  </div>
                </div>
              ) : (
                <div className="sb-call-connected-bar">
                  <div className="sb-wave-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <button
                    type="button"
                    className="sb-call-reset-btn"
                    onClick={() => {
                      setCallState('ringing');
                      setElapsedSec(0);
                    }}
                  >
                    Reset for Next Take
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="sb-lockscreen-stage">
              <div className="sb-lockscreen-clock" aria-hidden="true">
                <span className="sb-lockscreen-date">Christmas Eve · Johor Bahru</span>
                <span className="sb-lockscreen-time">7:30</span>
              </div>

              <div className="sb-lockscreen-card">
                <div className="sb-lockscreen-card__head">
                  <span className="sb-lockscreen-badge">
                    <StarMarkIcon size={13} />
                    <span>MESSAGE · NOW</span>
                  </span>
                  <span>just now</span>
                </div>
                <strong className="sb-lockscreen-sender">{callerName.trim() || 'APPA'}</strong>
                <p className="sb-lockscreen-body">
                  Well done today! Save them a seat at <strong>{eventTitle}</strong> ({churchName}).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

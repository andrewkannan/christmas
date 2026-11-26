import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import type { GuestSignupResult } from '../types.ts';
import { submitGuestSignup } from '../lib/api.ts';
import {
  ARRIVAL_GUIDE,
  KING_OF_GLORY_INVITE,
  VENUE_ADDRESS_LABEL,
  VENUE_NAV_LINKS,
  buildInviteGoogleCalendarUrl,
  buildInviteIcsContent,
} from '../invite/kingOfGloryInvite.ts';
import { VenueMap } from './VenueMap.tsx';

const PASS_STORAGE_KEY = 'ccc_kog_guest_pass_v1';
const MAX_SEATS = KING_OF_GLORY_INVITE.maxSeatsPerRegistration;
const QUICK_SEAT_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

type FieldName = 'guestName' | 'guestPhone' | 'seats' | 'invitedBy';
type FieldErrors = Partial<Record<FieldName, string>>;

function loadSavedPass(): GuestSignupResult | null {
  try {
    const raw = localStorage.getItem(PASS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSignupResult>;
    if (
      typeof parsed.confirmationCode === 'string' &&
      typeof parsed.guestName === 'string' &&
      typeof parsed.seats === 'number'
    ) {
      return {
        confirmationCode: parsed.confirmationCode,
        guestName: parsed.guestName,
        guestPhone: typeof parsed.guestPhone === 'string' ? parsed.guestPhone : '',
        seats: parsed.seats,
        invitedBy: typeof parsed.invitedBy === 'string' ? parsed.invitedBy : '',
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      };
    }
  } catch {
    // Corrupt or blocked storage — just show the empty form.
  }
  return null;
}

function savePass(pass: GuestSignupResult | null): void {
  try {
    if (pass) localStorage.setItem(PASS_STORAGE_KEY, JSON.stringify(pass));
    else localStorage.removeItem(PASS_STORAGE_KEY);
  } catch {
    // Storage may be full or disabled (private mode); the confirmation still shows on screen.
  }
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `guest-${crypto.randomUUID()}`
    : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function validate(field: FieldName, values: { guestName: string; guestPhone: string; seats: number }): string | undefined {
  switch (field) {
    case 'guestName':
      return values.guestName.trim().length < 2 ? 'Please enter your name (at least 2 characters).' : undefined;
    case 'guestPhone': {
      const digits = values.guestPhone.replace(/\D/g, '');
      if (!values.guestPhone.trim()) return 'Please enter your mobile / WhatsApp number.';
      if (digits.length < 8 || digits.length > 15) {
        return 'Please enter a valid mobile number, for example 012-345 6789.';
      }
      return undefined;
    }
    case 'seats':
      return !Number.isInteger(values.seats) || values.seats < 1 || values.seats > MAX_SEATS
        ? `Please choose between 1 and ${MAX_SEATS} seats.`
        : undefined;
    case 'invitedBy':
      return undefined;
  }
}

function seatsLabel(n: number): string {
  return n === 1 ? '1 seat' : `${n} seats`;
}

/* ==========================================================================
   Decorative art from the Canva invitation card (all aria-hidden)
   ========================================================================== */

function CornerFlourish({ className }: { className: string }) {
  return (
    <svg className={`kog-flourish ${className}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M4 60 C4 30 12 14 34 6" />
        <path d="M4 60 C30 60 48 52 58 30" />
        <path d="M14 46 c-6 -6 -2 -16 7 -14 c6 1 6 9 1 10 c-3 1 -5 -2 -3 -4" />
        <path d="M24 38 c4 -10 16 -12 20 -4" />
        <path d="M34 6 c4 0 7 3 6 7 c-1 3 -5 3 -6 1" />
        <path d="M58 30 c0 4 -3 7 -7 6 c-3 -1 -3 -5 -1 -6" />
      </g>
      <circle cx="4" cy="60" r="2.4" fill="currentColor" />
    </svg>
  );
}

function RuleOrnament({ className = '' }: { className?: string }) {
  return (
    <svg className={`kog-rule-ornament ${className}`} viewBox="0 0 120 16" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M60 8 c-8 -8 -20 -6 -20 0 c0 5 8 6 10 1" />
        <path d="M60 8 c8 8 20 6 20 0 c0 -5 -8 -6 -10 -1" />
        <path d="M60 8 c-8 8 -20 6 -20 0" />
        <path d="M60 8 c8 -8 20 -6 20 0" />
      </g>
    </svg>
  );
}

function MangerCrownMark() {
  return (
    <svg className="kog-manger" viewBox="0 0 120 92" aria-hidden="true" focusable="false">
      {/* Crown */}
      <path
        className="kog-manger__crown"
        d="M38 30 L34 8 L48 20 L60 4 L72 20 L86 8 L82 30 Z"
      />
      <circle className="kog-manger__crown" cx="34" cy="7" r="3" />
      <circle className="kog-manger__crown" cx="60" cy="3.5" r="3" />
      <circle className="kog-manger__crown" cx="86" cy="7" r="3" />
      <rect className="kog-manger__crown" x="37" y="29" width="46" height="5" rx="1.5" />
      {/* Straw */}
      <path
        className="kog-manger__straw"
        d="M18 46 L24 36 L28 44 L34 33 L40 43 L46 34 L52 43 L58 33 L64 43 L70 34 L76 43 L82 33 L88 44 L94 36 L100 46 Z"
      />
      {/* Trough */}
      <path className="kog-manger__wood" d="M14 45 H106 L96 66 H24 Z" />
      {/* Crossed legs */}
      <path className="kog-manger__wood" d="M30 64 L44 64 L30 90 L20 90 Z" />
      <path className="kog-manger__wood" d="M76 64 L90 64 L100 90 L90 90 Z" />
    </svg>
  );
}

function Postmark() {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="kog-postmark" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <path id={`pm-top-${id}`} d="M18 60 a42 42 0 0 1 84 0" />
        <path id={`pm-bot-${id}`} d="M14 60 a46 46 0 0 0 92 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text className="kog-postmark__text">
        <textPath href={`#pm-top-${id}`} startOffset="50%" textAnchor="middle">
          BLESSED CHRISTMAS
        </textPath>
      </text>
      <text className="kog-postmark__text">
        <textPath href={`#pm-bot-${id}`} startOffset="50%" textAnchor="middle">
          CCCJB BILINGUAL
        </textPath>
      </text>
      <path d="M60 40 V80 M48 52 H72" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function InviteCardFront() {
  return (
    <section className="kog-front" aria-labelledby="kog-title">
      <div className="kog-stamp-shadow">
        <div className="kog-stamp kog-stamp--white">
          <div className="kog-stamp__paper">
            <div className="kog-front__panel">
              <CornerFlourish className="kog-flourish--tl" />
              <CornerFlourish className="kog-flourish--tr" />
              <CornerFlourish className="kog-flourish--bl" />
              <CornerFlourish className="kog-flourish--br" />
              <div className="kog-front__rule kog-front__rule--top" aria-hidden="true">
                <RuleOrnament />
              </div>

              <p className="kog-front__tagline">{KING_OF_GLORY_INVITE.tagline}</p>
              <h1 id="kog-title" className="kog-title">
                <span className="kog-title__line kog-title__line--1">
                  <span className="kog-title__star" aria-hidden="true">✦</span>
                  <span className="kog-swash">J</span>esus,
                </span>{' '}
                <span className="kog-title__line kog-title__line--2">
                  <span className="kog-title__the">the</span> King of
                </span>{' '}
                <span className="kog-title__line kog-title__line--3">
                  <span className="kog-swash">G</span>lory
                </span>
              </h1>
              <MangerCrownMark />

              <div className="kog-front__rule kog-front__rule--bottom" aria-hidden="true">
                <RuleOrnament />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventDetailsColumn() {
  return (
    <div className="kog-details">
      <blockquote className="kog-verse">
        <p>‘{KING_OF_GLORY_INVITE.verse.text}’</p>
        <footer>{KING_OF_GLORY_INVITE.verse.reference}</footer>
      </blockquote>
      <RuleOrnament className="kog-rule-ornament--maroon" />
      <dl className="kog-when-where">
        <div className="kog-when-where__row">
          <dt className="visually-hidden">Date and time</dt>
          <dd>
            <span>{KING_OF_GLORY_INVITE.cardDateLabel}</span>
            <span>{KING_OF_GLORY_INVITE.timeLabel}</span>
          </dd>
        </div>
        <div className="kog-when-where__row kog-when-where__row--venue">
          <dt className="visually-hidden">Venue</dt>
          <dd>
            <span>
              {KING_OF_GLORY_INVITE.venue.building} {KING_OF_GLORY_INVITE.venue.floor}
            </span>
            <span>({KING_OF_GLORY_INVITE.venue.room})</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function PostcardHeader() {
  return (
    <div className="kog-postcard__header">
      <span className="kog-postcard__church">{KING_OF_GLORY_INVITE.churchShortName}</span>
      <span className="kog-postcard__logo">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M11 2h2v5h4v2h-4v13h-2V9H7V7h4z" fill="currentColor" />
          <path d="M3 22V12h3v10M18 22V10h3v12" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <span>{KING_OF_GLORY_INVITE.churchFullName}</span>
      </span>
    </div>
  );
}

/* ==========================================================================
   Page
   ========================================================================== */

export function GuestSignupPage() {
  const [completed, setCompleted] = useState<GuestSignupResult | null>(() => loadSavedPass());

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [seats, setSeats] = useState<number>(1);
  const [invitedBy, setInvitedBy] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [interacted, setInteracted] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const requestIdRef = useRef<string>(newRequestId());
  const announceTimerRef = useRef<number | undefined>(undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const seatsRef = useRef<HTMLInputElement>(null);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => window.clearTimeout(announceTimerRef.current), []);

  const values = { guestName, guestPhone, seats };

  const markInteracted = (field: FieldName) => {
    if (!interacted[field]) setInteracted((prev) => ({ ...prev, [field]: true }));
    // Clear an existing error as soon as the user edits; it is re-checked on blur.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (submitError) setSubmitError('');
  };

  const handleBlur = (field: FieldName, label: string) => {
    if (!interacted[field]) return;
    const message = validate(field, values);
    setErrors((prev) => ({ ...prev, [field]: message }));
    window.clearTimeout(announceTimerRef.current);
    if (message) {
      // Announce once, a moment later, so it doesn't talk over the next focused field.
      announceTimerRef.current = window.setTimeout(() => setAnnouncement(`${label}: ${message}`), 500);
    } else {
      setAnnouncement('');
    }
  };

  const describedBy = (field: FieldName, hintId?: string) =>
    [hintId, errors[field] ? `kog-${field}-error` : undefined].filter(Boolean).join(' ') || undefined;

  const changeSeats = (next: number) => {
    setSeats(Math.min(MAX_SEATS, Math.max(1, next)));
    markInteracted('seats');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError('');

    const nextErrors: FieldErrors = {
      guestName: validate('guestName', values),
      guestPhone: validate('guestPhone', values),
      seats: validate('seats', values),
    };
    setErrors(nextErrors);
    setInteracted({ guestName: true, guestPhone: true, seats: true, invitedBy: true });

    // Focus moves to the first invalid field so its error is read out with it.
    if (nextErrors.guestName) return nameRef.current?.focus();
    if (nextErrors.guestPhone) return phoneRef.current?.focus();
    if (nextErrors.seats) return seatsRef.current?.focus();

    setSubmitting(true);
    try {
      const { guest } = await submitGuestSignup({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        seats,
        invitedBy: invitedBy.trim(),
        clientRequestId: requestIdRef.current,
      });
      savePass(guest);
      setCompleted(guest);
      requestIdRef.current = newRequestId();
      window.setTimeout(() => confirmHeadingRef.current?.focus(), 50);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : 'We couldn’t save your registration. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    savePass(null);
    setCompleted(null);
    setGuestName('');
    setGuestPhone('');
    setSeats(1);
    setInvitedBy('');
    setErrors({});
    setInteracted({});
    setSubmitError('');
    window.setTimeout(() => nameRef.current?.focus(), 50);
  };

  return (
    <div className="kog-page">
      <InviteCardFront />

      {completed ? (
        <GuestConfirmation
          pass={completed}
          headingRef={confirmHeadingRef}
          onRegisterAnother={handleRegisterAnother}
        />
      ) : (
        <section className="kog-signup" aria-labelledby="kog-signup-title">
          <div className="kog-stamp-shadow">
            <div className="kog-stamp kog-stamp--red">
              <div className="kog-stamp__paper">
                <div className="kog-postcard">
                  <PostcardHeader />
                  <div className="kog-postcard__body">
                    <EventDetailsColumn />
                    <div className="kog-postcard__divider" aria-hidden="true" />
                    <div className="kog-postcard__form-col">
                      <h2 id="kog-signup-title" className="kog-section-title">
                        Reserve your seats
                      </h2>
                      <p className="kog-section-sub">
                        It’s free. Tell us who’s coming and we’ll save seats for your group.
                      </p>

                      <form
                        className="kog-form"
                        action="/api/public/guest-signup"
                        method="post"
                        noValidate
                        onSubmit={handleSubmit}
                      >
                        <div className="kog-field">
                          <label htmlFor="kog-guestName" className="kog-label">
                            Your name
                          </label>
                          <input
                            ref={nameRef}
                            id="kog-guestName"
                            name="guestName"
                            type="text"
                            required
                            minLength={2}
                            maxLength={80}
                            autoComplete="name"
                            autoCapitalize="words"
                            spellCheck={false}
                            enterKeyHint="next"
                            className="kog-input"
                            value={guestName}
                            aria-invalid={errors.guestName ? 'true' : 'false'}
                            aria-describedby={describedBy('guestName')}
                            onChange={(e) => {
                              setGuestName(e.target.value);
                              markInteracted('guestName');
                            }}
                            onBlur={() => handleBlur('guestName', 'Your name')}
                          />
                          {errors.guestName && (
                            <p id="kog-guestName-error" className="kog-error">
                              <span role="img" aria-label="Error">⚠</span> {errors.guestName}
                            </p>
                          )}
                        </div>

                        <div className="kog-field">
                          <label htmlFor="kog-guestPhone" className="kog-label">
                            Mobile / WhatsApp number
                          </label>
                          <span id="kog-guestPhone-hint" className="kog-hint">
                            e.g. 012-345 6789 · For your seat confirmation only.
                          </span>
                          <input
                            ref={phoneRef}
                            id="kog-guestPhone"
                            name="guestPhone"
                            type="tel"
                            inputMode="tel"
                            required
                            maxLength={30}
                            autoComplete="tel"
                            enterKeyHint="next"
                            className="kog-input"
                            value={guestPhone}
                            aria-invalid={errors.guestPhone ? 'true' : 'false'}
                            aria-describedby={describedBy('guestPhone', 'kog-guestPhone-hint')}
                            onChange={(e) => {
                              setGuestPhone(e.target.value);
                              markInteracted('guestPhone');
                            }}
                            onBlur={() => handleBlur('guestPhone', 'Mobile number')}
                          />
                          {errors.guestPhone && (
                            <p id="kog-guestPhone-error" className="kog-error">
                              <span role="img" aria-label="Error">⚠</span> {errors.guestPhone}
                            </p>
                          )}
                        </div>

                        <div className="kog-field">
                          <label htmlFor="kog-seats" className="kog-label">
                            Number of seats
                          </label>
                          <span id="kog-seats-hint" className="kog-hint">
                            Include yourself. Up to {MAX_SEATS} per registration.
                          </span>
                          <div className="kog-seats">
                            <button
                              type="button"
                              className="kog-seats__btn"
                              aria-label="Remove one seat"
                              disabled={seats <= 1}
                              onClick={() => changeSeats(seats - 1)}
                            >
                              −
                            </button>
                            <input
                              ref={seatsRef}
                              id="kog-seats"
                              name="seats"
                              type="number"
                              inputMode="numeric"
                              required
                              min={1}
                              max={MAX_SEATS}
                              step={1}
                              className="kog-input kog-seats__input"
                              value={Number.isFinite(seats) ? seats : ''}
                              aria-invalid={errors.seats ? 'true' : 'false'}
                              aria-describedby={describedBy('seats', 'kog-seats-hint')}
                              onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                setSeats(Number.isFinite(n) ? n : Number.NaN);
                                markInteracted('seats');
                              }}
                              onBlur={() => handleBlur('seats', 'Number of seats')}
                            />
                            <button
                              type="button"
                              className="kog-seats__btn"
                              aria-label="Add one seat"
                              disabled={seats >= MAX_SEATS}
                              onClick={() => changeSeats((Number.isFinite(seats) ? seats : 0) + 1)}
                            >
                              +
                            </button>
                          </div>
                          <div className="kog-seat-chips" role="group" aria-label="Quick pick number of seats">
                            {QUICK_SEAT_OPTIONS.map((n) => (
                              <button
                                key={n}
                                type="button"
                                className="kog-seat-chip"
                                aria-pressed={seats === n}
                                onClick={() => changeSeats(n)}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                          {errors.seats && (
                            <p id="kog-seats-error" className="kog-error">
                              <span role="img" aria-label="Error">⚠</span> {errors.seats}
                            </p>
                          )}
                        </div>

                        <div className="kog-field">
                          <label htmlFor="kog-invitedBy" className="kog-label">
                            Who invited you? <span className="kog-optional">(optional)</span>
                          </label>
                          <span id="kog-invitedBy-hint" className="kog-hint">
                            The friend or family member who gave you this card.
                          </span>
                          <input
                            id="kog-invitedBy"
                            name="invitedBy"
                            type="text"
                            maxLength={80}
                            autoComplete="off"
                            autoCapitalize="words"
                            spellCheck={false}
                            enterKeyHint="done"
                            className="kog-input"
                            value={invitedBy}
                            aria-describedby="kog-invitedBy-hint"
                            onChange={(e) => setInvitedBy(e.target.value)}
                          />
                        </div>

                        {submitError && (
                          <div className="kog-alert" role="alert">
                            {submitError}
                          </div>
                        )}

                        <button type="submit" className="kog-btn kog-btn--primary kog-btn--block" disabled={submitting}>
                          {submitting ? (
                            <>
                              <span className="kog-spinner kog-spinner--light" aria-hidden="true" />
                              <span>Reserving your {seats === 1 ? 'seat' : 'seats'}…</span>
                            </>
                          ) : (
                            <span>
                              Reserve my {Number.isFinite(seats) && seats > 1 ? `${seats} seats` : 'seat'}
                            </span>
                          )}
                        </button>
                        <p className="kog-fineprint">
                          After you register, we’ll show you the time, location and the way to Menara Zurich.
                        </p>
                      </form>
                    </div>
                  </div>
                  <Postmark />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

/* ==========================================================================
   After sign-up: confirmation + time, location & route guide
   ========================================================================== */

interface GuestConfirmationProps {
  pass: GuestSignupResult;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRegisterAnother: () => void;
}

function GuestConfirmation({ pass, headingRef, onRegisterAnother }: GuestConfirmationProps) {
  const [icsError, setIcsError] = useState('');

  const downloadIcs = () => {
    try {
      const blob = new Blob([buildInviteIcsContent(pass.confirmationCode)], {
        type: 'text/calendar;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jesus-the-king-of-glory.ics';
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIcsError('');
    } catch {
      setIcsError('Couldn’t create the calendar file on this device. Try “Google Calendar” instead.');
    }
  };

  return (
    <div className="kog-confirm">
      <section className="kog-confirm__ticket" aria-labelledby="kog-confirm-title">
        <div className="kog-stamp-shadow">
          <div className="kog-stamp kog-stamp--red">
            <div className="kog-stamp__paper">
              <div className="kog-postcard kog-postcard--ticket">
                <PostcardHeader />
                <div className="kog-ticket">
                  <p className="kog-ticket__eyebrow">
                    <span aria-hidden="true">✓</span> You’re registered
                  </p>
                  <h2 id="kog-confirm-title" ref={headingRef} tabIndex={-1} className="kog-ticket__title">
                    See you at Christmas, {pass.guestName}!
                  </h2>
                  <p className="kog-ticket__lead">
                    We’ve reserved <strong>{seatsLabel(pass.seats)}</strong> for you at{' '}
                    <em>{KING_OF_GLORY_INVITE.title}</em>.
                  </p>

                  <div className="kog-ticket__code">
                    <span>Confirmation code</span>
                    <strong>{pass.confirmationCode}</strong>
                    <small>Show this at the welcome desk on Level 8.</small>
                  </div>

                  <dl className="kog-ticket__facts">
                    <div>
                      <dt>When</dt>
                      <dd>
                        <strong>{KING_OF_GLORY_INVITE.dateLabel}</strong>
                        <span>
                          {KING_OF_GLORY_INVITE.timeLabel} · please arrive by {KING_OF_GLORY_INVITE.arriveByLabel}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Where</dt>
                      <dd>
                        <strong>
                          {KING_OF_GLORY_INVITE.venue.building}, {KING_OF_GLORY_INVITE.venue.floor} (
                          {KING_OF_GLORY_INVITE.venue.room})
                        </strong>
                        <span>{VENUE_ADDRESS_LABEL}</span>
                      </dd>
                    </div>
                  </dl>

                  <div className="kog-ticket__actions">
                    <a
                      className="kog-btn kog-btn--primary"
                      href={VENUE_NAV_LINKS.googleMaps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions in Google Maps
                    </a>
                    <a
                      className="kog-btn kog-btn--waze"
                      href={VENUE_NAV_LINKS.waze}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Waze
                    </a>
                  </div>
                  <div className="kog-ticket__actions kog-ticket__actions--secondary">
                    <a
                      className="kog-btn kog-btn--outline kog-btn--sm"
                      href={buildInviteGoogleCalendarUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Add to Google Calendar
                    </a>
                    <button type="button" className="kog-btn kog-btn--outline kog-btn--sm" onClick={downloadIcs}>
                      Add to Apple / Outlook calendar
                    </button>
                  </div>
                  {icsError && (
                    <p className="kog-error" role="alert">
                      {icsError}
                    </p>
                  )}
                </div>
                <Postmark />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="kog-route" aria-labelledby="kog-route-title">
        <h2 id="kog-route-title" className="kog-route__title">
          How to get to {KING_OF_GLORY_INVITE.venue.building}
        </h2>
        <p className="kog-route__sub">
          {KING_OF_GLORY_INVITE.venue.street}, {KING_OF_GLORY_INVITE.venue.area}
        </p>

        <VenueMap />

        <ol className="kog-steps" role="list">
          {ARRIVAL_GUIDE.map((step) => (
            <li key={step.title} className="kog-step">
              <strong className="kog-step__title">{step.title}</strong>
              <span className="kog-step__detail">{step.detail}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="kog-confirm__another">
        <p>Registering for someone else on this phone?</p>
        <button type="button" className="kog-btn kog-btn--outline" onClick={onRegisterAnother}>
          Register another guest
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import type { GuestSignupResult } from '../types.ts';
import { submitGuestSignup } from '../lib/api.ts';
import { playArcadeTone } from '../lib/sound.ts';
import {
  KING_OF_GLORY_INVITE,
  VENUE_ADDRESS_LABEL,
  VENUE_NAV_LINKS,
  buildInviteGoogleCalendarUrl,
  buildInviteIcsContent,
} from '../invite/kingOfGloryInvite.ts';
import {
  CalendarIcon,
  CheckCircleIcon,
  DownloadIcon,
  MapPinIcon,
  ShieldCheckIcon,
  TimerClockIcon,
  UserPlusIcon,
  WazeIcon,
} from '../components/Icons.tsx';
import { ConfettiBurst } from '../components/ConfettiBurst.tsx';
import { CastleSkylineCrest, ChristmasCastleMagic } from '../components/ChristmasCastleMagic.tsx';
import { VenueMap } from './VenueMap.tsx';

const PASS_STORAGE_KEY = 'ccc_kog_guest_pass_v1';
const MAX_SEATS = KING_OF_GLORY_INVITE.maxSeatsPerRegistration;
const MAX_PEOPLE_GLYPHS = 8;
const { venue } = KING_OF_GLORY_INVITE;

type FieldName = 'guestName' | 'guestPhone' | 'seats';
type FieldErrors = Partial<Record<FieldName, string>>;
type FormValues = { guestName: string; guestPhone: string; seats: number };

function loadSavedPass(): GuestSignupResult | null {
  try {
    const raw = localStorage.getItem(PASS_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<GuestSignupResult>;
    if (typeof p.confirmationCode === 'string' && typeof p.guestName === 'string' && typeof p.seats === 'number') {
      return {
        confirmationCode: p.confirmationCode,
        guestName: p.guestName,
        guestPhone: typeof p.guestPhone === 'string' ? p.guestPhone : '',
        seats: p.seats,
        invitedBy: typeof p.invitedBy === 'string' ? p.invitedBy : '',
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
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

function validate(field: FieldName, v: FormValues): string | undefined {
  switch (field) {
    case 'guestName':
      return v.guestName.trim().length < 2 ? 'Please enter your name (at least 2 characters).' : undefined;
    case 'guestPhone': {
      if (!v.guestPhone.trim()) return 'Please enter your WhatsApp number.';
      const digits = v.guestPhone.replace(/\D/g, '');
      return digits.length < 8 || digits.length > 15
        ? 'Please enter a valid mobile number, for example 012-345 6789.'
        : undefined;
    }
    case 'seats':
      return !Number.isInteger(v.seats) || v.seats < 1 || v.seats > MAX_SEATS
        ? `Please choose between 1 and ${MAX_SEATS} seats.`
        : undefined;
  }
}

const seatsLabel = (n: number) => (n === 1 ? '1 seat' : `${n} seats`);

/* ==========================================================================
   Decorative elements borrowed from the printed invitation card (aria-hidden)
   ========================================================================== */

function CornerFlourish({ className }: { className: string }) {
  return (
    <svg className={`rg-flourish ${className}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M4 60 C4 30 12 14 34 6" />
        <path d="M4 60 C30 60 48 52 58 30" />
        <path d="M14 46 c-6 -6 -2 -16 7 -14 c6 1 6 9 1 10 c-3 1 -5 -2 -3 -4" />
        <path d="M24 38 c4 -10 16 -12 20 -4" />
      </g>
      <circle cx="4" cy="60" r="2.4" fill="currentColor" />
    </svg>
  );
}

function MangerCrownMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`rg-manger ${className}`} viewBox="0 0 120 92" aria-hidden="true" focusable="false">
      <g className="rg-manger__crown">
        <path d="M38 30 L34 8 L48 20 L60 4 L72 20 L86 8 L82 30 Z" />
        <circle cx="34" cy="7" r="3" />
        <circle cx="60" cy="3.5" r="3" />
        <circle cx="86" cy="7" r="3" />
        <rect x="37" y="29" width="46" height="5" rx="1.5" />
      </g>
      <path
        className="rg-manger__straw"
        d="M18 46 L24 36 L28 44 L34 33 L40 43 L46 34 L52 43 L58 33 L64 43 L70 34 L76 43 L82 33 L88 44 L94 36 L100 46 Z"
      />
      <g className="rg-manger__wood">
        <path d="M14 45 H106 L96 66 H24 Z" />
        <path d="M30 64 L44 64 L30 90 L20 90 Z" />
        <path d="M76 64 L90 64 L100 90 L90 90 Z" />
      </g>
    </svg>
  );
}

function PeopleGlyphs({ count }: { count: number }) {
  const safe = Number.isFinite(count) ? Math.max(0, Math.min(MAX_SEATS, count)) : 0;
  const shown = Math.min(safe, MAX_PEOPLE_GLYPHS);
  return (
    <span className="rg-people" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className="rg-people__seat-token"
          style={{ animationDelay: `${i * 35}ms` }}
        >
          <svg className="rg-people__flame" viewBox="0 0 16 16">
            <path d="M8 1 L9.6 5.4 L14 7 L9.6 8.6 L8 13 L6.4 8.6 L2 7 L6.4 5.4 Z" />
          </svg>
          <svg className="rg-people__icon" viewBox="0 0 24 24">
            <circle cx="12" cy="7.5" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
          </svg>
        </span>
      ))}
      {safe > MAX_PEOPLE_GLYPHS && <span className="rg-people__more">+{safe - MAX_PEOPLE_GLYPHS}</span>}
    </span>
  );
}

function EventFacts({ variant }: { variant: 'hero' | 'ticket' }) {
  return (
    <dl className={`rg-facts rg-facts--${variant}`}>
      <div className="rg-facts__row">
        <dt>
          <CalendarIcon size={18} />
          <span className="visually-hidden">Date</span>
        </dt>
        <dd>
          <strong>{KING_OF_GLORY_INVITE.dateLabel}</strong>
          <span>Christmas Eve</span>
        </dd>
      </div>
      <div className="rg-facts__row">
        <dt>
          <TimerClockIcon size={18} />
          <span className="visually-hidden">Time</span>
        </dt>
        <dd>
          <strong>{KING_OF_GLORY_INVITE.timeLabel}</strong>
          <span>Please arrive by {KING_OF_GLORY_INVITE.arriveByLabel}</span>
        </dd>
      </div>
      <div className="rg-facts__row">
        <dt>
          <MapPinIcon size={18} />
          <span className="visually-hidden">Venue</span>
        </dt>
        <dd>
          <strong>
            {venue.building}, {venue.floor}
          </strong>
          <span>
            {venue.room} · {variant === 'ticket' ? VENUE_ADDRESS_LABEL : 'Jalan Dato Abdullah Tahir, Johor Bahru'}
          </span>
        </dd>
      </div>
    </dl>
  );
}

function BrandBar() {
  return (
    <header className="rg-brand">
      <span className="rg-brand__mark" aria-hidden="true">
        <MangerCrownMark />
      </span>
      <span className="rg-brand__name">{KING_OF_GLORY_INVITE.churchShortName}</span>
      <span className="rg-brand__church">{KING_OF_GLORY_INVITE.churchFullName}</span>
    </header>
  );
}

function InviteHero() {
  return (
    <section className="rg-hero rg-shadow" aria-labelledby="rg-hero-title">
      <div className="rg-stamp rg-stamp--red">
        <div className="rg-stamp__paper">
          <div className="rg-hero__panel">
            <div className="rg-foil-sheen" aria-hidden="true" />
            <CornerFlourish className="rg-flourish--tl" />
            <CornerFlourish className="rg-flourish--tr" />
            <CornerFlourish className="rg-flourish--bl" />
            <CornerFlourish className="rg-flourish--br" />
            <p className="rg-hero__eyebrow">{KING_OF_GLORY_INVITE.tagline}</p>
            <h1 id="rg-hero-title" className="rg-hero__title">
              Come celebrate Christmas with us
            </h1>
            <p className="rg-hero__lead">
              You’re warmly invited to a Christmas Eve evening with us. Bring your loved ones — we’ll save
              seats for all of you.
            </p>
            <EventFacts variant="hero" />
            <MangerCrownMark className="rg-hero__manger" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Page
   ========================================================================== */

export function GuestSignupPage() {
  const [completed, setCompleted] = useState<GuestSignupResult | null>(() => loadSavedPass());
  const [justRegistered, setJustRegistered] = useState(false);

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
  const doneHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => window.clearTimeout(announceTimerRef.current), []);

  const values: FormValues = { guestName, guestPhone, seats };

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
    [hintId, errors[field] ? `rg-${field}-error` : undefined].filter(Boolean).join(' ') || undefined;

  const changeSeats = (next: number) => {
    const clamped = Math.min(MAX_SEATS, Math.max(1, next));
    setSeats(clamped);
    markInteracted('seats');
    playArcadeTone(clamped > seats ? 'pickup' : 'tap');
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
    setInteracted({ guestName: true, guestPhone: true, seats: true });

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
      setJustRegistered(true);
      setCompleted(guest);
      playArcadeTone('fanfare');
      requestIdRef.current = newRequestId();
      window.scrollTo({ top: 0, behavior: 'auto' });
      window.setTimeout(() => doneHeadingRef.current?.focus(), 50);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : 'I couldn’t save your seats just now. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    savePass(null);
    setCompleted(null);
    setJustRegistered(false);
    setGuestName('');
    setGuestPhone('');
    setSeats(1);
    setInvitedBy('');
    setErrors({});
    setInteracted({});
    setSubmitError('');
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.setTimeout(() => nameRef.current?.focus(), 50);
  };

  const validSeats = Number.isFinite(seats) && seats >= 1;

  return (
    <div className="rg">
      <ChristmasCastleMagic variant="register" />
      <CastleSkylineCrest label={`${venue.building}, ${venue.floor} · Christmas Eve ${KING_OF_GLORY_INVITE.timeLabel}`} />
      <BrandBar />

      {completed ? (
        <GuestDone
          pass={completed}
          justRegistered={justRegistered}
          headingRef={doneHeadingRef}
          onRegisterAnother={handleRegisterAnother}
        />
      ) : (
        <div className="rg-layout">
          <InviteHero />

          <section className="rg-card" aria-labelledby="rg-form-title">
            <p className="rg-step">
              <span className="rg-step__dot rg-step__dot--on" aria-hidden="true" />
              <span className="rg-step__dot" aria-hidden="true" />
              <span>Step 1 of 2 · Your details</span>
            </p>
            <h2 id="rg-form-title" className="rg-card__title">
              Save your seats
            </h2>
            <p className="rg-card__sub">
              It takes less than a minute. Right after, I’ll show you exactly how to get to {venue.building}.
            </p>

            <form className="rg-form" action="/api/public/guest-signup" method="post" noValidate onSubmit={handleSubmit}>
              <div className="rg-field">
                <label htmlFor="rg-guestName" className="rg-label">
                  Your name
                </label>
                <input
                  ref={nameRef}
                  id="rg-guestName"
                  name="guestName"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  autoCapitalize="words"
                  spellCheck={false}
                  enterKeyHint="next"
                  className="rg-input"
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
                  <p id="rg-guestName-error" className="rg-error">
                    <span role="img" aria-label="Error">⚠</span> {errors.guestName}
                  </p>
                )}
              </div>

              <div className="rg-field">
                <label htmlFor="rg-guestPhone" className="rg-label">
                  WhatsApp number
                </label>
                <span id="rg-guestPhone-hint" className="rg-hint">
                  e.g. 012-345 6789 — only used to confirm your seats.
                </span>
                <input
                  ref={phoneRef}
                  id="rg-guestPhone"
                  name="guestPhone"
                  type="tel"
                  inputMode="tel"
                  required
                  maxLength={30}
                  autoComplete="tel"
                  enterKeyHint="next"
                  className="rg-input"
                  value={guestPhone}
                  aria-invalid={errors.guestPhone ? 'true' : 'false'}
                  aria-describedby={describedBy('guestPhone', 'rg-guestPhone-hint')}
                  onChange={(e) => {
                    setGuestPhone(e.target.value);
                    markInteracted('guestPhone');
                  }}
                  onBlur={() => handleBlur('guestPhone', 'WhatsApp number')}
                />
                {errors.guestPhone && (
                  <p id="rg-guestPhone-error" className="rg-error">
                    <span role="img" aria-label="Error">⚠</span> {errors.guestPhone}
                  </p>
                )}
              </div>

              <div className="rg-field">
                <label htmlFor="rg-seats" className="rg-label">
                  How many seats?
                </label>
                <span id="rg-seats-hint" className="rg-hint">
                  Count yourself too. Up to {MAX_SEATS} per registration.
                </span>
                <div className="rg-seats">
                  <div className="rg-stepper">
                    <button
                      type="button"
                      className="rg-stepper__btn"
                      aria-label="Remove one seat"
                      disabled={!validSeats || seats <= 1}
                      onClick={() => changeSeats(seats - 1)}
                    >
                      −
                    </button>
                    <input
                      ref={seatsRef}
                      id="rg-seats"
                      name="seats"
                      type="number"
                      inputMode="numeric"
                      required
                      min={1}
                      max={MAX_SEATS}
                      step={1}
                      className="rg-stepper__input"
                      value={Number.isFinite(seats) ? seats : ''}
                      aria-invalid={errors.seats ? 'true' : 'false'}
                      aria-describedby={describedBy('seats', 'rg-seats-hint')}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        setSeats(Number.isFinite(n) ? n : Number.NaN);
                        markInteracted('seats');
                      }}
                      onBlur={() => handleBlur('seats', 'How many seats')}
                    />
                    <button
                      type="button"
                      className="rg-stepper__btn"
                      aria-label="Add one seat"
                      disabled={validSeats && seats >= MAX_SEATS}
                      onClick={() => changeSeats((validSeats ? seats : 0) + 1)}
                    >
                      +
                    </button>
                  </div>
                  <PeopleGlyphs count={seats} />
                </div>
                {errors.seats && (
                  <p id="rg-seats-error" className="rg-error">
                    <span role="img" aria-label="Error">⚠</span> {errors.seats}
                  </p>
                )}
              </div>

              <details className="rg-invited">
                <summary>
                  <UserPlusIcon size={16} />
                  <span>Someone invited you? (optional)</span>
                </summary>
                <div className="rg-field rg-invited__body">
                  <label htmlFor="rg-invitedBy" className="rg-label">
                    Who invited you?
                  </label>
                  <input
                    id="rg-invitedBy"
                    name="invitedBy"
                    type="text"
                    maxLength={80}
                    autoComplete="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="done"
                    className="rg-input"
                    value={invitedBy}
                    onChange={(e) => setInvitedBy(e.target.value)}
                  />
                </div>
              </details>

              {submitError && (
                <div className="rg-alert" role="alert">
                  {submitError}
                </div>
              )}

              <button type="submit" className="rg-btn rg-btn--primary rg-btn--block rg-btn--lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="rg-spinner rg-spinner--light" aria-hidden="true" />
                    <span>Saving your seats…</span>
                  </>
                ) : (
                  <span>{validSeats && seats > 1 ? `Save my ${seats} seats` : 'Save my seat'}</span>
                )}
              </button>

              <p className="rg-trust">
                <ShieldCheckIcon size={16} />
                <span>Your details stay with the {KING_OF_GLORY_INVITE.churchShortName} welcome team.</span>
              </p>
            </form>
          </section>
        </div>
      )}

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

/* ==========================================================================
   After sign-up: ticket, directions & interactive arrival tour
   ========================================================================== */

interface GuestDoneProps {
  pass: GuestSignupResult;
  justRegistered?: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRegisterAnother: () => void;
}

function GuestDone({ pass, justRegistered = false, headingRef, onRegisterAnother }: GuestDoneProps) {
  const [icsError, setIcsError] = useState('');

  const downloadIcs = () => {
    try {
      const blob = new Blob([buildInviteIcsContent(pass.confirmationCode)], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cccjb-christmas-eve.ics';
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIcsError('');
    } catch {
      setIcsError('I couldn’t create the calendar file on this device. Try “Google Calendar” instead.');
    }
  };

  return (
    <div className="rg-done">
      {justRegistered && <ConfettiBurst intensity="high" />}
      <section className="rg-ticket-wrap" aria-labelledby="rg-done-title">
        <div className="rg-shadow">
        <div className="rg-stamp rg-stamp--cream">
          <div className="rg-stamp__paper">
            <div className="rg-ticket">
              <div className="rg-foil-sheen" aria-hidden="true" />
              <div className="rg-ticket__main">
                <p className="rg-step rg-step--done">
                  <span className="rg-step__dot rg-step__dot--on" aria-hidden="true" />
                  <span className="rg-step__dot rg-step__dot--on" aria-hidden="true" />
                  <span>Step 2 of 2 · All set</span>
                </p>
                <h2 id="rg-done-title" ref={headingRef} tabIndex={-1} className="rg-ticket__title">
                  <CheckCircleIcon size={26} className="rg-ticket__check" />
                  <span>You’re in, {pass.guestName}!</span>
                </h2>
                <p className="rg-ticket__lead">
                  We’ve saved <strong>{seatsLabel(pass.seats)}</strong> for you. See you on Christmas Eve!
                </p>
                <EventFacts variant="ticket" />
              </div>

              <div className="rg-ticket__stub">
                <span className="rg-ticket__stub-label">Confirmation code</span>
                <strong className="rg-ticket__code">{pass.confirmationCode}</strong>
                <span className="rg-ticket__stub-note">Show this at the welcome desk on {venue.floor}.</span>
                <span className="rg-ticket__seats">{seatsLabel(pass.seats)}</span>
              </div>
            </div>
          </div>
        </div>
        </div>

        <div className="rg-actions">
          <a className="rg-btn rg-btn--primary" href={VENUE_NAV_LINKS.googleMaps} target="_blank" rel="noopener noreferrer">
            <MapPinIcon size={18} />
            <span>Directions in Google Maps</span>
          </a>
          <a className="rg-btn rg-btn--waze" href={VENUE_NAV_LINKS.waze} target="_blank" rel="noopener noreferrer">
            <WazeIcon size={18} />
            <span>Open in Waze</span>
          </a>
          <a
            className="rg-btn rg-btn--ghost"
            href={buildInviteGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CalendarIcon size={18} />
            <span>Add to Google Calendar</span>
          </a>
          <button type="button" className="rg-btn rg-btn--ghost" onClick={downloadIcs}>
            <DownloadIcon size={18} />
            <span>Apple / Outlook calendar</span>
          </button>
        </div>
        {icsError && (
          <p className="rg-error rg-actions__error" role="alert">
            {icsError}
          </p>
        )}
      </section>

      <section className="rg-route" aria-labelledby="rg-route-title">
        <div className="rg-route__head">
          <h2 id="rg-route-title" className="rg-route__title">
            Your way to {venue.building}
          </h2>
          <p className="rg-route__sub">
            Tap each stop to fly there on the map. The tower lit up in gold is where we’ll be.
          </p>
        </div>
        <VenueMap />
      </section>

      <div className="rg-again">
        <p>Saving seats for someone else on this phone?</p>
        <button type="button" className="rg-btn rg-btn--ghost" onClick={onRegisterAnother}>
          Register another guest
        </button>
      </div>
    </div>
  );
}

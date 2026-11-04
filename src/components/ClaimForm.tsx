import { useId, useRef, useState } from 'react';
import {
  ACTIVE_ARCADE_GAMES,
  type EventSettings,
  type GameId,
  type PublicClaimResult,
} from '../types.ts';
import { submitWinnerLead } from '../lib/api.ts';
import { getOrCreateVisitorId } from '../lib/playerSession.ts';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CrownIcon,
  GiftBoxIcon,
  ShieldCheckIcon,
  ShiningTrophy,
  TicketPassIcon,
} from './Icons.tsx';

interface ClaimFormProps {
  gamePlayed: GameId;
  score: number;
  projectedRank: number | null;
  targetScore: number;
  volunteerName: string;
  settings: EventSettings;
  onClaimed: (result: PublicClaimResult) => void;
  onReplay: () => void;
}

const COUNTRY_OPTIONS = [
  { code: '60', label: 'MY +60' },
  { code: '65', label: 'SG +65' },
  { code: '62', label: 'ID +62' },
  { code: '63', label: 'PH +63' },
  { code: '66', label: 'TH +66' },
  { code: '61', label: 'AU +61' },
  { code: '44', label: 'UK +44' },
  { code: '1', label: 'US +1' },
  { code: '91', label: 'IN +91' },
  { code: '86', label: 'CN +86' },
];

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ClaimForm({
  gamePlayed,
  score,
  projectedRank,
  targetScore,
  volunteerName,
  settings,
  onClaimed,
  onReplay,
}: ClaimFormProps) {
  const uid = useId();
  const requestIdRef = useRef<string>(createClientRequestId());

  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState(settings.defaultCountryCode || '60');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const gameMeta = ACTIVE_ARCADE_GAMES.find((g) => g.id === gamePlayed);
  const trophyTier: 'gold' | 'silver' | 'bronze' =
    projectedRank === 2 ? 'silver' : projectedRank === 3 ? 'bronze' : 'gold';

  const syncAriaInvalid = (el: HTMLInputElement) => {
    const invalid = !el.checkValidity();
    el.classList.toggle('user-invalid-fallback', invalid);
    if (invalid) {
      el.setAttribute('aria-invalid', 'true');
    } else {
      el.removeAttribute('aria-invalid');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const inputs = Array.from(form.querySelectorAll('input'));
      for (const inp of inputs) {
        syncAriaInvalid(inp);
      }
      const firstInvalid = inputs.find((inp) => !inp.checkValidity());
      firstInvalid?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { claim } = await submitWinnerLead({
        name,
        phone,
        countryCode,
        gamePlayed,
        score,
        targetScore,
        volunteerName,
        clientRequestId: requestIdRef.current,
        visitorId: getOrCreateVisitorId(),
      });
      onClaimed(claim);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not unlock pass. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby={`${uid}-win-heading`}
      className="unlock-card stage-enter"
    >
      <div className="unlock-hero">
        <div className="unlock-hero__glow" aria-hidden="true" />
        <ShiningTrophy
          tier={trophyTier}
          size={78}
          rankBadge={projectedRank && projectedRank <= 3 ? projectedRank : null}
        />

        <span className="marquee-pill marquee-pill--gold">
          <CrownIcon size={13} />
          <span>
            {gameMeta ? `${gameMeta.title} · ` : ''}
            {score} PTS
            {projectedRank !== null ? ` · RANK #${projectedRank}` : ' · WINNER'}
          </span>
        </span>

        <h1 id={`${uid}-win-heading`} className="unlock-hero__title">
          Unlock Gift &amp; VIP Pass
        </h1>
      </div>

      <form method="post" action="/api/leads" noValidate onSubmit={handleSubmit} className="unlock-body">
        <div className="unlock-perks" aria-label="Included rewards">
          <div className="unlock-perk">
            <span className="unlock-perk__icon unlock-perk__icon--crimson">
              <GiftBoxIcon size={18} />
            </span>
            <div className="unlock-perk__copy">
              <strong>{settings.giftDescription}</strong>
              <span>Show pass code to collect right now</span>
            </div>
          </div>

          <div className="unlock-perk">
            <span className="unlock-perk__icon unlock-perk__icon--gold">
              <TicketPassIcon size={18} />
            </span>
            <div className="unlock-perk__copy">
              <strong>{settings.eventTitle}</strong>
              <span>
                {projectedRank !== null
                  ? `VIP E-Pass + Lock Rank #${projectedRank} on Board`
                  : 'VIP E-Pass + Official Leaderboard Access'}
              </span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`${uid}-name`} className="form-label">
            Name
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            type="text"
            className="form-input"
            autoComplete="name"
            enterKeyHint="next"
            required
            minLength={1}
            maxLength={80}
            placeholder="e.g. Mei Ling"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.currentTarget.hasAttribute('aria-invalid')) {
                syncAriaInvalid(e.currentTarget);
              }
            }}
            onBlur={(e) => syncAriaInvalid(e.currentTarget)}
          />
          <div className="field-error" role="alert">
            Please enter your name.
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`${uid}-phone`} className="form-label">
            WhatsApp Number
          </label>
          <div className="phone-row">
            <div>
              <label htmlFor={`${uid}-cc`} className="visually-hidden">
                Country code
              </label>
              <select
                id={`${uid}-cc`}
                name="countryCode"
                className="form-select"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {COUNTRY_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              id={`${uid}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              enterKeyHint="done"
              className="form-input"
              required
              pattern="[0-9+\-\s\(\)]{7,20}"
              placeholder="012 345 6789"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (e.currentTarget.hasAttribute('aria-invalid')) {
                  syncAriaInvalid(e.currentTarget);
                }
              }}
              onBlur={(e) => syncAriaInvalid(e.currentTarget)}
            />
          </div>
          <div className="field-error" role="alert">
            Enter a valid 7–15 digit mobile number.
          </div>
        </div>

        {serverError && (
          <div role="alert" className="form-alert">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--shimmer btn--full"
          disabled={submitting}
        >
          <GiftBoxIcon size={18} />
          <span>{submitting ? 'Opening VIP Pass…' : 'Get Gift & VIP Pass'}</span>
          <ArrowRightIcon size={15} />
        </button>

        <p className="privacy-reassurance">
          <ShieldCheckIcon size={14} />
          <span>Public board shows initials only (e.g. Mei L.) · Never shared.</span>
        </p>

        <div className="unlock-back">
          <button type="button" className="btn btn--subtle btn--sm" onClick={onReplay}>
            <ArrowLeftIcon size={14} />
            <span>Back to Arcade</span>
          </button>
        </div>
      </form>
    </section>
  );
}

import { useId, useRef, useState } from 'react';
import type { EventSettings, GameId, PublicClaimResult } from '../types.ts';
import { submitWinnerLead } from '../lib/api.ts';
import { getOrCreateVisitorId } from '../lib/playerSession.ts';

interface ClaimFormProps {
  gamePlayed: GameId;
  score: number;
  targetScore: number;
  volunteerName: string;
  settings: EventSettings;
  onClaimed: (result: PublicClaimResult) => void;
  onReplay: () => void;
}

const COUNTRY_OPTIONS = [
  { code: '60', label: '🇲🇾 +60' },
  { code: '65', label: '🇸🇬 +65' },
  { code: '62', label: '🇮🇩 +62' },
  { code: '63', label: '🇵🇭 +63' },
  { code: '66', label: '🇹🇭 +66' },
  { code: '61', label: '🇦🇺 +61' },
  { code: '44', label: '🇬🇧 +44' },
  { code: '1', label: '🇺🇸 +1' },
  { code: '91', label: '🇮🇳 +91' },
  { code: '86', label: '🇨🇳 +86' },
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
      style={{ maxInlineSize: '26rem', inlineSize: '100%', marginInline: 'auto' }}
    >
      <div style={{ textAlign: 'center', marginBlockEnd: '1rem' }}>
        <span className="challenger-tag">★ {score} pts · Winner</span>
        <h1 id={`${uid}-win-heading`} className="hero-title" style={{ marginBlockStart: '0.45rem' }}>
          Claim Your Gift
        </h1>
        <p className="subtle-text" style={{ marginBlockStart: '0.25rem' }}>
          🎁 {settings.giftDescription} + {settings.eventTitle} Pass
        </p>
      </div>

      <form method="post" action="/api/leads" noValidate onSubmit={handleSubmit} className="card-panel">
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
            placeholder="Your name"
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
            <span aria-hidden="true">⚠ </span>Please enter your name.
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
              pattern="[+0-9 ()\-]{7,20}"
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
            <span aria-hidden="true">⚠ </span>Enter a valid 7–15 digit mobile number.
          </div>
        </div>

        {serverError && (
          <div
            role="alert"
            style={{
              marginBlockEnd: '0.9rem',
              padding: '0.65rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-ink)',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            ⚠ {serverError}
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
          {submitting ? 'Opening Pass…' : 'Get Gift & E-Pass'}
        </button>

        <div style={{ marginBlockStart: '0.65rem', textAlign: 'center' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReplay}>
            ← Back to Arcade
          </button>
        </div>
      </form>
    </section>
  );
}

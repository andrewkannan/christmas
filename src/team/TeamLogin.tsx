import { useId, useState } from 'react';
import type { TeamSessionUser } from '../types.ts';
import { loginTeamPin } from '../lib/api.ts';
import { KeyPasscodeIcon, LockIcon, ShieldCheckIcon } from '../components/Icons.tsx';

interface TeamLoginProps {
  onAuthenticated: (user: TeamSessionUser | null) => void;
}

export function TeamLogin({ onAuthenticated }: TeamLoginProps) {
  const uid = useId();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncAriaInvalid = (el: HTMLInputElement) => {
    const isUserInvalid =
      typeof CSS !== 'undefined' &&
      CSS.supports?.('selector(:user-invalid)') &&
      el.matches(':user-invalid');
    if (isUserInvalid) {
      el.setAttribute('aria-invalid', 'true');
    } else {
      el.removeAttribute('aria-invalid');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmed = pin.trim();
    if (!trimmed) {
      setError('Please enter your personal passcode or Team PIN.');
      return;
    }
    setLoading(true);
    try {
      const res = await loginTeamPin(trimmed);
      onAuthenticated(res.user ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect passcode or Team PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby={`${uid}-login-title`}
      style={{ maxInlineSize: '28rem', marginInline: 'auto', inlineSize: '100%' }}
    >
      <form
        method="post"
        action="/api/team/login"
        onSubmit={handleSubmit}
        className="card-panel team-login-card"
      >
        <div className="team-login-card__badge">
          <LockIcon size={20} />
        </div>
        <span className="challenger-tag">Evangelism &amp; Pastoral Console</span>
        <h1
          id={`${uid}-login-title`}
          className="section-title"
          style={{ marginBlock: '0.45rem 0.35rem', fontSize: '1.35rem' }}
        >
          Team Command Center Sign-In
        </h1>
        <p className="subtle-text" style={{ marginBlockEnd: '1.2rem' }}>
          Sign in with <strong>only your personal passcode</strong> (e.g. <code>AK2708</code>) or
          the Master Team PIN to track campaign goals, log contact remarks, and send WhatsApp
          invitations.
        </p>

        <div className="form-group">
          <label htmlFor="team-access-passcode" className="form-label">
            Team Passcode or Team Access PIN
          </label>
          <span id={`${uid}-pin-hint`} className="field-hint">
            Letters &amp; numbers accepted (case-insensitive, e.g. AK2708) — no username required.
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
            <input
              id="team-access-passcode"
              name="pin"
              type={showPin ? 'text' : 'password'}
              autoComplete="current-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              required
              maxLength={24}
              placeholder="e.g. AK2708"
              className="form-input"
              value={pin}
              aria-describedby={`${uid}-pin-hint`}
              onBlur={(e) => syncAriaInvalid(e.currentTarget)}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
                if (e.currentTarget.hasAttribute('aria-invalid')) {
                  syncAriaInvalid(e.currentTarget);
                }
              }}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-pressed={showPin}
              aria-label={showPin ? 'Hide passcode' : 'Show passcode'}
              onClick={() => setShowPin((s) => !s)}
            >
              {showPin ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="form-alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
          <KeyPasscodeIcon size={16} />
          <span>{loading ? 'Verifying Passcode…' : 'Unlock Command Center'}</span>
        </button>

        <p className="privacy-reassurance">
          <ShieldCheckIcon size={14} />
          <span>Encrypted passcodes · Guest phone numbers stay strictly confidential</span>
        </p>
      </form>
    </section>
  );
}

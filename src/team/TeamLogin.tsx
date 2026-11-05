import { useId, useState } from 'react';
import { loginTeamPin } from '../lib/api.ts';
import { LockIcon, ShieldCheckIcon } from '../components/Icons.tsx';

interface TeamLoginProps {
  onAuthenticated: () => void;
}

export function TeamLogin({ onAuthenticated }: TeamLoginProps) {
  const uid = useId();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!pin.trim()) {
      setError('Please enter the Team PIN.');
      return;
    }
    setLoading(true);
    try {
      await loginTeamPin(pin.trim());
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby={`${uid}-login-title`}
      style={{ maxInlineSize: '27rem', marginInline: 'auto', inlineSize: '100%' }}
    >
      <form method="post" action="/api/team/login" onSubmit={handleSubmit} className="card-panel team-login-card">
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
          Enter your outreach team PIN to monitor campaign targets, log pastoral remarks on live
          contacts, and send 1-tap WhatsApp invitations.
        </p>

        <div className="form-group">
          <label htmlFor={`${uid}-pin`} className="form-label">
            Team Access PIN
          </label>
          <span id={`${uid}-pin-hint`} className="field-hint">
            Ask your outreach team leader for today&apos;s PIN.
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
            <input
              id={`${uid}-pin`}
              name="pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              required
              className="form-input"
              value={pin}
              aria-describedby={`${uid}-pin-hint`}
              onChange={(e) => setPin(e.target.value)}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-pressed={showPin}
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
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
          {loading ? 'Verifying PIN…' : 'Unlock Command Center'}
        </button>

        <p className="privacy-reassurance">
          <ShieldCheckIcon size={14} />
          <span>Protected session · Guest phone numbers stay strictly confidential</span>
        </p>
      </form>
    </section>
  );
}

import { useId, useState } from 'react';
import { loginTeamPin } from '../lib/api.ts';

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
    <section aria-labelledby={`${uid}-login-title`} style={{ maxInlineSize: '26rem', marginInline: 'auto', inlineSize: '100%' }}>
      <form method="post" action="/api/team/login" onSubmit={handleSubmit} className="card-panel">
        <span className="challenger-tag">Outreach Console</span>
        <h1 id={`${uid}-login-title`} className="section-title" style={{ marginBlock: '0.5rem 0.35rem' }}>
          🔐 Team Dashboard Sign-In
        </h1>
        <p className="subtle-text" style={{ marginBlockEnd: '1.2rem' }}>
          Enter your outreach team PIN to view live contacts, send 1-tap WhatsApp invites, and
          generate volunteer QR boards.
        </p>

        <div className="form-group">
          <label htmlFor={`${uid}-pin`} className="form-label">
            Team PIN
          </label>
          <span id={`${uid}-pin-hint`} className="field-hint">
            Ask your outreach leader for today&apos;s PIN (dev default: 1225).
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
          <div
            role="alert"
            style={{
              marginBlockEnd: '1rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-ink)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            ⚠ {error}
          </div>
        )}

        <button type="submit" className="btn btn--gold btn--full" disabled={loading}>
          {loading ? 'Verifying PIN…' : 'Unlock Team Dashboard'}
        </button>
      </form>
    </section>
  );
}

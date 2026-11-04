import { useEffect, useId, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { EventSettings } from '../types.ts';

interface QrBoardMakerProps {
  settings: EventSettings;
}

export function QrBoardMaker({ settings }: QrBoardMakerProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [volunteerName, setVolunteerName] = useState('Andrew');
  const [targetScore, setTargetScore] = useState(18);
  const [baseUrl, setBaseUrl] = useState(() => window.location.origin);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const raw = baseUrl.trim().replace(/\/+$/, '');
    const withProto = raw
      ? /^https?:\/\//i.test(raw)
        ? raw
        : `https://${raw}`
      : window.location.origin;

    let url: URL;
    try {
      url = new URL(withProto);
    } catch {
      url = new URL(window.location.origin);
    }

    if (volunteerName.trim()) {
      url.searchParams.set('vs', volunteerName.trim());
    }
    url.searchParams.set('target', String(targetScore || 18));
    return url.toString();
  }, [baseUrl, volunteerName, targetScore]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 560,
      margin: 2,
      color: { dark: '#0b1914', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <section className="card-panel" aria-labelledby={`${uid}-qr-heading`}>
      <h2 id={`${uid}-qr-heading`} className="section-title">
        🪧 Volunteer QR Board Generator
      </h2>
      <p className="subtle-text" style={{ marginBlock: '0.35rem 1.1rem' }}>
        Give each volunteer their own QR board so players see{' '}
        <strong>&ldquo;Beat {volunteerName || 'Me'}!&rdquo;</strong> and every contact is
        automatically tagged to the volunteer they met.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <div>
          <div className="form-group">
            <label htmlFor={`${uid}-vol`} className="form-label">
              Volunteer / Challenger Name
            </label>
            <span id={`${uid}-vol-hint`} className="field-hint">
              Leave blank for a general team board.
            </span>
            <input
              id={`${uid}-vol`}
              type="text"
              className="form-input"
              maxLength={40}
              value={volunteerName}
              aria-describedby={`${uid}-vol-hint`}
              onChange={(e) => setVolunteerName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-target`} className="form-label">
              Target Score to Beat (10–30 pts)
            </label>
            <span id={`${uid}-target-hint`} className="field-hint">
              16–18 pts gives players an exciting close win in 20s.
            </span>
            <input
              id={`${uid}-target`}
              type="text"
              inputMode="numeric"
              className="form-input"
              value={String(targetScore)}
              aria-describedby={`${uid}-target-hint`}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                setTargetScore(Number.isFinite(n) ? Math.min(50, Math.max(5, n || 15)) : 18);
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-base`} className="form-label">
              Public Website URL
            </label>
            <input
              id={`${uid}-base`}
              type="url"
              className="form-input"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-cream)',
            color: 'var(--ink-on-cream)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            textAlign: 'center',
            border: '2px solid var(--accent-gold)',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--accent-crimson)' }}>
            🎄 SCAN &amp; PLAY IN 20 SECONDS!
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', marginBlock: '0.2rem 0.65rem' }}>
            {volunteerName.trim()
              ? `Can You Beat ${volunteerName.trim()}'s ${targetScore} Pts?`
              : 'Win a Free Christmas Gift!'}
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt={`QR code linking to ${shareUrl}`}
              style={{
                inlineSize: '13.5rem',
                blockSize: '13.5rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #d4c5ab',
              }}
            />
          )}
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem',
              wordBreak: 'break-all',
              marginBlock: '0.6rem 0.9rem',
              color: 'var(--ink-on-cream-muted)',
            }}
          >
            {shareUrl}
          </p>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`qr-board-${(volunteerName.trim() || 'team').toLowerCase()}.png`}
                className="btn btn--primary btn--sm btn--full"
              >
                ⬇ Download QR PNG
              </a>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--cream-outline btn--sm"
                onClick={handleCopy}
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
              <button
                type="button"
                className="btn btn--cream-outline btn--sm"
                onClick={() => dialogRef.current?.showModal()}
              >
                🖨 Poster View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Native <dialog> opened via showModal() for full Printable A4 Board Poster */}
      <dialog ref={dialogRef} className="poster-dialog" aria-labelledby={`${uid}-poster-title`}>
        <div className="printable-board" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-crimson)' }}>
            {settings.churchName.toUpperCase()} · CHRISTMAS ARCADE CHALLENGE
          </div>
          <h2 id={`${uid}-poster-title`} style={{ fontSize: '1.85rem', margin: '0.35rem 0', fontWeight: 900 }}>
            {volunteerName.trim()
              ? `🎄 Beat ${volunteerName.trim()} & Win a Gift!`
              : '🎄 Play 20s & Win a Free Gift!'}
          </h2>
          <p style={{ margin: '0 0 0.9rem', fontWeight: 600 }}>
            Scan with your phone camera · Pick any quick game · Claim your{' '}
            <strong>{settings.giftDescription}</strong>!
          </p>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt={`Printable QR code for ${volunteerName || 'Team'}`}
              style={{ inlineSize: '17rem', blockSize: '17rem' }}
            />
          )}
          <p style={{ margin: '0.75rem 0 0', fontWeight: 800, fontSize: '0.98rem' }}>
            🧸 Claw Grab · 🛷 Santa Dash · 🧱 Tetris · ⚔️ Berry Slash · 🍬 Candy Match
          </p>
        </div>
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.6rem',
            marginBlockStart: '1.2rem',
          }}
        >
          <button
            type="button"
            className="btn btn--cream-outline btn--sm"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => window.print()}
          >
            🖨 Print A4 Board
          </button>
        </div>
      </dialog>
    </section>
  );
}

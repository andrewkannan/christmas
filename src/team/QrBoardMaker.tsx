import { useEffect, useId, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { EventSettings } from '../types.ts';
import {
  CheckCircleIcon,
  CopyIcon,
  DownloadPassIcon,
  QrBoardIcon,
} from '../components/Icons.tsx';

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
      color: { dark: '#18181b', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shareUrl]);

  // Fallback light-dismiss for browsers without native closedby="any"
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    const handleBackdropClick = (e: MouseEvent) => {
      if (supportsClosedBy) return;
      if (e.target !== dialog) return;
      if (e.clientX === 0 && e.clientY === 0) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inside) dialog.close();
    };
    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, []);

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
      <h2 id={`${uid}-qr-heading`} className="section-title settings-legend">
        <QrBoardIcon size={19} />
        <span>Evangelist QR Board Studio</span>
      </h2>
      <p className="subtle-text" style={{ marginBlock: '0.35rem 1.15rem' }}>
        Give each evangelist their own QR lanyard/board so street players see{' '}
        <strong>&ldquo;Beat {volunteerName.trim() || 'Me'}!&rdquo;</strong> and every new contact
        is automatically assigned to them in Live Contacts.
      </p>

      <div className="qr-studio-grid">
        <div>
          <div className="form-group">
            <label htmlFor={`${uid}-vol`} className="form-label">
              Evangelist / Challenger Name
            </label>
            <span id={`${uid}-vol-hint`} className="field-hint">
              Leave blank for a general church team board.
            </span>
            <input
              id={`${uid}-vol`}
              type="text"
              className="form-input"
              maxLength={40}
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              value={volunteerName}
              aria-describedby={`${uid}-vol-hint`}
              onChange={(e) => setVolunteerName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-target`} className="form-label">
              Target Score to Beat (5–50 pts)
            </label>
            <span id={`${uid}-target-hint`} className="field-hint">
              Displayed on the results screen as &ldquo;beat{' '}
              {volunteerName.trim() || 'the team'}&rsquo;s score&rdquo;.
            </span>
            <input
              id={`${uid}-target`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              className="form-input"
              value={String(targetScore)}
              aria-describedby={`${uid}-target-hint`}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                setTargetScore(Number.isFinite(n) ? Math.min(50, Math.max(5, n || 15)) : 18);
              }}
            />
          </div>

          <div className="form-group" style={{ marginBlockEnd: 0 }}>
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

        <div className="qr-preview-card">
          <div className="qr-preview-card__eyebrow">
            {settings.churchName.toUpperCase()} · STREET ARCADE
          </div>
          <div className="qr-preview-card__headline">
            {volunteerName.trim()
              ? `Can You Beat ${volunteerName.trim()}'s ${targetScore} Pts?`
              : 'Scan, Play & Receive a Christmas Blessing Gift!'}
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt={`QR code linking to ${shareUrl}`}
              className="qr-preview-card__img"
            />
          )}
          <p className="qr-preview-card__url">{shareUrl}</p>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`qr-board-${(volunteerName.trim() || 'team').toLowerCase()}.png`}
                className="btn btn--primary btn--sm btn--full"
              >
                <DownloadPassIcon size={15} />
                <span>Download QR PNG</span>
              </a>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--cream-outline btn--sm"
                onClick={handleCopy}
              >
                {copied ? <CheckCircleIcon size={14} /> : <CopyIcon size={14} />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button
                type="button"
                className="btn btn--cream-outline btn--sm"
                onClick={() => dialogRef.current?.showModal()}
              >
                <span>A4 Poster View</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Native <dialog> opened via showModal() for full Printable A4 Board Poster */}
      <dialog
        ref={dialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        className="poster-dialog"
        aria-labelledby={`${uid}-poster-title`}
      >
        <div className="printable-board" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-crimson)' }}>
            {settings.churchName.toUpperCase()} · CHRISTMAS ARCADE CHALLENGE
          </div>
          <h2
            id={`${uid}-poster-title`}
            style={{ fontSize: '1.8rem', margin: '0.35rem 0', fontWeight: 900 }}
          >
            {volunteerName.trim()
              ? `Beat ${volunteerName.trim()} & Receive a Christmas Gift!`
              : 'Play 45s & Receive a Christmas Blessing Gift!'}
          </h2>
          <p style={{ margin: '0 0 0.9rem', fontWeight: 600 }}>
            Scan with your phone camera · Pick any quick game · Show our team for your{' '}
            <strong>{settings.giftDescription}</strong>!
          </p>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt={`Printable QR code for ${volunteerName || 'Team'}`}
              style={{ inlineSize: '17rem', blockSize: '17rem' }}
            />
          )}
          <p style={{ margin: '0.75rem 0 0', fontWeight: 800, fontSize: '0.95rem' }}>
            Starlight Hockey (2P Versus) · Santa Dash · Block Stack · Berry Slash · Candy Match
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
            Print A4 Board
          </button>
        </div>
      </dialog>
    </section>
  );
}

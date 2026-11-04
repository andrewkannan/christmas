import { useEffect, useMemo, useState } from 'react';
import type { EventSettings, GameId, PublicClaimResult } from '../types.ts';
import { markGiftClaimedPublic } from '../lib/api.ts';
import { savePassLocally, trackArcadeEvent } from '../lib/playerSession.ts';
import { renderPersonalizedETicketPng } from '../lib/ticketCanvas.ts';

interface WinnerPassProps {
  claim: PublicClaimResult;
  settings: EventSettings;
  googleCalendarUrl: string;
  latestReplay?: { gameId: GameId; score: number } | null;
  onPassUpdated: (next: PublicClaimResult) => void;
  onKeepPlayingSamePlayer: () => void;
  onStartFreshFriend: () => void;
}

const GAME_NAMES: Record<GameId, string> = {
  'gift-rush': '⚡ Gift & Star Rush',
  'tap-duel': '🥊 Sleigh Tap Duel',
  'starlight-drop': '🎯 Starlight Drop',
};

function formatReadableDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day, hourStr, minStr] = match;
  const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const h24 = Number(hourStr);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${weekday}, ${Number(day)} ${monthName} ${year} · ${h12}:${minStr} ${period}`;
}

export function WinnerPass({
  claim,
  settings,
  googleCalendarUrl,
  latestReplay,
  onPassUpdated,
  onKeepPlayingSamePlayer,
  onStartFreshFriend,
}: WinnerPassProps) {
  const [giftClaimed, setGiftClaimed] = useState(claim.giftClaimed);
  const [markingClaim, setMarkingClaim] = useState(false);
  const [nowDate, setNowDate] = useState(() => new Date());

  useEffect(() => {
    setGiftClaimed(claim.giftClaimed);
  }, [claim.giftClaimed]);

  useEffect(() => {
    const id = setInterval(() => setNowDate(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ticketDataUrl = useMemo(
    () =>
      renderPersonalizedETicketPng({
        guestName: claim.name,
        redemptionCode: claim.redemptionCode,
        settings,
      }),
    [claim.name, claim.redemptionCode, settings]
  );

  const elapsedSec = Math.max(
    0,
    Math.floor((nowDate.getTime() - new Date(claim.createdAt).getTime()) / 1000)
  );
  const elapsedLabel =
    elapsedSec < 60
      ? `${elapsedSec}s ago`
      : elapsedSec < 3600
        ? `${Math.floor(elapsedSec / 60)}m ago`
        : `${Math.floor(elapsedSec / 3600)}h ago`;

  const friendShareUrl = useMemo(() => {
    const readableDate = formatReadableDate(settings.eventDateIso);
    const shareText =
      `I just played the Christmas Pocket Arcade! 🎄🎁\n\n` +
      `Come join me for *${settings.eventTitle}* hosted by ${settings.churchName} (plus play the 20s arcade games!):\n` +
      `📅 ${readableDate}\n📍 ${settings.venueName}\n` +
      `${window.location.origin}`;
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }, [settings]);

  const handleMarkClaimed = async () => {
    if (giftClaimed || markingClaim) return;
    setMarkingClaim(true);
    try {
      const res = await markGiftClaimedPublic(claim.claimToken);
      setGiftClaimed(res.claim.giftClaimed);
      savePassLocally(res.claim);
      onPassUpdated(res.claim);
    } catch {
      // Allow retry if offline
    } finally {
      setMarkingClaim(false);
    }
  };

  const emitAction = (
    eventType:
      | 'ticket_download'
      | 'invite_share_whatsapp'
      | 'calendar_google'
      | 'calendar_ics'
      | 'maps_click'
  ) => {
    void trackArcadeEvent(
      {
        eventType,
        claimToken: claim.claimToken,
        isPostInteraction: true,
        volunteerName: claim.volunteerName,
      },
      onPassUpdated
    );
  };

  return (
    <section aria-labelledby="winner-pass-heading" style={{ display: 'grid', gap: '1rem' }}>
      {latestReplay && (
        <div className="saved-pass-banner" role="status">
          <div>
            <span className="challenger-tag">Replay Score Recorded!</span>
            <p style={{ margin: '0.3rem 0 0', fontWeight: 800 }}>
              🔥 You scored {latestReplay.score} pts in {GAME_NAMES[latestReplay.gameId]}! (Total
              games played: {claim.totalGamesPlayed || 1})
            </p>
          </div>
          <button
            type="button"
            className="btn btn--gold btn--sm"
            onClick={onKeepPlayingSamePlayer}
          >
            🎮 Play Again
          </button>
        </div>
      )}

      <div className="winner-ticket">
        <div className="winner-ticket__live-bar" aria-live="off">
          <span>
            <span className="live-dot" aria-hidden="true" />
            LIVE PASS · {nowDate.toLocaleTimeString()}
          </span>
          <span>Unlocked {elapsedLabel}</span>
        </div>

        <h1
          id="winner-pass-heading"
          style={{
            margin: '0.9rem 0 0.25rem',
            fontSize: 'clamp(1.35rem, 1.1rem + 1.4vw, 1.85rem)',
            fontWeight: 900,
          }}
        >
          🎄 Your Saved Gift Pass &amp; E-Invitation
        </h1>
        <p style={{ margin: 0, color: 'var(--ink-on-cream-muted)', fontWeight: 600 }}>
          Guest: <strong>{claim.name}</strong> · Gift: <strong>{settings.giftDescription}</strong>
          {claim.volunteerName ? ` · Host: ${claim.volunteerName}` : ''}
        </p>

        <div className="redemption-code-box">
          <div style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em' }}>
            GIFT REDEMPTION CODE (SAVED ON THIS PHONE)
          </div>
          <div className="redemption-code">{claim.redemptionCode}</div>
          <div style={{ marginBlockStart: '0.5rem' }}>
            {giftClaimed ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '999px',
                  background: '#13251d',
                  color: '#63f2a7',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                }}
              >
                ✓ Physical Gift Handed Over
              </span>
            ) : (
              <button
                type="button"
                className="btn btn--cream-outline btn--sm"
                disabled={markingClaim}
                onClick={handleMarkClaimed}
              >
                {markingClaim ? 'Marking…' : 'Volunteer Tap: Mark Gift Given ✓'}
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            padding: '0.9rem',
            border: '1px solid #dfd3bc',
            marginBlockEnd: '0.9rem',
          }}
        >
          <div
            style={{
              fontSize: '0.76rem',
              fontWeight: 800,
              color: 'var(--accent-crimson)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            You&apos;re Invited · {settings.churchName}
          </div>
          <h2 style={{ margin: '0.2rem 0', fontSize: '1.2rem', fontWeight: 800 }}>
            {settings.eventTitle}
          </h2>
          <p style={{ margin: '0 0 0.45rem', fontSize: '0.9rem', color: 'var(--ink-on-cream-muted)' }}>
            {settings.eventSubtitle}
          </p>
          <p style={{ margin: '0.15rem 0', fontSize: '0.9rem', fontWeight: 700 }}>
            📅 {formatReadableDate(settings.eventDateIso)}
          </p>
          <p style={{ margin: '0.15rem 0', fontSize: '0.9rem', fontWeight: 700 }}>
            📍 {settings.venueName}
            {settings.venueAddress ? ` — ${settings.venueAddress}` : ''}
          </p>
          {settings.mapsUrl && (
            <p style={{ margin: '0.35rem 0 0' }}>
              <a
                href={settings.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => emitAction('maps_click')}
                style={{
                  color: '#0e6942',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                }}
              >
                🗺 Open Venue Directions in Maps →
              </a>
            </p>
          )}
        </div>

        {/* Keep Playing More Games CTA (Saved Session!) */}
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn--gold btn--full"
            onClick={onKeepPlayingSamePlayer}
          >
            🎮 Play More Arcade Games ({claim.totalGamesPlayed || 1} Played)
          </button>

          {ticketDataUrl && (
            <a
              href={ticketDataUrl}
              download={`christmas-invite-${claim.redemptionCode.toLowerCase()}.png`}
              onClick={() => emitAction('ticket_download')}
              className="btn btn--primary btn--full"
            >
              📥 Save My E-Invitation Image
            </a>
          )}

          <a
            href={friendShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => emitAction('invite_share_whatsapp')}
            className="btn btn--whatsapp btn--full"
          >
            💬 Share Invite on WhatsApp
          </a>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => emitAction('calendar_google')}
              className="btn btn--cream-outline btn--sm"
            >
              📅 Google Calendar
            </a>
            <a
              href="/api/calendar.ics"
              download
              onClick={() => emitAction('calendar_ics')}
              className="btn btn--cream-outline btn--sm"
            >
              🍎 Phone Calendar (.ics)
            </a>
          </div>
        </div>
      </div>

      {ticketDataUrl && (
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <img
            src={ticketDataUrl}
            alt={`Personalized Christmas E-Invitation card for ${claim.name} to ${settings.eventTitle}`}
            style={{
              maxInlineSize: '18rem',
              inlineSize: '100%',
              aspectRatio: '1080 / 1350',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          />
          <figcaption
            className="subtle-text"
            style={{ fontSize: '0.82rem', marginBlockStart: '0.35rem' }}
          >
            Your E-Invitation &amp; game session stay saved on this phone anytime you reopen this
            link.
          </figcaption>
        </figure>
      )}

      <div style={{ textAlign: 'center' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onStartFreshFriend}>
          👥 Handing This Phone to a Different Friend? Start New Player
        </button>
      </div>
    </section>
  );
}

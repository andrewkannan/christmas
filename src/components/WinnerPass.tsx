import { useEffect, useMemo, useState } from 'react';
import {
  GAME_LABELS_MAP,
  type EventSettings,
  type GameId,
  type PublicClaimResult,
} from '../types.ts';
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

  const friendShareUrl = useMemo(() => {
    const readableDate = formatReadableDate(settings.eventDateIso);
    const shareText =
      `Play the Christmas Arcade & join me at *${settings.eventTitle}*! 🎄🎁\n` +
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
    <section
      aria-labelledby="winner-pass-heading"
      style={{ maxInlineSize: '27rem', inlineSize: '100%', marginInline: 'auto', display: 'grid', gap: '0.85rem' }}
    >
      {latestReplay && (
        <div className="saved-pass-banner" role="status">
          <strong style={{ fontSize: '0.92rem' }}>
            ★ {latestReplay.score} pts in {GAME_LABELS_MAP[latestReplay.gameId] || latestReplay.gameId}
          </strong>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onKeepPlayingSamePlayer}
          >
            Play More
          </button>
        </div>
      )}

      <div className="wallet-pass">
        <div className="wallet-pass__header" aria-live="off">
          <div style={{ fontWeight: 800, fontSize: '0.84rem', letterSpacing: '0.03em' }}>
            <span className="live-dot" aria-hidden="true" />
            LIVE · {nowDate.toLocaleTimeString()}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', opacity: 0.92 }}>
            {settings.churchName}
          </div>
        </div>

        <div className="wallet-pass__body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink-secondary)', textTransform: 'uppercase' }}>
                Winner Pass
              </div>
              <h1 id="winner-pass-heading" style={{ margin: '0.1rem 0 0', fontSize: '1.45rem', fontWeight: 800 }}>
                {claim.name}
              </h1>
            </div>
            <span className="challenger-tag">🎁 {settings.giftDescription}</span>
          </div>

          <div className="redemption-code-box">
            <div className="redemption-code">{claim.redemptionCode}</div>
            <div style={{ marginBlockStart: '0.45rem' }}>
              {giftClaimed ? (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.28rem 0.75rem',
                    borderRadius: '999px',
                    background: 'var(--accent-emerald-soft)',
                    color: 'var(--accent-emerald)',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                  }}
                >
                  ✓ Gift Claimed
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={markingClaim}
                  onClick={handleMarkClaimed}
                >
                  {markingClaim ? 'Saving…' : 'Staff: Mark Gift Given ✓'}
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              padding: '0.9rem',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.73rem', fontWeight: 800, color: 'var(--accent-crimson)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              E-Invitation
            </div>
            <h2 style={{ margin: '0.15rem 0 0.35rem', fontSize: '1.15rem', fontWeight: 800 }}>
              {settings.eventTitle}
            </h2>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink-primary)' }}>
              📅 {formatReadableDate(settings.eventDateIso)}
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink-secondary)', marginBlockStart: '0.15rem' }}>
              📍 {settings.venueName}
              {settings.venueAddress ? ` · ${settings.venueAddress}` : ''}
            </div>
            {settings.mapsUrl && (
              <div style={{ marginBlockStart: '0.35rem' }}>
                <a
                  href={settings.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => emitAction('maps_click')}
                  style={{ color: 'var(--accent-crimson)', fontWeight: 700, fontSize: '0.84rem', textDecoration: 'none' }}
                >
                  Open in Maps →
                </a>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn--primary btn--full"
            onClick={onKeepPlayingSamePlayer}
          >
            🎮 Play All 5 Games ({claim.totalGamesPlayed || 1} Played)
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {ticketDataUrl && (
              <a
                href={ticketDataUrl}
                download={`christmas-pass-${claim.redemptionCode.toLowerCase()}.png`}
                onClick={() => emitAction('ticket_download')}
                className="btn btn--ghost btn--sm"
              >
                📥 Save Pass
              </a>
            )}
            <a
              href={friendShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => emitAction('invite_share_whatsapp')}
              className="btn btn--whatsapp btn--sm"
            >
              💬 Share Invite
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => emitAction('calendar_google')}
              className="btn btn--ghost btn--sm"
            >
              📅 Google Cal
            </a>
            <a
              href="/api/calendar.ics"
              download
              onClick={() => emitAction('calendar_ics')}
              className="btn btn--ghost btn--sm"
            >
              🍎 Apple Cal
            </a>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onStartFreshFriend}>
          Switch Player
        </button>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  ACTIVE_ARCADE_GAMES,
  type ActiveGameId,
  type EventSettings,
  type GameLeaderboard,
  type PublicClaimResult,
} from '../types.ts';
import { fetchLeaderboards, markGiftClaimedPublic } from '../lib/api.ts';
import { savePassLocally, trackArcadeEvent } from '../lib/playerSession.ts';
import { renderPersonalizedETicketBlob } from '../lib/ticketCanvas.ts';
import { ConfettiBurst } from './ConfettiBurst.tsx';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  CrownIcon,
  DownloadPassIcon,
  GameEmblem,
  GiftBoxIcon,
  MapPinIcon,
  MedalEmblem,
  PlayTriangleIcon,
  StarMarkIcon,
  WhatsAppIcon,
} from './Icons.tsx';

interface WinnerPassProps {
  claim: PublicClaimResult;
  justUnlocked?: boolean;
  settings: EventSettings;
  googleCalendarUrl: string;
  onPassUpdated: (next: PublicClaimResult) => void;
  onSelectGame: (game: ActiveGameId) => void;
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
  justUnlocked = false,
  settings,
  googleCalendarUrl,
  onPassUpdated,
  onSelectGame,
  onKeepPlayingSamePlayer,
  onStartFreshFriend,
}: WinnerPassProps) {
  const [giftClaimed, setGiftClaimed] = useState(claim.giftClaimed);
  const [markingClaim, setMarkingClaim] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passSavedNotice, setPassSavedNotice] = useState(false);
  const [nowDate, setNowDate] = useState(() => new Date());
  const [boards, setBoards] = useState<GameLeaderboard[] | null>(null);
  const [boardsError, setBoardsError] = useState(false);

  useEffect(() => {
    setGiftClaimed(claim.giftClaimed);
  }, [claim.giftClaimed]);

  useEffect(() => {
    const id = setInterval(() => setNowDate(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    fetchLeaderboards(claim.claimToken)
      .then((res) => {
        if (active) setBoards(res.games);
      })
      .catch(() => {
        if (active) setBoardsError(true);
      });
    return () => {
      active = false;
    };
  }, [claim.claimToken]);

  const friendShareUrl = useMemo(() => {
    const readableDate = formatReadableDate(settings.eventDateIso);
    const shareText =
      `Play the Christmas Arcade & join me at *${settings.eventTitle}*!\n` +
      `${readableDate}\n${settings.venueName}\n` +
      `${window.location.origin}`;
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }, [settings]);

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

  const handleSavePass = async () => {
    if (savingPass) return;
    setSavingPass(true);
    emitAction('ticket_download');

    try {
      const blob = await renderPersonalizedETicketBlob({
        guestName: claim.name,
        redemptionCode: claim.redemptionCode,
        settings,
      });
      if (!blob) return;

      const fileName = `christmas-pass-${claim.redemptionCode.toLowerCase()}.png`;
      const isCoarsePointer =
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

      // On mobile browsers (iOS Safari / Android Chrome), use native Share Sheet so guests
      // can tap "Save Image" straight to Photos without navigating to a "data:" URL!
      if (isCoarsePointer && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${settings.eventTitle} · VIP Pass`,
            });
            setPassSavedNotice(true);
            window.setTimeout(() => setPassSavedNotice(false), 2600);
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return;
            }
            // Fall through to Blob object-URL download if share failed for another reason.
          }
        }
      }

      // Clean Blob Object-URL download (never navigates the address bar to "data:")
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      setPassSavedNotice(true);
      window.setTimeout(() => setPassSavedNotice(false), 2600);
    } finally {
      setSavingPass(false);
    }
  };

  const rankedCount = useMemo(() => {
    if (boards) {
      return boards.filter((b) => Boolean(b.me)).length;
    }
    return ACTIVE_ARCADE_GAMES.filter((g) => (claim.bestScores?.[g.id] ?? 0) > 0).length;
  }, [boards, claim.bestScores]);

  return (
    <section
      aria-labelledby="winner-pass-heading"
      className="pass-stage stage-enter"
    >
      {justUnlocked && <ConfettiBurst intensity="high" />}

      <div className="wallet-pass">
        <div className="wallet-pass__header" aria-live="off">
          <div className="wallet-pass__live">
            <span className="live-dot" aria-hidden="true" />
            <span>LIVE · {nowDate.toLocaleTimeString()}</span>
          </div>
          <div className="wallet-pass__org">
            <StarMarkIcon size={14} />
            <span>{settings.churchName}</span>
          </div>
        </div>

        <div className="wallet-pass__top">
          <div className="wallet-pass__eyebrow">Official Winner Pass</div>
          <h1 id="winner-pass-heading" className="wallet-pass__guest">
            {claim.name}
          </h1>

          <div className={`gift-entitlement${giftClaimed ? ' gift-entitlement--claimed' : ''}`}>
            <span className="gift-entitlement__icon">
              <GiftBoxIcon size={18} />
            </span>
            <span className="gift-entitlement__name">{settings.giftDescription}</span>
            <span className="gift-entitlement__badge">
              {giftClaimed ? 'Collected' : 'Ready'}
            </span>
          </div>
        </div>

        <div className="wallet-pass__tear" aria-hidden="true">
          <span className="wallet-pass__notch wallet-pass__notch--left" />
          <span className="wallet-pass__line" />
          <span className="wallet-pass__notch wallet-pass__notch--right" />
        </div>

        <div className="wallet-pass__body">
          <div className="redemption-code-box">
            <div className="redemption-code-box__label">Show Code to Collect Gift</div>
            <div className="redemption-code">{claim.redemptionCode}</div>
            <div className="redemption-code-box__action">
              {giftClaimed ? (
                <span className="claimed-pill">
                  <CheckCircleIcon size={15} />
                  <span>Gift Claimed</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={markingClaim}
                  onClick={handleMarkClaimed}
                >
                  <CheckCircleIcon size={15} />
                  <span>{markingClaim ? 'Saving…' : 'Staff: Mark Gift Given'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="invite-card">
            <div className="invite-card__eyebrow">VIP E-Invitation</div>
            <h2 className="invite-card__title">{settings.eventTitle}</h2>
            {settings.eventSubtitle && (
              <p className="invite-card__subtitle">{settings.eventSubtitle}</p>
            )}

            <div className="invite-card__meta">
              <div className="invite-card__row">
                <CalendarIcon size={15} />
                <span>{formatReadableDate(settings.eventDateIso)}</span>
              </div>
              <div className="invite-card__row">
                <MapPinIcon size={15} />
                <span>
                  {settings.venueName}
                  {settings.venueAddress ? ` · ${settings.venueAddress}` : ''}
                </span>
              </div>
            </div>

            {settings.mapsUrl && (
              <a
                href={settings.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => emitAction('maps_click')}
                className="invite-card__maps"
              >
                <span>Open in Maps</span>
                <ArrowRightIcon size={13} />
              </a>
            )}
          </div>

          <button
            type="button"
            className="btn btn--primary btn--shimmer btn--full"
            onClick={onKeepPlayingSamePlayer}
          >
            <PlayTriangleIcon size={14} />
            <span>
              Play All 5 Games ({Math.max(1, claim.totalGamesPlayed || rankedCount)} Played)
            </span>
          </button>

          <div className="pass-actions-grid">
            <button
              type="button"
              onClick={handleSavePass}
              disabled={savingPass}
              className="btn btn--ghost btn--sm"
            >
              {passSavedNotice ? <CheckCircleIcon size={16} /> : <DownloadPassIcon size={16} />}
              <span>{passSavedNotice ? 'Pass Ready' : 'Save Pass'}</span>
            </button>

            <a
              href={friendShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => emitAction('invite_share_whatsapp')}
              className="btn btn--whatsapp btn--sm"
            >
              <WhatsAppIcon size={16} />
              <span>Share Invite</span>
            </a>

            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => emitAction('calendar_google')}
              className="btn btn--ghost btn--sm"
            >
              <CalendarIcon size={15} />
              <span>Google Cal</span>
            </a>

            <a
              href="/api/calendar.ics"
              download
              onClick={() => emitAction('calendar_ics')}
              className="btn btn--ghost btn--sm"
            >
              <CalendarIcon size={15} />
              <span>Apple Cal</span>
            </a>
          </div>
        </div>
      </div>

      <section className="card-panel my-ranks" aria-labelledby="my-ranks-heading">
        <div className="my-ranks__header">
          <h2 id="my-ranks-heading" className="section-title my-ranks__title">
            <CrownIcon size={18} className="my-ranks__crown" />
            <span>My ranks</span>
          </h2>
          <span className="my-ranks__progress">
            {rankedCount}/{ACTIVE_ARCADE_GAMES.length} Ranked
          </span>
        </div>

        {boardsError && !boards && <p className="top3-empty">Ranks unavailable offline.</p>}
        {!boardsError && !boards && <div className="podium-skeleton" aria-hidden="true" />}

        {boards && (
          <ul role="list" className="my-ranks__list">
            {ACTIVE_ARCADE_GAMES.map((game) => {
              const board = boards.find((b) => b.gameId === game.id);
              const leader = board?.top[0];
              const me = board?.me ?? null;
              const isPodium = me !== null && me.rank <= 3;

              return (
                <li
                  key={game.id}
                  className={`my-ranks__row${me?.rank === 1 ? ' my-ranks__row--first' : ''}`}
                >
                  <div
                    className="my-ranks__emblem"
                    style={{ background: game.accentBg, color: game.accentFg }}
                  >
                    <GameEmblem gameId={game.id} size={24} />
                  </div>

                  <div className="my-ranks__info">
                    <div className="my-ranks__game">{game.title}</div>
                    <div className="my-ranks__sub">
                      {me ? (
                        <span className="my-ranks__me-stat">
                          <strong>#{me.rank}</strong> · {me.score} pts
                          {leader && !leader.isMe ? ` · #1 ${leader.name} (${leader.score})` : ''}
                          {leader?.isMe ? ' · All-Time Leader!' : ''}
                        </span>
                      ) : leader ? (
                        <span>
                          #1 {leader.name} · {leader.score} pts
                        </span>
                      ) : (
                        <span className="my-ranks__open">#1 Spot Open — Claim It!</span>
                      )}
                    </div>
                  </div>

                  <div className="my-ranks__right">
                    {isPodium && (
                      <MedalEmblem rank={me.rank as 1 | 2 | 3} size={26} />
                    )}
                    <button
                      type="button"
                      className={`rank-play-pill${me ? '' : ' rank-play-pill--cta'}`}
                      onClick={() => onSelectGame(game.id)}
                      aria-label={`Play ${game.title}`}
                    >
                      <span>{me ? (me.rank === 1 ? 'Defend' : 'Beat') : 'Play'}</span>
                      <PlayTriangleIcon size={10} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="switch-player-row">
        <button type="button" className="btn btn--subtle btn--sm" onClick={onStartFreshFriend}>
          Switch Player
        </button>
      </div>
    </section>
  );
}

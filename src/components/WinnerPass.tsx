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
import { FullLeaderboardModal } from './FullLeaderboardModal.tsx';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  CrownIcon,
  DownloadPassIcon,
  FlameIcon,
  GameEmblem,
  GiftBoxIcon,
  MapPinIcon,
  PlayTriangleIcon,
  SparkleIcon,
  StarMarkIcon,
  TimerClockIcon,
  TrophyBoardIcon,
  WazeIcon,
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

type RankFilterTab = 'all' | 'podium' | 'climb';

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

function prefersAppleCalendar(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return true;
  return false;
}

function resolveDirectionsUrls(settings: EventSettings): {
  googleMapsHref: string;
  wazeHref: string;
} {
  const query =
    [settings.venueName, settings.venueAddress].filter(Boolean).join(', ') || settings.churchName;
  const rawMaps = (settings.mapsUrl || '').trim();
  const isGenericMaps =
    !rawMaps || /^https?:\/\/(www\.)?maps\.google\.com\/?$/i.test(rawMaps);

  const googleMapsHref = isGenericMaps
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : rawMaps;

  const rawWaze = (settings.wazeUrl || '').trim();
  const wazeHref = rawWaze
    ? rawWaze
    : `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;

  return { googleMapsHref, wazeHref };
}

function computeEventCountdown(
  eventDateIso: string,
  timezoneOffset: string,
  durationMinutes: number,
  nowMs: number
):
  | { state: 'upcoming'; days: number; hours: number; minutes: number; seconds: number }
  | { state: 'live' }
  | { state: 'ended' } {
  const cleanIso = eventDateIso.trim();
  const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleanIso) ? `${cleanIso}:00` : cleanIso;
  const offset = /^[+-]\d{2}:\d{2}$/.test(timezoneOffset.trim())
    ? timezoneOffset.trim()
    : '+08:00';
  const startMs = Date.parse(`${withSec}${offset}`);
  if (!Number.isFinite(startMs)) {
    return { state: 'ended' };
  }

  const endMs = startMs + Math.max(30, durationMinutes || 120) * 60_000;
  if (nowMs >= startMs && nowMs <= endMs) {
    return { state: 'live' };
  }
  if (nowMs > endMs) {
    return { state: 'ended' };
  }

  const totalSec = Math.max(0, Math.floor((startMs - nowMs) / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { state: 'upcoming', days, hours, minutes, seconds };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
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
  const [rankTab, setRankTab] = useState<RankFilterTab>('all');
  const [modalGameId, setModalGameId] = useState<ActiveGameId | null>(null);

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

  const giftTitle = useMemo(() => {
    const raw = (settings.giftDescription || 'Christmas Blessing Gift').trim();
    return raw.replace(/\s+Pack$/i, '');
  }, [settings.giftDescription]);

  const { googleMapsHref, wazeHref } = useMemo(
    () => resolveDirectionsUrls(settings),
    [settings]
  );

  const countdown = useMemo(
    () =>
      computeEventCountdown(
        settings.eventDateIso,
        settings.timezoneOffset,
        settings.durationMinutes,
        nowDate.getTime()
      ),
    [settings.eventDateIso, settings.timezoneOffset, settings.durationMinutes, nowDate]
  );

  const useAppleCalendar = useMemo(() => prefersAppleCalendar(), []);

  // Pick player's flagship game/score for the viral friend challenge share link
  const bestGameSummary = useMemo(() => {
    let topGame = ACTIVE_ARCADE_GAMES[0];
    let topScore = 0;
    let topRank: number | null = null;

    for (const g of ACTIVE_ARCADE_GAMES) {
      const boardMe = boards?.find((b) => b.gameId === g.id)?.me ?? null;
      const score = boardMe?.score ?? claim.bestScores?.[g.id] ?? 0;
      const rank = boardMe?.rank ?? null;

      const isBetterRank =
        rank !== null && (topRank === null || rank < topRank || (rank === topRank && score > topScore));
      const isBetterScore = topRank === null && rank === null && score > topScore;

      if (isBetterRank || isBetterScore) {
        topGame = g;
        topScore = score;
        topRank = rank;
      }
    }

    return { topGame, topScore, topRank };
  }, [boards, claim.bestScores]);

  const friendChallengeShareUrl = useMemo(() => {
    const firstName = claim.name.trim().split(/\s+/)[0] || 'Friend';
    const target = bestGameSummary.topScore >= 5 ? bestGameSummary.topScore : 18;
    const challengeLink = `${window.location.origin}/?friend=${encodeURIComponent(firstName)}&target=${target}`;
    const readableDate = formatReadableDate(settings.eventDateIso);

    const shareText =
      bestGameSummary.topScore > 0
        ? `🎄 Can you beat my *${bestGameSummary.topScore} pts*${
            bestGameSummary.topRank && bestGameSummary.topRank <= 3
              ? ` (Rank #${bestGameSummary.topRank} 🏆)`
              : ''
          } on *${bestGameSummary.topGame.title}*?\n\n` +
          `Play the 45s Christmas Arcade, try to beat my record & unlock your free *${giftTitle}* + VIP Invitation to *${settings.eventTitle}*!\n` +
          `📅 ${readableDate} · ${settings.venueName}\n\n` +
          `🎮 Tap to play & challenge me: ${challengeLink}`
        : `🎄 Come play the Christmas Arcade & beat my challenge!\n\n` +
          `Play any 45s game to win a free *${giftTitle}* + unlock your VIP Invitation to *${settings.eventTitle}*!\n` +
          `📅 ${readableDate} · ${settings.venueName}\n\n` +
          `🎮 Tap to play now: ${challengeLink}`;

    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }, [claim.name, bestGameSummary, giftTitle, settings]);

  const emitAction = (
    eventType:
      | 'ticket_download'
      | 'invite_share_whatsapp'
      | 'calendar_google'
      | 'calendar_ics'
      | 'maps_click'
      | 'waze_click'
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
        settings,
      });
      if (!blob) return;

      const safeSlug =
        claim.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'guest';
      const fileName = `vip-invitation-${safeSlug}.png`;
      const isCoarsePointer =
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

      if (isCoarsePointer && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${settings.eventTitle} · VIP Invitation`,
            });
            setPassSavedNotice(true);
            window.setTimeout(() => setPassSavedNotice(false), 2600);
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return;
            }
          }
        }
      }

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

  const gameRows = useMemo(() => {
    return ACTIVE_ARCADE_GAMES.map((game) => {
      const board = boards?.find((b) => b.gameId === game.id);
      const leader = board?.top[0] ?? null;
      const me = board?.me ?? null;
      const fallbackScore = claim.bestScores?.[game.id] ?? 0;
      return { game, board, leader, me, fallbackScore };
    });
  }, [boards, claim.bestScores]);

  const rankedCount = useMemo(
    () => gameRows.filter((r) => Boolean(r.me) || r.fallbackScore > 0).length,
    [gameRows]
  );

  const podiumCount = useMemo(
    () => gameRows.filter((r) => r.me !== null && r.me.rank <= 3).length,
    [gameRows]
  );

  const crownCount = useMemo(
    () => gameRows.filter((r) => r.me !== null && r.me.rank === 1).length,
    [gameRows]
  );

  const climbCount = useMemo(
    () => gameRows.filter((r) => r.me === null || r.me.rank > 1).length,
    [gameRows]
  );

  // Personalized Replay Motivation Quest
  const replayQuest = useMemo(() => {
    // 1. Closest overtake to #1 on an already-played game
    let closestOvertake: { gameId: ActiveGameId; title: string; diff: number } | null = null;
    for (const r of gameRows) {
      if (r.me && r.me.rank > 1 && r.leader) {
        const diff = Math.max(1, r.leader.score - r.me.score + 1);
        if (!closestOvertake || diff < closestOvertake.diff) {
          closestOvertake = { gameId: r.game.id, title: r.game.title, diff };
        }
      }
    }

    if (closestOvertake && closestOvertake.diff <= 25) {
      return {
        headline: `So close to #1 in ${closestOvertake.title}!`,
        sub: `Score +${closestOvertake.diff} more pts to take the Gold Crown.`,
        cta: `Chase #1`,
        targetGameId: closestOvertake.gameId,
      };
    }

    // 2. Any open #1 cabinet with zero players
    const openFirst = gameRows.find((r) => !r.leader);
    if (openFirst) {
      return {
        headline: `#1 Crown is wide open in ${openFirst.game.title}!`,
        sub: `Play 1 quick round to lock the first #1 trophy.`,
        cta: `Claim #1`,
        targetGameId: openFirst.game.id,
      };
    }

    // 3. Next unplayed cabinet to complete all 5
    const unplayed = gameRows.find((r) => !r.me && r.fallbackScore === 0);
    if (unplayed) {
      return {
        headline: `${rankedCount}/5 Cabinets Ranked — Try ${unplayed.game.title}!`,
        sub: `Complete all 5 games to build your all-time trophy record.`,
        cta: `Play Next`,
        targetGameId: unplayed.game.id,
      };
    }

    // 4. Any remaining non-#1 game
    if (closestOvertake) {
      return {
        headline: `${crownCount}/5 #1 Crowns Held — Conquer ${closestOvertake.title}!`,
        sub: `Beat #1 by +${closestOvertake.diff} pts to add another Gold Crown.`,
        cta: `Beat #1`,
        targetGameId: closestOvertake.gameId,
      };
    }

    // 5. Grand Slam (all 5 #1 crowns!)
    return {
      headline: `5/5 Grand Slam Champion!`,
      sub: `You hold every #1 Crown — push your records even higher!`,
      cta: `Defend`,
      targetGameId: ACTIVE_ARCADE_GAMES[0].id,
    };
  }, [gameRows, rankedCount, crownCount]);

  const visibleGameRows = useMemo(() => {
    if (rankTab === 'podium') {
      return gameRows.filter((r) => r.me !== null && r.me.rank <= 3);
    }
    if (rankTab === 'climb') {
      return gameRows.filter((r) => r.me === null || r.me.rank > 1);
    }
    return gameRows;
  }, [gameRows, rankTab]);

  return (
    <section aria-labelledby="winner-pass-heading" className="pass-stage stage-enter">
      {justUnlocked && <ConfettiBurst intensity="high" />}

      <div className="wallet-pass">
        <div className="wallet-pass__header" aria-live="off">
          <div className="wallet-pass__live">
            <span className="live-dot" aria-hidden="true" />
            <span>VIP PASS · {nowDate.toLocaleTimeString()}</span>
          </div>
          <div className="wallet-pass__org">
            <StarMarkIcon size={14} />
            <span>{settings.churchName}</span>
          </div>
        </div>

        <div className="wallet-pass__top">
          <div className="wallet-pass__eyebrow">Official Winner &amp; VIP Guest</div>
          <h1 id="winner-pass-heading" className="wallet-pass__guest">
            {claim.name}
          </h1>

          <div className={`gift-entitlement${giftClaimed ? ' gift-entitlement--claimed' : ''}`}>
            <span className="gift-entitlement__icon">
              <GiftBoxIcon size={20} />
            </span>
            <div className="gift-entitlement__copy">
              <strong className="gift-entitlement__name">{giftTitle}</strong>
              <span className="gift-entitlement__instruction">
                {giftClaimed
                  ? 'Collected with our team — Merry Christmas!'
                  : 'Show our team to collect with us'}
              </span>
            </div>
            {giftClaimed ? (
              <span className="gift-entitlement__badge">
                <CheckCircleIcon size={12} />
                <span>Collected</span>
              </span>
            ) : (
              <button
                type="button"
                className="gift-team-btn"
                disabled={markingClaim}
                onClick={handleMarkClaimed}
                aria-label="Team member: confirm Christmas Blessing Gift collected"
              >
                {markingClaim ? 'Saving…' : 'Team Confirm'}
              </button>
            )}
          </div>
        </div>

        <div className="wallet-pass__tear" aria-hidden="true">
          <span className="wallet-pass__notch wallet-pass__notch--left" />
          <span className="wallet-pass__line" />
          <span className="wallet-pass__notch wallet-pass__notch--right" />
        </div>

        <div className="wallet-pass__body">
          {/* HERO EYE-PULLING VIP CELEBRATION INVITATION */}
          <div className="vip-invitation-wrap">
            <article className="vip-invitation" aria-label="VIP Celebration Service Invitation">
              <div className="vip-invitation__aura" aria-hidden="true" />
              <div className="vip-invitation__sheen" aria-hidden="true" />

              <div className="vip-invitation__crest-row">
                <span className="vip-invitation__badge">
                  <StarMarkIcon size={12} />
                  <span>VIP Invitation · {settings.churchName}</span>
                </span>
                <span className="vip-invitation__free-tag">Free Entry</span>
              </div>

              <h2 className="vip-invitation__title">{settings.eventTitle}</h2>
              {settings.eventSubtitle && (
                <p className="vip-invitation__subtitle">{settings.eventSubtitle}</p>
              )}

              <div className="vip-invitation__promise">
                <SparkleIcon size={15} />
                <span>
                  Join our <strong>Celebration Service</strong> &amp; receive the{' '}
                  <strong>Greatest Gift</strong> there.
                </span>
              </div>

              <div className="vip-invitation__details">
                <div className="vip-invitation__detail-row">
                  <CalendarIcon size={16} />
                  <span>{formatReadableDate(settings.eventDateIso)}</span>
                </div>
                <div className="vip-invitation__detail-row">
                  <MapPinIcon size={16} />
                  <span>
                    {settings.venueName}
                    {settings.venueAddress ? ` · ${settings.venueAddress}` : ''}
                  </span>
                </div>
              </div>

              <div className="vip-invitation__directions">
                <a
                  href={googleMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => emitAction('maps_click')}
                  className="direction-pill"
                >
                  <MapPinIcon size={15} />
                  <span>Google Maps</span>
                </a>
                <a
                  href={wazeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => emitAction('waze_click')}
                  className="direction-pill direction-pill--waze"
                >
                  <WazeIcon size={16} />
                  <span>Waze</span>
                </a>
              </div>
            </article>

            {/* SMALL LIVE EVENT COUNTDOWN TAB */}
            <div className="invite-countdown-tab" role="timer" aria-live="off">
              <span className="invite-countdown-tab__label">
                <TimerClockIcon size={13} />
                <span>
                  {countdown.state === 'upcoming'
                    ? 'Celebration In'
                    : countdown.state === 'live'
                      ? 'Happening Live Now!'
                      : 'Celebration Service'}
                </span>
              </span>

              {countdown.state === 'upcoming' ? (
                <span className="invite-countdown-tab__clock">
                  {countdown.days > 0 && (
                    <span className="cd-seg">
                      <strong>{countdown.days}</strong>d
                    </span>
                  )}
                  <span className="cd-seg">
                    <strong>{pad2(countdown.hours)}</strong>h
                  </span>
                  <span className="cd-seg">
                    <strong>{pad2(countdown.minutes)}</strong>m
                  </span>
                  <span className="cd-seg">
                    <strong>{pad2(countdown.seconds)}</strong>s
                  </span>
                </span>
              ) : (
                <span className="invite-countdown-tab__clock">
                  {countdown.state === 'live' ? 'Doors Open · Welcome!' : 'We Would Love to Host You'}
                </span>
              )}
            </div>
          </div>

          {/* 1-CLICK CALENDAR (APPLE + ANDROID) & SAVE PASS */}
          <div className="pass-utility-row">
            <a
              href={useAppleCalendar ? '/api/calendar.ics' : googleCalendarUrl}
              target={useAppleCalendar ? undefined : '_blank'}
              rel={useAppleCalendar ? undefined : 'noopener noreferrer'}
              onClick={() => emitAction(useAppleCalendar ? 'calendar_ics' : 'calendar_google')}
              className="btn btn--gold-light btn--sm"
            >
              <CalendarIcon size={16} />
              <span>Add to Calendar</span>
            </a>

            <button
              type="button"
              onClick={handleSavePass}
              disabled={savingPass}
              className="btn btn--ghost btn--sm"
            >
              {passSavedNotice ? <CheckCircleIcon size={16} /> : <DownloadPassIcon size={16} />}
              <span>{passSavedNotice ? 'Invitation Saved' : 'Save Invitation'}</span>
            </button>
          </div>

          {/* GOAL-DRIVEN WHATSAPP FRIEND CHALLENGE */}
          <a
            href={friendChallengeShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => emitAction('invite_share_whatsapp')}
            className="friend-challenge-card"
          >
            <span className="friend-challenge-card__icon">
              <WhatsAppIcon size={20} />
            </span>
            <span className="friend-challenge-card__copy">
              <strong>Challenge Friends to Play</strong>
              <span>
                {bestGameSummary.topScore > 0
                  ? `Share your ${bestGameSummary.topScore} pts record so friends play & unlock their VIP Invite`
                  : 'Send the arcade link on WhatsApp so friends play & win their VIP Invite'}
              </span>
            </span>
            <span className="friend-challenge-card__go">
              <span>Share</span>
              <ArrowRightIcon size={13} />
            </span>
          </a>

          <button
            type="button"
            className="btn btn--primary btn--shimmer btn--full"
            onClick={onKeepPlayingSamePlayer}
          >
            <PlayTriangleIcon size={14} />
            <span>
              Play More Arcade Games ({Math.max(1, claim.totalGamesPlayed || rankedCount)} Played)
            </span>
          </button>
        </div>
      </div>

      {/* GLOWING MY RANKS TROPHY HALL + TABS + REPLAY MOTIVATION */}
      <section className="card-panel my-ranks" aria-labelledby="my-ranks-heading">
        <div className="my-ranks__header">
          <div className="my-ranks__heading-group">
            <h2 id="my-ranks-heading" className="section-title my-ranks__title">
              <CrownIcon size={19} className="my-ranks__crown" />
              <span>My Ranks &amp; Champions</span>
            </h2>
            <p className="my-ranks__tap-hint">Tap any game to see all players &amp; full rankings</p>
          </div>

          <button
            type="button"
            className="my-ranks__all-btn"
            onClick={() => setModalGameId(bestGameSummary.topGame.id)}
          >
            <TrophyBoardIcon size={14} />
            <span>Full Board</span>
          </button>
        </div>

        {/* CROWN QUEST & REPLAY MOTIVATOR BANNER */}
        <div className="crown-quest">
          <div className="crown-quest__pips" aria-hidden="true">
            {gameRows.map(({ game, me, fallbackScore }) => {
              const rank = me?.rank ?? null;
              const played = rank !== null || fallbackScore > 0;
              const pipClass =
                rank === 1
                  ? 'crown-pip crown-pip--gold'
                  : rank !== null && rank <= 3
                    ? 'crown-pip crown-pip--podium'
                    : played
                      ? 'crown-pip crown-pip--played'
                      : 'crown-pip';
              return (
                <span key={game.id} className={pipClass} title={game.title}>
                  {rank === 1 ? <CrownIcon size={12} /> : rank && rank <= 3 ? `#${rank}` : '•'}
                </span>
              );
            })}
          </div>

          <div className="crown-quest__row">
            <div className="crown-quest__copy">
              <strong>
                <FlameIcon size={14} />
                <span>{replayQuest.headline}</span>
              </strong>
              <span>{replayQuest.sub}</span>
            </div>
            <button
              type="button"
              className="crown-quest__btn"
              onClick={() => onSelectGame(replayQuest.targetGameId)}
            >
              <span>{replayQuest.cta}</span>
              <PlayTriangleIcon size={10} />
            </button>
          </div>
        </div>

        {/* SLEEK RANK FILTER TABS */}
        <div className="rank-filter-tabs" role="tablist" aria-label="Filter games by your rank">
          <button
            type="button"
            role="tab"
            aria-selected={rankTab === 'all'}
            className={`rank-filter-tab${rankTab === 'all' ? ' rank-filter-tab--active' : ''}`}
            onClick={() => setRankTab('all')}
          >
            <span>All Games</span>
            <span className="rank-filter-tab__count">5</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={rankTab === 'podium'}
            className={`rank-filter-tab rank-filter-tab--gold${
              rankTab === 'podium' ? ' rank-filter-tab--active' : ''
            }`}
            onClick={() => setRankTab('podium')}
          >
            <CrownIcon size={12} />
            <span>Top 1–3</span>
            <span className="rank-filter-tab__count">{podiumCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={rankTab === 'climb'}
            className={`rank-filter-tab${rankTab === 'climb' ? ' rank-filter-tab--active' : ''}`}
            onClick={() => setRankTab('climb')}
          >
            <span>Chase #1</span>
            <span className="rank-filter-tab__count">{climbCount}</span>
          </button>
        </div>

        {boardsError && !boards && <p className="top3-empty">Ranks unavailable offline.</p>}
        {!boardsError && !boards && <div className="podium-skeleton" aria-hidden="true" />}

        {boards && visibleGameRows.length === 0 && (
          <div className="rank-empty-callout">
            <CrownIcon size={22} />
            {rankTab === 'podium' ? (
              <>
                <strong>Your Podium Showcase Awaits!</strong>
                <span>Finish in the Top 3 on any game to light up glowing Gold, Silver &amp; Bronze cards here.</span>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => onSelectGame(replayQuest.targetGameId)}
                >
                  <PlayTriangleIcon size={12} />
                  <span>Play for Top 3</span>
                </button>
              </>
            ) : (
              <>
                <strong>You Hold Every #1 Crown!</strong>
                <span>All 5 cabinets belong to you — defend your titles anytime.</span>
              </>
            )}
          </div>
        )}

        {boards && visibleGameRows.length > 0 && (
          <ul role="list" className="my-ranks__list">
            {visibleGameRows.map(({ game, board, leader, me }) => {
              const isPodium = me !== null && me.rank <= 3;
              const tierClass = isPodium ? ` my-ranks__row--podium my-ranks__row--rank-${me.rank}` : '';
              const totalPlayers = board?.totalPlayers ?? 0;

              let gapNudge = '';
              if (me && me.rank === 1) {
                gapNudge = 'All-Time #1!';
              } else if (me && leader) {
                const ptsToFirst = Math.max(1, leader.score - me.score + 1);
                gapNudge = `+${ptsToFirst} pts for #1`;
              }

              return (
                <li key={game.id} className={`my-ranks__row${tierClass}`}>
                  <button
                    type="button"
                    className="my-ranks__inspect"
                    onClick={() => setModalGameId(game.id)}
                    aria-label={`View full player rankings for ${game.title}`}
                  >
                    <div
                      className="my-ranks__emblem"
                      style={{ background: game.accentBg, color: game.accentFg }}
                    >
                      <GameEmblem gameId={game.id} size={25} />
                    </div>

                    <div className="my-ranks__info">
                      <div className="my-ranks__game-line">
                        <span className="my-ranks__game">{game.title}</span>
                        {isPodium && (
                          <span className={`podium-tier-tag podium-tier-tag--${me.rank}`}>
                            {me.rank === 1 ? (
                              <>
                                <CrownIcon size={10} />
                                <span>#1 CROWN</span>
                              </>
                            ) : (
                              <>
                                <SparkleIcon size={9} />
                                <span>RANK #{me.rank}</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      <div className="my-ranks__sub">
                        {me ? (
                          <span className="my-ranks__me-stat">
                            <strong>#{me.rank}</strong> · {me.score} pts
                            {gapNudge ? ` · ${gapNudge}` : ''}
                          </span>
                        ) : leader ? (
                          <span>
                            #1 {leader.name} ({leader.score} pts) · Unranked
                          </span>
                        ) : (
                          <span className="my-ranks__open">#1 Spot Open — Claim It!</span>
                        )}
                      </div>

                      <span className="my-ranks__view-link">
                        {totalPlayers > 0
                          ? `See all ${totalPlayers} ${totalPlayers === 1 ? 'player' : 'players'} ›`
                          : 'View rankings ›'}
                      </span>
                    </div>
                  </button>

                  <div className="my-ranks__right">
                    <button
                      type="button"
                      className={`rank-play-pill${
                        me?.rank === 1
                          ? ' rank-play-pill--gold'
                          : me
                            ? ''
                            : ' rank-play-pill--cta'
                      }`}
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

      <FullLeaderboardModal
        open={modalGameId !== null}
        initialGameId={modalGameId ?? ACTIVE_ARCADE_GAMES[0].id}
        claimToken={claim.claimToken}
        summaryBoards={boards}
        onClose={() => setModalGameId(null)}
        onPlayGame={(gameId) => onSelectGame(gameId)}
      />

      <div className="switch-player-row">
        <button type="button" className="btn btn--subtle btn--sm" onClick={onStartFreshFriend}>
          Switch Player
        </button>
      </div>
    </section>
  );
}

import { useId, type CSSProperties, type ReactNode } from 'react';
import {
  DEFAULT_CAMPAIGN_TARGETS,
  GAME_LABELS_MAP,
  type MasterAnalyticsResponse,
} from '../types.ts';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  EyeScanIcon,
  FlameIcon,
  GiftBoxIcon,
  GridGamesIcon,
  NoteEditIcon,
  ReplayIcon,
  ShareViralIcon,
  SlidersIcon,
  TargetGoalIcon,
  UsersCrmIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import { computeTargetMetric, type ContactQuickFilter } from './teamHelpers.ts';

interface MasterAnalyticsProps {
  data: MasterAnalyticsResponse;
  hotLeadsCount: number;
  onRefresh: () => void;
  onJumpToContacts: (filter: ContactQuickFilter, volunteer?: string) => void;
  onOpenSettings: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page / QR Scan View',
  game_start: 'Started Game',
  game_complete: 'Completed Game',
  e_invite_view: 'Opened VIP E-Invitation',
  ticket_download: 'Saved E-Ticket PNG',
  invite_share_whatsapp: 'Shared Friend Challenge on WhatsApp',
  calendar_google: 'Added Google Calendar',
  calendar_ics: 'Saved Phone Calendar (.ics)',
  maps_click: 'Opened Venue Directions (Maps / Waze)',
  team_whatsapp_followup: 'Team Sent WhatsApp Follow-Up',
};

export function MasterAnalytics({
  data,
  hotLeadsCount,
  onRefresh,
  onJumpToContacts,
  onOpenSettings,
}: MasterAnalyticsProps) {
  const uid = useId();
  const { overview, byGame, byVolunteer, recentActivity } = data;
  const targets = data.targets ?? DEFAULT_CAMPAIGN_TARGETS;

  const totalCalendarSaves = overview.googleCalendarAdds + overview.icsCalendarDownloads;
  const totalViralActions =
    overview.invitationsShared + overview.eTicketDownloads + totalCalendarSaves;
  const pendingGifts = Math.max(0, overview.totalLeads - overview.giftsClaimed);
  const pendingWhatsapps = Math.max(
    0,
    overview.totalLeads - overview.teamWhatsappFollowupsSent
  );

  const targetItems: Array<{
    id: string;
    title: string;
    current: number;
    target: number;
    accent: 'crimson' | 'emerald' | 'gold';
    icon: ReactNode;
    subtext: string;
  }> = [
    {
      id: 'page-views',
      title: 'Total QR Scans & Page Views',
      current: overview.totalPageViews,
      target: targets.pageViews,
      accent: 'crimson',
      icon: <EyeScanIcon size={18} />,
      subtext: `${overview.uniqueVisitors.toLocaleString()} unique phones · ${overview.qrScanViews.toLocaleString()} via ?vs= QR`,
    },
    {
      id: 'games-started',
      title: 'Games Started',
      current: overview.totalGamesStarted,
      target: targets.gamesStarted,
      accent: 'gold',
      icon: <GridGamesIcon size={18} />,
      subtext: `${overview.totalGamesPlayed.toLocaleString()} completed · ${overview.avgGamesPerLead} avg / contact`,
    },
    {
      id: 'registered-contacts',
      title: 'Registered Contacts (Name + Phone)',
      current: overview.totalLeads,
      target: targets.leads,
      accent: 'crimson',
      icon: <UsersCrmIcon size={18} />,
      subtext: `${overview.visitorToLeadRatePct}% visitor-to-contact conversion`,
    },
    {
      id: 'physical-gifts',
      title: 'Physical Gifts Handed Out',
      current: overview.giftsClaimed,
      target: targets.giftsHandedOut,
      accent: 'emerald',
      icon: <GiftBoxIcon size={18} />,
      subtext:
        overview.totalLeads > 0
          ? `${Math.round((overview.giftsClaimed / overview.totalLeads) * 100)}% of registered contacts gifted`
          : 'Ready for street gift handoff',
    },
    {
      id: 'games-after',
      title: 'Games Played AFTER Street Interaction',
      current: overview.gamesAfterInteraction,
      target: targets.gamesAfter,
      accent: 'gold',
      icon: <FlameIcon size={18} />,
      subtext: `${overview.uniquePlayersAfterInteraction.toLocaleString()} guests kept playing on their phone`,
    },
    {
      id: 'viral-actions',
      title: 'Shared Invites + Saved Tickets + Calendar Adds',
      current: totalViralActions,
      target: targets.viralActions,
      accent: 'emerald',
      icon: <ShareViralIcon size={18} />,
      subtext: `${overview.invitationsShared} WhatsApp shares · ${overview.eTicketDownloads} tickets · ${totalCalendarSaves} calendar`,
    },
  ];

  const evaluatedTargets = targetItems.map((item) => ({
    ...item,
    metric: computeTargetMetric(item.current, item.target),
  }));

  const metTargetsCount = evaluatedTargets.filter((t) => t.metric.isMet).length;
  const overallPacePct = Math.round(
    evaluatedTargets.reduce((sum, t) => sum + Math.min(100, t.metric.pct), 0) /
      evaluatedTargets.length
  );

  const stageRate = (num: number, den: number) =>
    den > 0 ? `${Math.min(100, Math.round((num / den) * 100))}%` : '—';

  const funnelStages = [
    {
      id: 'f-views',
      label: '1. Total QR Scans & Page Views',
      current: overview.totalPageViews,
      target: targets.pageViews,
      conversionPill: `${overview.uniqueVisitors.toLocaleString()} unique phones`,
      detail: `${overview.returnViewsAfterInteraction.toLocaleString()} saved-session return visits`,
    },
    {
      id: 'f-games',
      label: '2. Games Started',
      current: overview.totalGamesStarted,
      target: targets.gamesStarted,
      conversionPill: `${stageRate(overview.totalGamesStarted, overview.totalPageViews)} of views`,
      detail: `${overview.gamesDuringInteraction.toLocaleString()} on street · ${overview.gamesAfterInteraction.toLocaleString()} after street`,
    },
    {
      id: 'f-leads',
      label: '3. Registered Contacts (Name + Phone)',
      current: overview.totalLeads,
      target: targets.leads,
      conversionPill: `${overview.visitorToLeadRatePct}% of unique phones`,
      detail: `${overview.contactsWithRemarks.toLocaleString()} with pastoral remarks · ${overview.confirmedRsvps.toLocaleString()} confirmed RSVPs`,
    },
    {
      id: 'f-gifts',
      label: '4. Physical Gifts Handed Out',
      current: overview.giftsClaimed,
      target: targets.giftsHandedOut,
      conversionPill: `${stageRate(overview.giftsClaimed, overview.totalLeads)} of contacts`,
      detail: `${overview.teamWhatsappFollowupsSent.toLocaleString()} received personal WhatsApp invite`,
    },
    {
      id: 'f-after',
      label: '5. Games Played AFTER Street Interaction',
      current: overview.gamesAfterInteraction,
      target: targets.gamesAfter,
      conversionPill: `${overview.uniquePlayersAfterInteraction.toLocaleString()} returning players`,
      detail: `${overview.repeatEInviteViews.toLocaleString()} repeat VIP invitation views at home`,
    },
    {
      id: 'f-viral',
      label: '6. Shared Invites + Saved Tickets + Calendar Adds',
      current: totalViralActions,
      target: targets.viralActions,
      conversionPill: `${overview.invitationsShared} shares · ${totalCalendarSaves} calendar`,
      detail: `${overview.eTicketDownloads} E-Ticket PNG saves · ${overview.mapsDirectionsClicks} Waze/Maps clicks`,
    },
  ];

  return (
    <div className="mission-stack">
      {/* 1. Executive Evangelism Scoreboard & Immediate Action Queue */}
      <section className="console-hero" aria-labelledby={`${uid}-pace-heading`}>
        <div className="console-hero__top">
          <div className="console-hero__summary">
            <span className="console-hero__eyebrow">
              <TargetGoalIcon size={14} />
              <span>Campaign Target Pace · Live Auto-Sync</span>
            </span>
            <h2 id={`${uid}-pace-heading`} className="console-hero__title">
              {overallPacePct}% Overall Campaign Completion
            </h2>
            <p className="console-hero__sub">
              <strong>
                {metTargetsCount} of {evaluatedTargets.length}
              </strong>{' '}
              official evangelism targets reached ·{' '}
              <strong>{overview.confirmedRsvps}</strong> confirmed Celebration Service RSVPs ·{' '}
              <strong>{overview.contactsWithRemarks}</strong> contacts with pastoral remarks
            </p>
          </div>

          <div className="console-hero__controls">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenSettings}>
              <SlidersIcon size={15} />
              <span>Adjust Targets</span>
            </button>
            <button type="button" className="btn btn--gold btn--sm" onClick={onRefresh}>
              <ReplayIcon size={15} />
              <span>Sync Now</span>
            </button>
          </div>
        </div>

        <div className="action-queue-grid" role="group" aria-label="Operational follow-up queues">
          <button
            type="button"
            className={`action-queue-card${pendingWhatsapps > 0 ? ' action-queue-card--urgent' : ''}`}
            onClick={() => onJumpToContacts('needs_whatsapp')}
          >
            <span className="action-queue-card__top">
              <WhatsAppIcon size={16} />
              <span>Unsent 1st WhatsApp</span>
            </span>
            <strong className="action-queue-card__num">{pendingWhatsapps}</strong>
            <span className="action-queue-card__cta">
              <span>{pendingWhatsapps > 0 ? 'Follow up now' : 'All contacts texted'}</span>
              <ArrowRightIcon size={13} />
            </span>
          </button>

          <button
            type="button"
            className={`action-queue-card${pendingGifts > 0 ? ' action-queue-card--amber' : ''}`}
            onClick={() => onJumpToContacts('needs_gift')}
          >
            <span className="action-queue-card__top">
              <GiftBoxIcon size={16} />
              <span>Awaiting Street Gift</span>
            </span>
            <strong className="action-queue-card__num">{pendingGifts}</strong>
            <span className="action-queue-card__cta">
              <span>{pendingGifts > 0 ? 'Verify gift handoff' : 'All gifts handed out'}</span>
              <ArrowRightIcon size={13} />
            </span>
          </button>

          <button
            type="button"
            className="action-queue-card action-queue-card--hot"
            onClick={() => onJumpToContacts('hot')}
          >
            <span className="action-queue-card__top">
              <FlameIcon size={16} />
              <span>Hot Post-Street Leads</span>
            </span>
            <strong className="action-queue-card__num">{hotLeadsCount}</strong>
            <span className="action-queue-card__cta">
              <span>Replayed / shared / saved</span>
              <ArrowRightIcon size={13} />
            </span>
          </button>

          <button
            type="button"
            className="action-queue-card action-queue-card--emerald"
            onClick={() => onJumpToContacts('confirmed')}
          >
            <span className="action-queue-card__top">
              <CheckCircleIcon size={16} />
              <span>Confirmed Service RSVPs</span>
            </span>
            <strong className="action-queue-card__num">{overview.confirmedRsvps}</strong>
            <span className="action-queue-card__cta">
              <span>{overview.repliedContacts} warm replies</span>
              <ArrowRightIcon size={13} />
            </span>
          </button>
        </div>
      </section>

      {/* 2. Official 6 Evangelism Campaign Target Scorecards */}
      <section aria-labelledby={`${uid}-targets-heading`}>
        <div className="section-header-row">
          <div>
            <h2 id={`${uid}-targets-heading`} className="section-title">
              Official Evangelism Campaign Targets (6 Goals)
            </h2>
            <p className="subtle-text">
              Live progress against your street outreach, gift blessing, and post-interaction
              benchmarks.
            </p>
          </div>
        </div>

        <div className="target-scorecard-grid">
          {evaluatedTargets.map((item) => {
            const labelId = `${uid}-target-label-${item.id}`;
            const { metric } = item;
            return (
              <article
                key={item.id}
                className={`target-card target-card--${item.accent}${
                  metric.isMet ? ' target-card--met' : ''
                }`}
              >
                <div className="target-card__header">
                  <span className={`target-card__icon target-card__icon--${item.accent}`}>
                    {item.icon}
                  </span>
                  <span
                    className={`target-card__pct-pill${
                      metric.isMet ? ' target-card__pct-pill--met' : ''
                    }`}
                  >
                    {metric.pct}%
                  </span>
                </div>

                <h3 id={labelId} className="target-card__title">
                  {item.title}
                </h3>

                <div className="target-card__numbers">
                  <span className="target-card__current">
                    {metric.current.toLocaleString()}
                  </span>
                  <span className="target-card__denom">
                    / {metric.target.toLocaleString()} target
                  </span>
                </div>

                <progress
                  aria-labelledby={labelId}
                  className={`target-progress target-progress--${
                    metric.isMet ? 'emerald' : item.accent
                  }`}
                  value={metric.clampedValue}
                  max={metric.target}
                />

                <div className="target-card__footer">
                  <span className="target-card__sub">{item.subtext}</span>
                  <span
                    className={`target-card__status${
                      metric.isMet ? ' target-card__status--met' : ''
                    }`}
                  >
                    {metric.statusLabel}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Secondary Supporting Pulse Strip */}
      <div className="pulse-strip" aria-label="Supporting engagement metrics">
        <div className="pulse-chip">
          <span className="pulse-chip__label">Unique Phones</span>
          <strong className="pulse-chip__val">{overview.uniqueVisitors.toLocaleString()}</strong>
        </div>
        <div className="pulse-chip">
          <span className="pulse-chip__label">Saved-Session Returns</span>
          <strong className="pulse-chip__val">
            {overview.returnViewsAfterInteraction.toLocaleString()}
          </strong>
        </div>
        <div className="pulse-chip">
          <span className="pulse-chip__label">VIP Invite Opens</span>
          <strong className="pulse-chip__val">{overview.eInviteViews.toLocaleString()}</strong>
        </div>
        <div className="pulse-chip">
          <span className="pulse-chip__label">Maps &amp; Waze Clicks</span>
          <strong className="pulse-chip__val">
            {overview.mapsDirectionsClicks.toLocaleString()}
          </strong>
        </div>
        <div className="pulse-chip">
          <span className="pulse-chip__label">Team WhatsApps Sent</span>
          <strong className="pulse-chip__val">
            {overview.teamWhatsappFollowupsSent.toLocaleString()}
          </strong>
        </div>
        <div className="pulse-chip">
          <span className="pulse-chip__label">Contacts w/ Remarks</span>
          <strong className="pulse-chip__val">
            {overview.contactsWithRemarks.toLocaleString()}
          </strong>
        </div>
      </div>

      {/* 4. 6-Stage Target vs. Conversion Funnel */}
      <section className="card-panel" aria-labelledby={`${uid}-funnel-heading`}>
        <div className="section-header-row" style={{ marginBlockEnd: '0.9rem' }}>
          <div>
            <h3 id={`${uid}-funnel-heading`} className="section-title">
              Street-to-Celebration Conversion Funnel
            </h3>
            <p className="subtle-text">
              Each stage measured directly against its official target and stage-to-stage
              conversion rate.
            </p>
          </div>
        </div>

        <div className="funnel-list">
          {funnelStages.map((stage) => {
            const metric = computeTargetMetric(stage.current, stage.target);
            const progId = `${uid}-${stage.id}`;
            return (
              <div key={stage.id} className="funnel-row">
                <div className="funnel-row__top">
                  <label htmlFor={progId} className="funnel-row__label">
                    {stage.label}
                  </label>
                  <div className="funnel-row__badges">
                    <span className="funnel-conv-pill">{stage.conversionPill}</span>
                    <strong className="funnel-row__nums">
                      {metric.current.toLocaleString()}{' '}
                      <span>/ {metric.target.toLocaleString()}</span> ({metric.pct}%)
                    </strong>
                  </div>
                </div>
                <progress
                  id={progId}
                  className={`funnel-progress${metric.isMet ? ' funnel-progress--met' : ''}`}
                  value={metric.clampedValue}
                  max={metric.target}
                />
                <div className="funnel-row__detail">{stage.detail}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Mini-Game Engagement & Evangelist Leaderboard */}
      <div className="analytics-tables-grid">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={`${uid}-games-caption`}
          className="table-wrapper"
        >
          <table
            className="leads-table analytics-table"
            style={
              {
                '--col-2': '"Completed"',
                '--col-3': '"On Street"',
                '--col-4': '"After Street"',
                '--col-5': '"High / Avg"',
              } as CSSProperties
            }
          >
            <caption id={`${uid}-games-caption`}>
              Arcade Cabinet Performance (Street vs. Post-Interaction)
            </caption>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Completed</th>
                <th scope="col">Street</th>
                <th scope="col">After</th>
                <th scope="col">High / Avg</th>
              </tr>
            </thead>
            <tbody>
              {byGame.map((g) => (
                <tr key={g.gameId}>
                  <th scope="row">{GAME_LABELS_MAP[g.gameId] || g.gameId}</th>
                  <td>
                    <strong>{g.completions}</strong>{' '}
                    <span className="subtle-text" style={{ fontSize: '0.78rem' }}>
                      ({g.starts} starts)
                    </span>
                  </td>
                  <td>{g.duringInteraction}</td>
                  <td style={{ color: 'var(--accent-gold-bright)', fontWeight: 800 }}>
                    {g.afterInteraction}
                  </td>
                  <td>
                    {g.highScore} / {g.avgScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby={`${uid}-vol-caption`}
          className="table-wrapper"
        >
          <table
            className="leads-table analytics-table"
            style={
              {
                '--col-2': '"QR Scans"',
                '--col-3': '"Contacts"',
                '--col-4': '"Follow-Up & RSVP"',
                '--col-5': '"Remarks"',
              } as CSSProperties
            }
          >
            <caption id={`${uid}-vol-caption`}>
              Evangelist &amp; QR Board Shepherd Performance
            </caption>
            <thead>
              <tr>
                <th scope="col">Evangelist</th>
                <th scope="col">Scans</th>
                <th scope="col">Contacts</th>
                <th scope="col">Follow-Up &amp; RSVP</th>
                <th scope="col">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {byVolunteer.length === 0 ? (
                <tr>
                  <td colSpan={5} className="subtle-text">
                    No volunteer QR scans or assigned contacts yet.
                  </td>
                </tr>
              ) : (
                byVolunteer.map((v) => {
                  const followPct =
                    v.leadsCount > 0
                      ? Math.round((v.whatsappFollowedUp / v.leadsCount) * 100)
                      : 0;
                  return (
                    <tr key={v.volunteerName}>
                      <th scope="row">
                        <button
                          type="button"
                          className="table-link-btn"
                          onClick={() => onJumpToContacts('all', v.volunteerName)}
                        >
                          {v.volunteerName}
                        </button>
                      </th>
                      <td>
                        {v.views}{' '}
                        <span className="subtle-text" style={{ fontSize: '0.76rem' }}>
                          ({v.uniqueVisitors} phones)
                        </span>
                      </td>
                      <td>
                        <strong>{v.leadsCount}</strong>{' '}
                        <span className="subtle-text" style={{ fontSize: '0.76rem' }}>
                          ({v.giftsClaimed} gifted)
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{followPct}% texted</span>
                        {v.confirmedRsvps > 0 && (
                          <span className="rsvp-inline-pill">
                            {v.confirmedRsvps} RSVP
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="remarks-count-chip">
                          <NoteEditIcon size={13} />
                          <span>{v.withRemarks}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Live Outreach & Post-Street Activity Stream */}
      <section className="card-panel" aria-labelledby={`${uid}-stream-heading`}>
        <h3
          id={`${uid}-stream-heading`}
          className="section-title"
          style={{ marginBlockEnd: '0.8rem' }}
        >
          Live Player &amp; Invitation Activity Stream
        </h3>
        {recentActivity.length === 0 ? (
          <p className="subtle-text">
            Real-time scans, arcade rounds, friend shares, and calendar saves stream here
            automatically.
          </p>
        ) : (
          <ul role="list" className="activity-list">
            {recentActivity.slice(0, 20).map((ev) => (
              <li key={ev.id} className="activity-item">
                <div className="activity-item__main">
                  <strong>{EVENT_LABELS[ev.eventType] || ev.eventType}</strong>
                  <span>{ev.guestName ? ` · ${ev.guestName}` : ' · Street Visitor'}</span>
                  {ev.gameId ? (
                    <span>
                      {' '}
                      ({GAME_LABELS_MAP[ev.gameId] || ev.gameId}
                      {ev.eventType === 'game_complete' ? ` · ${ev.score} pts` : ''})
                    </span>
                  ) : null}
                  {ev.volunteerName ? <span> · Evangelist: {ev.volunteerName}</span> : null}
                  {ev.isPostInteraction && (
                    <span className="post-street-pill">After Street</span>
                  )}
                </div>
                <span className="activity-item__time">
                  {new Date(ev.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

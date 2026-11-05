import { useId, type CSSProperties, type ReactNode } from 'react';
import {
  DEFAULT_CAMPAIGN_TARGETS,
  GAME_LABELS_MAP,
  type ActivityLogCategory,
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
import type { ActivityLogModalRequest } from './ActivityLogDialog.tsx';
import {
  computeTargetMetric,
  getEventActionMeta,
  type ContactQuickFilter,
} from './teamHelpers.ts';

interface MasterAnalyticsProps {
  data: MasterAnalyticsResponse;
  hotLeadsCount: number;
  onRefresh: () => void;
  onJumpToContacts: (filter: ContactQuickFilter, volunteer?: string) => void;
  onOpenActivityLog: (req: ActivityLogModalRequest) => void;
  onOpenSettings: () => void;
}

export function MasterAnalytics({
  data,
  hotLeadsCount,
  onRefresh,
  onJumpToContacts,
  onOpenActivityLog,
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
    logSubtitle: string;
    logCategory: ActivityLogCategory;
    current: number;
    target: number;
    accent: 'crimson' | 'emerald' | 'gold';
    icon: ReactNode;
    subtext: string;
  }> = [
    {
      id: 'page-views',
      title: 'Total QR Scans & Page Views',
      logSubtitle: 'Every QR board scan and arcade page open across street & return visits',
      logCategory: 'page_views',
      current: overview.totalPageViews,
      target: targets.pageViews,
      accent: 'crimson',
      icon: <EyeScanIcon size={18} />,
      subtext: `${overview.uniqueVisitors.toLocaleString()} unique phones · ${overview.qrScanViews.toLocaleString()} via ?vs= QR`,
    },
    {
      id: 'games-started',
      title: 'Games Started',
      logSubtitle: 'Every arcade game round started and completed with player & score attribution',
      logCategory: 'games_started',
      current: overview.totalGamesStarted,
      target: targets.gamesStarted,
      accent: 'gold',
      icon: <GridGamesIcon size={18} />,
      subtext: `${overview.totalGamesPlayed.toLocaleString()} completed · ${overview.avgGamesPerLead} avg / contact`,
    },
    {
      id: 'registered-contacts',
      title: 'Registered Contacts (Name + Phone)',
      logSubtitle: 'Chronological log of every guest who registered their Name & WhatsApp number',
      logCategory: 'registered_contacts',
      current: overview.totalLeads,
      target: targets.leads,
      accent: 'crimson',
      icon: <UsersCrmIcon size={18} />,
      subtext: `${overview.visitorToLeadRatePct}% visitor-to-contact conversion`,
    },
    {
      id: 'physical-gifts',
      title: 'Physical Gifts Handed Out',
      logSubtitle: 'Every guest who received their physical Christmas Blessing Gift',
      logCategory: 'physical_gifts',
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
      logSubtitle: 'Guests who kept playing arcade games on their phone after leaving the street booth',
      logCategory: 'games_after',
      current: overview.gamesAfterInteraction,
      target: targets.gamesAfter,
      accent: 'gold',
      icon: <FlameIcon size={18} />,
      subtext: `${overview.uniquePlayersAfterInteraction.toLocaleString()} guests kept playing on their phone`,
    },
    {
      id: 'viral-actions',
      title: 'Shared Invites + Saved Tickets + Calendar Adds',
      logSubtitle: 'Every WhatsApp friend challenge share, E-Ticket PNG download, and Calendar save',
      logCategory: 'viral_actions',
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

  const funnelStages: Array<{
    id: string;
    label: string;
    logTitle: string;
    logCategory: ActivityLogCategory;
    current: number;
    target: number;
    conversionPill: string;
    detail: string;
  }> = [
    {
      id: 'f-views',
      label: '1. Total QR Scans & Page Views',
      logTitle: 'Stage 1 Log — Total QR Scans & Page Views',
      logCategory: 'page_views',
      current: overview.totalPageViews,
      target: targets.pageViews,
      conversionPill: `${overview.uniqueVisitors.toLocaleString()} unique phones`,
      detail: `${overview.returnViewsAfterInteraction.toLocaleString()} saved-session return visits`,
    },
    {
      id: 'f-games',
      label: '2. Games Started',
      logTitle: 'Stage 2 Log — Games Started & Completed',
      logCategory: 'games_started',
      current: overview.totalGamesStarted,
      target: targets.gamesStarted,
      conversionPill: `${stageRate(overview.totalGamesStarted, overview.totalPageViews)} of views`,
      detail: `${overview.gamesDuringInteraction.toLocaleString()} on street · ${overview.gamesAfterInteraction.toLocaleString()} after street`,
    },
    {
      id: 'f-leads',
      label: '3. Registered Contacts (Name + Phone)',
      logTitle: 'Stage 3 Log — Registered Contacts',
      logCategory: 'registered_contacts',
      current: overview.totalLeads,
      target: targets.leads,
      conversionPill: `${overview.visitorToLeadRatePct}% of unique phones`,
      detail: `${overview.contactsWithRemarks.toLocaleString()} with pastoral remarks · ${overview.confirmedRsvps.toLocaleString()} confirmed RSVPs`,
    },
    {
      id: 'f-gifts',
      label: '4. Physical Gifts Handed Out',
      logTitle: 'Stage 4 Log — Physical Gifts Handed Out',
      logCategory: 'physical_gifts',
      current: overview.giftsClaimed,
      target: targets.giftsHandedOut,
      conversionPill: `${stageRate(overview.giftsClaimed, overview.totalLeads)} of contacts`,
      detail: `${overview.teamWhatsappFollowupsSent.toLocaleString()} received personal WhatsApp invite`,
    },
    {
      id: 'f-after',
      label: '5. Games Played AFTER Street Interaction',
      logTitle: 'Stage 5 Log — Games Played AFTER Street Interaction',
      logCategory: 'games_after',
      current: overview.gamesAfterInteraction,
      target: targets.gamesAfter,
      conversionPill: `${overview.uniquePlayersAfterInteraction.toLocaleString()} returning players`,
      detail: `${overview.repeatEInviteViews.toLocaleString()} repeat VIP invitation views at home`,
    },
    {
      id: 'f-viral',
      label: '6. Shared Invites + Saved Tickets + Calendar Adds',
      logTitle: 'Stage 6 Log — Shared Invites + Saved Tickets + Calendar Adds',
      logCategory: 'viral_actions',
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
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() =>
                onOpenActivityLog({
                  title: 'Complete Campaign Click & Activity Log',
                  subtitle:
                    'Every QR scan, game round, registration, gift handoff, Google Maps click, Waze click, share, and calendar save.',
                  category: 'all',
                })
              }
            >
              <EyeScanIcon size={15} />
              <span>Full Click Log</span>
            </button>
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

      {/* 2. Official 6 Evangelism Campaign Target Scorecards (Click any card to view exact audit log) */}
      <section aria-labelledby={`${uid}-targets-heading`}>
        <div className="section-header-row">
          <div>
            <h2 id={`${uid}-targets-heading`} className="section-title">
              Official Evangelism Campaign Targets (6 Goals)
            </h2>
            <p className="subtle-text">
              Click any target card or metric chip below to inspect the exact log of who clicked and
              when.
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
                className={`target-card target-card--interactive target-card--${item.accent}${
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
                  <div className="target-card__footer-right">
                    <span
                      className={`target-card__status${
                        metric.isMet ? ' target-card__status--met' : ''
                      }`}
                    >
                      {metric.statusLabel}
                    </span>
                    <button
                      type="button"
                      className="target-card__log-btn"
                      aria-label={`View log for ${item.title}`}
                      onClick={() =>
                        onOpenActivityLog({
                          title: item.title,
                          subtitle: item.logSubtitle,
                          category: item.logCategory,
                        })
                      }
                    >
                      <span>View Log</span>
                      <ArrowRightIcon size={12} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Secondary Supporting Pulse Strip — Every Metric Opens Its Exact Click Log */}
      <div className="pulse-strip" role="group" aria-label="Supporting engagement metrics">
        <button
          type="button"
          className="pulse-chip pulse-chip--interactive"
          onClick={() =>
            onOpenActivityLog({
              title: 'Unique Phones & QR Scan Log',
              subtitle: 'Every QR scan and visitor session across the campaign',
              category: 'page_views',
            })
          }
        >
          <span className="pulse-chip__label">Unique Phones</span>
          <strong className="pulse-chip__val">{overview.uniqueVisitors.toLocaleString()}</strong>
          <span className="pulse-chip__cta">View log →</span>
        </button>

        <button
          type="button"
          className="pulse-chip pulse-chip--interactive"
          onClick={() =>
            onOpenActivityLog({
              title: 'Saved-Session Return Visits',
              subtitle: 'Guests who reopened their saved pass or arcade link after street outreach',
              category: 'return_views',
            })
          }
        >
          <span className="pulse-chip__label">Saved-Session Returns</span>
          <strong className="pulse-chip__val">
            {overview.returnViewsAfterInteraction.toLocaleString()}
          </strong>
          <span className="pulse-chip__cta">View log →</span>
        </button>

        <button
          type="button"
          className="pulse-chip pulse-chip--interactive"
          onClick={() =>
            onOpenActivityLog({
              title: 'VIP Celebration Invitation Opens',
              subtitle: 'Every guest who opened the VIP Celebration Invitation screen',
              category: 'invite_views',
            })
          }
        >
          <span className="pulse-chip__label">VIP Invite Opens</span>
          <strong className="pulse-chip__val">{overview.eInviteViews.toLocaleString()}</strong>
          <span className="pulse-chip__cta">View log →</span>
        </button>

        <button
          type="button"
          className="pulse-chip pulse-chip--interactive"
          onClick={() =>
            onOpenActivityLog({
              title: 'Google Maps & Waze Venue Clicks',
              subtitle:
                'Exact log of every guest who clicked Google Maps or Waze on their VIP Invitation',
              category: 'directions',
            })
          }
        >
          <span className="pulse-chip__label">Maps &amp; Waze Clicks</span>
          <strong className="pulse-chip__val">
            {overview.mapsDirectionsClicks.toLocaleString()}
          </strong>
          <span className="pulse-chip__cta">
            {overview.googleMapsClicks} Maps · {overview.wazeClicks} Waze →
          </span>
        </button>

        <button
          type="button"
          className="pulse-chip pulse-chip--interactive"
          onClick={() =>
            onOpenActivityLog({
              title: 'Team Personal WhatsApp Follow-Up Log',
              subtitle: 'Every personal WhatsApp invitation sent by evangelists from Command Center',
              category: 'team_whatsapp',
            })
          }
        >
          <span className="pulse-chip__label">Team WhatsApps Sent</span>
          <strong className="pulse-chip__val">
            {overview.teamWhatsappFollowupsSent.toLocaleString()}
          </strong>
          <span className="pulse-chip__cta">View log →</span>
        </button>

        <button
          type="button"
          className="pulse-chip pulse-chip--interactive"
          onClick={() => onJumpToContacts('with_remarks')}
        >
          <span className="pulse-chip__label">Contacts w/ Remarks</span>
          <strong className="pulse-chip__val">
            {overview.contactsWithRemarks.toLocaleString()}
          </strong>
          <span className="pulse-chip__cta">View notes →</span>
        </button>
      </div>

      {/* 4. 6-Stage Target vs. Conversion Funnel */}
      <section className="card-panel" aria-labelledby={`${uid}-funnel-heading`}>
        <div className="section-header-row" style={{ marginBlockEnd: '0.9rem' }}>
          <div>
            <h3 id={`${uid}-funnel-heading`} className="section-title">
              Street-to-Celebration Conversion Funnel
            </h3>
            <p className="subtle-text">
              Each stage measured directly against its official target — click View Log on any stage
              to inspect who completed it.
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
                    <button
                      type="button"
                      className="table-link-btn funnel-log-btn"
                      aria-label={`View log for ${stage.label}`}
                      onClick={() =>
                        onOpenActivityLog({
                          title: stage.logTitle,
                          category: stage.logCategory,
                        })
                      }
                    >
                      View Log →
                    </button>
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
              Arcade Cabinet Performance (tap any game to see who played)
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
              {byGame.map((g) => {
                const gameLabel = GAME_LABELS_MAP[g.gameId] || g.gameId;
                return (
                  <tr key={g.gameId}>
                    <th scope="row">
                      <button
                        type="button"
                        className="table-link-btn"
                        onClick={() =>
                          onOpenActivityLog({
                            title: `${gameLabel} — Player & Round Log`,
                            subtitle:
                              'Every street and post-interaction round played on this arcade cabinet',
                            category: 'games_started',
                            gameId: g.gameId,
                          })
                        }
                      >
                        {gameLabel}
                      </button>
                    </th>
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
                );
              })}
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
                        <div className="vol-cell-actions">
                          <button
                            type="button"
                            className="table-link-btn"
                            onClick={() => onJumpToContacts('all', v.volunteerName)}
                          >
                            {v.volunteerName}
                          </button>
                          <button
                            type="button"
                            className="inline-copy-btn"
                            aria-label={`View click log for evangelist ${v.volunteerName}`}
                            onClick={() =>
                              onOpenActivityLog({
                                title: `${v.volunteerName} — Evangelist QR & Click Log`,
                                subtitle: `Every scan, game round, registration, and VIP invite click from ${v.volunteerName}'s QR board`,
                                category: 'all',
                                volunteer: v.volunteerName,
                              })
                            }
                          >
                            Log
                          </button>
                        </div>
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
        <div className="section-header-row" style={{ marginBlockEnd: '0.8rem' }}>
          <div>
            <h3 id={`${uid}-stream-heading`} className="section-title">
              Live Player &amp; Invitation Activity Stream
            </h3>
            <p className="subtle-text">
              Tap any live event below to inspect that guest’s complete click &amp; gameplay history.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              onOpenActivityLog({
                title: 'Complete Campaign Click & Activity Log',
                subtitle:
                  'Searchable audit log of every guest click (Maps, Waze, Shares, Tickets, Calendar, Games, Scans)',
                category: 'all',
              })
            }
          >
            <EyeScanIcon size={15} />
            <span>View Full Click &amp; Activity Log</span>
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <p className="subtle-text">
            Real-time scans, arcade rounds, Maps/Waze clicks, friend shares, and calendar saves
            stream here automatically.
          </p>
        ) : (
          <ul role="list" className="activity-list">
            {recentActivity.slice(0, 20).map((ev) => {
              const actionMeta = getEventActionMeta(ev.eventType);
              return (
                <li key={ev.id} className="activity-item">
                  <button
                    type="button"
                    className="activity-item__btn"
                    onClick={() => {
                      if (ev.leadId !== null && ev.guestName) {
                        onOpenActivityLog({
                          title: `${ev.guestName} — Complete Click & Activity Log`,
                          subtitle: `${ev.redemptionCode ? `${ev.redemptionCode} · ` : ''}${
                            ev.guestPhone ? `+${ev.guestPhone}` : ''
                          }`,
                          category: 'all',
                          leadId: ev.leadId,
                        });
                      } else {
                        onOpenActivityLog({
                          title: `${actionMeta.shortBadge} — Activity Log`,
                          category:
                            ev.eventType === 'maps_click'
                              ? 'maps_only'
                              : ev.eventType === 'waze_click'
                                ? 'waze_only'
                                : 'all',
                        });
                      }
                    }}
                  >
                    <div className="activity-item__main">
                      <span className={`log-action-badge log-action-badge--${actionMeta.tone}`}>
                        {actionMeta.shortBadge}
                      </span>
                      <strong>
                        {ev.guestName
                          ? ev.guestName
                          : `Street Visitor ${ev.visitorTag || ''}`}
                      </strong>
                      {ev.redemptionCode ? (
                        <span className="subtle-text" style={{ fontSize: '0.78rem' }}>
                          ({ev.redemptionCode})
                        </span>
                      ) : null}
                      {ev.gameId ? (
                        <span>
                          · {GAME_LABELS_MAP[ev.gameId] || ev.gameId}
                          {ev.eventType === 'game_complete' ? ` (${ev.score} pts)` : ''}
                        </span>
                      ) : null}
                      {ev.volunteerName ? (
                        <span className="subtle-text"> · Evangelist: {ev.volunteerName}</span>
                      ) : null}
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
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

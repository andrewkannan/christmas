import { useId, type CSSProperties } from 'react';
import type { MasterAnalyticsResponse } from '../types.ts';

interface MasterAnalyticsProps {
  data: MasterAnalyticsResponse;
  onRefresh: () => void;
}

const GAME_TITLES: Record<string, string> = {
  'gift-rush': '⚡ Gift & Star Rush',
  'tap-duel': '🥊 Sleigh Tap Duel',
  'starlight-drop': '🎯 Starlight Drop & Spark',
};

const EVENT_LABELS: Record<string, string> = {
  page_view: '👁 Page / QR View',
  game_start: '🕹 Started Game',
  game_complete: '🎮 Completed Game',
  e_invite_view: '🎟 Viewed E-Invitation',
  ticket_download: '📥 Saved E-Ticket PNG',
  invite_share_whatsapp: '📤 Shared Invite on WhatsApp',
  calendar_google: '📅 Added Google Calendar',
  calendar_ics: '🍎 Downloaded Phone Calendar (.ics)',
  maps_click: '🗺 Opened Venue Directions',
  team_whatsapp_followup: '💬 Team Sent WhatsApp Follow-Up',
};

export function MasterAnalytics({ data, onRefresh }: MasterAnalyticsProps) {
  const uid = useId();
  const { overview, byGame, byVolunteer, recentActivity } = data;

  const totalCalendarSaves = overview.googleCalendarAdds + overview.icsCalendarDownloads;

  const funnelSteps = [
    {
      id: 'views',
      label: 'Total QR Scans & Page Views',
      count: overview.totalPageViews,
      detail: `${overview.uniqueVisitors} unique phones · ${overview.returnViewsAfterInteraction} return visits`,
    },
    {
      id: 'games-start',
      label: 'Games Started',
      count: overview.totalGamesStarted,
      detail: `${overview.totalGamesPlayed} finished`,
    },
    {
      id: 'leads',
      label: 'Registered Contacts (Name + Phone)',
      count: overview.totalLeads,
      detail: `${overview.visitorToLeadRatePct}% visitor-to-contact conversion`,
    },
    {
      id: 'gifts',
      label: 'Physical Gifts Handed Out',
      count: overview.giftsClaimed,
      detail: `${overview.teamWhatsappFollowupsSent} received team WhatsApp follow-up`,
    },
    {
      id: 'post-games',
      label: 'Games Played AFTER Street Interaction',
      count: overview.gamesAfterInteraction,
      detail: `${overview.uniquePlayersAfterInteraction} guests kept playing on their phone`,
    },
    {
      id: 'viral-actions',
      label: 'Shared Invites + Saved Tickets + Calendar Adds',
      count:
        overview.invitationsShared + overview.eTicketDownloads + totalCalendarSaves,
      detail: `${overview.invitationsShared} WhatsApp shares · ${overview.eTicketDownloads} PNG saves · ${totalCalendarSaves} calendar`,
    },
  ];

  const maxFunnel = Math.max(1, ...funnelSteps.map((s) => s.count));

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 className="section-title">📊 Master Outreach Numbers (Live Auto-Sync)</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRefresh}>
          ↻ Refresh Numbers
        </button>
      </div>

      {/* 1. Complete 12-Metric Executive Grid */}
      <div className="master-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-card__label">👁 Total Page Views</span>
          <span className="kpi-card__num">{overview.totalPageViews}</span>
          <span className="kpi-card__sub">
            {overview.uniqueVisitors} unique phones · {overview.qrScanViews} via ?vs= QR
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">🔄 Return Views (Saved Session)</span>
          <span className="kpi-card__num">{overview.returnViewsAfterInteraction}</span>
          <span className="kpi-card__sub">
            {overview.repeatEInviteViews} repeat E-Invite opens
          </span>
        </div>

        <div className="kpi-card kpi-card--highlight">
          <span className="kpi-card__label">🎮 Total Games Played</span>
          <span className="kpi-card__num">{overview.totalGamesPlayed}</span>
          <span className="kpi-card__sub">
            {overview.totalGamesStarted} started · {overview.avgGamesPerLead} avg / guest
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">⚡ Played During Outreach</span>
          <span className="kpi-card__num">{overview.gamesDuringInteraction}</span>
          <span className="kpi-card__sub">Initial street challenge games</span>
        </div>

        <div className="kpi-card kpi-card--highlight">
          <span className="kpi-card__label">🔥 Played AFTER Outreach</span>
          <span className="kpi-card__num">{overview.gamesAfterInteraction}</span>
          <span className="kpi-card__sub">
            By {overview.uniquePlayersAfterInteraction} returning players
          </span>
        </div>

        <div className="kpi-card kpi-card--highlight">
          <span className="kpi-card__label">📝 Registered Contacts</span>
          <span className="kpi-card__num">{overview.totalLeads}</span>
          <span className="kpi-card__sub">
            {overview.visitorToLeadRatePct}% conversion from visitors
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">🎁 Physical Gifts Claimed</span>
          <span className="kpi-card__num">{overview.giftsClaimed}</span>
          <span className="kpi-card__sub">
            {overview.totalLeads > 0
              ? `${Math.round((overview.giftsClaimed / overview.totalLeads) * 100)}% of registered`
              : 'Ready for street handoff'}
          </span>
        </div>

        <div className="kpi-card kpi-card--highlight">
          <span className="kpi-card__label">📤 Shared Invitations</span>
          <span className="kpi-card__num">{overview.invitationsShared}</span>
          <span className="kpi-card__sub">WhatsApp friend-invite shares</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">📥 E-Tickets Saved (PNG)</span>
          <span className="kpi-card__num">{overview.eTicketDownloads}</span>
          <span className="kpi-card__sub">{overview.eInviteViews} total E-Invite views</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">📅 Calendar Saves</span>
          <span className="kpi-card__num">{totalCalendarSaves}</span>
          <span className="kpi-card__sub">
            {overview.googleCalendarAdds} Google · {overview.icsCalendarDownloads} Phone (.ics)
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">🗺 Venue Map Clicks</span>
          <span className="kpi-card__num">{overview.mapsDirectionsClicks}</span>
          <span className="kpi-card__sub">Directions opened from E-Invite</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">💬 Team WhatsApps Sent</span>
          <span className="kpi-card__num">{overview.teamWhatsappFollowupsSent}</span>
          <span className="kpi-card__sub">
            {Math.max(0, overview.totalLeads - overview.teamWhatsappFollowupsSent)} awaiting
            follow-up
          </span>
        </div>
      </div>

      {/* 2. Full Outreach & Post-Interaction Funnel */}
      <section className="card-panel" aria-labelledby={`${uid}-funnel-heading`}>
        <h3 id={`${uid}-funnel-heading`} className="section-title" style={{ marginBlockEnd: '0.9rem' }}>
          Outreach &amp; Post-Interaction Funnel
        </h3>
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {funnelSteps.map((step) => {
            const progId = `${uid}-prog-${step.id}`;
            return (
              <div key={step.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    marginBlockEnd: '0.25rem',
                    fontSize: '0.92rem',
                  }}
                >
                  <label htmlFor={progId} style={{ fontWeight: 700 }}>
                    {step.label}
                  </label>
                  <strong style={{ color: 'var(--accent-gold-bright)' }}>{step.count}</strong>
                </div>
                <progress
                  id={progId}
                  className="funnel-progress"
                  value={Math.min(step.count, maxFunnel)}
                  max={maxFunnel}
                />
                <div className="subtle-text" style={{ fontSize: '0.8rem', marginBlockStart: '0.15rem' }}>
                  {step.detail}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Breakdown by Mini-Game & Breakdown by Volunteer QR Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
          gap: '1rem',
        }}
      >
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
                '--col-2': '"Played"',
                '--col-3': '"During Outreach"',
                '--col-4': '"After Outreach"',
                '--col-5': '"Best / Avg"',
              } as CSSProperties
            }
          >
            <caption id={`${uid}-games-caption`}>Games Breakdown (During vs. After Outreach)</caption>
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Played</th>
                <th scope="col">During</th>
                <th scope="col">After</th>
                <th scope="col">Best / Avg</th>
              </tr>
            </thead>
            <tbody>
              {byGame.map((g) => (
                <tr key={g.gameId}>
                  <th scope="row">{GAME_TITLES[g.gameId] || g.gameId}</th>
                  <td>
                    <strong>{g.completions}</strong>{' '}
                    <span className="subtle-text" style={{ fontSize: '0.8rem' }}>
                      ({g.starts} starts)
                    </span>
                  </td>
                  <td>{g.duringInteraction}</td>
                  <td style={{ color: 'var(--accent-gold-bright)', fontWeight: 700 }}>
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
                '--col-2': '"Views"',
                '--col-3': '"Games"',
                '--col-4': '"Contacts"',
                '--col-5': '"Shares"',
              } as CSSProperties
            }
          >
            <caption id={`${uid}-vol-caption`}>Volunteer / QR Board Performance</caption>
            <thead>
              <tr>
                <th scope="col">Volunteer QR</th>
                <th scope="col">Views</th>
                <th scope="col">Games (After)</th>
                <th scope="col">Contacts</th>
                <th scope="col">Shares</th>
              </tr>
            </thead>
            <tbody>
              {byVolunteer.length === 0 ? (
                <tr>
                  <td colSpan={5} className="subtle-text">
                    No QR board scans recorded yet.
                  </td>
                </tr>
              ) : (
                byVolunteer.map((v) => (
                  <tr key={v.volunteerName}>
                    <th scope="row">{v.volunteerName}</th>
                    <td>
                      {v.views}{' '}
                      <span className="subtle-text" style={{ fontSize: '0.78rem' }}>
                        ({v.uniqueVisitors} phones)
                      </span>
                    </td>
                    <td>
                      {v.gamesPlayed}{' '}
                      <span style={{ color: 'var(--accent-gold-bright)', fontWeight: 700 }}>
                        ({v.gamesAfterInteraction} after)
                      </span>
                    </td>
                    <td>
                      <strong>{v.leadsCount}</strong> ({v.giftsClaimed}🎁 · {v.whatsappFollowedUp}💬)
                    </td>
                    <td>{v.sharedInvites}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Live Activity Stream */}
      <section className="card-panel" aria-labelledby={`${uid}-stream-heading`}>
        <h3 id={`${uid}-stream-heading`} className="section-title" style={{ marginBlockEnd: '0.8rem' }}>
          ⚡ Live Player &amp; Invite Activity Stream
        </h3>
        {recentActivity.length === 0 ? (
          <p className="subtle-text">
            Activity will stream here live as people scan QR boards, play games, and share their
            invitations.
          </p>
        ) : (
          <ul role="list" className="activity-list">
            {recentActivity.slice(0, 20).map((ev) => (
              <li key={ev.id} className="activity-item">
                <div>
                  <strong>{EVENT_LABELS[ev.eventType] || ev.eventType}</strong>
                  {ev.guestName ? ` · ${ev.guestName}` : ' · Visitor'}
                  {ev.gameId ? ` (${GAME_TITLES[ev.gameId] || ev.gameId}` : ''}
                  {ev.gameId && ev.eventType === 'game_complete' ? ` · ${ev.score} pts)` : ev.gameId ? ')' : ''}
                  {ev.volunteerName ? ` · QR: ${ev.volunteerName}` : ''}
                  {ev.isPostInteraction && (
                    <span
                      style={{
                        marginInlineStart: '0.45rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '999px',
                        background: 'rgba(245, 185, 66, 0.2)',
                        color: 'var(--accent-gold-bright)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                      }}
                    >
                      After Outreach
                    </span>
                  )}
                </div>
                <span className="subtle-text" style={{ fontSize: '0.78rem' }}>
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

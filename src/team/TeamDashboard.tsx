import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  GAME_LABELS_MAP,
  type EventSettings,
  type MasterAnalyticsResponse,
  type TeamDashboardStats,
  type TeamLeadRecord,
} from '../types.ts';
import {
  fetchMasterAnalytics,
  fetchTeamLeads,
  logoutTeam,
  patchTeamLead,
} from '../lib/api.ts';
import { MasterAnalytics } from './MasterAnalytics.tsx';
import { QrBoardMaker } from './QrBoardMaker.tsx';
import { EventSettingsForm } from './EventSettingsForm.tsx';

interface TeamDashboardProps {
  settings: EventSettings;
  onSettingsUpdated: (next: EventSettings) => void;
  onLoggedOut: () => void;
}

export function TeamDashboard({
  settings,
  onSettingsUpdated,
  onLoggedOut,
}: TeamDashboardProps) {
  const uid = useId();
  const [activeTab, setActiveTab] = useState<'master' | 'leads' | 'qr' | 'settings'>('master');
  const [masterData, setMasterData] = useState<MasterAnalyticsResponse | null>(null);
  const [leads, setLeads] = useState<TeamLeadRecord[]>([]);
  const [stats, setStats] = useState<TeamDashboardStats>({
    totalLeads: 0,
    giftsClaimed: 0,
    whatsappSentCount: 0,
    byVolunteer: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [volunteerFilter, setVolunteerFilter] = useState('ALL');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [leadsRes, masterRes] = await Promise.all([
        fetchTeamLeads(),
        fetchMasterAnalytics(),
      ]);
      setLeads(leadsRes.leads);
      setStats(leadsRes.stats);
      setMasterData(masterRes);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load dashboard data.';
      if (msg.includes('PIN') || msg.includes('401')) {
        onLoggedOut();
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [onLoggedOut]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => {
      if (activeTab === 'master' || activeTab === 'leads') {
        void loadData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, loadData]);

  const volunteerOptions = useMemo(
    () => Object.keys(stats.byVolunteer).sort(),
    [stats.byVolunteer]
  );

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (volunteerFilter !== 'ALL' && (lead.volunteerName || 'Unassigned') !== volunteerFilter) {
        return false;
      }
      if (pendingOnly && lead.whatsappSent) {
        return false;
      }
      if (
        q &&
        !lead.name.toLowerCase().includes(q) &&
        !lead.normalizedPhone.includes(q) &&
        !lead.redemptionCode.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [leads, volunteerFilter, pendingOnly, searchQuery]);

  const handleToggleLead = async (
    lead: TeamLeadRecord,
    patch: { giftClaimed?: boolean; whatsappSent?: boolean }
  ) => {
    setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, ...patch } : item)));
    try {
      const res = await patchTeamLead(lead.id, patch);
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? res.lead : item)));
      void fetchMasterAnalytics()
        .then((m) => setMasterData(m))
        .catch(() => {});
    } catch {
      void loadData();
    }
  };

  return (
    <section aria-labelledby={`${uid}-dash-title`}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBlockEnd: '1rem',
        }}
      >
        <div>
          <span className="challenger-tag">Master Outreach Console</span>
          <h1
            id={`${uid}-dash-title`}
            className="hero-title"
            style={{ marginBlockStart: '0.25rem' }}
          >
            {settings.churchName} Command Center
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="/api/team/leads/export.csv" className="btn btn--ghost btn--sm">
            ⬇ Export Full CSV
          </a>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={async () => {
              await logoutTeam();
              onLoggedOut();
            }}
          >
            Lock Console
          </button>
        </div>
      </div>

      {/* Console Views */}
      <div className="tab-bar" role="group" aria-label="Dashboard sections">
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'master' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'master'}
          onClick={() => setActiveTab('master')}
        >
          📊 Master Dashboard
        </button>
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'leads' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'leads'}
          onClick={() => setActiveTab('leads')}
        >
          📋 Live Contacts ({stats.totalLeads})
        </button>
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'qr' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'qr'}
          onClick={() => setActiveTab('qr')}
        >
          🪧 QR Board Maker
        </button>
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'settings' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        >
          ✨ Event &amp; WhatsApp Settings
        </button>
      </div>

      {activeTab === 'master' && (
        loading && !masterData ? (
          <div className="card-panel">Loading master analytics…</div>
        ) : error && !masterData ? (
          <div className="card-panel" role="alert">
            <p style={{ margin: '0 0 0.75rem', color: 'var(--danger-ink)' }}>⚠ {error}</p>
            <button type="button" className="btn btn--gold btn--sm" onClick={() => void loadData()}>
              Retry
            </button>
          </div>
        ) : masterData ? (
          <MasterAnalytics data={masterData} onRefresh={() => void loadData()} />
        ) : null
      )}

      {activeTab === 'qr' && <QrBoardMaker settings={settings} />}

      {activeTab === 'settings' && (
        <EventSettingsForm initialSettings={settings} onSaved={onSettingsUpdated} />
      )}

      {activeTab === 'leads' && (
        <div>
          <div
            className="card-panel"
            style={{
              marginBlockEnd: '1rem',
              padding: '0.9rem 1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <div>
              <label htmlFor={`${uid}-search`} className="form-label">
                Search Guest or Code
              </label>
              <input
                id={`${uid}-search`}
                type="search"
                className="form-input"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Name, phone, or XMAS-..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor={`${uid}-vol-filter`} className="form-label">
                Filter by Volunteer QR
              </label>
              <select
                id={`${uid}-vol-filter`}
                className="form-select"
                value={volunteerFilter}
                onChange={(e) => setVolunteerFilter(e.target.value)}
              >
                <option value="ALL">All Volunteers ({stats.totalLeads})</option>
                {volunteerOptions.map((vol) => (
                  <option key={vol} value={vol}>
                    {vol} ({stats.byVolunteer[vol]})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn--sm ${pendingOnly ? 'btn--gold' : 'btn--ghost'}`}
                aria-pressed={pendingOnly}
                onClick={() => setPendingOnly((p) => !p)}
              >
                {pendingOnly ? '✓ Showing Unsent Only' : 'Unsent WhatsApp Only'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => void loadData()}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="card-panel">Loading live outreach contacts…</div>
          ) : error ? (
            <div className="card-panel" role="alert">
              <p style={{ margin: '0 0 0.75rem', color: 'var(--danger-ink)' }}>⚠ {error}</p>
              <button
                type="button"
                className="btn btn--gold btn--sm"
                onClick={() => void loadData()}
              >
                Retry
              </button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div
              className="card-panel"
              role="status"
              style={{ textAlign: 'center', paddingBlock: '2.5rem' }}
            >
              <div style={{ fontSize: '2.4rem' }} aria-hidden="true">
                🎄
              </div>
              <h2 className="section-title" style={{ marginBlock: '0.4rem 0.3rem' }}>
                {leads.length === 0
                  ? 'Ready for Your First Street Player!'
                  : 'No Matching Contacts'}
              </h2>
              <p className="subtle-text" style={{ marginBlockEnd: '1rem' }}>
                {leads.length === 0
                  ? 'Generate your custom volunteer QR board in the QR Board Maker tab and invite someone to play!'
                  : 'Try clearing your volunteer or search filter.'}
              </p>
              {leads.length === 0 && (
                <button
                  type="button"
                  className="btn btn--gold btn--sm"
                  onClick={() => setActiveTab('qr')}
                >
                  Open QR Board Maker →
                </button>
              )}
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="leads-table-caption"
              className="table-wrapper"
            >
              <table className="leads-table">
                <caption id="leads-table-caption">
                  Live outreach players ({filteredLeads.length} shown · auto-refreshes every 5s)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Guest &amp; Pass</th>
                    <th scope="col">WhatsApp Number</th>
                    <th scope="col">Challenger</th>
                    <th scope="col">Games &amp; Engagement</th>
                    <th scope="col">Status</th>
                    <th scope="col">1-Tap Follow-Up</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <th scope="row">
                        <div>{lead.name}</div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            color: 'var(--accent-gold-bright)',
                          }}
                        >
                          {lead.redemptionCode} ·{' '}
                          {new Date(lead.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </th>
                      <td data-col="phone">+{lead.normalizedPhone}</td>
                      <td data-col="volunteer">{lead.volunteerName || 'General'}</td>
                      <td data-col="game">
                        <div>
                          {GAME_LABELS_MAP[lead.gamePlayed] || lead.gamePlayed} ({lead.score} pts)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold-bright)' }}>
                          🎮 {lead.totalGamesPlayed} played ({lead.gamesAfterInteraction} after) ·
                          📤 {lead.inviteShares} shares · 📅{' '}
                          {lead.calendarAdds + lead.ticketDownloads} saved
                        </div>
                      </td>
                      <td data-col="status">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className={`btn btn--sm ${lead.giftClaimed ? 'btn--gold' : 'btn--ghost'}`}
                            aria-pressed={lead.giftClaimed}
                            aria-label={`Gift Given for ${lead.name}`}
                            onClick={() =>
                              void handleToggleLead(lead, { giftClaimed: !lead.giftClaimed })
                            }
                          >
                            {lead.giftClaimed ? '✓ Gift Given' : 'Mark Gifted'}
                          </button>
                          <button
                            type="button"
                            className={`btn btn--sm ${lead.whatsappSent ? 'btn--gold' : 'btn--ghost'}`}
                            aria-pressed={lead.whatsappSent}
                            aria-label={`WhatsApp Sent for ${lead.name}`}
                            onClick={() =>
                              void handleToggleLead(lead, { whatsappSent: !lead.whatsappSent })
                            }
                          >
                            {lead.whatsappSent ? '✓ Texted' : 'Mark Texted'}
                          </button>
                        </div>
                      </td>
                      <td data-col="actions">
                        <a
                          href={lead.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Send WhatsApp Invite to ${lead.name}`}
                          className="btn btn--whatsapp btn--sm"
                          onClick={() => {
                            if (!lead.whatsappSent) {
                              void handleToggleLead(lead, { whatsappSent: true });
                            }
                          }}
                        >
                          💬 Send WhatsApp Invite
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

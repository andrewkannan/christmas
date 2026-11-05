import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  GAME_LABELS_MAP,
  type EventSettings,
  type LeadPatchInput,
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
import {
  BellReminderIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadPassIcon,
  EyeScanIcon,
  FlameIcon,
  GiftBoxIcon,
  LockIcon,
  NoteEditIcon,
  QrBoardIcon,
  ReplayIcon,
  SlidersIcon,
  TargetGoalIcon,
  UsersCrmIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import { MasterAnalytics } from './MasterAnalytics.tsx';
import { QrBoardMaker } from './QrBoardMaker.tsx';
import { EventSettingsForm } from './EventSettingsForm.tsx';
import { ContactCrmDialog } from './ContactCrmDialog.tsx';
import {
  ActivityLogDialog,
  type ActivityLogModalRequest,
} from './ActivityLogDialog.tsx';
import {
  formatShortTimestamp,
  getFollowUpStageMeta,
  getLeadEngagementScore,
  getLeadEngagementTier,
  type ContactQuickFilter,
  type ContactSortBy,
} from './teamHelpers.ts';

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
    withRemarksCount: 0,
    confirmedRsvpCount: 0,
    repliedCount: 0,
    hotLeadsCount: 0,
    byVolunteer: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const [quickFilter, setQuickFilter] = useState<ContactQuickFilter>('all');
  const [volunteerFilter, setVolunteerFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<ContactSortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [focusNotesOnOpen, setFocusNotesOnOpen] = useState(false);
  const [activityLogRequest, setActivityLogRequest] =
    useState<ActivityLogModalRequest | null>(null);
  const [copiedLeadPhoneId, setCopiedLeadPhoneId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [leadsRes, masterRes] = await Promise.all([
        fetchTeamLeads(),
        fetchMasterAnalytics(),
      ]);
      setLeads(leadsRes.leads);
      setStats(leadsRes.stats);
      setMasterData(masterRes);
      setLastSyncedAt(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
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
    if (!autoSync) return;
    const interval = setInterval(() => {
      if (activeTab === 'master' || activeTab === 'leads') {
        void loadData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, autoSync, loadData]);

  const volunteerOptions = useMemo(
    () => Object.keys(stats.byVolunteer).sort(),
    [stats.byVolunteer]
  );

  const volunteerSuggestions = useMemo(
    () => volunteerOptions.filter((v) => v !== 'Unassigned'),
    [volunteerOptions]
  );

  const selectedLead = useMemo(
    () => (selectedLeadId !== null ? leads.find((l) => l.id === selectedLeadId) ?? null : null),
    [leads, selectedLeadId]
  );

  const pendingWhatsappCount = useMemo(
    () => leads.filter((l) => !l.whatsappSent && l.followUpStatus === 'new').length,
    [leads]
  );
  const pendingGiftCount = useMemo(
    () => leads.filter((l) => !l.giftClaimed).length,
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      if (volunteerFilter !== 'ALL' && (lead.volunteerName || 'Unassigned') !== volunteerFilter) {
        return false;
      }
      if (quickFilter === 'needs_gift' && lead.giftClaimed) return false;
      if (quickFilter === 'needs_whatsapp' && (lead.whatsappSent || lead.followUpStatus !== 'new')) {
        return false;
      }
      if (quickFilter === 'hot' && getLeadEngagementTier(lead) !== 'hot') return false;
      if (quickFilter === 'with_remarks' && !lead.notes.trim()) return false;
      if (quickFilter === 'confirmed' && lead.followUpStatus !== 'confirmed') return false;

      if (
        q &&
        !lead.name.toLowerCase().includes(q) &&
        !lead.normalizedPhone.includes(q) &&
        !lead.rawPhone.toLowerCase().includes(q) &&
        !lead.redemptionCode.toLowerCase().includes(q) &&
        !lead.volunteerName.toLowerCase().includes(q) &&
        !lead.notes.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === 'hot_first') {
      return [...filtered].sort((a, b) => getLeadEngagementScore(b) - getLeadEngagementScore(a));
    }
    if (sortBy === 'recent_activity') {
      return [...filtered].sort((a, b) =>
        (b.lastActiveAt || b.createdAt).localeCompare(a.lastActiveAt || a.createdAt)
      );
    }
    if (sortBy === 'highest_score') {
      return [...filtered].sort((a, b) => b.score - a.score);
    }
    return filtered;
  }, [leads, volunteerFilter, quickFilter, searchQuery, sortBy]);

  const handlePatchLead = useCallback(
    async (leadId: number, patch: LeadPatchInput): Promise<TeamLeadRecord | null> => {
      setLeads((prev) =>
        prev.map((item) => (item.id === leadId ? { ...item, ...patch } : item))
      );
      try {
        const res = await patchTeamLead(leadId, patch);
        setLeads((prev) => prev.map((item) => (item.id === leadId ? res.lead : item)));
        void Promise.all([fetchTeamLeads(), fetchMasterAnalytics()])
          .then(([leadsRes, masterRes]) => {
            setLeads(leadsRes.leads);
            setStats(leadsRes.stats);
            setMasterData(masterRes);
          })
          .catch(() => {});
        return res.lead;
      } catch (err) {
        void loadData();
        throw err;
      }
    },
    [loadData]
  );

  const handleJumpToContacts = useCallback(
    (filter: ContactQuickFilter, volunteer?: string) => {
      setQuickFilter(filter);
      setVolunteerFilter(volunteer ?? 'ALL');
      setActiveTab('leads');
    },
    []
  );

  const openLeadCrm = (leadId: number, focusNotes = false) => {
    setFocusNotesOnOpen(focusNotes);
    setSelectedLeadId(leadId);
  };

  const handleCopyPhoneInline = async (lead: TeamLeadRecord) => {
    try {
      await navigator.clipboard.writeText(`+${lead.normalizedPhone}`);
      setCopiedLeadPhoneId(lead.id);
      setTimeout(() => {
        setCopiedLeadPhoneId((curr) => (curr === lead.id ? null : curr));
      }, 1800);
    } catch {
      // Clipboard ignored if restricted
    }
  };

  const filterPills: Array<{ id: ContactQuickFilter; label: string; count: number }> = [
    { id: 'all', label: 'All Contacts', count: leads.length },
    { id: 'needs_whatsapp', label: 'Needs WhatsApp', count: pendingWhatsappCount },
    { id: 'needs_gift', label: 'Needs Gift', count: pendingGiftCount },
    { id: 'hot', label: 'Hot Intent', count: stats.hotLeadsCount },
    { id: 'with_remarks', label: 'Has Remarks', count: stats.withRemarksCount },
    { id: 'confirmed', label: 'Confirmed RSVP', count: stats.confirmedRsvpCount },
  ];

  const storageInfo = masterData?.storage;

  return (
    <section aria-labelledby={`${uid}-dash-title`} className="team-console">
      {/* Top Executive Console Header */}
      <header className="team-console__header">
        <div className="team-console__brand">
          <div className="team-console__eyebrow-row">
            <span className="challenger-tag">Evangelism &amp; Pastoral CRM</span>
            <span className="sync-status-pill" aria-live="off">
              <span className={`live-dot${autoSync ? '' : ' live-dot--paused'}`} />
              <span>
                {autoSync
                  ? lastSyncedAt
                    ? `Live · ${lastSyncedAt}`
                    : 'Live Sync'
                  : 'Sync Paused'}
              </span>
            </span>
            {storageInfo && (
              <span
                className={`storage-status-pill ${
                  storageInfo.engine === 'postgres' && storageInfo.persistent
                    ? 'storage-status-pill--postgres'
                    : storageInfo.persistent
                      ? 'storage-status-pill--local'
                      : 'storage-status-pill--ephemeral'
                }`}
              >
                {storageInfo.persistent ? (
                  <CheckCircleIcon size={13} />
                ) : (
                  <svg
                    width={13}
                    height={13}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3 2.5 20h19L12 3Z" />
                    <path d="M12 9v4.5" />
                    <circle cx="12" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
                  </svg>
                )}
                <span>
                  {storageInfo.engine === 'postgres'
                    ? storageInfo.persistent
                      ? 'PostgreSQL Persistent'
                      : 'PostgreSQL Sync Issue'
                    : storageInfo.persistent
                      ? 'Local SQLite'
                      : 'Ephemeral SQLite (Unlinked)'}
                </span>
              </span>
            )}
          </div>
          <h1 id={`${uid}-dash-title`} className="hero-title team-console__title">
            {settings.churchName} Command Center
          </h1>
        </div>

        <div className="team-console__actions">
          <button
            type="button"
            className="btn btn--subtle btn--sm"
            aria-pressed={autoSync}
            onClick={() => setAutoSync((s) => !s)}
          >
            {autoSync ? 'Pause Auto-Sync' : 'Resume Auto-Sync'}
          </button>
          <a href="/api/team/leads/export.csv" className="btn btn--ghost btn--sm">
            <DownloadPassIcon size={15} />
            <span>Export CSV</span>
          </a>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={async () => {
              await logoutTeam();
              onLoggedOut();
            }}
          >
            <LockIcon size={15} />
            <span>Lock Console</span>
          </button>
        </div>
      </header>

      {storageInfo?.warning && (
        <div role="alert" className="storage-warning-banner">
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="storage-warning-banner__icon"
          >
            <path d="M12 3 2.5 20h19L12 3Z" />
            <path d="M12 9v4.5" />
            <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
          </svg>
          <div className="storage-warning-banner__body">
            <strong>Database Persistence Warning:</strong> {storageInfo.warning}
          </div>
        </div>
      )}

      {/* Primary Segmented Navigation */}
      <div className="tab-bar" role="group" aria-label="Dashboard sections">
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'master' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'master'}
          onClick={() => setActiveTab('master')}
        >
          <TargetGoalIcon size={16} />
          <span>Mission Control</span>
        </button>
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'leads' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'leads'}
          onClick={() => setActiveTab('leads')}
        >
          <UsersCrmIcon size={16} />
          <span>Live Contacts ({stats.totalLeads})</span>
        </button>
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'qr' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'qr'}
          onClick={() => setActiveTab('qr')}
        >
          <QrBoardIcon size={16} />
          <span>QR Board Maker</span>
        </button>
        <button
          type="button"
          className={`btn btn--sm ${activeTab === 'settings' ? 'btn--gold' : 'btn--ghost'}`}
          aria-pressed={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        >
          <SlidersIcon size={16} />
          <span>Targets &amp; Settings</span>
        </button>
      </div>

      {/* View 1: Mission Control */}
      {activeTab === 'master' &&
        (loading && !masterData ? (
          <div className="card-panel">Loading evangelism mission control…</div>
        ) : error && !masterData ? (
          <div className="card-panel" role="alert">
            <p style={{ margin: '0 0 0.75rem', color: 'var(--danger-ink)' }}>{error}</p>
            <button type="button" className="btn btn--gold btn--sm" onClick={() => void loadData()}>
              Retry
            </button>
          </div>
        ) : masterData ? (
          <MasterAnalytics
            data={masterData}
            hotLeadsCount={stats.hotLeadsCount}
            onRefresh={() => void loadData()}
            onJumpToContacts={handleJumpToContacts}
            onOpenActivityLog={setActivityLogRequest}
            onOpenSettings={() => setActiveTab('settings')}
          />
        ) : null)}

      {/* View 2: QR Board Maker */}
      {activeTab === 'qr' && <QrBoardMaker settings={settings} />}

      {/* View 3: Targets & Event Settings */}
      {activeTab === 'settings' && (
        <EventSettingsForm
          initialSettings={settings}
          onSaved={(next) => {
            onSettingsUpdated(next);
            void loadData();
          }}
        />
      )}

      {/* View 4: Live Contacts Pastoral CRM */}
      {activeTab === 'leads' && (
        <div className="crm-leads-stack">
          <div className="card-panel crm-toolbar">
            {/* Pipeline Filter Pills */}
            <div className="crm-filter-pills" role="group" aria-label="Contact pipeline filters">
              {filterPills.map((pill) => {
                const active = quickFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    className={`crm-filter-pill${active ? ' crm-filter-pill--active' : ''}`}
                    aria-pressed={active}
                    onClick={() => setQuickFilter(pill.id)}
                  >
                    <span>{pill.label}</span>
                    <span className="crm-filter-pill__count">{pill.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search, Evangelist Filter & Sort Controls */}
            <div className="crm-toolbar__inputs">
              <div>
                <label htmlFor={`${uid}-search`} className="form-label">
                  Search Guest, Phone, Code, or Remarks
                </label>
                <input
                  id={`${uid}-search`}
                  type="search"
                  className="form-input"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Name, phone, XMAS-..., Mandarin, ride..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor={`${uid}-vol-filter`} className="form-label">
                  Evangelist / QR Board
                </label>
                <select
                  id={`${uid}-vol-filter`}
                  className="form-select"
                  value={volunteerFilter}
                  onChange={(e) => setVolunteerFilter(e.target.value)}
                >
                  <option value="ALL">All Evangelists ({stats.totalLeads})</option>
                  {volunteerOptions.map((vol) => (
                    <option key={vol} value={vol}>
                      {vol} ({stats.byVolunteer[vol]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`${uid}-sort`} className="form-label">
                  Sort Priority
                </label>
                <select
                  id={`${uid}-sort`}
                  className="form-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ContactSortBy)}
                >
                  <option value="newest">Newest Contacts First</option>
                  <option value="hot_first">Hot &amp; Re-Engaged First</option>
                  <option value="recent_activity">Most Recently Active</option>
                  <option value="highest_score">Highest Arcade Score</option>
                </select>
              </div>

              <div className="crm-toolbar__refresh">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void loadData()}
                >
                  <ReplayIcon size={15} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card-panel">Loading live evangelism contacts…</div>
          ) : error ? (
            <div className="card-panel" role="alert">
              <p style={{ margin: '0 0 0.75rem', color: 'var(--danger-ink)' }}>{error}</p>
              <button
                type="button"
                className="btn btn--gold btn--sm"
                onClick={() => void loadData()}
              >
                Retry
              </button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="card-panel crm-empty-state" role="status">
              <div className="crm-empty-state__icon" aria-hidden="true">
                <UsersCrmIcon size={28} />
              </div>
              <h2 className="section-title" style={{ marginBlock: '0.45rem 0.25rem' }}>
                {leads.length === 0
                  ? 'Ready for Your First Street Contact'
                  : 'No Contacts Match Current Filter'}
              </h2>
              <p className="subtle-text" style={{ marginBlockEnd: '1rem' }}>
                {leads.length === 0
                  ? 'Generate each evangelist’s QR board in QR Board Maker and invite guests to play!'
                  : 'Clear the active pipeline filter or search term to see all contacts.'}
              </p>
              {leads.length === 0 ? (
                <button
                  type="button"
                  className="btn btn--gold btn--sm"
                  onClick={() => setActiveTab('qr')}
                >
                  Open QR Board Maker
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setQuickFilter('all');
                    setVolunteerFilter('ALL');
                    setSearchQuery('');
                  }}
                >
                  Show All Contacts ({leads.length})
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
                  Live Evangelism Contacts ({filteredLeads.length} of {leads.length} shown · tap any
                  contact’s remark box to add pastoral notes &amp; RSVP stage)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Guest &amp; Intent</th>
                    <th scope="col">Evangelist &amp; Arcade</th>
                    <th scope="col">Evangelism Remarks</th>
                    <th scope="col">Gift &amp; RSVP Stage</th>
                    <th scope="col">1-Tap Outreach</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const heat = getLeadEngagementTier(lead);
                    const stageMeta = getFollowUpStageMeta(lead.followUpStatus);
                    const hasNotes = Boolean(lead.notes.trim());

                    return (
                      <tr key={lead.id}>
                        <th scope="row">
                          <div className="lead-guest-cell">
                            <div className="lead-guest-cell__top">
                              <span className="lead-guest-cell__name">{lead.name}</span>
                              <span className={`heat-badge heat-badge--${heat}`}>
                                {heat === 'hot' && <FlameIcon size={11} />}
                                {heat === 'hot'
                                  ? 'Hot'
                                  : heat === 'warm'
                                    ? 'Warm'
                                    : 'Street'}
                              </span>
                            </div>

                            <div className="lead-guest-cell__phone-row">
                              <span className="lead-guest-cell__phone">
                                +{lead.normalizedPhone}
                              </span>
                              <button
                                type="button"
                                className="inline-copy-btn"
                                aria-label={`Copy phone number for ${lead.name}`}
                                onClick={() => void handleCopyPhoneInline(lead)}
                              >
                                <CopyIcon size={12} />
                                <span>
                                  {copiedLeadPhoneId === lead.id ? 'Copied' : 'Copy'}
                                </span>
                              </button>
                            </div>

                            <div className="lead-guest-cell__sub">
                              {lead.redemptionCode} · {formatShortTimestamp(lead.createdAt)}
                            </div>
                          </div>
                        </th>

                        <td data-col="game">
                          <div className="lead-game-cell">
                            <span className="lead-evangelist-pill">
                              Evangelist: <strong>{lead.volunteerName || 'General'}</strong>
                            </span>
                            <div className="lead-game-cell__primary">
                              {GAME_LABELS_MAP[lead.gamePlayed] || lead.gamePlayed} ({lead.score}{' '}
                              pts)
                            </div>
                            <div className="lead-game-cell__metrics">
                              {lead.totalGamesPlayed} played ({lead.gamesAfterInteraction} after) ·{' '}
                              {lead.inviteShares} shares ·{' '}
                              {lead.calendarAdds + lead.ticketDownloads} saved ·{' '}
                              {lead.directionsClicks} Maps/Waze
                            </div>
                          </div>
                        </td>

                        <td data-col="remarks">
                          <button
                            type="button"
                            className={`remark-cell-btn${
                              hasNotes ? ' remark-cell-btn--filled' : ' remark-cell-btn--empty'
                            }`}
                            aria-label={
                              hasNotes
                                ? `Edit remarks for ${lead.name}`
                                : `Add remark for ${lead.name}`
                            }
                            onClick={() => openLeadCrm(lead.id, true)}
                          >
                            {hasNotes ? (
                              <>
                                <span className="remark-cell-btn__text">{lead.notes}</span>
                                <span className="remark-cell-btn__meta">
                                  <NoteEditIcon size={12} />
                                  <span>
                                    Edit remark
                                    {lead.notesUpdatedAt
                                      ? ` · ${formatShortTimestamp(lead.notesUpdatedAt)}`
                                      : ''}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <span className="remark-cell-btn__add">
                                <NoteEditIcon size={14} />
                                <span>+ Add Remark / Prayer Note</span>
                              </span>
                            )}
                          </button>
                        </td>

                        <td data-col="status">
                          <div className="lead-status-stack">
                            <button
                              type="button"
                              className={`btn btn--xs ${
                                lead.giftClaimed ? 'btn--gold' : 'btn--ghost'
                              }`}
                              aria-pressed={lead.giftClaimed}
                              aria-label={`Gift Given for ${lead.name}`}
                              onClick={() =>
                                void handlePatchLead(lead.id, {
                                  giftClaimed: !lead.giftClaimed,
                                })
                              }
                            >
                              {lead.giftClaimed ? (
                                <CheckCircleIcon size={14} />
                              ) : (
                                <GiftBoxIcon size={14} />
                              )}
                              <span>{lead.giftClaimed ? 'Gift Given' : 'Mark Gifted'}</span>
                            </button>

                            <button
                              type="button"
                              className={`rsvp-badge rsvp-badge--${stageMeta.tone}`}
                              aria-label={`Follow-up stage for ${lead.name}: ${stageMeta.label}. Click to update`}
                              onClick={() => openLeadCrm(lead.id, false)}
                            >
                              <span>{stageMeta.shortLabel}</span>
                            </button>
                          </div>
                        </td>

                        <td data-col="actions">
                          <div className="lead-actions-stack">
                            <a
                              href={lead.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Send WhatsApp Invite to ${lead.name}`}
                              className="btn btn--whatsapp btn--xs"
                              onClick={() => {
                                if (!lead.whatsappSent || lead.followUpStatus === 'new') {
                                  void handlePatchLead(lead.id, {
                                    whatsappSent: true,
                                    followUpStatus:
                                      lead.followUpStatus === 'new'
                                        ? 'contacted'
                                        : lead.followUpStatus,
                                  });
                                }
                              }}
                            >
                              <WhatsAppIcon size={14} />
                              <span>WhatsApp Invite</span>
                            </a>

                            <div className="lead-actions-secondary">
                              <a
                                href={lead.reminderWhatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Send Service Reminder WhatsApp to ${lead.name}`}
                                className="btn btn--ghost btn--xs"
                              >
                                <BellReminderIcon size={13} />
                                <span>Reminder</span>
                              </a>
                              <button
                                type="button"
                                className="btn btn--ghost btn--xs"
                                aria-label={`View click log for ${lead.name}`}
                                onClick={() =>
                                  setActivityLogRequest({
                                    title: `${lead.name} — Complete Click & Activity Log`,
                                    subtitle: `${lead.redemptionCode} · +${lead.normalizedPhone}`,
                                    category: 'all',
                                    leadId: lead.id,
                                  })
                                }
                              >
                                <EyeScanIcon size={13} />
                                <span>Log</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--xs"
                                aria-label={`Open full CRM & remarks for ${lead.name}`}
                                onClick={() => openLeadCrm(lead.id, false)}
                              >
                                <NoteEditIcon size={13} />
                                <span>CRM</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Native <dialog> Guest Follow-Up & Remarks CRM Modal */}
      <ContactCrmDialog
        lead={selectedLead}
        focusNotesOnOpen={focusNotesOnOpen}
        volunteerSuggestions={volunteerSuggestions}
        onClose={() => setSelectedLeadId(null)}
        onSave={handlePatchLead}
      />

      {/* Native <dialog> Click & Activity Audit Log Modal */}
      <ActivityLogDialog
        request={activityLogRequest}
        onClose={() => setActivityLogRequest(null)}
        onInspectLead={(leadId) => openLeadCrm(leadId, false)}
      />
    </section>
  );
}

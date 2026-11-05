import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  GAME_LABELS_MAP,
  type ActivityLogCategory,
  type ActivityLogEntry,
} from '../types.ts';
import { fetchTeamActivityLog } from '../lib/api.ts';
import {
  CalendarIcon,
  CloseIcon,
  CopyIcon,
  EyeScanIcon,
  GiftBoxIcon,
  GridGamesIcon,
  MapPinIcon,
  NoteEditIcon,
  ReplayIcon,
  ShareViralIcon,
  TicketPassIcon,
  UsersCrmIcon,
  WazeIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import {
  formatExactLogTimestamp,
  getEventActionMeta,
  getFollowUpStageMeta,
} from './teamHelpers.ts';

export interface ActivityLogModalRequest {
  title: string;
  subtitle?: string;
  category: ActivityLogCategory;
  gameId?: string;
  leadId?: number;
  volunteer?: string;
}

interface ActivityLogDialogProps {
  request: ActivityLogModalRequest | null;
  onClose: () => void;
  onInspectLead: (leadId: number) => void;
}

const LOG_CATEGORY_PILLS: ReadonlyArray<{
  id: ActivityLogCategory;
  label: string;
}> = [
  { id: 'all', label: 'All Clicks & Events' },
  { id: 'directions', label: 'Maps & Waze' },
  { id: 'maps_only', label: 'Google Maps' },
  { id: 'waze_only', label: 'Waze' },
  { id: 'viral_actions', label: 'Shares + Tickets + Calendar' },
  { id: 'shares', label: 'WhatsApp Shares' },
  { id: 'tickets', label: 'E-Tickets Saved' },
  { id: 'calendar', label: 'Calendar Adds' },
  { id: 'invite_views', label: 'VIP Invite Opens' },
  { id: 'games_after', label: 'After-Street Games' },
  { id: 'games_started', label: 'All Games' },
  { id: 'page_views', label: 'QR Scans & Views' },
  { id: 'return_views', label: 'Return Visits' },
  { id: 'registered_contacts', label: 'Registrations' },
  { id: 'physical_gifts', label: 'Gifts Handed Out' },
  { id: 'team_whatsapp', label: 'Team WhatsApps' },
];

function renderActionIcon(eventType: string) {
  switch (eventType) {
    case 'maps_click':
      return <MapPinIcon size={13} />;
    case 'waze_click':
      return <WazeIcon size={13} />;
    case 'calendar_google':
    case 'calendar_ics':
      return <CalendarIcon size={13} />;
    case 'ticket_download':
      return <TicketPassIcon size={13} />;
    case 'invite_share_whatsapp':
      return <ShareViralIcon size={13} />;
    case 'team_whatsapp_followup':
      return <WhatsAppIcon size={13} />;
    case 'gift_claimed':
      return <GiftBoxIcon size={13} />;
    case 'lead_registered':
      return <UsersCrmIcon size={13} />;
    case 'game_start':
    case 'game_complete':
      return <GridGamesIcon size={13} />;
    default:
      return <EyeScanIcon size={13} />;
  }
}

export function ActivityLogDialog({
  request,
  onClose,
  onInspectLead,
}: ActivityLogDialogProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [category, setCategory] = useState<ActivityLogCategory>('all');
  const [scopedGameId, setScopedGameId] = useState<string | undefined>(undefined);
  const [scopedLeadId, setScopedLeadId] = useState<number | undefined>(undefined);
  const [scopedVolunteer, setScopedVolunteer] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isOpen = request !== null;

  // Reset filters when a new drill-down request opens the modal
  useEffect(() => {
    if (!request) return;
    setCategory(request.category);
    setScopedGameId(request.gameId);
    setScopedLeadId(request.leadId);
    setScopedVolunteer(request.volunteer);
    setSearchText('');
    setDebouncedSearch('');
    setError(null);
  }, [request]);

  // Debounce search query slightly so typing doesn't spam network requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 180);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Open/close native <dialog> via showModal()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Native close event + outside pointerdown/pointerup fallback when closedby is unsupported
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleNativeClose);

    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    let pressedOutside = false;

    const isOutsideDialog = (e: PointerEvent) => {
      if (e.clientX === 0 && e.clientY === 0) return false;
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (supportsClosedBy) return;
      pressedOutside = isOutsideDialog(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (supportsClosedBy) return;
      if (pressedOutside && isOutsideDialog(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onClose]);

  const loadLogs = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTeamActivityLog({
        category,
        gameId: scopedGameId,
        leadId: scopedLeadId,
        volunteer: scopedVolunteer,
        search: debouncedSearch || undefined,
        limit: 250,
      });
      setEntries(res.entries);
      setTotalMatching(res.totalMatching);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activity log.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, category, scopedGameId, scopedLeadId, scopedVolunteer, debouncedSearch]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const summaryBreakdown = useMemo(() => {
    let registeredRows = 0;
    let mapsRows = 0;
    let wazeRows = 0;
    for (const row of entries) {
      if (row.leadId !== null) registeredRows += 1;
      if (row.eventType === 'maps_click') mapsRows += 1;
      if (row.eventType === 'waze_click') wazeRows += 1;
    }
    return {
      registeredRows,
      anonymousRows: Math.max(0, entries.length - registeredRows),
      mapsRows,
      wazeRows,
    };
  }, [entries]);

  const handleCopyPhone = async (entryId: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(`+${phone}`);
      setCopiedId(entryId);
      setTimeout(() => {
        setCopiedId((curr) => (curr === entryId ? null : curr));
      }, 1800);
    } catch {
      // Clipboard ignored in restricted contexts
    }
  };

  const activeCategoryLabel =
    LOG_CATEGORY_PILLS.find((p) => p.id === category)?.label ?? 'Activity Log';

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="crm-dialog activity-log-dialog"
      aria-labelledby={`${uid}-log-title`}
    >
      {request && (
        <div className="crm-dialog__sheet activity-log-dialog__sheet">
          <header className="crm-dialog__header">
            <div className="crm-dialog__heading-wrap">
              <div className="crm-dialog__eyebrow-row">
                <span className="heat-badge heat-badge--hot">Click &amp; Activity Audit Log</span>
                <span className="crm-dialog__code">
                  {totalMatching.toLocaleString()} matching{' '}
                  {totalMatching === 1 ? 'record' : 'records'}
                </span>
              </div>
              <h2 id={`${uid}-log-title`} className="crm-dialog__title">
                {request.title}
              </h2>
              <p className="crm-dialog__meta">
                {request.subtitle ||
                  'Exact chronological audit trail showing who clicked, which evangelist board they came from, and when.'}
              </p>
            </div>

            <button
              type="button"
              className="icon-round-btn crm-dialog__close"
              aria-label="Close click and activity log"
              onClick={() => dialogRef.current?.close()}
            >
              <CloseIcon size={16} />
            </button>
          </header>

          <div className="crm-dialog__body activity-log-dialog__body">
            {/* Active Scope Chips (when opened from a specific guest, game, or evangelist) */}
            {(scopedLeadId !== undefined || scopedGameId || scopedVolunteer) && (
              <div className="log-scope-bar" role="group" aria-label="Active scope filters">
                {scopedLeadId !== undefined && (
                  <button
                    type="button"
                    className="quick-tag-chip quick-tag-chip--active"
                    onClick={() => setScopedLeadId(undefined)}
                  >
                    <span>Scoped to Contact #{scopedLeadId} · Show All Guests ×</span>
                  </button>
                )}
                {scopedGameId && (
                  <button
                    type="button"
                    className="quick-tag-chip quick-tag-chip--active"
                    onClick={() => setScopedGameId(undefined)}
                  >
                    <span>
                      Game: {GAME_LABELS_MAP[scopedGameId] || scopedGameId} · Clear ×
                    </span>
                  </button>
                )}
                {scopedVolunteer && (
                  <button
                    type="button"
                    className="quick-tag-chip quick-tag-chip--active"
                    onClick={() => setScopedVolunteer(undefined)}
                  >
                    <span>Evangelist: {scopedVolunteer} · Clear ×</span>
                  </button>
                )}
              </div>
            )}

            {/* Quick Category Filter Pills */}
            <div className="log-filter-pills" role="group" aria-label="Filter log by click type">
              {LOG_CATEGORY_PILLS.map((pill) => {
                const active = category === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    className={`crm-filter-pill crm-filter-pill--compact${
                      active ? ' crm-filter-pill--active' : ''
                    }`}
                    aria-pressed={active}
                    onClick={() => setCategory(pill.id)}
                  >
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & Refresh Controls */}
            <div className="log-search-bar">
              <div className="log-search-bar__field">
                <label htmlFor={`${uid}-log-search`} className="form-label">
                  Search Guest Name, Phone, XMAS Code, or Evangelist
                </label>
                <input
                  ref={searchInputRef}
                  id={`${uid}-log-search`}
                  type="search"
                  autoFocus
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="form-input"
                  placeholder="e.g. Daniel, 6012, XMAS-, Andrew, waze..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="log-search-bar__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void loadLogs()}
                >
                  <ReplayIcon size={15} />
                  <span>Refresh Log</span>
                </button>
              </div>
            </div>

            {/* Summary Breakdown Strip */}
            <div className="crm-snapshot-bar">
              <div className="crm-snapshot-stats">
                <span className="crm-stat-chip">
                  Filter: <strong>{activeCategoryLabel}</strong>
                </span>
                <span className="crm-stat-chip">
                  <strong>{summaryBreakdown.registeredRows}</strong> registered guest clicks
                </span>
                <span className="crm-stat-chip">
                  <strong>{summaryBreakdown.anonymousRows}</strong> unregistered visitor events
                </span>
                {(category === 'directions' ||
                  category === 'maps_only' ||
                  category === 'waze_only' ||
                  summaryBreakdown.mapsRows + summaryBreakdown.wazeRows > 0) && (
                  <span className="crm-stat-chip">
                    <strong>{summaryBreakdown.mapsRows}</strong> Google Maps ·{' '}
                    <strong>{summaryBreakdown.wazeRows}</strong> Waze
                  </span>
                )}
              </div>
              {totalMatching > entries.length && (
                <span className="subtle-text" style={{ fontSize: '0.76rem' }}>
                  Showing latest {entries.length} of {totalMatching.toLocaleString()}
                </span>
              )}
            </div>

            {/* Results Table */}
            {error ? (
              <div role="alert" className="form-alert" style={{ marginBlockEnd: 0 }}>
                {error}
              </div>
            ) : loading && entries.length === 0 ? (
              <div className="card-panel" style={{ textAlign: 'center', paddingBlock: '2rem' }}>
                Loading click &amp; activity records…
              </div>
            ) : entries.length === 0 ? (
              <div className="card-panel crm-empty-state" role="status">
                <p className="section-title" style={{ marginBlock: '0 0.3rem' }}>
                  No Matching Click Records Yet
                </p>
                <p className="subtle-text" style={{ margin: 0 }}>
                  When guests scan QR codes, play games, or tap Google Maps, Waze, Calendar, E-Ticket,
                  or WhatsApp Share, every individual click appears here with their name and phone.
                </p>
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={`${uid}-log-caption`}
                className="table-wrapper activity-log-table-wrap"
              >
                <table className="leads-table activity-log-table">
                  <caption id={`${uid}-log-caption`}>
                    {activeCategoryLabel} — {entries.length} chronological{' '}
                    {entries.length === 1 ? 'entry' : 'entries'}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Who Clicked / Guest</th>
                      <th scope="col">Exact Click / Action</th>
                      <th scope="col">Evangelist &amp; Stage</th>
                      <th scope="col">Exact Time</th>
                      <th scope="col">CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const actionMeta = getEventActionMeta(entry.eventType);
                      const stageMeta = entry.followUpStatus
                        ? getFollowUpStageMeta(entry.followUpStatus)
                        : null;

                      return (
                        <tr key={entry.id}>
                          <th scope="row">
                            {entry.leadId !== null && entry.guestName ? (
                              <div className="lead-guest-cell">
                                <div className="lead-guest-cell__top">
                                  <span className="lead-guest-cell__name">{entry.guestName}</span>
                                  {stageMeta && (
                                    <span
                                      className={`rsvp-badge rsvp-badge--${stageMeta.tone}`}
                                      style={{ minBlockSize: '22px', padding: '0.08rem 0.45rem', fontSize: '0.66rem' }}
                                    >
                                      {stageMeta.shortLabel}
                                    </span>
                                  )}
                                </div>
                                {entry.guestPhone && (
                                  <div className="lead-guest-cell__phone-row">
                                    <span className="lead-guest-cell__phone">
                                      +{entry.guestPhone}
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-copy-btn"
                                      aria-label={
                                        copiedId === entry.id
                                          ? `Copied phone number for ${entry.guestName}`
                                          : `Copy phone number for ${entry.guestName}`
                                      }
                                      onClick={() =>
                                        void handleCopyPhone(entry.id, entry.guestPhone!)
                                      }
                                    >
                                      <CopyIcon size={11} />
                                      <span>{copiedId === entry.id ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>
                                )}
                                {entry.redemptionCode && (
                                  <div className="lead-guest-cell__sub">{entry.redemptionCode}</div>
                                )}
                              </div>
                            ) : (
                              <div className="lead-guest-cell">
                                <span className="lead-guest-cell__name log-anon-name">
                                  Unregistered Street Visitor
                                </span>
                                <span className="lead-guest-cell__sub">
                                  Device {entry.visitorTag || '#anon'}
                                </span>
                              </div>
                            )}
                          </th>

                          <td data-col="action">
                            <div className="log-action-cell">
                              <span
                                className={`log-action-badge log-action-badge--${actionMeta.tone}`}
                              >
                                {renderActionIcon(entry.eventType)}
                                <span>{actionMeta.shortBadge}</span>
                              </span>
                              <span className="log-action-cell__desc">{actionMeta.label}</span>
                              {entry.gameId && (
                                <span className="log-action-cell__game">
                                  {GAME_LABELS_MAP[entry.gameId] || entry.gameId}
                                  {entry.eventType === 'game_complete' ||
                                  entry.eventType === 'lead_registered'
                                    ? ` · ${entry.score} pts`
                                    : ''}
                                </span>
                              )}
                            </div>
                          </td>

                          <td data-col="context">
                            <div className="log-context-cell">
                              <span className="lead-evangelist-pill">
                                Evangelist:{' '}
                                <strong>{entry.volunteerName || 'General / Direct'}</strong>
                              </span>
                              {entry.isPostInteraction ? (
                                <span className="post-street-pill" style={{ marginInlineStart: 0 }}>
                                  After Street (Phone)
                                </span>
                              ) : (
                                <span className="subtle-text" style={{ fontSize: '0.74rem' }}>
                                  On Street / Live Booth
                                </span>
                              )}
                            </div>
                          </td>

                          <td data-col="time">
                            <span className="activity-item__time">
                              {formatExactLogTimestamp(entry.createdAt)}
                            </span>
                          </td>

                          <td data-col="crm">
                            {entry.leadId !== null ? (
                              <button
                                type="button"
                                className="btn btn--ghost btn--xs"
                                aria-label={`Open CRM card for ${entry.guestName || 'guest'}`}
                                onClick={() => {
                                  const targetLeadId = entry.leadId!;
                                  dialogRef.current?.close();
                                  onInspectLead(targetLeadId);
                                }}
                              >
                                <NoteEditIcon size={13} />
                                <span>Open CRM</span>
                              </button>
                            ) : (
                              <span className="subtle-text" style={{ fontSize: '0.75rem' }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <footer className="crm-dialog__footer">
            <form method="dialog">
              <button type="submit" className="btn btn--ghost btn--sm">
                Close Log
              </button>
            </form>
          </footer>
        </div>
      )}
    </dialog>
  );
}

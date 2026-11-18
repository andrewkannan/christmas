import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  DEFAULT_CHURCH_ZONES,
  GAME_LABELS_MAP,
  type AdminOverviewResponse,
  type AdminUnifiedRecord,
  type EventSettings,
  type TeamSessionUser,
} from '../types.ts';
import {
  fetchAdminOverview,
  logoutTeam,
  patchCrownSettings,
  patchSoulRegistration,
  patchTeamLead,
} from '../lib/api.ts';
import { ChristmasCrownArt } from '../crown/ChristmasCrownArt.tsx';
import {
  CheckCircleIcon,
  CrownIcon,
  DownloadIcon,
  RefreshIcon,
  SparkleIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';

interface AdminConsolePageProps {
  currentUser: TeamSessionUser | null;
  settings: EventSettings;
  onSettingsUpdated: (next: EventSettings) => void;
  onOpenPresent: () => void;
  onOpenRegister: () => void;
  onOpenTeamConsole: () => void;
  onLoggedOut: () => void;
}

type SourceFilter = 'all' | 'register' | 'arcade';
type AttendanceFilter = 'all' | 'attended' | 'pending';

export function AdminConsolePage({
  currentUser,
  settings,
  onSettingsUpdated,
  onOpenPresent,
  onOpenRegister,
  onOpenTeamConsole,
  onLoggedOut,
}: AdminConsolePageProps) {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Crown Target & Zones Settings State
  const [targetInput, setTargetInput] = useState<number>(
    settings.crownTargetSouls ?? 500
  );
  const [countArcadeInput, setCountArcadeInput] = useState<boolean>(
    settings.crownCountArcadeLeads !== false
  );
  const [zonesText, setZonesText] = useState<string>(() =>
    (settings.churchZones && settings.churchZones.length > 0
      ? settings.churchZones
      : [...DEFAULT_CHURCH_ZONES]
    ).join('\n')
  );
  const [showZonesEditor, setShowZonesEditor] = useState(false);
  const [savingCrown, setSavingCrown] = useState(false);
  const [crownSaveMsg, setCrownSaveMsg] = useState('');

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Row mutation & notes state
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [editingNoteUid, setEditingNoteUid] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const res = await fetchAdminOverview();
      setData(res);
      setTargetInput(res.crownStatus.targetSouls);
      setCountArcadeInput(res.crownStatus.countArcadeLeads);
      if (res.crownStatus.churchZones.length > 0) {
        setZonesText(res.crownStatus.churchZones.join('\n'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load unified admin registrations.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleSaveCrownTarget = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingCrown(true);
    setCrownSaveMsg('');
    try {
      const parsedZones = zonesText
        .split(/\r?\n/)
        .map((z) => z.trim())
        .filter(Boolean);
      const res = await patchCrownSettings({
        crownTargetSouls: Math.max(1, Math.round(Number(targetInput) || 500)),
        crownCountArcadeLeads: countArcadeInput,
        churchZones: parsedZones.length > 0 ? parsedZones : [...DEFAULT_CHURCH_ZONES],
      });
      onSettingsUpdated(res.settings);
      setCrownSaveMsg(
        `Saved! Final Full Crown is now set to ${res.crownStatus.targetSouls.toLocaleString()} souls (${res.crownStatus.fillPercentage}% full).`
      );
      await loadOverview();
    } catch (err) {
      setCrownSaveMsg(
        err instanceof Error ? err.message : 'Failed to update Crown target.'
      );
    } finally {
      setSavingCrown(false);
    }
  };

  const handleToggleAttended = async (rec: AdminUnifiedRecord) => {
    setBusyUid(rec.uid);
    const nextAttended = !rec.attended;
    try {
      if (rec.source === 'register') {
        await patchSoulRegistration(rec.recordId, { attended: nextAttended });
      } else {
        await patchTeamLead(rec.recordId, {
          attended: nextAttended,
          followUpStatus: nextAttended ? 'confirmed' : undefined,
        });
      }
      await loadOverview();
    } catch {
      // Ignore transient error
    } finally {
      setBusyUid(null);
    }
  };

  const handleMarkWhatsappSent = async (rec: AdminUnifiedRecord) => {
    if (rec.whatsappSent) return;
    try {
      if (rec.source === 'register') {
        await patchSoulRegistration(rec.recordId, { whatsappSent: true });
      } else {
        await patchTeamLead(rec.recordId, { whatsappSent: true });
      }
      await loadOverview();
    } catch {
      // Ignore
    }
  };

  const handleSaveNote = async (rec: AdminUnifiedRecord) => {
    setBusyUid(rec.uid);
    try {
      if (rec.source === 'register') {
        await patchSoulRegistration(rec.recordId, { notes: noteDraft });
      } else {
        await patchTeamLead(rec.recordId, { notes: noteDraft });
      }
      setEditingNoteUid(null);
      await loadOverview();
    } catch {
      // Ignore
    } finally {
      setBusyUid(null);
    }
  };

  const availableZones = useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.records ?? []) {
      if (r.churchZone) set.add(r.churchZone);
    }
    return Array.from(set).sort();
  }, [data?.records]);

  const filteredRecords = useMemo(() => {
    const records = data?.records ?? [];
    const q = searchQuery.trim().toLowerCase();

    return records.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (attendanceFilter === 'attended' && !r.attended) return false;
      if (attendanceFilter === 'pending' && r.attended) return false;
      if (zoneFilter !== 'ALL' && r.churchZone !== zoneFilter) return false;

      if (q) {
        const haystack = [
          r.soulName,
          r.soulPhone,
          r.soulNormalizedPhone,
          r.memberName,
          r.memberPhone,
          r.churchZone,
          r.address,
          r.code,
          r.notes,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [data?.records, sourceFilter, attendanceFilter, zoneFilter, searchQuery]);

  const stats = data?.stats;
  const crownStatus = data?.crownStatus;

  return (
    <div className="admin-console-stage">
      {/* Top Admin Header */}
      <header className="card-panel admin-hero">
        <div className="admin-hero__top">
          <div>
            <div className="admin-hero__badges">
              <span className="eyebrow-pill">
                <CrownIcon size={14} />
                <span>{settings.churchName} · Unified Christmas Admin</span>
              </span>
              {currentUser && (
                <span className="badge badge--gold">
                  Signed in: {currentUser.name} ({currentUser.role})
                </span>
              )}
            </div>
            <h1 className="hero-title">
              King of Glory Crown, Soul Registrations &amp; Christmas Attendance
            </h1>
            <p className="hero-subtitle">
              Track every New Soul registered by Church Members on <code>/register</code> alongside
              every guest from the Christmas Arcade Game, set the Final Full Crown number for{' '}
              <code>/present</code>, record Christmas attendance, and WhatsApp guests in one tap.
            </p>
          </div>

          <div className="admin-hero__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onOpenPresent}
            >
              <CrownIcon size={15} />
              <span>Launch /present Crown Screen</span>
            </button>
            <button
              type="button"
              className="btn btn--subtle btn--sm"
              onClick={onOpenRegister}
            >
              <SparkleIcon size={15} />
              <span>Open /register Form</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onOpenTeamConsole}
            >
              <span>/team Analytics</span>
            </button>
            <a
              href="/api/team/admin-export.csv"
              className="btn btn--ghost btn--sm"
            >
              <DownloadIcon size={15} />
              <span>Export CSV</span>
            </a>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => void loadOverview()}
            >
              <RefreshIcon size={15} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                void logoutTeam().then(onLoggedOut);
              }}
            >
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Live KPI Summary Cards */}
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card admin-kpi-card--gold">
            <span className="admin-kpi-card__label">👑 King of Glory Crown Progress</span>
            <strong className="admin-kpi-card__value">
              {(stats?.crownProgressSouls ?? 0).toLocaleString()} /{' '}
              {(stats?.crownTargetSouls ?? 500).toLocaleString()}
            </strong>
            <span className="admin-kpi-card__sub">
              {stats?.crownFillPercentage ?? 0}% of Final Full Crown
            </span>
          </div>

          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">🎄 Church Member /register</span>
            <strong className="admin-kpi-card__value">
              {(stats?.registerHeadcount ?? 0).toLocaleString()} Souls
            </strong>
            <span className="admin-kpi-card__sub">
              Across {stats?.registerRecordsCount ?? 0} member submissions
            </span>
          </div>

          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">🕹️ Street Arcade Game Players</span>
            <strong className="admin-kpi-card__value">
              {(stats?.arcadeRecordsCount ?? 0).toLocaleString()} Guests
            </strong>
            <span className="admin-kpi-card__sub">
              Registered via QR &amp; Christmas Arcade
            </span>
          </div>

          <div className="admin-kpi-card admin-kpi-card--green">
            <span className="admin-kpi-card__label">✅ Attended on Christmas</span>
            <strong className="admin-kpi-card__value">
              {(stats?.attendedHeadcount ?? 0).toLocaleString()} Souls Present
            </strong>
            <span className="admin-kpi-card__sub">
              {stats?.attendedRecordsCount ?? 0} groups / guests checked in
            </span>
          </div>

          <div className="admin-kpi-card">
            <span className="admin-kpi-card__label">💬 WhatsApp Contacted</span>
            <strong className="admin-kpi-card__value">
              {(stats?.whatsappSentCount ?? 0).toLocaleString()}
            </strong>
            <span className="admin-kpi-card__sub">
              of {stats?.totalUnifiedRecords ?? 0} total registrations
            </span>
          </div>
        </div>
      </header>

      {/* Section 1: Final Full Crown Target & Home Church Zones Controller */}
      <section className="card-panel admin-crown-config" aria-labelledby="crown-config-heading">
        <div className="admin-crown-config__grid">
          <div className="admin-crown-config__main">
            <h2 id="crown-config-heading" className="section-title">
              👑 King of Glory Final Full Crown Number (/present Settings)
            </h2>
            <p className="muted-text">
              Set the target soul count required for the Christmas Tree-themed Crown on{' '}
              <code>/present</code> to reach <strong>100% Full Crown</strong> from bottom to top.
            </p>

            <form onSubmit={handleSaveCrownTarget} className="admin-crown-form">
              <div className="admin-crown-form__row">
                <div className="form-field">
                  <label htmlFor="admin-crown-target-input" className="form-label">
                    Final Full Crown Target (Souls)
                  </label>
                  <div className="admin-crown-target-controls">
                    <input
                      id="admin-crown-target-input"
                      name="crownTargetSouls"
                      type="number"
                      min={1}
                      max={100000}
                      required
                      className="form-input admin-crown-target-input"
                      value={targetInput}
                      onChange={(e) =>
                        setTargetInput(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                    />
                    <div className="admin-crown-presets" role="group" aria-label="Crown target presets">
                      {[100, 250, 500, 1000, 1500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`btn btn--sm ${
                            targetInput === preset ? 'btn--primary' : 'btn--ghost'
                          }`}
                          onClick={() => setTargetInput(preset)}
                        >
                          {preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="admin-checkbox-row" htmlFor="admin-count-arcade">
                  <input
                    id="admin-count-arcade"
                    name="crownCountArcadeLeads"
                    type="checkbox"
                    checked={countArcadeInput}
                    onChange={(e) => setCountArcadeInput(e.target.checked)}
                  />
                  <span>
                    Include Street Arcade Game registrations alongside <code>/register</code> souls
                    in the Crown progress bar
                  </span>
                </label>
              </div>

              <div className="admin-zones-toggle-row">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-expanded={showZonesEditor}
                  onClick={() => setShowZonesEditor((v) => !v)}
                >
                  {showZonesEditor
                    ? 'Hide Home Church Zone Option List Editor'
                    : 'Customize Home Church Zone Option List (/register)'}
                </button>
              </div>

              {showZonesEditor && (
                <div className="form-field">
                  <label htmlFor="admin-zones-textarea" className="form-label">
                    Home Church Zones (One zone per line — displayed in /register dropdown)
                  </label>
                  <textarea
                    id="admin-zones-textarea"
                    name="churchZones"
                    rows={5}
                    className="form-input form-textarea"
                    value={zonesText}
                    onChange={(e) => setZonesText(e.target.value)}
                  />
                </div>
              )}

              <div className="admin-crown-form__actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={savingCrown}
                >
                  <CrownIcon size={16} />
                  <span>{savingCrown ? 'Saving Crown Target…' : 'Save Final Full Crown Number'}</span>
                </button>
                {crownSaveMsg && (
                  <span className="admin-save-feedback" role="status" aria-live="polite">
                    {crownSaveMsg}
                  </span>
                )}
              </div>
            </form>
          </div>

          <div className="admin-crown-config__preview">
            <ChristmasCrownArt
              fillPercentage={crownStatus?.fillPercentage ?? 0}
              currentSouls={crownStatus?.totalProgressSouls ?? 0}
              targetSouls={targetInput}
              compact
            />
          </div>
        </div>
      </section>

      {/* Section 2: Unified Registration & Christmas Attendance Tracker */}
      <section className="card-panel admin-directory-panel" aria-labelledby="admin-directory-heading">
        <div className="admin-directory-header">
          <div>
            <h2 id="admin-directory-heading" className="section-title">
              Unified Soul Registrations &amp; Arcade Guest List ({filteredRecords.length})
            </h2>
            <p className="muted-text">
              View all registrations from Church Members (<code>/register</code>) and the Arcade
              Game (<code>/</code>), check guests in when they attend on Christmas, and message
              them on WhatsApp.
            </p>
          </div>
        </div>

        {/* Search & Filter Controls wrapped in <search> landmark */}
        <search className="admin-filter-bar" aria-label="Filter registrations and guests">
          <div className="admin-source-tabs" role="group" aria-label="Filter by registration source">
            <button
              type="button"
              className={`btn btn--sm ${sourceFilter === 'all' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setSourceFilter('all')}
            >
              All Combined ({stats?.totalUnifiedRecords ?? 0})
            </button>
            <button
              type="button"
              className={`btn btn--sm ${
                sourceFilter === 'register' ? 'btn--primary' : 'btn--ghost'
              }`}
              onClick={() => setSourceFilter('register')}
            >
              👑 Church Member /register ({stats?.registerRecordsCount ?? 0})
            </button>
            <button
              type="button"
              className={`btn btn--sm ${sourceFilter === 'arcade' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setSourceFilter('arcade')}
            >
              🕹️ Arcade Game ({stats?.arcadeRecordsCount ?? 0})
            </button>
          </div>

          <div className="admin-filter-inputs">
            <div className="form-field">
              <label htmlFor="admin-search-input" className="visually-hidden">
                Search by name, phone, church member, zone, or code
              </label>
              <input
                id="admin-search-input"
                type="search"
                placeholder="Search New Soul name, phone, Church Member, zone, address, code…"
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="admin-attendance-filter" className="visually-hidden">
                Filter by Christmas Attendance
              </label>
              <select
                id="admin-attendance-filter"
                className="form-input form-select"
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value as AttendanceFilter)}
              >
                <option value="all">All Attendance Statuses</option>
                <option value="attended">✅ Attended on Christmas</option>
                <option value="pending">⏳ Not Checked In Yet</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="admin-zone-filter" className="visually-hidden">
                Filter by Home Church Zone
              </label>
              <select
                id="admin-zone-filter"
                className="form-input form-select"
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
              >
                <option value="ALL">All Home Church Zones</option>
                {availableZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </search>

        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="admin-empty-state" role="status">
            Loading unified registrations…
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="admin-empty-state" role="status">
            <strong>No matching registrations found.</strong>
            <span>
              Share <code>/register</code> with church members or clear your active filters.
            </span>
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="admin-unified-table-caption"
            className="admin-table-wrapper"
          >
            <table className="admin-unified-table">
              <caption id="admin-unified-table-caption" className="visually-hidden">
                Unified Christmas Soul Registrations and Arcade Guests with Attendance Check-In and
                WhatsApp Actions
              </caption>
              <thead>
                <tr>
                  <th scope="col">New Soul / Guest</th>
                  <th scope="col">No. of Members</th>
                  <th scope="col">Church Member &amp; Home Zone</th>
                  <th scope="col">Christmas Attendance</th>
                  <th scope="col">WhatsApp &amp; Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => {
                  const isBusy = busyUid === rec.uid;
                  const isEditingNote = editingNoteUid === rec.uid;

                  return (
                    <tr
                      key={rec.uid}
                      className={rec.attended ? 'admin-row--attended' : undefined}
                    >
                      <th scope="row" className="admin-cell-soul">
                        <div className="admin-soul-identity">
                          <div className="admin-soul-identity__head">
                            <strong className="admin-soul-name">{rec.soulName}</strong>
                            <span
                              className={`badge ${
                                rec.source === 'register' ? 'badge--gold' : 'badge--pine'
                              }`}
                            >
                              {rec.source === 'register'
                                ? '👑 Member /register'
                                : '🕹️ Arcade Game'}
                            </span>
                            <code className="admin-code-chip">{rec.code}</code>
                          </div>
                          <div className="admin-soul-meta">
                            <span>📱 {rec.soulPhone}</span>
                            <span>
                              🕒{' '}
                              {new Date(rec.createdAt).toLocaleString('en-MY', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {rec.address && (
                            <div className="admin-soul-address">📍 {rec.address}</div>
                          )}
                          {rec.notes && !isEditingNote && (
                            <div className="admin-soul-note">📝 {rec.notes}</div>
                          )}
                        </div>
                      </th>

                      <td className="admin-cell-count">
                        <span className="admin-pax-pill">
                          {rec.memberCount}{' '}
                          {rec.memberCount === 1 ? 'Member' : 'Members'}
                        </span>
                      </td>

                      <td className="admin-cell-member">
                        <div className="admin-member-info">
                          <strong>{rec.memberName}</strong>
                          {rec.memberPhone && <span>📱 {rec.memberPhone}</span>}
                          <span className="admin-zone-tag">{rec.churchZone}</span>
                          {rec.source === 'arcade' && rec.gamePlayed && (
                            <span className="admin-game-tag">
                              {GAME_LABELS_MAP[rec.gamePlayed] || rec.gamePlayed} · {rec.score} pts
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="admin-cell-attendance">
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-pressed={rec.attended}
                          aria-label={`Mark ${rec.soulName} as ${
                            rec.attended ? 'not attended' : 'attended on Christmas'
                          }`}
                          className={`btn btn--sm admin-attend-btn ${
                            rec.attended
                              ? 'admin-attend-btn--checked'
                              : 'admin-attend-btn--unchecked'
                          }`}
                          onClick={() => void handleToggleAttended(rec)}
                        >
                          <CheckCircleIcon size={16} />
                          <span>
                            {rec.attended ? 'Attended Christmas' : 'Mark Attended'}
                          </span>
                        </button>
                        {rec.attended && rec.attendedAt && (
                          <span className="admin-attended-time">
                            Checked in{' '}
                            {new Date(rec.attendedAt).toLocaleTimeString('en-MY', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </td>

                      <td className="admin-cell-actions">
                        <div className="admin-action-stack">
                          <a
                            href={rec.soulWhatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--whatsapp btn--sm"
                            aria-label={`WhatsApp New Soul ${rec.soulName}`}
                            onClick={() => void handleMarkWhatsappSent(rec)}
                          >
                            <WhatsAppIcon size={15} />
                            <span>
                              {rec.whatsappSent ? 'WhatsApp Again' : 'WhatsApp Soul'}
                            </span>
                          </a>

                          {rec.memberWhatsappUrl && (
                            <a
                              href={rec.memberWhatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn--subtle btn--sm"
                              aria-label={`WhatsApp Inviting Member ${rec.memberName}`}
                            >
                              <WhatsAppIcon size={14} />
                              <span>WA Member</span>
                            </a>
                          )}

                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => {
                              if (isEditingNote) {
                                setEditingNoteUid(null);
                              } else {
                                setEditingNoteUid(rec.uid);
                                setNoteDraft(rec.notes || '');
                              }
                            }}
                          >
                            <span>{rec.notes ? 'Edit Note' : '+ Note'}</span>
                          </button>
                        </div>

                        {isEditingNote && (
                          <div className="admin-note-editor">
                            <label
                              htmlFor={`note-input-${rec.uid}`}
                              className="visually-hidden"
                            >
                              Pastoral or attendance note for {rec.soulName}
                            </label>
                            <input
                              id={`note-input-${rec.uid}`}
                              type="text"
                              className="form-input"
                              placeholder="Add carpool, seating, or follow-up note…"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                            />
                            <div className="admin-note-editor__btns">
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                disabled={isBusy}
                                onClick={() => void handleSaveNote(rec)}
                              >
                                Save Note
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => setEditingNoteUid(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

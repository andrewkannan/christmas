import { useId, useMemo, useState } from 'react';
import {
  BOOTH_GAME_LABELS_MAP,
  type BoothWinnerPatchInput,
  type BoothWinnerRecord,
  type BoothWinnersStats,
  type EventSettings,
} from '../types.ts';
import {
  CheckCircleIcon,
  CopyIcon,
  GiftBoxIcon,
  NoteEditIcon,
  QrBoardIcon,
  SparkleIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import { formatShortTimestamp } from './teamHelpers.ts';

interface BoothWinnersPanelProps {
  winners: BoothWinnerRecord[];
  stats: BoothWinnersStats;
  settings: EventSettings;
  onPatchWinner: (id: number, patch: BoothWinnerPatchInput) => Promise<BoothWinnerRecord | null>;
}

type BoothFilter = 'all' | 'needs_token' | 'needs_whatsapp' | 'friend_opened';

export function BoothWinnersPanel({
  winners,
  stats,
  settings,
  onPatchWinner,
}: BoothWinnersPanelProps) {
  const uid = useId();
  const [filter, setFilter] = useState<BoothFilter>('all');
  const [search, setSearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredWinners = useMemo(() => {
    const q = search.trim().toLowerCase();
    return winners.filter((w) => {
      if (filter === 'needs_token' && w.tokenHandedOut) return false;
      if (filter === 'needs_whatsapp' && w.whatsappSent) return false;
      if (filter === 'friend_opened' && !w.friendOpened) return false;

      if (
        q &&
        !w.voucherCode.toLowerCase().includes(q) &&
        !w.memberName.toLowerCase().includes(q) &&
        !w.memberPhone.toLowerCase().includes(q) &&
        !w.friendName.toLowerCase().includes(q) &&
        !w.relationship.toLowerCase().includes(q) &&
        !w.notes.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [winners, filter, search]);

  const handleSaveNotes = async (id: number) => {
    setSavingId(id);
    try {
      await onPatchWinner(id, { notes: noteDraft });
      setEditingNoteId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleCopyInviteLink = async (id: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <section className="card-panel" aria-labelledby={`${uid}-booth-panel-heading`}>
      <div className="crm-toolbar-top">
        <div>
          <h2 id={`${uid}-booth-panel-heading`} className="section-title">
            <GiftBoxIcon size={19} />
            <span>Church Booth Winners (/winners) — Member &ldquo;New Soul&rdquo; Invites</span>
          </h2>
          <p className="subtle-text" style={{ marginBlockStart: '0.25rem' }}>
            Tracks church members who played at the Sunday Booth to win a{' '}
            <strong>Reserved VIP Seat &amp; {settings.giftDescription} Token</strong> for their
            unreached friends &amp; family (kept separate from street evangelism KPIs).
          </p>
        </div>

        <div className="crm-toolbar-actions">
          <a
            href="/winners"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--primary btn--sm"
          >
            <QrBoardIcon size={15} />
            <span>Open /winners Booth Page</span>
          </a>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="booth-team-kpi-grid" style={{ marginBlock: '1rem' }}>
        <div className="booth-team-kpi">
          <span className="booth-team-kpi__label">Members Played</span>
          <strong className="booth-team-kpi__value">{stats.totalMembersPlayed}</strong>
        </div>
        <div className="booth-team-kpi booth-team-kpi--gold">
          <span className="booth-team-kpi__label">New Soul Seats Won</span>
          <strong className="booth-team-kpi__value">{stats.totalNewSoulSeats}</strong>
        </div>
        <div className="booth-team-kpi">
          <span className="booth-team-kpi__label">Gift Tokens Handed Out</span>
          <strong className="booth-team-kpi__value">
            {stats.tokensHandedOut} / {stats.totalMembersPlayed}
          </strong>
        </div>
        <div className="booth-team-kpi">
          <span className="booth-team-kpi__label">WhatsApp Invites Sent</span>
          <strong className="booth-team-kpi__value">{stats.whatsappSentCount}</strong>
        </div>
        <div className="booth-team-kpi booth-team-kpi--green">
          <span className="booth-team-kpi__label">Friends Opened Invite</span>
          <strong className="booth-team-kpi__value">{stats.friendsOpenedCount}</strong>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <search aria-label="Filter church booth winners" className="crm-filter-bar">
        <div className="quick-filter-pills" role="group" aria-label="Booth status filter">
          <button
            type="button"
            className={`quick-tag-chip${filter === 'all' ? ' quick-tag-chip--active' : ''}`}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All ({winners.length})
          </button>
          <button
            type="button"
            className={`quick-tag-chip${filter === 'needs_token' ? ' quick-tag-chip--active' : ''}`}
            aria-pressed={filter === 'needs_token'}
            onClick={() => setFilter('needs_token')}
          >
            🎁 Needs Physical Gift Token ({winners.filter((w) => !w.tokenHandedOut).length})
          </button>
          <button
            type="button"
            className={`quick-tag-chip${
              filter === 'needs_whatsapp' ? ' quick-tag-chip--active' : ''
            }`}
            aria-pressed={filter === 'needs_whatsapp'}
            onClick={() => setFilter('needs_whatsapp')}
          >
            💬 Pending WhatsApp ({winners.filter((w) => !w.whatsappSent).length})
          </button>
          <button
            type="button"
            className={`quick-tag-chip${
              filter === 'friend_opened' ? ' quick-tag-chip--active' : ''
            }`}
            aria-pressed={filter === 'friend_opened'}
            onClick={() => setFilter('friend_opened')}
          >
            ✨ Friend Opened Link ({winners.filter((w) => w.friendOpened).length})
          </button>
        </div>

        <div className="crm-search-row" style={{ marginBlockStart: '0.65rem' }}>
          <label htmlFor={`${uid}-search`} className="visually-hidden">
            Search by member name, friend name, or voucher code
          </label>
          <input
            id={`${uid}-search`}
            type="search"
            className="form-input"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Search Member Name, Friend ('New Soul') Name, or VIP-XXXX voucher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </search>

      {filteredWinners.length === 0 ? (
        <div className="empty-state" style={{ marginBlockStart: '1rem' }}>
          <SparkleIcon size={24} />
          <p>
            {winners.length === 0
              ? 'No church booth games recorded yet. Open /winners at your Sunday booth to start winning seats for new souls!'
              : 'No booth records match your current filter.'}
          </p>
        </div>
      ) : (
        <ul role="list" className="booth-admin-list">
          {filteredWinners.map((w) => (
            <li key={w.id} className="booth-admin-card">
              <div className="booth-admin-card__top">
                <div className="booth-admin-card__identity">
                  <span className="booth-voucher-code">{w.voucherCode}</span>
                  <div>
                    <h3 className="booth-admin-card__title">
                      Member: <strong>{w.memberName}</strong> ({w.memberPhone}) → Inviting VIP:{' '}
                      <span className="booth-ticker-item__vip">{w.friendName}</span>
                    </h3>
                    <div className="booth-admin-card__meta">
                      <span>
                        {w.relationship} ·{' '}
                        <strong>
                          {w.seatsReserved} {w.seatsReserved === 1 ? 'Seat' : 'Seats'}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        {BOOTH_GAME_LABELS_MAP[w.gamePlayed]} ({w.score} pts)
                      </span>
                      <span>·</span>
                      <span>{formatShortTimestamp(w.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="booth-admin-card__badges">
                  {w.friendOpened && (
                    <span className="status-pill status-pill--green">
                      ✨ {w.friendName} Opened Invite!
                    </span>
                  )}
                </div>
              </div>

              <div className="booth-admin-card__actions">
                <button
                  type="button"
                  className={`btn btn--sm ${w.tokenHandedOut ? 'btn--subtle' : 'btn--gold-light'}`}
                  onClick={() => void onPatchWinner(w.id, { tokenHandedOut: !w.tokenHandedOut })}
                >
                  <CheckCircleIcon size={15} />
                  <span>
                    {w.tokenHandedOut
                      ? '✅ Gift Token Handed Out'
                      : '🎁 Mark Gift Token Handed Out'}
                  </span>
                </button>

                <a
                  href={w.memberFollowupWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--whatsapp btn--sm"
                  onClick={() => void onPatchWinner(w.id, { whatsappSent: true })}
                >
                  <WhatsAppIcon size={15} />
                  <span>WhatsApp Member ({w.memberName})</span>
                </a>

                <button
                  type="button"
                  className="btn btn--subtle btn--sm"
                  onClick={() => handleCopyInviteLink(w.id, w.friendInviteUrl)}
                >
                  <CopyIcon size={14} />
                  <span>
                    {copiedId === w.id ? 'Copied Link!' : `Copy ${w.friendName}'s VIP Link`}
                  </span>
                </button>

                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setEditingNoteId(editingNoteId === w.id ? null : w.id);
                    setNoteDraft(w.notes || '');
                  }}
                >
                  <NoteEditIcon size={14} />
                  <span>{w.notes ? 'Edit Remark' : 'Add Remark'}</span>
                </button>
              </div>

              {w.notes && editingNoteId !== w.id && (
                <p className="booth-admin-card__note">📝 {w.notes}</p>
              )}

              {editingNoteId === w.id && (
                <div className="booth-admin-card__note-editor">
                  <label htmlFor={`${uid}-note-${w.id}`} className="form-label">
                    Pastoral / Booth Follow-up Remark for {w.memberName} &amp; {w.friendName}
                  </label>
                  <textarea
                    id={`${uid}-note-${w.id}`}
                    rows={2}
                    className="form-input"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="e.g. Handed 2 gift tokens + Chinese invitation card for Uncle Lim…"
                  />
                  <div className="booth-admin-card__note-btns">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={savingId === w.id}
                      onClick={() => void handleSaveNotes(w.id)}
                    >
                      Save Remark
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setEditingNoteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

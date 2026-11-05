import { useEffect, useId, useRef, useState } from 'react';
import {
  GAME_LABELS_MAP,
  type FollowUpStatus,
  type LeadPatchInput,
  type TeamLeadRecord,
} from '../types.ts';
import {
  BellReminderIcon,
  CheckCircleIcon,
  CloseIcon,
  CopyIcon,
  FlameIcon,
  GiftBoxIcon,
  NoteEditIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import {
  FOLLOWUP_STAGE_OPTIONS,
  QUICK_REMARK_TAGS,
  formatShortTimestamp,
  getLeadEngagementTier,
  hasQuickTagInNotes,
  toggleQuickTagInNotes,
} from './teamHelpers.ts';

interface ContactCrmDialogProps {
  lead: TeamLeadRecord | null;
  focusNotesOnOpen?: boolean;
  volunteerSuggestions: string[];
  onClose: () => void;
  onSave: (leadId: number, patch: LeadPatchInput) => Promise<TeamLeadRecord | null>;
}

export function ContactCrmDialog({
  lead,
  focusNotesOnOpen = false,
  volunteerSuggestions,
  onClose,
  onSave,
}: ContactCrmDialogProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const [notes, setNotes] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>('new');
  const [volunteerName, setVolunteerName] = useState('');
  const [giftClaimed, setGiftClaimed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<'phone' | 'link' | null>(null);

  const activeLeadId = lead?.id ?? null;

  // Initialize draft state ONLY when switching to a different guest so 5s live polling never clobbers typing
  useEffect(() => {
    if (!lead) return;
    setNotes(lead.notes || '');
    setFollowUpStatus(lead.followUpStatus || (lead.whatsappSent ? 'contacted' : 'new'));
    setVolunteerName(lead.volunteerName || '');
    setGiftClaimed(Boolean(lead.giftClaimed));
    setSaveError(null);
    setCopiedKind(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeadId]);

  // Open/close native <dialog> via showModal() + light-dismiss fallback for browsers without closedby
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activeLeadId !== null) {
      if (!dialog.open) {
        dialog.showModal();
      }
      if (focusNotesOnOpen) {
        requestAnimationFrame(() => {
          notesRef.current?.focus();
        });
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [activeLeadId, focusNotesOnOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      onClose();
    };
    dialog.addEventListener('close', handleNativeClose);

    // Fallback light-dismiss when native closedby="any" is unsupported
    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    const handleBackdropClick = (e: MouseEvent) => {
      if (supportsClosedBy) return;
      if (e.target !== dialog) return;
      if (e.clientX === 0 && e.clientY === 0) return;
      const rect = dialog.getBoundingClientRect();
      const clickedInDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!clickedInDialog) {
        dialog.close();
      }
    };
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const handleCopy = async (text: string, kind: 'phone' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      setTimeout(() => {
        setCopiedKind((curr) => (curr === kind ? null : curr));
      }, 2000);
    } catch {
      // Clipboard may be restricted in non-HTTPS contexts
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lead) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await onSave(lead.id, {
        notes,
        followUpStatus,
        volunteerName: volunteerName.trim(),
        giftClaimed,
      });
      if (updated) {
        dialogRef.current?.close();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save contact remarks.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickWhatsappClick = (markContacted: boolean) => {
    if (!lead) return;
    if (markContacted && followUpStatus === 'new') {
      setFollowUpStatus('contacted');
      void onSave(lead.id, { whatsappSent: true, followUpStatus: 'contacted' });
    }
  };

  const heatTier = lead ? getLeadEngagementTier(lead) : 'street';

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="crm-dialog"
      aria-labelledby={`${uid}-crm-title`}
    >
      {lead && (
        <form method="post" onSubmit={handleSubmit} className="crm-dialog__sheet">
          <header className="crm-dialog__header">
            <div className="crm-dialog__heading-wrap">
              <div className="crm-dialog__eyebrow-row">
                <span className={`heat-badge heat-badge--${heatTier}`}>
                  {heatTier === 'hot' && <FlameIcon size={12} />}
                  {heatTier === 'hot'
                    ? 'Hot Intent'
                    : heatTier === 'warm'
                      ? 'Warm Guest'
                      : 'Street Contact'}
                </span>
                <span className="crm-dialog__code">{lead.redemptionCode}</span>
              </div>
              <h2 id={`${uid}-crm-title`} className="crm-dialog__title">
                {lead.name}
              </h2>
              <p className="crm-dialog__meta">
                +{lead.normalizedPhone} · Met {formatShortTimestamp(lead.createdAt)}
                {lead.volunteerName ? ` · Evangelist: ${lead.volunteerName}` : ''}
              </p>
            </div>

            <button
              type="button"
              className="icon-round-btn crm-dialog__close"
              aria-label="Close guest follow-up dialog"
              onClick={() => dialogRef.current?.close()}
            >
              <CloseIcon size={16} />
            </button>
          </header>

          <div className="crm-dialog__body">
            {/* Guest Activity & Copy Bar */}
            <div className="crm-snapshot-bar">
              <div className="crm-snapshot-stats">
                <span className="crm-stat-chip">
                  <strong>{GAME_LABELS_MAP[lead.gamePlayed] || lead.gamePlayed}</strong> ·{' '}
                  {lead.score} pts
                </span>
                <span className="crm-stat-chip">
                  <strong>{lead.totalGamesPlayed}</strong> games ({lead.gamesAfterInteraction} after
                  street)
                </span>
                <span className="crm-stat-chip">
                  <strong>{lead.inviteShares}</strong> shares ·{' '}
                  <strong>{lead.calendarAdds + lead.ticketDownloads}</strong> saved
                </span>
              </div>
              <div className="crm-copy-actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => void handleCopy(`+${lead.normalizedPhone}`, 'phone')}
                >
                  <CopyIcon size={13} />
                  <span>{copiedKind === 'phone' ? 'Copied Phone!' : 'Copy Phone'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => void handleCopy(lead.personalInviteUrl, 'link')}
                >
                  <CopyIcon size={13} />
                  <span>{copiedKind === 'link' ? 'Copied VIP Link!' : 'Copy VIP Link'}</span>
                </button>
              </div>
            </div>

            {/* Pastoral & Evangelism Remarks */}
            <div className="form-group crm-remarks-group">
              <div className="crm-label-row">
                <label htmlFor={`${uid}-notes`} className="form-label crm-label-with-icon">
                  <NoteEditIcon size={15} />
                  <span>Evangelism &amp; Pastoral Remarks</span>
                </label>
                <span className="crm-char-count" aria-live="off">
                  {notes.length} / 1000
                </span>
              </div>
              <span id={`${uid}-notes-hint`} className="field-hint">
                Tap quick tags or write personal context (language, family, prayer needs, transport
                for Celebration Service).
                {lead.notesUpdatedAt
                  ? ` Last updated ${formatShortTimestamp(lead.notesUpdatedAt)}.`
                  : ''}
              </span>

              <div className="quick-tag-row" role="group" aria-label="Quick remark tags">
                {QUICK_REMARK_TAGS.map((tag) => {
                  const active = hasQuickTagInNotes(notes, tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`quick-tag-chip${active ? ' quick-tag-chip--active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setNotes((curr) => toggleQuickTagInNotes(curr, tag))}
                    >
                      {active ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                ref={notesRef}
                id={`${uid}-notes`}
                maxLength={1000}
                rows={4}
                className="form-textarea crm-notes-textarea"
                aria-describedby={`${uid}-notes-hint`}
                placeholder="e.g. Met outside JB City Square with his wife Mei. Speaks Mandarin & English, keen to visit Dec 24 service, asked for Waze parking info..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* 5-Stage Follow-Up & Celebration RSVP Pipeline (Radio buttons per forms guide: < 6 choices) */}
            <fieldset className="crm-fieldset">
              <legend className="form-label">Follow-Up &amp; Celebration RSVP Stage</legend>
              <div className="rsvp-radio-grid">
                {FOLLOWUP_STAGE_OPTIONS.map((stage) => {
                  const checked = followUpStatus === stage.value;
                  return (
                    <label
                      key={stage.value}
                      className={`rsvp-radio-card rsvp-radio-card--${stage.tone}${
                        checked ? ' rsvp-radio-card--checked' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${uid}-followup-stage`}
                        value={stage.value}
                        checked={checked}
                        onChange={() => setFollowUpStatus(stage.value)}
                      />
                      <span className="rsvp-radio-card__title">{stage.label}</span>
                      <span className="rsvp-radio-card__desc">{stage.description}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Assigned Evangelist & Gift Status */}
            <div className="crm-two-col">
              <div className="form-group" style={{ marginBlockEnd: 0 }}>
                <label htmlFor={`${uid}-evangelist`} className="form-label">
                  Assigned Evangelist / Follow-Up IC
                </label>
                <input
                  id={`${uid}-evangelist`}
                  type="text"
                  list={`${uid}-vol-list`}
                  maxLength={40}
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  className="form-input"
                  placeholder="e.g. Andrew"
                  value={volunteerName}
                  onChange={(e) => setVolunteerName(e.target.value)}
                />
                <datalist id={`${uid}-vol-list`}>
                  {volunteerSuggestions.map((vol) => (
                    <option key={vol} value={vol} />
                  ))}
                </datalist>
              </div>

              <div className="crm-gift-box">
                <span className="form-label">Street Blessing Gift</span>
                <button
                  type="button"
                  className={`btn btn--sm btn--full ${giftClaimed ? 'btn--gold' : 'btn--ghost'}`}
                  aria-pressed={giftClaimed}
                  onClick={() => setGiftClaimed((g) => !g)}
                >
                  {giftClaimed ? <CheckCircleIcon size={16} /> : <GiftBoxIcon size={16} />}
                  <span>{giftClaimed ? 'Physical Gift Handed Out' : 'Mark Gift Handed Out'}</span>
                </button>
              </div>
            </div>

            {/* 2-Stage Direct WhatsApp Outreach Links */}
            <div className="crm-outreach-strip">
              <a
                href={lead.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--whatsapp btn--sm"
                onClick={() => handleQuickWhatsappClick(true)}
              >
                <WhatsAppIcon size={16} />
                <span>1st WhatsApp Invite</span>
              </a>
              <a
                href={lead.reminderWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--ghost btn--sm"
                onClick={() => handleQuickWhatsappClick(false)}
              >
                <BellReminderIcon size={15} />
                <span>Service Reminder WhatsApp</span>
              </a>
            </div>

            {saveError && (
              <div role="alert" className="form-alert" style={{ marginBlockEnd: 0 }}>
                {saveError}
              </div>
            )}
          </div>

          <footer className="crm-dialog__footer">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save Remarks & Status'}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}

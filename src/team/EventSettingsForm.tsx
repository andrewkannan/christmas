import { useId, useState } from 'react';
import {
  DEFAULT_CAMPAIGN_TARGETS,
  type CampaignTargets,
  type EventSettings,
} from '../types.ts';
import { saveTeamEventSettings } from '../lib/api.ts';
import {
  BellReminderIcon,
  CheckCircleIcon,
  ReplayIcon,
  SlidersIcon,
  TargetGoalIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import { DEFAULT_REMINDER_TEMPLATE_CLIENT } from './teamHelpers.ts';

interface EventSettingsFormProps {
  initialSettings: EventSettings;
  readOnly?: boolean;
  onSaved: (updated: EventSettings) => void;
}

export function EventSettingsForm({
  initialSettings,
  readOnly = false,
  onSaved,
}: EventSettingsFormProps) {
  const uid = useId();
  const [form, setForm] = useState<EventSettings>(() => ({
    ...initialSettings,
    reminderTemplate:
      initialSettings.reminderTemplate?.trim() || DEFAULT_REMINDER_TEMPLATE_CLIENT,
    campaignTargets: {
      ...DEFAULT_CAMPAIGN_TARGETS,
      ...(initialSettings.campaignTargets ?? {}),
    },
  }));
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const targets: CampaignTargets = {
    ...DEFAULT_CAMPAIGN_TARGETS,
    ...(form.campaignTargets ?? {}),
  };

  const setTargetField = (key: keyof CampaignTargets, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    const num = cleaned === '' ? 1 : Math.min(1_000_000, Math.max(1, Number(cleaned)));
    setForm({
      ...form,
      campaignTargets: {
        ...targets,
        [key]: num,
      },
    });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await saveTeamEventSettings(form);
      onSaved(res.settings);
      setStatusMsg({
        kind: 'ok',
        text: 'Campaign targets, event details & WhatsApp templates updated live!',
      });
    } catch (err) {
      setStatusMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form method="post" onSubmit={handleSave} className="settings-stack">
      {readOnly && (
        <div className="card-panel team-readonly-note">
          <SlidersIcon size={18} />
          <div>
            <strong>View-Only Campaign Settings</strong>
            <p className="subtle-text" style={{ margin: '0.18rem 0 0' }}>
              Team Leaders / Admins can update campaign targets, celebration service details, and
              WhatsApp templates.
            </p>
          </div>
        </div>
      )}
      {/* 1. Evangelism Campaign Targets */}
      <section className="card-panel settings-fieldset" aria-labelledby={`${uid}-sec-targets`}>
        <div className="settings-fieldset__header">
          <div>
            <h2 id={`${uid}-sec-targets`} className="section-title settings-legend">
              <TargetGoalIcon size={18} />
              <span>Evangelism Campaign Targets</span>
            </h2>
            <p className="subtle-text" style={{ marginBlockStart: '0.25rem' }}>
              Tracks live completion % and remaining goals across Mission Control and the
              Conversion Funnel.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={() =>
              setForm({
                ...form,
                campaignTargets: { ...DEFAULT_CAMPAIGN_TARGETS },
              })
            }
          >
            <ReplayIcon size={13} />
            <span>Reset Defaults (1500 / 500 / 100)</span>
          </button>
        </div>

        <div className="targets-form-grid">
          <div className="form-group">
            <label htmlFor={`${uid}-t-views`} className="form-label">
              Total QR Scans &amp; Page Views
            </label>
            <input
              id={`${uid}-t-views`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              required
              className="form-input"
              value={String(targets.pageViews)}
              onChange={(e) => setTargetField('pageViews', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-t-games`} className="form-label">
              Games Started
            </label>
            <input
              id={`${uid}-t-games`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              required
              className="form-input"
              value={String(targets.gamesStarted)}
              onChange={(e) => setTargetField('gamesStarted', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-t-leads`} className="form-label">
              Registered Contacts (Name + Phone)
            </label>
            <input
              id={`${uid}-t-leads`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              required
              className="form-input"
              value={String(targets.leads)}
              onChange={(e) => setTargetField('leads', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-t-gifts`} className="form-label">
              Physical Gifts Handed Out
            </label>
            <input
              id={`${uid}-t-gifts`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              required
              className="form-input"
              value={String(targets.giftsHandedOut)}
              onChange={(e) => setTargetField('giftsHandedOut', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-t-after`} className="form-label">
              Games Played AFTER Street Interaction
            </label>
            <input
              id={`${uid}-t-after`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              required
              className="form-input"
              value={String(targets.gamesAfter)}
              onChange={(e) => setTargetField('gamesAfter', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-t-viral`} className="form-label">
              Shared Invites + Saved Tickets + Calendar Adds
            </label>
            <input
              id={`${uid}-t-viral`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              required
              className="form-input"
              value={String(targets.viralActions)}
              onChange={(e) => setTargetField('viralActions', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* 2. Celebration Service & VIP Invitation Settings */}
      <section className="card-panel settings-fieldset" aria-labelledby={`${uid}-sec-service`}>
        <h2
          id={`${uid}-sec-service`}
          className="section-title settings-legend"
          style={{ marginBlockEnd: '0.25rem' }}
        >
          <SlidersIcon size={18} />
          <span>Celebration Service &amp; VIP Invitation Details</span>
        </h2>
        <p className="subtle-text" style={{ marginBlockEnd: '1.1rem' }}>
          Updates the player VIP Pass, countdown timer, Google/.ics Calendar invite, and
          Maps/Waze links immediately.
        </p>

        <div className="settings-two-col">
          <div className="form-group">
            <label htmlFor={`${uid}-church`} className="form-label">
              Church / Ministry Name
            </label>
            <input
              id={`${uid}-church`}
              type="text"
              required
              maxLength={80}
              className="form-input"
              value={form.churchName}
              onChange={(e) => setForm({ ...form, churchName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-gift`} className="form-label">
              Street Physical Gift Name
            </label>
            <input
              id={`${uid}-gift`}
              type="text"
              required
              maxLength={100}
              className="form-input"
              value={form.giftDescription}
              onChange={(e) => setForm({ ...form, giftDescription: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`${uid}-title`} className="form-label">
            Christmas Celebration Event Title
          </label>
          <input
            id={`${uid}-title`}
            type="text"
            required
            maxLength={100}
            className="form-input"
            value={form.eventTitle}
            onChange={(e) => setForm({ ...form, eventTitle: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor={`${uid}-sub`} className="form-label">
            Event Tagline / Highlights
          </label>
          <input
            id={`${uid}-sub`}
            type="text"
            maxLength={180}
            className="form-input"
            value={form.eventSubtitle}
            onChange={(e) => setForm({ ...form, eventSubtitle: e.target.value })}
          />
        </div>

        <div className="settings-three-col">
          <div className="form-group">
            <label htmlFor={`${uid}-dt`} className="form-label">
              Event Date &amp; Start Time
            </label>
            <input
              id={`${uid}-dt`}
              type="datetime-local"
              required
              className="form-input"
              value={form.eventDateIso}
              onChange={(e) => setForm({ ...form, eventDateIso: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-tz`} className="form-label">
              Timezone Offset
            </label>
            <input
              id={`${uid}-tz`}
              type="text"
              required
              autoCorrect="off"
              spellCheck={false}
              pattern="[+\-]\d{2}:\d{2}"
              placeholder="+08:00"
              className="form-input"
              value={form.timezoneOffset}
              onChange={(e) => setForm({ ...form, timezoneOffset: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-cc`} className="form-label">
              Default Country Code
            </label>
            <input
              id={`${uid}-cc`}
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              required
              pattern="\d{1,4}"
              placeholder="60"
              className="form-input"
              value={form.defaultCountryCode}
              onChange={(e) =>
                setForm({ ...form, defaultCountryCode: e.target.value.replace(/\D/g, '') })
              }
            />
          </div>
        </div>

        <div className="settings-two-col">
          <div className="form-group">
            <label htmlFor={`${uid}-venue`} className="form-label">
              Venue Name
            </label>
            <input
              id={`${uid}-venue`}
              type="text"
              required
              maxLength={120}
              className="form-input"
              value={form.venueName}
              onChange={(e) => setForm({ ...form, venueName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-addr`} className="form-label">
              Street Address / Landmark
            </label>
            <input
              id={`${uid}-addr`}
              type="text"
              maxLength={200}
              className="form-input"
              value={form.venueAddress}
              onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
            />
          </div>
        </div>

        <div className="settings-two-col">
          <div className="form-group">
            <label htmlFor={`${uid}-maps`} className="form-label">
              Google Maps Link (Optional)
            </label>
            <input
              id={`${uid}-maps`}
              type="url"
              maxLength={300}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Auto-generated from Venue if blank"
              className="form-input"
              value={form.mapsUrl}
              onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${uid}-waze`} className="form-label">
              Waze Link (Optional)
            </label>
            <input
              id={`${uid}-waze`}
              type="url"
              maxLength={300}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Auto-generated from Venue if blank"
              className="form-input"
              value={form.wazeUrl ?? ''}
              onChange={(e) => setForm({ ...form, wazeUrl: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* 3. Two-Stage Evangelism WhatsApp Templates */}
      <section className="card-panel settings-fieldset" aria-labelledby={`${uid}-sec-wa`}>
        <h2
          id={`${uid}-sec-wa`}
          className="section-title settings-legend"
          style={{ marginBlockEnd: '0.25rem' }}
        >
          <WhatsAppIcon size={18} />
          <span>1-Tap Evangelism &amp; Service Reminder WhatsApp Templates</span>
        </h2>
        <p className="subtle-text" style={{ marginBlockEnd: '1rem' }}>
          Available placeholders: <code>{'{name}'}</code>, <code>{'{volunteer}'}</code>,{' '}
          <code>{'{churchName}'}</code>, <code>{'{eventTitle}'}</code>,{' '}
          <code>{'{eventDate}'}</code>, <code>{'{venueName}'}</code>,{' '}
          <code>{'{venueAddress}'}</code>, <code>{'{inviteUrl}'}</code>.
        </p>

        <div className="form-group">
          <label htmlFor={`${uid}-wa`} className="form-label crm-label-with-icon">
            <WhatsAppIcon size={15} />
            <span>Stage 1: Street Follow-Up &amp; VIP Invite Message</span>
          </label>
          <span id={`${uid}-wa-hint`} className="field-hint">
            Opened when an evangelist taps &ldquo;WhatsApp Invite&rdquo; right after meeting a
            guest.
          </span>
          <textarea
            id={`${uid}-wa`}
            required
            maxLength={1000}
            className="form-textarea"
            aria-describedby={`${uid}-wa-hint`}
            value={form.whatsappTemplate}
            onChange={(e) => setForm({ ...form, whatsappTemplate: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ marginBlockEnd: 0 }}>
          <label htmlFor={`${uid}-rem`} className="form-label crm-label-with-icon">
            <BellReminderIcon size={15} />
            <span>Stage 2: Pre-Service Friendly Reminder Message</span>
          </label>
          <span id={`${uid}-rem-hint`} className="field-hint">
            Opened when tapping &ldquo;Reminder&rdquo; 1–2 days before Celebration Service to
            confirm attendance.
          </span>
          <textarea
            id={`${uid}-rem`}
            maxLength={1000}
            className="form-textarea"
            aria-describedby={`${uid}-rem-hint`}
            value={form.reminderTemplate ?? ''}
            onChange={(e) => setForm({ ...form, reminderTemplate: e.target.value })}
          />
        </div>
      </section>

      {statusMsg && (
        <div
          role={statusMsg.kind === 'err' ? 'alert' : 'status'}
          aria-live="polite"
          className={statusMsg.kind === 'ok' ? 'settings-toast settings-toast--ok' : 'form-alert'}
        >
          {statusMsg.kind === 'ok' && <CheckCircleIcon size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {!readOnly && (
        <div className="settings-save-bar">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving Settings…' : 'Save Targets & Live Event Settings'}
          </button>
        </div>
      )}
    </form>
  );
}

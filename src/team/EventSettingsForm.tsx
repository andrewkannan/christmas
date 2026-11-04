import { useId, useState } from 'react';
import type { EventSettings } from '../types.ts';
import { saveTeamEventSettings } from '../lib/api.ts';

interface EventSettingsFormProps {
  initialSettings: EventSettings;
  onSaved: (updated: EventSettings) => void;
}

export function EventSettingsForm({ initialSettings, onSaved }: EventSettingsFormProps) {
  const uid = useId();
  const [form, setForm] = useState<EventSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await saveTeamEventSettings(form);
      onSaved(res.settings);
      setStatusMsg({
        kind: 'ok',
        text: '✓ Event invitation & WhatsApp template updated live!',
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
    <section className="card-panel" aria-labelledby={`${uid}-settings-heading`}>
      <h2 id={`${uid}-settings-heading`} className="section-title">
        ✨ Christmas Event &amp; Invite Settings
      </h2>
      <p className="subtle-text" style={{ marginBlock: '0.35rem 1.2rem' }}>
        Changes update the player E-Ticket, Google/.ics Calendar invite, and 1-tap WhatsApp
        follow-up template immediately.
      </p>

      <form method="post" onSubmit={handleSave}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
            gap: '0 1rem',
          }}
        >
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
              Physical Gift Name
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
            Christmas Event Title
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
            gap: '0 1rem',
          }}
        >
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
            gap: '0 1rem',
          }}
        >
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
            gap: '0 1rem',
          }}
        >
          <div className="form-group">
            <label htmlFor={`${uid}-maps`} className="form-label">
              Google Maps Link (Optional)
            </label>
            <input
              id={`${uid}-maps`}
              type="url"
              maxLength={300}
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
              placeholder="Auto-generated from Venue if blank"
              className="form-input"
              value={form.wazeUrl ?? ''}
              onChange={(e) => setForm({ ...form, wazeUrl: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`${uid}-wa`} className="form-label">
            1-Tap Volunteer WhatsApp Template
          </label>
          <span id={`${uid}-wa-hint`} className="field-hint">
            Placeholders: {'{name}'}, {'{volunteer}'}, {'{eventTitle}'}, {'{eventDate}'},{' '}
            {'{venueName}'}, {'{venueAddress}'}.
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

        {statusMsg && (
          <div
            role={statusMsg.kind === 'err' ? 'alert' : 'status'}
            aria-live="polite"
            style={{
              marginBlockEnd: '1rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: statusMsg.kind === 'ok' ? 'rgba(31, 163, 104, 0.2)' : 'var(--danger-bg)',
              border: `1px solid ${statusMsg.kind === 'ok' ? 'var(--accent-emerald-bright)' : 'var(--danger-border)'}`,
              fontWeight: 600,
            }}
          >
            {statusMsg.text}
          </div>
        )}

        <button type="submit" className="btn btn--gold" disabled={saving}>
          {saving ? 'Saving Settings…' : 'Save Live Event Settings'}
        </button>
      </form>
    </section>
  );
}

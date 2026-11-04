import type { EventSettings } from '../src/types.ts';

function toUtcCalendarStamp(localIso: string, timezoneOffset: string, addMinutes = 0): string {
  const normalizedOffset = /^[+-]\d{2}:\d{2}$/.test(timezoneOffset) ? timezoneOffset : '+08:00';
  const isoWithTz = `${localIso.slice(0, 16)}:00${normalizedOffset}`;
  const parsed = new Date(isoWithTz);
  const baseMs = Number.isNaN(parsed.getTime())
    ? Date.UTC(2026, 11, 24, 11, 30, 0)
    : parsed.getTime();
  const target = new Date(baseMs + addMinutes * 60_000);

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${target.getUTCFullYear()}` +
    `${pad(target.getUTCMonth() + 1)}` +
    `${pad(target.getUTCDate())}T` +
    `${pad(target.getUTCHours())}` +
    `${pad(target.getUTCMinutes())}` +
    `${pad(target.getUTCSeconds())}Z`
  );
}

function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildIcsContent(settings: EventSettings, publicUrl: string): string {
  const dtStart = toUtcCalendarStamp(settings.eventDateIso, settings.timezoneOffset, 0);
  const dtEnd = toUtcCalendarStamp(
    settings.eventDateIso,
    settings.timezoneOffset,
    settings.durationMinutes || 120
  );
  const dtStamp = toUtcCalendarStamp(new Date().toISOString().slice(0, 16), '+00:00', 0);

  const location = [settings.venueName, settings.venueAddress].filter(Boolean).join(', ');
  const descriptionParts = [
    `${settings.eventTitle} — Hosted by ${settings.churchName}`,
    settings.eventSubtitle,
    settings.mapsUrl ? `Directions: ${settings.mapsUrl}` : '',
    publicUrl ? `Event Page: ${publicUrl}` : '',
  ].filter(Boolean);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Christmas Pocket Arcade//Evangelism Invite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:christmas-invite-${dtStart}@pocketarcade.local`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(`${settings.eventTitle} (${settings.churchName})`)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`,
    `LOCATION:${escapeIcsText(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}

export function buildGoogleCalendarUrl(settings: EventSettings): string {
  const dtStart = toUtcCalendarStamp(settings.eventDateIso, settings.timezoneOffset, 0);
  const dtEnd = toUtcCalendarStamp(
    settings.eventDateIso,
    settings.timezoneOffset,
    settings.durationMinutes || 120
  );
  const location = [settings.venueName, settings.venueAddress].filter(Boolean).join(', ');
  const details = [
    `${settings.eventSubtitle}`,
    `Hosted by ${settings.churchName}`,
    settings.mapsUrl ? `Map: ${settings.mapsUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', `${settings.eventTitle} — ${settings.churchName}`);
  url.searchParams.set('dates', `${dtStart}/${dtEnd}`);
  url.searchParams.set('details', details);
  url.searchParams.set('location', location);
  return url.toString();
}

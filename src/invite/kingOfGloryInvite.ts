/**
 * Single source of truth for the "Jesus, the King of Glory" physical invitation card
 * (Canva design) — used by the /register guest sign-up page AND by the server when it
 * builds the guest's WhatsApp confirmation message, so both always show identical details.
 *
 * ⚠️ Edit event / venue / arrival-guide copy HERE only.
 */

export interface ArrivalGuideStep {
  title: string;
  detail: string;
}

export const KING_OF_GLORY_INVITE = {
  churchShortName: 'CCCJB Bilingual',
  churchFullName: 'Calvary Community Church',
  tagline: 'A Bilingual Christmas Celebration',
  title: 'Jesus, the King of Glory',
  verse: {
    text: 'Who is this King of glory? The Lord of hosts, He is the King of glory. Selah.',
    reference: 'Psalms 24:10',
  },

  /** ISO-8601 start with explicit Malaysia offset so calendars convert correctly. */
  startIso: '2026-12-24T19:30:00+08:00',
  durationMinutes: 120,
  dateLabel: 'Thursday, 24 December 2026',
  cardDateLabel: '24th December',
  shortDateLabel: 'Thu, 24 Dec',
  timeLabel: '7:30 PM',
  arriveByLabel: '7:15 PM',

  venue: {
    building: 'Menara Zurich',
    floor: 'Level 8',
    room: 'Auditorium 3',
    street: '15, Jalan Dato Abdullah Tahir',
    area: 'Taman Abad, 80300 Johor Bahru, Johor',
    /** OpenStreetMap building centroid for Menara Zurich (way 369332662). */
    lat: 1.4795313,
    lng: 103.7593321,
  },

  maxSeatsPerRegistration: 20,
} as const;

export const VENUE_FULL_LABEL = `${KING_OF_GLORY_INVITE.venue.building}, ${KING_OF_GLORY_INVITE.venue.floor} (${KING_OF_GLORY_INVITE.venue.room})`;

export const VENUE_ADDRESS_LABEL = `${KING_OF_GLORY_INVITE.venue.street}, ${KING_OF_GLORY_INVITE.venue.area}`;

const NAV_QUERY = `${KING_OF_GLORY_INVITE.venue.building}, Jalan Dato Abdullah Tahir, Johor Bahru`;

/** Turn-by-turn directions links (open the native app on mobile when installed). */
export const VENUE_NAV_LINKS = {
  googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(NAV_QUERY)}&travelmode=driving`,
  waze: `https://waze.com/ul?ll=${KING_OF_GLORY_INVITE.venue.lat},${KING_OF_GLORY_INVITE.venue.lng}&navigate=yes&zoom=17`,
  appleMaps: `https://maps.apple.com/?daddr=${KING_OF_GLORY_INVITE.venue.lat},${KING_OF_GLORY_INVITE.venue.lng}&q=${encodeURIComponent(KING_OF_GLORY_INVITE.venue.building)}`,
} as const;

export interface MapCamera {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface ArrivalStop extends ArrivalGuideStep {
  id: 'area' | 'tower' | 'arrive' | 'level8';
  label: string;
  camera: MapCamera;
}

export interface Landmark {
  name: string;
  lng: number;
  lat: number;
}

const VENUE_CENTER: [number, number] = [KING_OF_GLORY_INVITE.venue.lng, KING_OF_GLORY_INVITE.venue.lat];

/** Menara Zurich building outline from OpenStreetMap (way 369332662), [lng, lat]. */
export const VENUE_FOOTPRINT: ReadonlyArray<[number, number]> = [
  [103.7593156, 1.4797011],
  [103.7597384, 1.4795529],
  [103.7596348, 1.4792573],
  [103.7595022, 1.4793038],
  [103.7594986, 1.4792935],
  [103.7593582, 1.4793427],
  [103.759363, 1.4793565],
  [103.7592132, 1.479409],
  [103.7589257, 1.4795097],
  [103.7590281, 1.4798018],
  [103.7593156, 1.4797011],
];

/** Well-known places nearby (OpenStreetMap) so guests can orient themselves on the map. */
export const NEARBY_LANDMARKS: readonly Landmark[] = [
  { name: 'KSL City Mall', lng: 103.7623222, lat: 1.4853626 },
  { name: 'Grand Paragon Hotel', lng: 103.7614847, lat: 1.4817995 },
  { name: 'DNP Plaza', lng: 103.7573941, lat: 1.4788761 },
];

/**
 * Guided arrival tour shown after a guest registers. Each stop flies the map to a camera.
 * Keep each step short — guests read this on their phone in the car park.
 */
export const ARRIVAL_TOUR: readonly ArrivalStop[] = [
  {
    id: 'area',
    label: 'The area',
    title: 'Head to Jalan Dato Abdullah Tahir',
    detail:
      'Menara Zurich is in Taman Abad, Johor Bahru — less than 1 km from KSL City Mall. Tap Google Maps or Waze for turn-by-turn directions.',
    camera: { center: [103.7607, 1.4823], zoom: 14.6, pitch: 25, bearing: 0 },
  },
  {
    id: 'tower',
    label: 'The tower',
    title: 'Look for the gold tower',
    detail:
      'On this map Menara Zurich is lit up in gold. It sits on Jalan Dato Abdullah Tahir, just along the road from DNP Plaza.',
    camera: { center: VENUE_CENTER, zoom: 16.4, pitch: 55, bearing: -20 },
  },
  {
    id: 'arrive',
    label: 'Parking',
    title: 'Park or get dropped off',
    detail:
      'Driving? Use the Menara Zurich car park in the building (parking charges may apply). Taking Grab? Set your drop-off to “Menara Zurich” and get off at the main lobby.',
    camera: { center: VENUE_CENTER, zoom: 17.4, pitch: 62, bearing: 35 },
  },
  {
    id: 'level8',
    label: 'Level 8',
    title: `Lift up to ${KING_OF_GLORY_INVITE.venue.floor}, ${KING_OF_GLORY_INVITE.venue.room}`,
    detail: `From the lobby, take the lift to ${KING_OF_GLORY_INVITE.venue.floor} and follow the Christmas signs to ${KING_OF_GLORY_INVITE.venue.room}. Our welcome team will meet you there — please arrive by ${KING_OF_GLORY_INVITE.arriveByLabel}.`,
    camera: { center: VENUE_CENTER, zoom: 18, pitch: 70, bearing: 80 },
  },
];

function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function getEventStartEnd(): { start: Date; end: Date } {
  const start = new Date(KING_OF_GLORY_INVITE.startIso);
  const end = new Date(start.getTime() + KING_OF_GLORY_INVITE.durationMinutes * 60_000);
  return { start, end };
}

export function buildInviteGoogleCalendarUrl(): string {
  const { start, end } = getEventStartEnd();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${KING_OF_GLORY_INVITE.title} — ${KING_OF_GLORY_INVITE.tagline}`,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    location: `${VENUE_FULL_LABEL}, ${VENUE_ADDRESS_LABEL}`,
    details: `${KING_OF_GLORY_INVITE.churchShortName} · ${KING_OF_GLORY_INVITE.churchFullName}\nTake the lift to ${KING_OF_GLORY_INVITE.venue.floor}, ${KING_OF_GLORY_INVITE.venue.room}.\nDirections: ${VENUE_NAV_LINKS.googleMaps}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 calendar file content for Apple Calendar / Outlook. */
export function buildInviteIcsContent(confirmationCode: string, nowMs = Date.now()): string {
  const { start, end } = getEventStartEnd();
  const uid = `${confirmationCode.toLowerCase()}-king-of-glory@cccjb-bilingual`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CCCJB Bilingual//King of Glory Christmas//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(new Date(nowMs))}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(`${KING_OF_GLORY_INVITE.title} — ${KING_OF_GLORY_INVITE.tagline}`)}`,
    `LOCATION:${escapeIcsText(`${VENUE_FULL_LABEL}, ${VENUE_ADDRESS_LABEL}`)}`,
    `DESCRIPTION:${escapeIcsText(
      `Confirmation code: ${confirmationCode}\nTake the lift to ${KING_OF_GLORY_INVITE.venue.floor}, ${KING_OF_GLORY_INVITE.venue.room}.\nDirections: ${VENUE_NAV_LINKS.googleMaps}`
    )}`,
    `GEO:${KING_OF_GLORY_INVITE.venue.lat};${KING_OF_GLORY_INVITE.venue.lng}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`${KING_OF_GLORY_INVITE.title} starts at ${KING_OF_GLORY_INVITE.timeLabel}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** WhatsApp confirmation text the church team can send to a guest who signed up. */
export function buildGuestConfirmationMessage(args: {
  guestName: string;
  seats: number;
  confirmationCode: string;
}): string {
  const seatsLabel = args.seats === 1 ? '1 seat' : `${args.seats} seats`;
  return (
    `Hi ${args.guestName}! 🎄\n\n` +
    `Thank you for registering for *${KING_OF_GLORY_INVITE.title}* — ${KING_OF_GLORY_INVITE.tagline} by ${KING_OF_GLORY_INVITE.churchShortName}.\n\n` +
    `🎟️ *Reserved:* ${seatsLabel}\n` +
    `🔖 *Confirmation code:* ${args.confirmationCode}\n` +
    `📅 *When:* ${KING_OF_GLORY_INVITE.dateLabel}, ${KING_OF_GLORY_INVITE.timeLabel}\n` +
    `📍 *Where:* ${VENUE_FULL_LABEL}\n${VENUE_ADDRESS_LABEL}\n\n` +
    `🗺️ Directions: ${VENUE_NAV_LINKS.googleMaps}\n\n` +
    `Take the lift to ${KING_OF_GLORY_INVITE.venue.floor} and follow the signs to ${KING_OF_GLORY_INVITE.venue.room}. See you there!`
  );
}

import type { EventSettings } from '../src/types.ts';

export interface PhoneValidationResult {
  valid: boolean;
  normalizedPhone: string;
  error?: string;
}

/**
 * Normalizes local or international mobile numbers into clean E.164 digits (without '+')
 * suitable for https://wa.me/<digits>.
 */
export function normalizePhoneForWhatsApp(
  rawPhone: string,
  countryCodeInput: string
): PhoneValidationResult {
  const trimmed = rawPhone.trim();
  const cleanCountry = countryCodeInput.replace(/\D/g, '') || '60';

  if (!trimmed) {
    return { valid: false, normalizedPhone: '', error: 'Please enter your mobile number.' };
  }

  const hasExplicitPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      normalizedPhone: '',
      error: 'Please enter a valid mobile number (7 to 15 digits).',
    };
  }

  // Reject all-identical dummy digits like 00000000 or 11111111
  if (/^(\d)\1{6,}$/.test(digits)) {
    return {
      valid: false,
      normalizedPhone: '',
      error: 'Please enter a real mobile number so you can receive your e-invitation.',
    };
  }

  if (hasExplicitPlus) {
    if (digits.startsWith(`${cleanCountry}0`)) {
      digits = cleanCountry + digits.slice(cleanCountry.length + 1);
    }
    return { valid: true, normalizedPhone: digits };
  }

  if (digits.startsWith('00') && digits.length > 9) {
    return { valid: true, normalizedPhone: digits.slice(2) };
  }

  if (digits.startsWith('0')) {
    digits = cleanCountry + digits.slice(1);
  } else if (!digits.startsWith(cleanCountry) || digits.length <= 9) {
    digits = cleanCountry + digits;
  }

  if (digits.length < 8 || digits.length > 15) {
    return {
      valid: false,
      normalizedPhone: '',
      error: 'Please check your mobile number digits.',
    };
  }

  return { valid: true, normalizedPhone: digits };
}

export function formatReadableEventDate(eventDateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(eventDateIso);
  if (!match) return eventDateIso;
  const [, year, month, day, hourStr, minStr] = match;
  const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const hour24 = Number(hourStr);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${weekday}, ${Number(day)} ${monthName} ${year} · ${hour12}:${minStr} ${period}`;
}

export const DEFAULT_REMINDER_TEMPLATE =
  'Hi {name}! 🎄 Friendly reminder from {volunteer} ({churchName}) — our *{eventTitle}* Celebration Service is coming up!\n\n📅 {eventDate}\n📍 {venueName} ({venueAddress})\n\n🎟 Your VIP Invitation & directions: {inviteUrl}\n\nLet me know if you are coming with friends or need directions—see you there! ✨';

export function buildPersonalPassUrl(publicBaseUrl: string, claimToken?: string): string {
  return claimToken
    ? `${publicBaseUrl.replace(/\/+$/, '')}/?pass=${encodeURIComponent(claimToken)}`
    : publicBaseUrl;
}

function renderWhatsAppTemplate(
  template: string,
  params: {
    guestName: string;
    volunteerName: string;
    claimToken?: string;
    settings: EventSettings;
    publicBaseUrl: string;
  }
): string {
  const { guestName, volunteerName, claimToken, settings, publicBaseUrl } = params;
  const firstName = guestName.trim().split(/\s+/)[0] || guestName.trim();
  const volunteerText = volunteerName.trim() || settings.churchName;
  const formattedDate = formatReadableEventDate(settings.eventDateIso);
  const personalUrl = buildPersonalPassUrl(publicBaseUrl, claimToken);

  return template
    .replaceAll('{name}', firstName)
    .replaceAll('{volunteer}', volunteerText)
    .replaceAll('{churchName}', settings.churchName)
    .replaceAll('{eventTitle}', settings.eventTitle)
    .replaceAll('{eventDate}', formattedDate)
    .replaceAll('{venueName}', settings.venueName)
    .replaceAll('{venueAddress}', settings.venueAddress)
    .replaceAll('{mapsUrl}', settings.mapsUrl || '')
    .replaceAll('{inviteUrl}', personalUrl)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildPersonalWhatsAppUrl(params: {
  normalizedPhone: string;
  guestName: string;
  volunteerName: string;
  claimToken?: string;
  settings: EventSettings;
  publicBaseUrl: string;
}): string {
  const message = renderWhatsAppTemplate(params.settings.whatsappTemplate, params);
  return `https://wa.me/${params.normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildReminderWhatsAppUrl(params: {
  normalizedPhone: string;
  guestName: string;
  volunteerName: string;
  claimToken?: string;
  settings: EventSettings;
  publicBaseUrl: string;
}): string {
  const tpl = params.settings.reminderTemplate?.trim() || DEFAULT_REMINDER_TEMPLATE;
  const message = renderWhatsAppTemplate(tpl, params);
  return `https://wa.me/${params.normalizedPhone}?text=${encodeURIComponent(message)}`;
}

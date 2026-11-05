import type { FollowUpStatus, TeamLeadRecord } from '../types.ts';

export type LeadEngagementTier = 'hot' | 'warm' | 'street';

export type ContactQuickFilter =
  | 'all'
  | 'needs_gift'
  | 'needs_whatsapp'
  | 'hot'
  | 'with_remarks'
  | 'confirmed';

export type ContactSortBy = 'newest' | 'hot_first' | 'recent_activity' | 'highest_score';

export interface FollowUpStageOption {
  value: FollowUpStatus;
  label: string;
  shortLabel: string;
  description: string;
  tone: 'neutral' | 'blue' | 'gold' | 'emerald' | 'muted';
}

export const FOLLOWUP_STAGE_OPTIONS: readonly FollowUpStageOption[] = [
  {
    value: 'new',
    label: 'New Contact',
    shortLabel: 'New',
    description: 'Met on street — awaiting 1st WhatsApp',
    tone: 'neutral',
  },
  {
    value: 'contacted',
    label: 'WhatsApp Sent',
    shortLabel: 'Texted',
    description: 'Personal e-invitation sent on WhatsApp',
    tone: 'blue',
  },
  {
    value: 'replied',
    label: 'Replied · Warm',
    shortLabel: 'Replied',
    description: 'Guest responded & chatting with team',
    tone: 'gold',
  },
  {
    value: 'confirmed',
    label: 'Confirmed Coming',
    shortLabel: 'Confirmed RSVP',
    description: 'Planning to attend Celebration Service',
    tone: 'emerald',
  },
  {
    value: 'not_free',
    label: 'Keep in Touch',
    shortLabel: 'Next Event',
    description: 'Away this date — invite to future gathering',
    tone: 'muted',
  },
] as const;

export function getFollowUpStageMeta(status: FollowUpStatus | undefined): FollowUpStageOption {
  return (
    FOLLOWUP_STAGE_OPTIONS.find((opt) => opt.value === status) ?? FOLLOWUP_STAGE_OPTIONS[0]
  );
}

export const QUICK_REMARK_TAGS: readonly string[] = [
  'Coming with family',
  'Interested in service',
  'Needs transport / ride',
  'Mandarin / Bilingual',
  'Youth / Student',
  'Prayer request',
  'Follow up Dec 23',
] as const;

export function hasQuickTagInNotes(notes: string, tag: string): boolean {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\n|·|,|;)\\s*${escaped}(\\s*($|\\n|·|,|;))`, 'i').test(notes);
}

export function toggleQuickTagInNotes(currentNotes: string, tag: string): string {
  const trimmed = currentNotes.trim();
  if (!trimmed) return tag;

  if (hasQuickTagInNotes(trimmed, tag)) {
    const parts = trimmed
      .split(/\s*·\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.toLowerCase() !== tag.toLowerCase());
    return parts.join(' · ');
  }

  const next = `${trimmed} · ${tag}`;
  return next.slice(0, 1000);
}

export function getLeadEngagementTier(
  lead: Pick<
    TeamLeadRecord,
    | 'calendarAdds'
    | 'inviteShares'
    | 'gamesAfterInteraction'
    | 'ticketDownloads'
    | 'eInviteViews'
  >
): LeadEngagementTier {
  if (
    lead.calendarAdds > 0 ||
    lead.inviteShares > 0 ||
    lead.gamesAfterInteraction >= 2
  ) {
    return 'hot';
  }
  if (
    lead.gamesAfterInteraction === 1 ||
    lead.ticketDownloads > 0 ||
    lead.eInviteViews > 1
  ) {
    return 'warm';
  }
  return 'street';
}

export function getLeadEngagementScore(lead: TeamLeadRecord): number {
  return (
    (lead.followUpStatus === 'confirmed' ? 25 : 0) +
    (lead.followUpStatus === 'replied' ? 15 : 0) +
    lead.calendarAdds * 18 +
    lead.inviteShares * 16 +
    lead.gamesAfterInteraction * 10 +
    lead.ticketDownloads * 8 +
    Math.max(0, lead.eInviteViews - 1) * 4 +
    lead.totalGamesPlayed * 2
  );
}

export interface TargetMetricSummary {
  current: number;
  target: number;
  pct: number;
  clampedValue: number;
  remaining: number;
  isMet: boolean;
  statusLabel: string;
}

export function computeTargetMetric(current: number, rawTarget: number): TargetMetricSummary {
  const target = Math.max(1, Math.round(rawTarget || 1));
  const safeCurrent = Math.max(0, Math.round(current || 0));
  const pct = Math.round((safeCurrent / target) * 100);
  const clampedValue = Math.min(safeCurrent, target);
  const remaining = Math.max(0, target - safeCurrent);
  const isMet = safeCurrent >= target;
  const statusLabel = isMet
    ? safeCurrent > target
      ? `Target Met (+${(safeCurrent - target).toLocaleString()})`
      : 'Target Reached'
    : `${remaining.toLocaleString()} to go`;

  return {
    current: safeCurrent,
    target,
    pct,
    clampedValue,
    remaining,
    isMet,
    statusLabel,
  };
}

export function formatShortTimestamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DEFAULT_REMINDER_TEMPLATE_CLIENT =
  'Hi {name}! 🎄 Friendly reminder from {volunteer} ({churchName}) — our *{eventTitle}* Celebration Service is coming up!\n\n📅 {eventDate}\n📍 {venueName} ({venueAddress})\n\n🎟 Your VIP Invitation & directions: {inviteUrl}\n\nLet me know if you are coming with friends or need directions—see you there! ✨';

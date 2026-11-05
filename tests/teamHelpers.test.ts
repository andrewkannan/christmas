import { describe, expect, it } from 'vitest';
import {
  computeTargetMetric,
  getFollowUpStageMeta,
  getLeadEngagementTier,
  hasQuickTagInNotes,
  toggleQuickTagInNotes,
} from '../src/team/teamHelpers.ts';

describe('teamHelpers — campaign target & pastoral CRM logic', () => {
  it('computes campaign target percentages, clamped progress values, and met/remaining labels', () => {
    const partial = computeTargetMetric(375, 1500);
    expect(partial.pct).toBe(25);
    expect(partial.clampedValue).toBe(375);
    expect(partial.remaining).toBe(1125);
    expect(partial.isMet).toBe(false);
    expect(partial.statusLabel).toBe('1,125 to go');

    const exceeded = computeTargetMetric(530, 500);
    expect(exceeded.pct).toBe(106);
    expect(exceeded.clampedValue).toBe(500);
    expect(exceeded.remaining).toBe(0);
    expect(exceeded.isMet).toBe(true);
    expect(exceeded.statusLabel).toBe('Target Met (+30)');
  });

  it('toggles quick remark tags cleanly without clobbering custom pastoral notes', () => {
    const step1 = toggleQuickTagInNotes('', 'Coming with family');
    expect(step1).toBe('Coming with family');
    expect(hasQuickTagInNotes(step1, 'Coming with family')).toBe(true);

    const step2 = toggleQuickTagInNotes(step1, 'Mandarin / Bilingual');
    expect(step2).toBe('Coming with family · Mandarin / Bilingual');
    expect(hasQuickTagInNotes(step2, 'Mandarin / Bilingual')).toBe(true);

    const step3 = toggleQuickTagInNotes(step2, 'Coming with family');
    expect(step3).toBe('Mandarin / Bilingual');
    expect(hasQuickTagInNotes(step3, 'Coming with family')).toBe(false);
  });

  it('classifies lead engagement heat tiers into hot, warm, and street', () => {
    expect(
      getLeadEngagementTier({
        calendarAdds: 1,
        inviteShares: 0,
        gamesAfterInteraction: 0,
        ticketDownloads: 0,
        eInviteViews: 1,
      })
    ).toBe('hot');

    expect(
      getLeadEngagementTier({
        calendarAdds: 0,
        inviteShares: 0,
        gamesAfterInteraction: 1,
        ticketDownloads: 0,
        eInviteViews: 1,
      })
    ).toBe('warm');

    expect(
      getLeadEngagementTier({
        calendarAdds: 0,
        inviteShares: 0,
        gamesAfterInteraction: 0,
        ticketDownloads: 0,
        eInviteViews: 1,
      })
    ).toBe('street');
  });

  it('maps follow-up stage metadata with safe fallback to new', () => {
    expect(getFollowUpStageMeta('confirmed').shortLabel).toBe('Confirmed RSVP');
    expect(getFollowUpStageMeta(undefined).value).toBe('new');
  });
});

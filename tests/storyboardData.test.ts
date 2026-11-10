import { describe, expect, it } from 'vitest';
import { PRODUCTION_PROPS_CHECKLIST, STORYBOARD_CUTS } from '../src/storyboard/storyboardData.ts';

describe('Promo video storyboard scripts & production checklist', () => {
  it('defines 3 complete creative storyline continuations that all start with the vintage car, mirror smile, and JESUS "Yes Appa!" call', () => {
    expect(STORYBOARD_CUTS).toHaveLength(3);

    for (const cut of STORYBOARD_CUTS) {
      expect(cut.shots.length).toBeGreaterThanOrEqual(8);
      cut.shots.forEach((shot, idx) => {
        expect(shot.shotNumber).toBe(idx + 1);
        expect(shot.visualAction.length).toBeGreaterThan(20);
        expect(shot.cameraAngle.length).toBeGreaterThan(15);
        expect(shot.audioCue.length).toBeGreaterThan(10);
      });

      expect(cut.shots[0]?.art).toBe('car-door');
      expect(cut.shots[1]?.art).toBe('mirror-smile');
      expect(cut.shots[2]?.art).toBe('jesus-call');
      expect(cut.shots[2]?.dialogueOrText).toContain('Yes Appa!');

      const hasQrBeat = cut.shots.some(
        (s) => s.arcadeTieIn === 'qr-board' || s.art === 'qr-scan-hook' || s.art === 'color-burst-scan'
      );
      const hasHockeyBeat = cut.shots.some((s) => s.art === 'hockey-versus');
      const hasGiftPassBeat = cut.shots.some((s) => s.art === 'gift-vip-pass');
      expect(hasQrBeat).toBe(true);
      expect(hasHockeyBeat).toBe(true);
      expect(hasGiftPassBeat).toBe(true);
    }
  });

  it('includes essential hero props for filming the car call and street QR arcade', () => {
    expect(PRODUCTION_PROPS_CHECKLIST.length).toBeGreaterThanOrEqual(5);
    expect(PRODUCTION_PROPS_CHECKLIST.some((p) => p.item.includes('Vintage Classic Car'))).toBe(true);
    expect(PRODUCTION_PROPS_CHECKLIST.some((p) => p.item.includes('QR Code Boards'))).toBe(true);
  });
});

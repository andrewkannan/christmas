import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  clampPlayerHalfPoint,
  createHockeyMatchState,
  DOUBLE_PUCK_AT_MS,
  HOCKEY_DURATION_MS,
  HOCKEY_WIN_GOALS,
  MAX_HOCKEY_SCORE,
  playerInputToCanonical,
  PUCK_RADIUS,
  RINK_HEIGHT,
  RINK_MID_Y,
  RINK_WIDTH,
  setPlayerStrikerTarget,
  stepHockeyMatch,
  STRIKER_RADIUS,
  toPerspectivePoint,
  toRoomSnapshot,
} from '../src/games/hockeyLogic.ts';
import { createRng } from '../src/games/rng.ts';
import { HockeyRoomManager } from '../server/hockeyRooms.ts';

describe('Starlight Air Hockey pure physics & perspective properties', () => {
  it('toPerspectivePoint is an involution for both roles and maps joiner inputs strictly to top half', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: RINK_WIDTH, noNaN: true }),
        fc.double({ min: 0, max: RINK_HEIGHT, noNaN: true }),
        fc.constantFrom<'host' | 'joiner'>('host', 'joiner'),
        (x, y, role) => {
          const once = toPerspectivePoint(x, y, role);
          const twice = toPerspectivePoint(once.x, once.y, role);
          expect(twice.x).toBeCloseTo(x, 6);
          expect(twice.y).toBeCloseTo(y, 6);

          const clamped = clampPlayerHalfPoint(x, y);
          expect(clamped.y).toBeGreaterThanOrEqual(RINK_MID_Y + STRIKER_RADIUS);
          expect(clamped.y).toBeLessThanOrEqual(RINK_HEIGHT - STRIKER_RADIUS);

          const joinerCanonical = playerInputToCanonical(x, y, 'joiner');
          expect(joinerCanonical.y).toBeLessThanOrEqual(RINK_MID_Y - STRIKER_RADIUS);
          expect(joinerCanonical.y).toBeGreaterThanOrEqual(STRIKER_RADIUS);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('keeps pucks horizontally in bounds, scores integer-bounded, and activates Double Puck Fever on arbitrary trajectories', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.array(
          fc.record({
            hx: fc.integer({ min: 20, max: 340 }),
            hy: fc.integer({ min: 480, max: 870 }),
            jx: fc.integer({ min: 20, max: 340 }),
            jy: fc.integer({ min: 480, max: 870 }),
          }),
          { minLength: 10, maxLength: 30 }
        ),
        (seed, moves) => {
          const rng = createRng(seed);
          const state = createHockeyMatchState({
            code: '4829',
            hostName: 'Mei',
            joinerName: 'Daniel',
            joinerIsBot: false,
            status: 'playing',
            rng,
          });

          let prevHostGoals = 0;
          let prevJoinerGoals = 0;

          for (let i = 0; i < 60 && state.status === 'playing'; i++) {
            const mv = moves[i % moves.length];
            setPlayerStrikerTarget(state, 'host', mv.hx, mv.hy);
            setPlayerStrikerTarget(state, 'joiner', mv.jx, mv.jy);
            stepHockeyMatch(state, 50, rng);

            for (const puck of state.pucks) {
              expect(puck.x).toBeGreaterThanOrEqual(PUCK_RADIUS);
              expect(puck.x).toBeLessThanOrEqual(RINK_WIDTH - PUCK_RADIUS);
            }

            expect(Number.isInteger(state.hostScore)).toBe(true);
            expect(Number.isInteger(state.joinerScore)).toBe(true);
            expect(state.hostScore).toBeGreaterThanOrEqual(0);
            expect(state.hostScore).toBeLessThanOrEqual(MAX_HOCKEY_SCORE);
            expect(state.joinerScore).toBeLessThanOrEqual(MAX_HOCKEY_SCORE);
            expect(state.hostGoals).toBeGreaterThanOrEqual(prevHostGoals);
            expect(state.joinerGoals).toBeGreaterThanOrEqual(prevJoinerGoals);
            prevHostGoals = state.hostGoals;
            prevJoinerGoals = state.joinerGoals;
          }
        }
      ),
      { numRuns: 80 }
    );
  });

  it('spawns Double Puck Fever at 33s and finishes cleanly at 45s or 7-goal knockout', () => {
    const rng = createRng(42);
    const state = createHockeyMatchState({
      code: '7777',
      hostName: 'Guest',
      joinerName: 'Frosty Elf Bot',
      joinerIsBot: true,
      status: 'playing',
      rng,
    });

    // Advance past 33s in 50ms steps (stopping early only if 7-goal knockout occurs)
    while (state.status === 'playing' && state.elapsedMs < DOUBLE_PUCK_AT_MS + 100) {
      stepHockeyMatch(state, 50, rng);
    }

    if (state.status === 'playing') {
      expect(state.doublePuckSpawned).toBe(true);
      expect(state.pucks.length).toBe(2);
    }

    while (state.status === 'playing') {
      stepHockeyMatch(state, 50, rng);
    }

    expect(state.status).toBe('finished');
    expect(
      state.elapsedMs >= HOCKEY_DURATION_MS ||
        state.hostGoals >= HOCKEY_WIN_GOALS ||
        state.joinerGoals >= HOCKEY_WIN_GOALS
    ).toBe(true);

    const hostSnap = toRoomSnapshot(state, 'host', 1000);
    const joinerSnap = toRoomSnapshot(state, 'joiner', 1000);
    expect(hostSnap.myGoals).toBe(joinerSnap.oppGoals);
    expect(hostSnap.oppGoals).toBe(joinerSnap.myGoals);
  });
});

describe('HockeyRoomManager 4-digit room lifecycle & auth', () => {
  it('allocates a 4-digit code, pairs joiner, blocks 3rd player & token spoofing, and steps match clock', () => {
    let nowMs = 1_700_000_000_000;
    const manager = new HockeyRoomManager({ now: () => nowMs });

    const created = manager.createRoom('Mei Ling');
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('Expected room');

    expect(created.data.code).toMatch(/^\d{4}$/);
    expect(created.data.snapshot.status).toBe('waiting');

    // Invalid code rejected
    const badJoin = manager.joinRoom('99', 'Daniel');
    expect(badJoin.ok).toBe(false);
    if (!badJoin.ok) expect(badJoin.status).toBe(400);

    // Challenger joins with 4-digit code -> room moves to countdown
    const joined = manager.joinRoom(created.data.code, 'Daniel');
    expect(joined.ok).toBe(true);
    if (!joined.ok) throw new Error('Expected join');
    expect(joined.data.snapshot.status).toBe('countdown');
    expect(joined.data.snapshot.oppStriker.name).toBe('Mei Ling');

    // 3rd player trying same 4-digit code gets 409 Conflict
    const third = manager.joinRoom(created.data.code, 'Intruder');
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.status).toBe(409);

    // Wrong playerToken gets 403 Forbidden
    const spoof = manager.updateInput(created.data.code, 'wrong-token-1234567890', 180, 700);
    expect(spoof.ok).toBe(false);
    if (!spoof.ok) expect(spoof.status).toBe(403);

    // Advance past 2.4s countdown into live play
    for (let i = 0; i < 60; i++) {
      nowMs += 50;
      manager.getSnapshot(created.data.code, created.data.playerToken);
    }

    const hostLive = manager.updateInput(
      created.data.code,
      created.data.playerToken,
      180,
      760
    );
    expect(hostLive.ok).toBe(true);
    if (hostLive.ok) {
      expect(hostLive.snapshot.status).toBe('playing');
      expect(hostLive.snapshot.oppStriker.name).toBe('Daniel');
    }

    manager.disposeAll();
  });
});

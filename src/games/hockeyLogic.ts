import type {
  HockeyGoalBanner,
  HockeyPuckSnapshot,
  HockeyRole,
  HockeyRoomSnapshot,
  HockeyRoomStatus,
} from '../types.ts';
import type { Rng } from './rng.ts';

export const RINK_WIDTH = 360;
export const RINK_HEIGHT = 900;
export const RINK_MID_Y = 450;

export const GOAL_WIDTH = 148;
export const GOAL_LEFT = (RINK_WIDTH - GOAL_WIDTH) / 2; // 106
export const GOAL_RIGHT = GOAL_LEFT + GOAL_WIDTH; // 254

export const STRIKER_RADIUS = 26;
export const PUCK_RADIUS = 15;
export const STAR_GATE_RADIUS = 24;

export const HOCKEY_DURATION_MS = 45_000;
export const HOCKEY_COUNTDOWN_MS = 2_400;
export const DOUBLE_PUCK_AT_MS = 33_000; // Final 12 seconds: Double Puck Fever!
export const HOCKEY_WIN_GOALS = 7;
export const MAX_HOCKEY_SCORE = 450;

const MIN_PUCK_SPEED = 155;
const BASE_SERVE_SPEED = 310;
const MAX_PUCK_SPEED = 840;
const MAX_TURBO_SPEED = 960;
const WALL_DAMPING = 0.96;
const ICE_FRICTION_PER_SEC = 0.985;
const SUBSTEPS = 3;

export interface CanonicalStriker {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  name: string;
  connected: boolean;
  botControlled: boolean;
  /** True once the player has sent at least one non-default input (prevents AFK point farming). */
  hasMoved: boolean;
  hitCooldownMs: number;
}

export interface CanonicalPuck {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  turbo: boolean;
  lastTouchedBy: HockeyRole | null;
  servePauseMs: number;
}

export interface CanonicalGoalEvent {
  scorer: HockeyRole;
  points: number;
  turbo: boolean;
  seq: number;
}

export interface HockeyMatchState {
  code: string;
  status: HockeyRoomStatus;
  countdownMs: number;
  elapsedMs: number;
  hostGoals: number;
  joinerGoals: number;
  hostScore: number;
  joinerScore: number;
  host: CanonicalStriker;
  joiner: CanonicalStriker;
  pucks: CanonicalPuck[];
  nextPuckId: number;
  doublePuckSpawned: boolean;
  starGateX: number;
  starGateDir: 1 | -1;
  starGateCooldownMs: number;
  goalSeq: number;
  lastGoal: CanonicalGoalEvent | null;
  endReason: 'time' | 'knockout' | null;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function addClampedScore(current: number, delta: number): number {
  return Math.min(MAX_HOCKEY_SCORE, current + Math.max(0, Math.round(delta)));
}

/**
 * Clamp a striker position inside the player-centric bottom half (y in [450, 900]).
 */
export function clampPlayerHalfPoint(x: number, y: number): { x: number; y: number } {
  const safeX = Number.isFinite(x) ? x : RINK_WIDTH / 2;
  const safeY = Number.isFinite(y) ? y : RINK_HEIGHT - 86;
  return {
    x: clamp(safeX, STRIKER_RADIUS + 6, RINK_WIDTH - STRIKER_RADIUS - 6),
    y: clamp(safeY, RINK_MID_Y + STRIKER_RADIUS + 4, RINK_HEIGHT - STRIKER_RADIUS - 8),
  };
}

/**
 * Convert a canonical table point/vector into a player's own perspective
 * (so BOTH players defend the bottom goal y=900 and smash upward toward y=0).
 */
export function toPerspectivePoint(
  x: number,
  y: number,
  role: HockeyRole
): { x: number; y: number } {
  if (role === 'host') return { x, y };
  return { x: RINK_WIDTH - x, y: RINK_HEIGHT - y };
}

export function toPerspectiveVelocity(
  vx: number,
  vy: number,
  role: HockeyRole
): { vx: number; vy: number } {
  if (role === 'host') return { vx, vy };
  return { vx: -vx, vy: -vy };
}

/**
 * Convert a player-centric striker input (always bottom half y in [450, 900])
 * into canonical table coordinates (bottom half for host, top half for joiner).
 */
export function playerInputToCanonical(
  playerX: number,
  playerY: number,
  role: HockeyRole
): { x: number; y: number } {
  const clamped = clampPlayerHalfPoint(playerX, playerY);
  return toPerspectivePoint(clamped.x, clamped.y, role);
}

function spawnPuck(
  id: number,
  rng: Rng,
  towardRole: HockeyRole,
  pauseMs = 450
): CanonicalPuck {
  const angleOffset = (rng() - 0.5) * 0.65;
  const dirY = towardRole === 'host' ? 1 : -1;
  const speed = BASE_SERVE_SPEED;
  return {
    id,
    x: RINK_WIDTH / 2 + (rng() - 0.5) * 32,
    y: RINK_MID_Y,
    vx: Math.sin(angleOffset) * speed,
    vy: Math.cos(angleOffset) * speed * dirY,
    turbo: false,
    lastTouchedBy: null,
    servePauseMs: pauseMs,
  };
}

export function createHockeyMatchState(options: {
  code: string;
  hostName: string;
  joinerName: string;
  joinerIsBot: boolean;
  status?: HockeyRoomStatus;
  rng: Rng;
}): HockeyMatchState {
  const initialServe: HockeyRole = options.rng() < 0.5 ? 'host' : 'joiner';
  return {
    code: options.code,
    status: options.status ?? 'waiting',
    countdownMs: HOCKEY_COUNTDOWN_MS,
    elapsedMs: 0,
    hostGoals: 0,
    joinerGoals: 0,
    hostScore: 0,
    joinerScore: 0,
    host: {
      x: RINK_WIDTH / 2,
      y: RINK_HEIGHT - 86,
      targetX: RINK_WIDTH / 2,
      targetY: RINK_HEIGHT - 86,
      vx: 0,
      vy: 0,
      name: options.hostName || 'Player 1',
      connected: true,
      botControlled: false,
      hasMoved: false,
      hitCooldownMs: 0,
    },
    joiner: {
      x: RINK_WIDTH / 2,
      y: 86,
      targetX: RINK_WIDTH / 2,
      targetY: 86,
      vx: 0,
      vy: 0,
      name: options.joinerName || (options.joinerIsBot ? 'Frosty Elf Bot' : 'Challenger'),
      connected: options.joinerIsBot,
      botControlled: options.joinerIsBot,
      hasMoved: options.joinerIsBot,
      hitCooldownMs: 0,
    },
    pucks: [spawnPuck(1, options.rng, initialServe, 220)],
    nextPuckId: 2,
    doublePuckSpawned: false,
    starGateX: RINK_WIDTH / 2,
    starGateDir: 1,
    starGateCooldownMs: 0,
    goalSeq: 0,
    lastGoal: null,
    endReason: null,
  };
}

/**
 * Apply a player's pointer/keyboard target in player-centric coordinates.
 */
export function setPlayerStrikerTarget(
  state: HockeyMatchState,
  role: HockeyRole,
  playerX: number,
  playerY: number
): void {
  const canonical = playerInputToCanonical(playerX, playerY, role);
  const striker = role === 'host' ? state.host : state.joiner;
  const movedDist = Math.hypot(canonical.x - striker.targetX, canonical.y - striker.targetY);
  if (movedDist > 1.5) {
    striker.hasMoved = true;
  }
  striker.targetX = canonical.x;
  striker.targetY = canonical.y;
}

/**
 * Update an AI-controlled striker in canonical space (works for joiner top-half or stale-player fallback).
 */
export function updateBotTarget(
  state: HockeyMatchState,
  role: HockeyRole,
  dtSec: number
): void {
  const striker = role === 'host' ? state.host : state.joiner;
  const isTop = role === 'joiner';
  const homeY = isTop ? 84 : RINK_HEIGHT - 84;

  // Pick the most threatening puck heading toward or inside this striker's half.
  let threat: CanonicalPuck | null = null;
  let bestUrgency = -Infinity;
  for (const puck of state.pucks) {
    if (puck.servePauseMs > 0) continue;
    const inMyHalf = isTop ? puck.y < RINK_MID_Y + 40 : puck.y > RINK_MID_Y - 40;
    const movingAtMe = isTop ? puck.vy < -20 : puck.vy > 20;
    const distToGoal = isTop ? puck.y : RINK_HEIGHT - puck.y;
    const urgency = (inMyHalf ? 500 : 0) + (movingAtMe ? 350 : 0) - distToGoal;
    if (urgency > bestUrgency) {
      bestUrgency = urgency;
      threat = puck;
    }
  }

  let desiredX = RINK_WIDTH / 2;
  let desiredY = homeY;

  if (threat) {
    const inAttackZone = isTop
      ? threat.y > 68 && threat.y < RINK_MID_Y - 36
      : threat.y < RINK_HEIGHT - 68 && threat.y > RINK_MID_Y + 36;

    // Gentle oscillation so the bot leaves realistic passing angles for a street guest to score!
    const weave = Math.sin(state.elapsedMs * 0.0042) * 22;
    desiredX = clamp(
      threat.x + weave * (inAttackZone ? 0.45 : 0.8),
      STRIKER_RADIUS + 18,
      RINK_WIDTH - STRIKER_RADIUS - 18
    );

    if (inAttackZone) {
      desiredY = isTop
        ? clamp(threat.y - 16, 68, RINK_MID_Y - STRIKER_RADIUS - 28)
        : clamp(threat.y + 16, RINK_MID_Y + STRIKER_RADIUS + 28, RINK_HEIGHT - 68);
    } else {
      desiredY = homeY + (isTop ? 18 : -18);
    }
  }

  // If solo guest hasn't touched controls yet and bot already leads by 4, stay in defensive guard
  // so an untouched test round plays cleanly to the buzzer.
  if (role === 'joiner' && !state.host.hasMoved && state.joinerGoals >= 4) {
    desiredX = GOAL_LEFT - 18;
    desiredY = 70;
  }

  const maxBotStep = 430 * dtSec;
  const dx = desiredX - striker.targetX;
  const dy = desiredY - striker.targetY;
  const dist = Math.hypot(dx, dy);
  if (dist > maxBotStep && dist > 0) {
    striker.targetX += (dx / dist) * maxBotStep;
    striker.targetY += (dy / dist) * maxBotStep;
  } else {
    striker.targetX = desiredX;
    striker.targetY = desiredY;
  }
  striker.hasMoved = true;
}

function advanceStriker(striker: CanonicalStriker, role: HockeyRole, dtSec: number): void {
  const minY = role === 'host' ? RINK_MID_Y + STRIKER_RADIUS + 4 : STRIKER_RADIUS + 8;
  const maxY = role === 'host' ? RINK_HEIGHT - STRIKER_RADIUS - 8 : RINK_MID_Y - STRIKER_RADIUS - 4;
  const nextX = clamp(striker.targetX, STRIKER_RADIUS + 6, RINK_WIDTH - STRIKER_RADIUS - 6);
  const nextY = clamp(striker.targetY, minY, maxY);

  if (dtSec > 0) {
    const rawVx = (nextX - striker.x) / dtSec;
    const rawVy = (nextY - striker.y) / dtSec;
    // Smooth instantaneous velocity slightly so crisp finger flicks transfer clean momentum.
    striker.vx = clamp(striker.vx * 0.35 + rawVx * 0.65, -1100, 1100);
    striker.vy = clamp(striker.vy * 0.35 + rawVy * 0.65, -1100, 1100);
  }
  striker.x = nextX;
  striker.y = nextY;
  if (striker.hitCooldownMs > 0) {
    striker.hitCooldownMs = Math.max(0, striker.hitCooldownMs - dtSec * 1000);
  }
}

function collideStrikerWithPuck(
  state: HockeyMatchState,
  striker: CanonicalStriker,
  role: HockeyRole,
  puck: CanonicalPuck
): number {
  const dx = puck.x - striker.x;
  const dy = puck.y - striker.y;
  const minDist = STRIKER_RADIUS + PUCK_RADIUS;
  const distSq = dx * dx + dy * dy;
  if (distSq >= minDist * minDist) return 0;

  const dist = Math.sqrt(distSq);
  const nx = dist > 0.001 ? dx / dist : 0;
  const ny = dist > 0.001 ? dy / dist : role === 'host' ? -1 : 1;

  // Separate immediately so puck can never stick inside striker.
  const overlap = minDist - dist + 0.8;
  puck.x += nx * overlap;
  puck.y += ny * overlap;

  const relVx = puck.vx - striker.vx;
  const relVy = puck.vy - striker.vy;
  const relDot = relVx * nx + relVy * ny;

  if (relDot < 0) {
    const restitution = 0.94;
    puck.vx -= (1 + restitution) * relDot * nx;
    puck.vy -= (1 + restitution) * relDot * ny;
  }

  // Add striker swing transfer + guaranteed crisp arcade pop toward opponent half.
  puck.vx += striker.vx * 0.42;
  puck.vy += striker.vy * 0.48;

  const strikerSpeed = Math.hypot(striker.vx, striker.vy);
  const minPop = strikerSpeed > 260 ? 480 : 350;
  const maxCap = puck.turbo ? MAX_TURBO_SPEED : MAX_PUCK_SPEED;
  const curSpeed = Math.hypot(puck.vx, puck.vy);
  if (curSpeed < minPop) {
    const boostAngleX = nx * 0.72;
    const boostAngleY = ny !== 0 ? ny : role === 'host' ? -1 : 1;
    const norm = Math.hypot(boostAngleX, boostAngleY) || 1;
    puck.vx = (boostAngleX / norm) * minPop;
    puck.vy = (boostAngleY / norm) * minPop;
  } else if (curSpeed > maxCap) {
    puck.vx = (puck.vx / curSpeed) * maxCap;
    puck.vy = (puck.vy / curSpeed) * maxCap;
  }

  puck.lastTouchedBy = role;

  if (striker.hitCooldownMs <= 0) {
    striker.hitCooldownMs = 150;
    if (striker.hasMoved) {
      const strikePts = strikerSpeed >= 260 ? 4 : 2;
      if (role === 'host') {
        state.hostScore = addClampedScore(state.hostScore, strikePts);
      } else {
        state.joinerScore = addClampedScore(state.joinerScore, strikePts);
      }
      return strikePts;
    }
  }
  return 0;
}

function finishMatchWithBonuses(state: HockeyMatchState, reason: 'time' | 'knockout'): void {
  if (state.status === 'finished') return;
  state.status = 'finished';
  state.endReason = reason;

  if (state.hostGoals > state.joinerGoals && state.hostGoals > 0) {
    state.hostScore = addClampedScore(state.hostScore, 15);
  } else if (state.joinerGoals > state.hostGoals && state.joinerGoals > 0) {
    state.joinerScore = addClampedScore(state.joinerScore, 15);
  } else if (state.hostGoals === state.joinerGoals && state.hostGoals > 0) {
    state.hostScore = addClampedScore(state.hostScore, 5);
    state.joinerScore = addClampedScore(state.joinerScore, 5);
  }
}

export interface StepEvents {
  hostStrikePts: number;
  joinerStrikePts: number;
  starGateBy: HockeyRole | null;
  goal: CanonicalGoalEvent | null;
  doublePuckActivated: boolean;
  finishedNow: boolean;
}

/**
 * Advance the canonical Starlight Hockey match by `dtMs` milliseconds.
 */
export function stepHockeyMatch(
  state: HockeyMatchState,
  dtMs: number,
  rng: Rng
): StepEvents {
  const events: StepEvents = {
    hostStrikePts: 0,
    joinerStrikePts: 0,
    starGateBy: null,
    goal: null,
    doublePuckActivated: false,
    finishedNow: false,
  };

  const clampedDtMs = clamp(dtMs, 0, 80);
  if (clampedDtMs <= 0 || state.status === 'waiting' || state.status === 'finished') {
    return events;
  }

  if (state.status === 'countdown') {
    state.countdownMs -= clampedDtMs;
    const sec = clampedDtMs / 1000;
    advanceStriker(state.host, 'host', sec);
    advanceStriker(state.joiner, 'joiner', sec);
    if (state.countdownMs <= 0) {
      state.countdownMs = 0;
      state.status = 'playing';
    }
    return events;
  }

  // Playing state
  state.elapsedMs = Math.min(HOCKEY_DURATION_MS, state.elapsedMs + clampedDtMs);
  const dtSec = clampedDtMs / 1000;

  if (state.host.botControlled) {
    updateBotTarget(state, 'host', dtSec);
  }
  if (state.joiner.botControlled) {
    updateBotTarget(state, 'joiner', dtSec);
  }

  // Drift the glowing center Star Gate smoothly across the portal seam
  if (state.starGateCooldownMs > 0) {
    state.starGateCooldownMs = Math.max(0, state.starGateCooldownMs - clampedDtMs);
  }
  state.starGateX += state.starGateDir * 68 * dtSec;
  if (state.starGateX > RINK_WIDTH - 68) {
    state.starGateX = RINK_WIDTH - 68;
    state.starGateDir = -1;
  } else if (state.starGateX < 68) {
    state.starGateX = 68;
    state.starGateDir = 1;
  }

  // Final 12 seconds: Double Puck Fever!
  if (!state.doublePuckSpawned && state.elapsedMs >= DOUBLE_PUCK_AT_MS && state.pucks.length < 2) {
    state.doublePuckSpawned = true;
    const trailingRole: HockeyRole =
      state.hostGoals <= state.joinerGoals ? 'joiner' : 'host';
    const feverPuck = spawnPuck(state.nextPuckId++, rng, trailingRole, 180);
    feverPuck.turbo = true;
    state.pucks.push(feverPuck);
    events.doublePuckActivated = true;
  }

  const subDtSec = dtSec / SUBSTEPS;

  for (let step = 0; step < SUBSTEPS; step++) {
    advanceStriker(state.host, 'host', subDtSec);
    advanceStriker(state.joiner, 'joiner', subDtSec);

    for (let i = 0; i < state.pucks.length; i++) {
      const puck = state.pucks[i];
      if (puck.servePauseMs > 0) {
        puck.servePauseMs = Math.max(0, puck.servePauseMs - (clampedDtMs / SUBSTEPS));
        continue;
      }

      const prevY = puck.y;
      puck.x += puck.vx * subDtSec;
      puck.y += puck.vy * subDtSec;

      // Gentle ice glide damping + minimum momentum floor so a puck never stalls dead
      const damp = Math.pow(ICE_FRICTION_PER_SEC, subDtSec);
      puck.vx *= damp;
      puck.vy *= damp;

      const speed = Math.hypot(puck.vx, puck.vy);
      if (speed < MIN_PUCK_SPEED) {
        const dirY = puck.vy >= 0 ? 1 : -1;
        const norm = speed > 1 ? speed : 1;
        puck.vx = speed > 1 ? (puck.vx / norm) * MIN_PUCK_SPEED : (rng() - 0.5) * 60;
        puck.vy = speed > 1 ? (puck.vy / norm) * MIN_PUCK_SPEED : dirY * MIN_PUCK_SPEED;
      }

      // Side walls
      if (puck.x - PUCK_RADIUS < 0) {
        puck.x = PUCK_RADIUS;
        puck.vx = Math.abs(puck.vx) * WALL_DAMPING;
      } else if (puck.x + PUCK_RADIUS > RINK_WIDTH) {
        puck.x = RINK_WIDTH - PUCK_RADIUS;
        puck.vx = -Math.abs(puck.vx) * WALL_DAMPING;
      }

      // Check Star Gate portal crossing at y = 450
      const crossedPortal =
        (prevY < RINK_MID_Y && puck.y >= RINK_MID_Y) ||
        (prevY > RINK_MID_Y && puck.y <= RINK_MID_Y);
      if (
        crossedPortal &&
        state.starGateCooldownMs <= 0 &&
        Math.abs(puck.x - state.starGateX) <= STAR_GATE_RADIUS + PUCK_RADIUS
      ) {
        puck.turbo = true;
        const boostedSpeed = Math.min(MAX_TURBO_SPEED, Math.hypot(puck.vx, puck.vy) * 1.24 + 70);
        const cur = Math.hypot(puck.vx, puck.vy) || 1;
        puck.vx = (puck.vx / cur) * boostedSpeed;
        puck.vy = (puck.vy / cur) * boostedSpeed;
        state.starGateCooldownMs = 3_200;

        if (puck.lastTouchedBy === 'host' && state.host.hasMoved) {
          state.hostScore = addClampedScore(state.hostScore, 5);
          events.starGateBy = 'host';
        } else if (puck.lastTouchedBy === 'joiner' && state.joiner.hasMoved) {
          state.joinerScore = addClampedScore(state.joinerScore, 5);
          events.starGateBy = 'joiner';
        }
      }

      // Top boundary & Joiner goal (Host scores when puck enters y <= 0 inside goal mouth!)
      const inGoalMouth = puck.x >= GOAL_LEFT + PUCK_RADIUS * 0.35 && puck.x <= GOAL_RIGHT - PUCK_RADIUS * 0.35;
      if (puck.y - PUCK_RADIUS <= 0) {
        if (inGoalMouth) {
          const pts = puck.turbo ? 20 : 12;
          state.hostGoals += 1;
          state.hostScore = addClampedScore(state.hostScore, pts);
          state.goalSeq += 1;
          const goalEvt: CanonicalGoalEvent = {
            scorer: 'host',
            points: pts,
            turbo: puck.turbo,
            seq: state.goalSeq,
          };
          state.lastGoal = goalEvt;
          events.goal = goalEvt;
          state.pucks[i] = spawnPuck(state.nextPuckId++, rng, 'joiner', 550);
          continue;
        } else {
          puck.y = PUCK_RADIUS;
          puck.vy = Math.abs(puck.vy) * WALL_DAMPING;
          // Corner bevel nudge so puck never wedges in top corners
          if (puck.x < 42) puck.vx += 95;
          if (puck.x > RINK_WIDTH - 42) puck.vx -= 95;
        }
      }

      // Bottom boundary & Host goal (Joiner scores when puck enters y >= RINK_HEIGHT inside goal mouth!)
      if (puck.y + PUCK_RADIUS >= RINK_HEIGHT) {
        if (inGoalMouth) {
          const pts = puck.turbo ? 20 : 12;
          state.joinerGoals += 1;
          state.joinerScore = addClampedScore(state.joinerScore, pts);
          state.goalSeq += 1;
          const goalEvt: CanonicalGoalEvent = {
            scorer: 'joiner',
            points: pts,
            turbo: puck.turbo,
            seq: state.goalSeq,
          };
          state.lastGoal = goalEvt;
          events.goal = goalEvt;
          state.pucks[i] = spawnPuck(state.nextPuckId++, rng, 'host', 550);
          continue;
        } else {
          puck.y = RINK_HEIGHT - PUCK_RADIUS;
          puck.vy = -Math.abs(puck.vy) * WALL_DAMPING;
          if (puck.x < 42) puck.vx += 95;
          if (puck.x > RINK_WIDTH - 42) puck.vx -= 95;
        }
      }

      // Striker collisions
      events.hostStrikePts += collideStrikerWithPuck(state, state.host, 'host', puck);
      events.joinerStrikePts += collideStrikerWithPuck(state, state.joiner, 'joiner', puck);

      // Post-collision rail guard so a striker pinning a puck near the rail never pushes it out of bounds
      if (puck.x < PUCK_RADIUS) {
        puck.x = PUCK_RADIUS;
        puck.vx = Math.abs(puck.vx) * WALL_DAMPING;
      } else if (puck.x > RINK_WIDTH - PUCK_RADIUS) {
        puck.x = RINK_WIDTH - PUCK_RADIUS;
        puck.vx = -Math.abs(puck.vx) * WALL_DAMPING;
      }
    }

    // Puck-to-puck elastic bounce during Double Puck Fever
    if (state.pucks.length === 2) {
      const a = state.pucks[0];
      const b = state.pucks[1];
      if (a.servePauseMs <= 0 && b.servePauseMs <= 0) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = PUCK_RADIUS * 2;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0 && distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5 + 0.4;
          a.x = clamp(a.x - nx * overlap, PUCK_RADIUS, RINK_WIDTH - PUCK_RADIUS);
          a.y -= ny * overlap;
          b.x = clamp(b.x + nx * overlap, PUCK_RADIUS, RINK_WIDTH - PUCK_RADIUS);
          b.y += ny * overlap;
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dot = dvx * nx + dvy * ny;
          if (dot > 0) {
            a.vx -= dot * nx;
            a.vy -= dot * ny;
            b.vx += dot * nx;
            b.vy += dot * ny;
          }
        }
      }
    }
  }

  // Check knockout (first to 7 goals) or 45s time cap
  if (state.hostGoals >= HOCKEY_WIN_GOALS || state.joinerGoals >= HOCKEY_WIN_GOALS) {
    finishMatchWithBonuses(state, 'knockout');
    events.finishedNow = true;
  } else if (state.elapsedMs >= HOCKEY_DURATION_MS) {
    finishMatchWithBonuses(state, 'time');
    events.finishedNow = true;
  }

  return events;
}

/**
 * Serialize canonical match state into a player-centric snapshot where `myStriker`
 * is always at the bottom of the screen (y in [450, 900]) and `oppStriker` is at the top (y in [0, 450]).
 */
export function toRoomSnapshot(
  state: HockeyMatchState,
  role: HockeyRole,
  serverTimeMs: number
): HockeyRoomSnapshot {
  const me = role === 'host' ? state.host : state.joiner;
  const opp = role === 'host' ? state.joiner : state.host;
  const myPos = toPerspectivePoint(me.x, me.y, role);
  const myVel = toPerspectiveVelocity(me.vx, me.vy, role);
  const oppPos = toPerspectivePoint(opp.x, opp.y, role);
  const oppVel = toPerspectiveVelocity(opp.vx, opp.vy, role);

  const pucks: HockeyPuckSnapshot[] = state.pucks.map((p) => {
    const pos = toPerspectivePoint(p.x, p.y, role);
    const vel = toPerspectiveVelocity(p.vx, p.vy, role);
    return {
      id: p.id,
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      vx: Math.round(vel.vx * 10) / 10,
      vy: Math.round(vel.vy * 10) / 10,
      turbo: p.turbo,
    };
  });

  const starGatePos = toPerspectivePoint(state.starGateX, RINK_MID_Y, role);
  let lastGoal: HockeyGoalBanner | null = null;
  if (state.lastGoal) {
    lastGoal = {
      scorer: state.lastGoal.scorer === role ? 'me' : 'opp',
      points: state.lastGoal.points,
      turbo: state.lastGoal.turbo,
      seq: state.lastGoal.seq,
    };
  }

  return {
    code: state.code,
    role,
    status: state.status,
    countdown: state.status === 'countdown' ? Math.max(1, Math.ceil(state.countdownMs / 800)) : 0,
    elapsedMs: Math.round(state.elapsedMs),
    timeLeftMs: Math.max(0, Math.round(HOCKEY_DURATION_MS - state.elapsedMs)),
    winGoals: HOCKEY_WIN_GOALS,
    myGoals: role === 'host' ? state.hostGoals : state.joinerGoals,
    oppGoals: role === 'host' ? state.joinerGoals : state.hostGoals,
    myArcadeScore: role === 'host' ? state.hostScore : state.joinerScore,
    oppArcadeScore: role === 'host' ? state.joinerScore : state.hostScore,
    myStriker: {
      x: Math.round(myPos.x * 10) / 10,
      y: Math.round(myPos.y * 10) / 10,
      vx: Math.round(myVel.vx * 10) / 10,
      vy: Math.round(myVel.vy * 10) / 10,
      connected: me.connected,
      botControlled: me.botControlled,
      name: me.name,
    },
    oppStriker: {
      x: Math.round(oppPos.x * 10) / 10,
      y: Math.round(oppPos.y * 10) / 10,
      vx: Math.round(oppVel.vx * 10) / 10,
      vy: Math.round(oppVel.vy * 10) / 10,
      connected: opp.connected,
      botControlled: opp.botControlled,
      name: opp.name,
    },
    pucks,
    starGateX: Math.round(starGatePos.x * 10) / 10,
    starGateActive: state.starGateCooldownMs <= 0,
    lastGoal,
    serverTimeMs,
  };
}

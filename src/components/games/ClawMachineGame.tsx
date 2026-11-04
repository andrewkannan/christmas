import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { createRng, randomSeed, type Rng } from '../../games/rng.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

/* ------------------------------------------------------------------------------------------------
 * Layout & tuning (logical canvas units: 360 x 480)
 * ---------------------------------------------------------------------------------------------- */

const STAGE_W = 360;
const STAGE_H = 480;
const MAX_DT = 0.05;
const MAX_DPR = 2;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';

const COLORS = {
  crimson: '#d70015',
  pine: '#0f6840',
  gold: '#f5b942',
  amber: '#b45309',
  ink: '#1d1d1f',
  snow: '#ffffff',
} as const;

const CANOPY_H = 40;
const RAIL_Y = 72;
/** Cable length when the claw is parked at the top. */
const CABLE_MIN = 34;
const PRONG_LEN = 28;
/** A held prize hangs with its centre at pivot + HOLD_OFFSET + r * HOLD_RADIUS_FACTOR. */
const HOLD_OFFSET = 16;
const HOLD_RADIUS_FACTOR = 0.6;
const FLOOR_Y = 440;
/** Longest cable: prong tips stop just above the cabinet floor. */
const CABLE_MAX = FLOOR_Y - 4 - PRONG_LEN - RAIL_Y;
const DIVIDER_X = 98;
const CHUTE = { x: 14, y: 330, w: 76, h: 138 } as const;
const CHUTE_X = CHUTE.x + CHUTE.w / 2;

const AIM_MIN_X = 122;
const AIM_MAX_X = 334;
const AIM_START_X = 230;
/** Claw speed while a direction is held (px/s). */
const AIM_SPEED = 250;
/** Exponential smoothing rate of the claw toward its aim target. */
const AIM_EASE = 16;
/** Step for keyboard-activated ◀ / ▶ pad buttons. */
const KEY_NUDGE = 26;

/* Grab cycle: ~0.4s descend + 0.2s close + ~0.45s rise + ~0.3s carry + 0.22s release ≈ 1.6s. */
const DESCEND_SPEED = 680;
const RISE_SPEED = 640;
const CARRY_SPEED = 560;
const RETURN_SPEED = 720;
const CLOSE_SEC = 0.2;
const RELEASE_SEC = 0.22;

/** Catch half-width = r * CATCH_RADIUS_FACTOR + CATCH_PAD (+ golden bonus). */
const CATCH_RADIUS_FACTOR = 0.55;
const CATCH_PAD = 8;
const GOLDEN_CATCH_BONUS = 12;
const GOLDEN_SEC = 8;

const GRAVITY = 1800;
const SPAWN_SEC = 0.4;
const SPAWN_DROP_PX = 90;
const REFILL_SEC = 0.45;
const BOB_AMP = 1.8;
const BOB_RATE = 2.2;
const SHAKE_SEC = 0.28;
const SHAKE_PX = 3;
/** Pointer travel (CSS px) under which a canvas press counts as a tap (= drop). */
const TAP_SLOP_PX = 10;
/** Keeps refilled prizes clear of a claw that is mid-grab. */
const SPAWN_CLAW_CLEARANCE = 36;

/* Difficulty ramp: the pile thins out (bigger gaps → aiming matters) and stars get likelier. */
const RAMP_SEC = 35;
const START_PRIZES = 7;
const MIN_PRIZES = 4;
const STAR_CHANCE_START = 0.12;
const STAR_CHANCE_END = 0.28;
const STAR_CHANCE_GOLDEN = 0.4;
const GIFT_CHANCE = 0.35;

const SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  // Back row
  { x: 152, y: 374 },
  { x: 204, y: 374 },
  { x: 256, y: 374 },
  { x: 308, y: 374 },
  // Front row
  { x: 126, y: 414 },
  { x: 178, y: 414 },
  { x: 230, y: 414 },
  { x: 282, y: 414 },
  { x: 334, y: 414 },
];

type PrizeKind = 'plush' | 'gift' | 'star';

const PRIZE_SPEC: Record<PrizeKind, { points: number; radius: number; popColor: string }> = {
  plush: { points: 1, radius: 21, popColor: COLORS.pine },
  gift: { points: 2, radius: 19, popColor: COLORS.crimson },
  star: { points: 3, radius: 17, popColor: COLORS.amber },
};

const LEGEND: ReadonlyArray<{ kind: PrizeKind; x: number }> = [
  { kind: 'plush', x: 236 },
  { kind: 'gift', x: 282 },
  { kind: 'star', x: 326 },
];

/* ------------------------------------------------------------------------------------------------
 * State
 * ---------------------------------------------------------------------------------------------- */

type PrizeState = 'spawning' | 'resting' | 'held' | 'falling';

interface Prize {
  id: number;
  kind: PrizeKind;
  /** Art variant (plush: bear/snowman, gift: crimson/pine). */
  variant: number;
  /** Index into SLOTS, or -1 once it has left the pile. */
  slot: number;
  x: number;
  y: number;
  baseY: number;
  r: number;
  phase: number;
  state: PrizeState;
  spawnT: number;
  vy: number;
}

type ClawPhase = 'aim' | 'descend' | 'close' | 'rise' | 'carry' | 'release' | 'return';

interface Claw {
  x: number;
  targetX: number;
  /** Where the current grab started; the claw glides back here after a delivery. */
  dropX: number;
  cable: number;
  /** 1 = fully open, 0 = fully closed. */
  jaw: number;
  phase: ClawPhase;
  phaseT: number;
  held: Prize | null;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  age: number;
  life: number;
}

interface GameState {
  rng: Rng;
  claw: Claw;
  prizes: Prize[];
  popups: Popup[];
  nextId: number;
  simTime: number;
  refillT: number;
  golden: boolean;
  shakeT: number;
}

interface InputState {
  keyLeft: boolean;
  keyRight: boolean;
  /** -1 / 0 / 1 from the held ◀ / ▶ pad buttons. */
  padDir: number;
  /** Accumulated discrete aim movement (drag deltas, keyboard nudges), logical px. */
  aimDx: number;
  dropRequested: boolean;
}

interface DragState {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  moved: boolean;
}

type KeyAction = 'left' | 'right' | 'drop';

const KEY_ACTIONS: Record<string, KeyAction | undefined> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'drop',
  ' ': 'drop',
  Enter: 'drop',
};

/* ------------------------------------------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function approach(value: number, target: number, maxStep: number): number {
  if (Math.abs(target - value) <= maxStep) return target;
  return value + Math.sign(target - value) * maxStep;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function contactCable(prize: Prize): number {
  return prize.y - HOLD_OFFSET - prize.r * HOLD_RADIUS_FACTOR - RAIL_Y;
}

function catchBonus(state: GameState): number {
  return state.golden ? GOLDEN_CATCH_BONUS : 0;
}

/** The first resting prize the claw would touch if dropped at `x` (topmost row wins). */
function findCatch(prizes: readonly Prize[], x: number, bonus: number): Prize | null {
  let best: Prize | null = null;
  for (const p of prizes) {
    if (p.state !== 'resting') continue;
    const dx = Math.abs(p.x - x);
    if (dx > p.r * CATCH_RADIUS_FACTOR + CATCH_PAD + bonus) continue;
    if (!best || p.baseY < best.baseY || (p.baseY === best.baseY && dx < Math.abs(best.x - x))) {
      best = p;
    }
  }
  return best;
}

function addPopup(state: GameState, text: string, x: number, y: number, color: string, size: number, life: number): void {
  state.popups.push({ x: clamp(x, 40, STAGE_W - 40), y, text, color, size, age: 0, life });
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest('input, textarea, select') !== null;
}

/** A focused button/link outside this playfield should keep its own Space/Enter behaviour. */
function isForeignControl(target: EventTarget | null, ownPad: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest('button, a[href], [role="button"]');
  return control !== null && !(ownPad?.contains(control) ?? false);
}

/* ------------------------------------------------------------------------------------------------
 * Simulation
 * ---------------------------------------------------------------------------------------------- */

function rollKind(rng: Rng, elapsedSec: number, golden: boolean): PrizeKind {
  const starChance = golden
    ? STAR_CHANCE_GOLDEN
    : STAR_CHANCE_START + (STAR_CHANCE_END - STAR_CHANCE_START) * clamp01(elapsedSec / RAMP_SEC);
  const roll = rng();
  if (roll < starChance) return 'star';
  if (roll < starChance + GIFT_CHANCE) return 'gift';
  return 'plush';
}

function targetPrizeCount(elapsedSec: number): number {
  return Math.round(START_PRIZES - (START_PRIZES - MIN_PRIZES) * clamp01(elapsedSec / RAMP_SEC));
}

function spawnPrize(state: GameState, elapsedSec: number): Prize | null {
  const { claw } = state;
  const clawBusy = claw.phase === 'descend' || claw.phase === 'close' || claw.phase === 'rise';
  const freeSlots: number[] = [];
  SLOTS.forEach((slot, index) => {
    if (state.prizes.some((p) => p.slot === index)) return;
    if (clawBusy && Math.abs(slot.x - claw.x) < SPAWN_CLAW_CLEARANCE) return;
    freeSlots.push(index);
  });
  if (freeSlots.length === 0) return null;

  const slotIndex = freeSlots[Math.floor(state.rng() * freeSlots.length)];
  const slot = SLOTS[slotIndex];
  const kind = rollKind(state.rng, elapsedSec, state.golden);
  const prize: Prize = {
    id: state.nextId++,
    kind,
    variant: state.rng() < 0.5 ? 0 : 1,
    slot: slotIndex,
    x: slot.x,
    y: slot.y - SPAWN_DROP_PX,
    baseY: slot.y,
    r: PRIZE_SPEC[kind].radius,
    phase: state.rng() * Math.PI * 2,
    state: 'spawning',
    spawnT: 0,
    vy: 0,
  };
  state.prizes.push(prize);
  return prize;
}

function createGameState(): GameState {
  const state: GameState = {
    rng: createRng(randomSeed()),
    claw: {
      x: AIM_START_X,
      targetX: AIM_START_X,
      dropX: AIM_START_X,
      cable: CABLE_MIN,
      jaw: 1,
      phase: 'aim',
      phaseT: 0,
      held: null,
    },
    prizes: [],
    popups: [],
    nextId: 1,
    simTime: 0,
    refillT: 0,
    golden: false,
    shakeT: 0,
  };
  for (let i = 0; i < START_PRIZES; i++) {
    const prize = spawnPrize(state, 0);
    if (!prize) break;
    prize.state = 'resting';
    prize.spawnT = 1;
    prize.y = prize.baseY;
  }
  return state;
}

function setPhase(claw: Claw, phase: ClawPhase): void {
  claw.phase = phase;
  claw.phaseT = 0;
}

function holdPosition(claw: Claw, prize: Prize): { x: number; y: number } {
  return { x: claw.x, y: RAIL_Y + claw.cable + HOLD_OFFSET + prize.r * HOLD_RADIUS_FACTOR };
}

function snapHeldPrize(claw: Claw): void {
  if (!claw.held) return;
  const pos = holdPosition(claw, claw.held);
  claw.held.x = pos.x;
  claw.held.y = pos.y;
}

function updateGolden(state: GameState, api: PlayfieldApi): void {
  const golden = api.timeLeftSec() <= GOLDEN_SEC;
  if (golden && !state.golden) {
    playArcadeTone('star');
    triggerHaptic(30);
    addPopup(state, 'GOLDEN CLAW!', (DIVIDER_X + STAGE_W) / 2, 210, COLORS.amber, 22, 1.4);
  }
  state.golden = golden;
}

function releasePrize(state: GameState, api: PlayfieldApi): void {
  const prize = state.claw.held;
  if (!prize) return;
  const spec = PRIZE_SPEC[prize.kind];
  prize.state = 'falling';
  prize.vy = 0;
  state.claw.held = null;
  api.addScore(spec.points);
  addPopup(state, `+${spec.points}`, CHUTE_X + 6, CHUTE.y - 40, spec.popColor, 24, 0.9);
  playArcadeTone(prize.kind === 'star' ? 'star' : 'pickup');
  triggerHaptic(20);
}

function registerMiss(state: GameState, api: PlayfieldApi): void {
  addPopup(state, 'MISS', state.claw.x, RAIL_Y + CABLE_MIN + 64, COLORS.crimson, 28, 1.1);
  api.loseLife();
}

function updateClaw(state: GameState, input: InputState, api: PlayfieldApi, dt: number, reduced: boolean): void {
  const { claw } = state;
  // Discrete inputs are consumed every frame so nothing queued during a grab cycle fires later.
  const aimDx = input.aimDx;
  const dropRequested = input.dropRequested;
  input.aimDx = 0;
  input.dropRequested = false;
  claw.phaseT += dt;

  switch (claw.phase) {
    case 'aim': {
      const dir = clamp(input.padDir + (input.keyRight ? 1 : 0) - (input.keyLeft ? 1 : 0), -1, 1);
      claw.targetX = clamp(claw.targetX + dir * AIM_SPEED * dt + aimDx, AIM_MIN_X, AIM_MAX_X);
      claw.x += (claw.targetX - claw.x) * Math.min(1, dt * AIM_EASE);
      claw.jaw = approach(claw.jaw, 1, dt * 5);
      if (dropRequested) {
        // Drop exactly where the aim guide is drawn.
        claw.targetX = claw.x;
        claw.dropX = claw.x;
        claw.jaw = 1;
        setPhase(claw, 'descend');
        playArcadeTone('tap');
        triggerHaptic(10);
      }
      break;
    }
    case 'descend': {
      claw.cable += DESCEND_SPEED * dt;
      const target = findCatch(state.prizes, claw.x, catchBonus(state));
      if (target && claw.cable >= contactCable(target)) {
        claw.cable = contactCable(target);
        target.state = 'held';
        target.slot = -1;
        claw.held = target;
        setPhase(claw, 'close');
        playArcadeTone('tap');
        triggerHaptic(14);
      } else if (!target && claw.cable >= CABLE_MAX) {
        claw.cable = CABLE_MAX;
        setPhase(claw, 'close');
        if (!reduced) state.shakeT = SHAKE_SEC;
      }
      break;
    }
    case 'close': {
      claw.jaw = Math.max(0, 1 - claw.phaseT / CLOSE_SEC);
      if (claw.held) {
        const pos = holdPosition(claw, claw.held);
        const pull = Math.min(1, dt * 14);
        claw.held.x += (pos.x - claw.held.x) * pull;
        claw.held.y += (pos.y - claw.held.y) * pull;
      }
      if (claw.phaseT >= CLOSE_SEC) setPhase(claw, 'rise');
      break;
    }
    case 'rise': {
      claw.cable = Math.max(CABLE_MIN, claw.cable - RISE_SPEED * dt);
      snapHeldPrize(claw);
      if (claw.cable <= CABLE_MIN) {
        if (claw.held) {
          setPhase(claw, 'carry');
        } else {
          setPhase(claw, 'aim');
          claw.targetX = claw.x;
          registerMiss(state, api);
        }
      }
      break;
    }
    case 'carry': {
      claw.x = approach(claw.x, CHUTE_X, CARRY_SPEED * dt);
      snapHeldPrize(claw);
      if (claw.x === CHUTE_X) {
        releasePrize(state, api);
        setPhase(claw, 'release');
      }
      break;
    }
    case 'release': {
      claw.jaw = Math.min(1, claw.phaseT / RELEASE_SEC);
      if (claw.phaseT >= RELEASE_SEC) setPhase(claw, 'return');
      break;
    }
    case 'return': {
      claw.x = approach(claw.x, claw.dropX, RETURN_SPEED * dt);
      if (claw.x === claw.dropX) {
        claw.targetX = claw.dropX;
        setPhase(claw, 'aim');
      }
      break;
    }
  }
}

function updatePrizes(state: GameState, dt: number, reduced: boolean): void {
  for (const p of state.prizes) {
    if (p.state === 'spawning') {
      p.spawnT = Math.min(1, p.spawnT + dt / SPAWN_SEC);
      p.y = p.baseY - (reduced ? 0 : (1 - easeOutCubic(p.spawnT)) * SPAWN_DROP_PX);
      if (p.spawnT >= 1) p.state = 'resting';
    } else if (p.state === 'resting') {
      p.y = p.baseY + (reduced ? 0 : Math.sin(state.simTime * BOB_RATE + p.phase) * BOB_AMP);
    } else if (p.state === 'falling') {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
    }
  }
  // Delivered prizes vanish once fully behind the chute's front panel.
  state.prizes = state.prizes.filter((p) => !(p.state === 'falling' && p.y - p.r > CHUTE.y + 2));
}

function refillPrizes(state: GameState, api: PlayfieldApi, dt: number): void {
  state.refillT = Math.max(0, state.refillT - dt);
  if (state.refillT > 0) return;
  const elapsed = api.elapsedSec();
  const onField = state.prizes.filter((p) => p.state === 'resting' || p.state === 'spawning').length;
  if (onField >= targetPrizeCount(elapsed)) return;
  if (spawnPrize(state, elapsed)) state.refillT = REFILL_SEC;
}

function updatePopups(state: GameState, dt: number): void {
  for (const pop of state.popups) {
    pop.age += dt;
    pop.y -= 40 * dt;
  }
  state.popups = state.popups.filter((pop) => pop.age < pop.life);
}

function updateGame(state: GameState, input: InputState, api: PlayfieldApi, dt: number, reduced: boolean): void {
  state.simTime += dt;
  state.shakeT = Math.max(0, state.shakeT - dt);
  updateGolden(state, api);
  updateClaw(state, input, api, dt, reduced);
  updatePrizes(state, dt, reduced);
  refillPrizes(state, api, dt);
  updatePopups(state, dt);
}

/* ------------------------------------------------------------------------------------------------
 * Rendering
 * ---------------------------------------------------------------------------------------------- */

function syncCanvasSize(canvas: HTMLCanvasElement): number {
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const width = Math.round(STAGE_W * dpr);
  const height = Math.round(STAGE_H * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return dpr;
}

function drawHighlight(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(-r * 0.34, -r * 0.36, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
}

function drawBear(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = '#a8642c';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.62, -r * 0.62, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e9b98a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.62, -r * 0.62, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#a8642c';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3d2ae';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.28, r * 0.38, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(0, r * 0.16, r * 0.11, 0, Math.PI * 2);
  ctx.arc(-r * 0.34, -r * 0.14, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.34, -r * 0.14, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Crimson bow tie
  ctx.fillStyle = COLORS.crimson;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.82);
  ctx.lineTo(-r * 0.36, r * 0.64);
  ctx.lineTo(-r * 0.36, r * 1.0);
  ctx.closePath();
  ctx.moveTo(0, r * 0.82);
  ctx.lineTo(r * 0.36, r * 0.64);
  ctx.lineTo(r * 0.36, r * 1.0);
  ctx.closePath();
  ctx.fill();
  drawHighlight(ctx, r);
}

function drawSnowman(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = COLORS.snow;
  ctx.strokeStyle = '#cfd8e3';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Bobble hat
  ctx.fillStyle = COLORS.crimson;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.55);
  ctx.quadraticCurveTo(0, -r * 1.6, r * 0.7, -r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.snow;
  ctx.beginPath();
  ctx.arc(0, -r * 1.12, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Face
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.12, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.32, -r * 0.12, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.02);
  ctx.lineTo(r * 0.42, r * 0.14);
  ctx.lineTo(0, r * 0.24);
  ctx.closePath();
  ctx.fill();
  // Pine scarf
  ctx.fillStyle = COLORS.pine;
  ctx.beginPath();
  ctx.roundRect(-r * 0.82, r * 0.44, r * 1.64, r * 0.26, r * 0.12);
  ctx.roundRect(r * 0.2, r * 0.5, r * 0.26, r * 0.5, r * 0.1);
  ctx.fill();
}

function drawGift(ctx: CanvasRenderingContext2D, r: number, variant: number): void {
  const s = r * 1.6;
  ctx.fillStyle = variant === 0 ? COLORS.crimson : COLORS.pine;
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 2, s, s, Math.max(2, r * 0.28));
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(-r * 0.17, -s / 2, r * 0.34, s);
  ctx.fillRect(-s / 2, -r * 0.17, s, r * 0.34);
  // Bow loops
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.3, -s / 2 - r * 0.16, r * 0.3, r * 0.18, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(-s / 2 + r * 0.2, -s / 2 + r * 0.2, r * 0.36, r * 0.36);
}

function drawStar(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = COLORS.gold;
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outer = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const inner = outer + Math.PI / 5;
    ctx.lineTo(Math.cos(outer) * r * 1.15, Math.sin(outer) * r * 1.15);
    ctx.lineTo(Math.cos(inner) * r * 0.5, Math.sin(inner) * r * 0.5);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawHighlight(ctx, r * 0.8);
}

function drawPrizeArt(ctx: CanvasRenderingContext2D, kind: PrizeKind, variant: number, r: number): void {
  if (kind === 'star') drawStar(ctx, r);
  else if (kind === 'gift') drawGift(ctx, r, variant);
  else if (variant === 0) drawBear(ctx, r);
  else drawSnowman(ctx, r);
}

function drawPrize(ctx: CanvasRenderingContext2D, p: Prize): void {
  ctx.save();
  if (p.state === 'spawning') ctx.globalAlpha = clamp01(p.spawnT * 1.4);
  if (p.state === 'resting' || p.state === 'spawning') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.baseY + p.r * 0.9, p.r * 0.8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(p.x, p.y);
  drawPrizeArt(ctx, p.kind, p.variant, p.r);
  ctx.restore();
}

function drawCanopy(ctx: CanvasRenderingContext2D, golden: boolean): void {
  ctx.fillStyle = COLORS.crimson;
  ctx.fillRect(0, 0, STAGE_W, CANOPY_H);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? COLORS.snow : COLORS.crimson;
    ctx.beginPath();
    ctx.arc(18 + i * 36, CANOPY_H, 18, 0, Math.PI);
    ctx.fill();
  }
  if (golden) {
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(0, CANOPY_H - 4, STAGE_W, 4);
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = golden ? COLORS.gold : COLORS.snow;
  ctx.fillText(golden ? '★ GOLDEN CLAW' : 'CLAW GRAB', 14, CANOPY_H / 2);

  // Points legend
  ctx.font = `800 13px ${FONT}`;
  for (const item of LEGEND) {
    ctx.save();
    ctx.translate(item.x, CANOPY_H / 2);
    drawPrizeArt(ctx, item.kind, 0, 8);
    ctx.restore();
    ctx.fillStyle = COLORS.snow;
    ctx.fillText(String(PRIZE_SPEC[item.kind].points), item.x + 13, CANOPY_H / 2 + 1);
  }
}

function drawCabinet(ctx: CanvasRenderingContext2D, golden: boolean): void {
  const bg = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  bg.addColorStop(0, '#fffdf9');
  bg.addColorStop(0.75, '#f5f7fa');
  bg.addColorStop(1, '#e8edf5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  if (golden) {
    ctx.fillStyle = 'rgba(245, 185, 66, 0.16)';
    ctx.fillRect(0, CANOPY_H, STAGE_W, STAGE_H - CANOPY_H);
  }

  // Snowy cabinet floor
  ctx.fillStyle = '#e4eaf3';
  ctx.fillRect(DIVIDER_X, FLOOR_Y, STAGE_W - DIVIDER_X, STAGE_H - FLOOR_Y);
  ctx.fillStyle = COLORS.snow;
  for (let x = DIVIDER_X + 10; x < STAGE_W + 10; x += 24) {
    ctx.beginPath();
    ctx.arc(x, FLOOR_Y + 2, 10, Math.PI, 0);
    ctx.fill();
  }

  // Glass divider between the pile and the chute
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.beginPath();
  ctx.roundRect(DIVIDER_X - 3, 318, 6, STAGE_H - 318, 3);
  ctx.fill();

  // Chute hint arrow
  ctx.fillStyle = 'rgba(215, 0, 21, 0.35)';
  ctx.font = `800 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▼', CHUTE_X, CHUTE.y - 14);

  drawCanopy(ctx, golden);

  // Gantry rail
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(24, RAIL_Y);
  ctx.lineTo(STAGE_W - 20, RAIL_Y);
  ctx.stroke();
}

function drawChute(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.snow;
  ctx.strokeStyle = COLORS.crimson;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(CHUTE.x, CHUTE.y, CHUTE.w, CHUTE.h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(29, 29, 31, 0.12)';
  ctx.beginPath();
  ctx.roundRect(CHUTE.x + 8, CHUTE.y + 8, CHUTE.w - 16, 12, 6);
  ctx.fill();
  ctx.fillStyle = COLORS.crimson;
  ctx.font = `800 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRIZE', CHUTE_X, CHUTE.y + 42);
  ctx.fillText('CHUTE', CHUTE_X, CHUTE.y + 56);
}

function drawAimGuide(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { claw } = state;
  if (claw.phase !== 'aim') return;
  const target = findCatch(state.prizes, claw.x, catchBonus(state));
  const startY = RAIL_Y + claw.cable + PRONG_LEN + 6;
  const endY = target ? target.y - target.r * 0.55 : FLOOR_Y;
  const color = state.golden ? 'rgba(180, 83, 9, 0.7)' : 'rgba(215, 0, 21, 0.45)';
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(claw.x, startY);
  ctx.lineTo(claw.x, endY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(claw.x, endY, target ? 4.5 : 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClaw(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { claw, golden } = state;
  const { x } = claw;
  const pivot = RAIL_Y + claw.cable;

  // Carriage
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.roundRect(x - 20, RAIL_Y - 9, 40, 18, 7);
  ctx.fill();
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(x - 11, RAIL_Y, 3, 0, Math.PI * 2);
  ctx.arc(x + 11, RAIL_Y, 3, 0, Math.PI * 2);
  ctx.fill();

  // Cable
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, RAIL_Y + 9);
  ctx.lineTo(x, pivot - 6);
  ctx.stroke();

  if (claw.held) drawPrize(ctx, claw.held);

  // Prongs (cannot close past a held prize)
  const spread = Math.max(claw.held ? claw.held.r * 0.9 : 5, 5 + claw.jaw * 25);
  ctx.save();
  if (golden) {
    ctx.shadowColor = 'rgba(245, 185, 66, 0.9)';
    ctx.shadowBlur = 12;
  }
  ctx.strokeStyle = golden ? '#f59e0b' : COLORS.amber;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * 5, pivot + 4);
    ctx.quadraticCurveTo(x + side * (spread + 10), pivot + 12, x + side * spread, pivot + PRONG_LEN);
    ctx.lineTo(x + side * (spread - 5), pivot + PRONG_LEN + 4);
    ctx.stroke();
  }
  ctx.fillStyle = golden ? COLORS.gold : '#f59e0b';
  ctx.beginPath();
  ctx.arc(x, pivot, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(x - 2.5, pivot - 2.5, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPopups(ctx: CanvasRenderingContext2D, popups: readonly Popup[]): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const pop of popups) {
    ctx.globalAlpha = clamp01(1 - pop.age / pop.life);
    ctx.font = `900 ${pop.size}px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.snow;
    ctx.strokeText(pop.text, pop.x, pop.y);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
  }
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, state: GameState, reduced: boolean): void {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.save();
  if (state.shakeT > 0 && !reduced) {
    ctx.translate(Math.sin(state.simTime * 95) * SHAKE_PX * (state.shakeT / SHAKE_SEC), 0);
  }
  drawCabinet(ctx, state.golden);

  const pile = state.prizes
    .filter((p) => p.state === 'resting' || p.state === 'spawning')
    .sort((a, b) => a.baseY - b.baseY);
  for (const p of pile) drawPrize(ctx, p);
  for (const p of state.prizes) {
    if (p.state === 'falling') drawPrize(ctx, p);
  }

  drawAimGuide(ctx, state);
  drawChute(ctx);
  drawClaw(ctx, state);
  drawPopups(ctx, state.popups);
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------------------------------- */

interface PadMoveButtonProps {
  dir: -1 | 1;
  onHoldChange: (dir: -1 | 0 | 1, from: -1 | 1) => void;
  onKeyboardNudge: (dir: -1 | 1) => void;
}

function PadMoveButton({ dir, onHoldChange, onKeyboardNudge }: PadMoveButtonProps) {
  const release = () => onHoldChange(0, dir);
  return (
    <button
      type="button"
      className="arcade-pad__btn"
      aria-label={dir < 0 ? 'Move claw left' : 'Move claw right'}
      onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHoldChange(dir, dir);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onLostPointerCapture={release}
      onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
        // detail === 0 → activated from the keyboard (Enter/Space), not by a pointer hold.
        if (e.detail === 0) onKeyboardNudge(dir);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span aria-hidden="true">{dir < 0 ? '◀' : '▶'}</span>
    </button>
  );
}

export function ClawMachineGame({ api }: PlayfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<PlayfieldApi>(api);
  const inputRef = useRef<InputState>({ keyLeft: false, keyRight: false, padDir: 0, aimDx: 0, dropRequested: false });
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  // Game loop: one rAF; simulation freezes (but keeps drawing) whenever the round is not live.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const state = createGameState();
    const input = inputRef.current;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reduced = e.matches;
    };
    motionQuery.addEventListener('change', onMotionChange);

    let last = performance.now();
    let rafId = 0;
    const frame = (now: number) => {
      const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
      last = now;
      const currentApi = apiRef.current;
      if (currentApi.isLive()) {
        updateGame(state, input, currentApi, dt, reduced);
      } else {
        input.aimDx = 0;
        input.dropRequested = false;
      }
      const dpr = syncCanvasSize(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, state, reduced);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  // Keyboard: ←/→ held to move, Space / Enter / ↓ to drop.
  useEffect(() => {
    const input = inputRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      const action = KEY_ACTIONS[e.key];
      if (!action || isTextEntry(e.target)) return;
      if (action === 'drop' && isForeignControl(e.target, padRef.current)) return;
      if (e.key !== 'Enter') e.preventDefault();
      if (!apiRef.current.isLive()) return;
      if (action === 'left') input.keyLeft = true;
      else if (action === 'right') input.keyRight = true;
      else if (!e.repeat) input.dropRequested = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const action = KEY_ACTIONS[e.key];
      if (action === 'left') input.keyLeft = false;
      else if (action === 'right') input.keyRight = false;
    };
    const onBlur = () => {
      input.keyLeft = false;
      input.keyRight = false;
      input.padDir = 0;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const requestDrop = () => {
    if (apiRef.current.isLive()) inputRef.current.dropRequested = true;
  };

  const handleHoldChange = (dir: -1 | 0 | 1, from: -1 | 1) => {
    const input = inputRef.current;
    if (dir !== 0) input.padDir = dir;
    else if (input.padDir === from) input.padDir = 0;
  };

  const handleKeyboardNudge = (dir: -1 | 1) => {
    if (apiRef.current.isLive()) inputRef.current.aimDx += dir * KEY_NUDGE;
  };

  // Canvas: drag (relative, so a finger never hides the claw) to aim; a tap drops.
  const handleCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, moved: false };
  };

  const handleCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > TAP_SLOP_PX) {
      drag.moved = true;
    }
    if (drag.moved && apiRef.current.isLive()) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0) inputRef.current.aimDx += (e.clientX - drag.lastX) * (STAGE_W / rect.width);
    }
    drag.lastX = e.clientX;
  };

  const handleCanvasPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) requestDrop();
  };

  const handleCanvasPointerCancel = () => {
    dragRef.current = null;
  };

  return (
    <>
      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={STAGE_W}
          height={STAGE_H}
          className="game-canvas"
          role="img"
          aria-label="Claw Grab prize cabinet. Move the claw over a prize and drop it: plush 1 point, gift 2, star 3. An empty grab costs a life."
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerCancel}
        />
      </div>

      <div ref={padRef} className="arcade-pad" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
        <PadMoveButton dir={-1} onHoldChange={handleHoldChange} onKeyboardNudge={handleKeyboardNudge} />
        <button
          type="button"
          className="arcade-pad__btn arcade-pad__btn--action"
          aria-label="Drop claw"
          onClick={requestDrop}
          onContextMenu={(e) => e.preventDefault()}
        >
          ⬇ DROP
        </button>
        <PadMoveButton dir={1} onHoldChange={handleHoldChange} onKeyboardNudge={handleKeyboardNudge} />
      </div>
    </>
  );
}

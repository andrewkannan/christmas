import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { createRng, randInt, randomSeed, type Rng } from '../../games/rng.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

/* ------------------------------------------------------------------ */
/* Tuning                                                              */
/* ------------------------------------------------------------------ */

/** Logical stage size; the backing store is scaled by devicePixelRatio. */
const STAGE_W = 360;
const STAGE_H = 480;
const MAX_DPR = 2;
const MAX_DT = 0.05;
const TAU = Math.PI * 2;

/**
 * Gravity and apex band are chosen together: apexes sit in the upper half of the stage and the
 * lowest throw (apex at APEX_MAX_Y) still spends ~1.9 s between leaving and re-crossing the bottom edge.
 */
const GRAVITY = 600;
const APEX_MIN_Y = 70;
const APEX_MAX_Y = 220;
/** Keeps throws (and their landing point) clear of the side edges. */
const EDGE_MARGIN = 40;
const MAX_HORIZONTAL_DRIFT = 200;

/** Extra reach (logical px) added to an item's radius when testing a blade segment. */
const SLICE_TOLERANCE = 6;
/** Blade segments shorter than this are treated as a resting finger, not a slice. */
const MIN_SEGMENT_PX = 2;
const COMBO_MIN = 3;
const MAX_TRAIL_POINTS = 32;

const MAX_ITEMS_PER_SEC = 4;
const BASE_ITEMS_PER_SEC = 1.2;
const ITEMS_PER_SEC_RAMP = 0.05;
const FIRST_SPAWN_DELAY_SEC = 0.6;
const FULL_STAGE_RETRY_SEC = 0.2;
const BOMB_FREE_SEC = 5;
const BOMB_MAX_SHARE = 0.15;
const BOMB_CHANCE = 0.13;
/** Breathing room after a bomb so the board doesn't refill the instant the shell resumes. */
const BOMB_RECOVERY_SEC = 0.9;
/** Blade angle used for keyboard slices (a short rising diagonal). */
const KEYBOARD_SLICE_ANGLE = -0.39;

const CRIMSON = '#d70015';
const PINE = '#0f6840';
const GOLD = '#f5b942';
const GINGER = '#b8692e';
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", system-ui, sans-serif';
const FROST_COLORS = ['#ffffff', '#dbeafe', '#93c5fd'] as const;
const ORNAMENT_TINTS = [CRIMSON, GOLD, PINE] as const;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TreatKind = 'ornament' | 'candy' | 'gingerbread' | 'berry';
type ItemKind = TreatKind | 'bomb';

/** Ornaments are listed twice so they are the most common treat. */
const TREAT_POOL: readonly TreatKind[] = ['ornament', 'ornament', 'candy', 'gingerbread', 'berry'];

const ITEM_RADIUS: Record<ItemKind, number> = {
  ornament: 24,
  candy: 25,
  gingerbread: 25,
  berry: 22,
  bomb: 23,
};

interface Item {
  kind: ItemKind;
  /** Main colour: ornament body, juice colour for the other treats. */
  tint: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
}

interface Half {
  kind: TreatKind;
  tint: string;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  /** Cut line angle relative to the item's own rotation. */
  cut: number;
  side: 1 | -1;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  decay: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  sub: string | null;
  size: number;
  fill: string;
  outline: string;
  life: number;
  decay: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

/** One pointerdown → pointerup gesture. */
interface Swipe {
  pointerId: number;
  x: number;
  y: number;
  hits: number;
  combo: Popup | null;
}

interface SnowDot {
  x: number;
  y: number;
  r: number;
}

interface GameState {
  rng: Rng;
  items: Item[];
  halves: Half[];
  particles: Particle[];
  popups: Popup[];
  trail: TrailPoint[];
  swipe: Swipe | null;
  spawnTimer: number;
  spawned: number;
  bombs: number;
  /** Frost flash intensity, 1 → 0. */
  flash: number;
  /** Cosmetic clock (always advances; drives the fuse spark). */
  clock: number;
  reducedMotion: boolean;
  snow: SnowDot[];
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createGameState(): GameState {
  const rng = createRng(randomSeed());
  const snow = Array.from({ length: 34 }, () => ({
    x: rng() * STAGE_W,
    y: rng() * (STAGE_H - 30),
    r: 0.8 + rng() * 1.8,
  }));
  return {
    rng,
    items: [],
    halves: [],
    particles: [],
    popups: [],
    trail: [],
    swipe: null,
    spawnTimer: FIRST_SPAWN_DELAY_SEC,
    spawned: 0,
    bombs: 0,
    flash: 0,
    clock: 0,
    reducedMotion: false,
    snow,
  };
}

function spawnRate(elapsed: number): number {
  return Math.min(MAX_ITEMS_PER_SEC, BASE_ITEMS_PER_SEC + elapsed * ITEMS_PER_SEC_RAMP);
}

function maxActive(elapsed: number): number {
  return Math.min(8, 3 + Math.floor(elapsed / 8));
}

function maxBurst(elapsed: number): number {
  if (elapsed < 8) return 1;
  if (elapsed < 20) return 2;
  if (elapsed < 35) return 3;
  return 4;
}

function canSpawnBomb(state: GameState, elapsed: number): boolean {
  return elapsed >= BOMB_FREE_SEC && (state.bombs + 1) / (state.spawned + 1) <= BOMB_MAX_SHARE;
}

function tintFor(kind: ItemKind, rng: Rng): string {
  switch (kind) {
    case 'ornament':
      return ORNAMENT_TINTS[randInt(rng, ORNAMENT_TINTS.length)];
    case 'gingerbread':
      return GINGER;
    case 'bomb':
      return '#1e3a8a';
    case 'candy':
    case 'berry':
      return CRIMSON;
  }
}

/** Throws an item from below the bottom edge in its own horizontal lane of the burst. */
function throwItem(rng: Rng, kind: ItemKind, lane: number, lanes: number): Item {
  const r = ITEM_RADIUS[kind];
  const laneW = (STAGE_W - EDGE_MARGIN * 2) / lanes;
  const x = EDGE_MARGIN + laneW * (lane + 0.2 + rng() * 0.6);
  const startY = STAGE_H + r;
  const apexY = APEX_MIN_Y + rng() * (APEX_MAX_Y - APEX_MIN_Y);
  const vy = -Math.sqrt(2 * GRAVITY * (startY - apexY));
  const airtime = (-2 * vy) / GRAVITY;
  const landX = clamp(x + (rng() - 0.5) * MAX_HORIZONTAL_DRIFT, EDGE_MARGIN, STAGE_W - EDGE_MARGIN);
  return {
    kind,
    tint: tintFor(kind, rng),
    x,
    y: startY,
    vx: (landX - x) / airtime,
    vy,
    r,
    rot: rng() * TAU,
    vrot: (rng() - 0.5) * 5,
  };
}

function hasFallenOff(item: Item): boolean {
  return item.vy > 0 && item.y - item.r > STAGE_H;
}

/** Only items whose centre is on screen can be sliced (pointer capture can reach past the edges). */
function isSliceable(item: Item): boolean {
  return item.y > 0 && item.y < STAGE_H;
}

/** Seconds until the item drops fully below the bottom edge. */
function timeToExit(item: Item): number {
  const drop = STAGE_H + item.r - item.y;
  return (item.vy + Math.sqrt(item.vy * item.vy + 2 * GRAVITY * Math.max(0, drop))) / GRAVITY;
}

/**
 * Returns the position (0..1) along segment a→b closest to the circle centre when the segment
 * passes within `radius` of it, otherwise null.
 */
function segmentHitParam(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const px = ax + dx * t - cx;
  const py = ay + dy * t - cy;
  return px * px + py * py <= radius * radius ? t : null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('button, a[href], input, select, textarea, [role="button"]') !== null)
  );
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

function runSpawner(state: GameState, elapsed: number, dt: number): void {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  const room = maxActive(elapsed) - state.items.length;
  if (room <= 0) {
    state.spawnTimer = FULL_STAGE_RETRY_SEC;
    return;
  }

  const burst = Math.min(room, 1 + randInt(state.rng, maxBurst(elapsed)));
  let bombInBurst = false;
  for (let lane = 0; lane < burst; lane += 1) {
    const isBomb = !bombInBurst && canSpawnBomb(state, elapsed) && state.rng() < BOMB_CHANCE;
    const kind: ItemKind = isBomb ? 'bomb' : TREAT_POOL[randInt(state.rng, TREAT_POOL.length)];
    state.items.push(throwItem(state.rng, kind, lane, burst));
    state.spawned += 1;
    if (isBomb) {
      state.bombs += 1;
      bombInBurst = true;
    }
  }

  // Never faster than MAX_ITEMS_PER_SEC on average, whatever the jitter.
  const jitter = 0.85 + state.rng() * 0.3;
  state.spawnTimer = Math.max(burst / MAX_ITEMS_PER_SEC, (burst / spawnRate(elapsed)) * jitter);
}

function moveItems(state: GameState, dt: number): void {
  for (const item of state.items) {
    item.vy += GRAVITY * dt;
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    if (!state.reducedMotion) item.rot += item.vrot * dt;
  }
}

/**
 * Removes items that fell off the bottom. At most one life is lost per frame: the shell pauses
 * after `loseLife`, and any other dropped treat is charged on a following live frame.
 */
function resolveMisses(state: GameState, api: PlayfieldApi): void {
  const missed = state.items.find((item) => item.kind !== 'bomb' && hasFallenOff(item));
  state.items = state.items.filter((item) => item !== missed && !(item.kind === 'bomb' && hasFallenOff(item)));
  if (!missed) return;

  state.popups.push({
    x: clamp(missed.x, 20, STAGE_W - 20),
    y: STAGE_H - 22,
    text: '✕',
    sub: null,
    size: 24,
    fill: CRIMSON,
    outline: '#ffffff',
    life: 1,
    decay: 1,
  });
  api.loseLife();
}

function stepSimulation(state: GameState, api: PlayfieldApi, dt: number): void {
  moveItems(state, dt);
  resolveMisses(state, api);
  runSpawner(state, api.elapsedSec(), dt);
}

/** Cosmetic effects keep animating while the round is paused so slices and bursts can finish. */
function stepEffects(state: GameState, dt: number): void {
  state.clock += dt;
  state.flash = Math.max(0, state.flash - dt * 1.8);

  for (const half of state.halves) {
    half.vy += GRAVITY * dt;
    half.x += half.vx * dt;
    half.y += half.vy * dt;
    half.rot += half.vrot * dt;
    half.life -= dt * 1.4;
  }
  state.halves = state.halves.filter((half) => half.life > 0);

  for (const p of state.particles) {
    p.vy += GRAVITY * 0.5 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= p.decay * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const popup of state.popups) {
    if (!state.reducedMotion) popup.y -= 40 * dt;
    popup.life -= popup.decay * dt;
  }
  state.popups = state.popups.filter((popup) => popup.life > 0);

  for (const point of state.trail) point.life -= dt * 4.8;
  state.trail = state.trail.filter((point) => point.life > 0);
}

function pushTrail(state: GameState, x: number, y: number): void {
  state.trail.push({ x, y, life: 1 });
  if (state.trail.length > MAX_TRAIL_POINTS) state.trail.shift();
}

function spawnParticles(state: GameState, x: number, y: number, count: number, colors: readonly string[], speed: number): void {
  if (state.reducedMotion) return;
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng() * TAU;
    const v = speed * (0.4 + state.rng() * 0.6);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - speed * 0.3,
      size: 1.5 + state.rng() * 2.5,
      color: colors[randInt(state.rng, colors.length)],
      life: 1,
      decay: 1.6 + state.rng() * 0.8,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Slicing                                                             */
/* ------------------------------------------------------------------ */

function sliceTreat(state: GameState, api: PlayfieldApi, item: Item, kind: TreatKind, angle: number): void {
  state.items = state.items.filter((other) => other !== item);
  api.addScore(1);

  // Halves fly apart perpendicular to the blade.
  const push = state.reducedMotion ? 25 : 80;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  for (const side of [1, -1] as const) {
    state.halves.push({
      kind,
      tint: item.tint,
      r: item.r,
      x: item.x,
      y: item.y,
      vx: item.vx * 0.5 + nx * push * side,
      vy: Math.min(item.vy, 0) * 0.4 + ny * push * side,
      rot: item.rot,
      vrot: state.reducedMotion ? 0 : side * 3,
      cut: angle - item.rot,
      side,
      life: 1,
    });
  }

  spawnParticles(state, item.x, item.y, 8, [item.tint, '#ffffff'], 140);
  state.popups.push({
    x: item.x,
    y: item.y - item.r - 6,
    text: '+1',
    sub: null,
    size: 20,
    fill: CRIMSON,
    outline: '#ffffff',
    life: 1,
    decay: 1.3,
  });
  playArcadeTone('pickup');
  triggerHaptic(10);
}

/** Awards the swipe combo incrementally (+3 on the 3rd slice, +1 per extra slice) so the bonus always equals n. */
function registerSwipeHit(state: GameState, api: PlayfieldApi, swipe: Swipe, x: number, y: number): void {
  swipe.hits += 1;
  if (swipe.hits < COMBO_MIN) return;

  api.addScore(swipe.hits === COMBO_MIN ? COMBO_MIN : 1);
  const text = `COMBO ×${swipe.hits}`;
  const sub = `+${swipe.hits} bonus`;
  const px = clamp(x, 80, STAGE_W - 80);
  const py = clamp(y - 40, 50, STAGE_H - 60);

  if (swipe.combo && swipe.combo.life > 0) {
    Object.assign(swipe.combo, { text, sub, x: px, y: py, life: 1 });
  } else {
    swipe.combo = { x: px, y: py, text, sub, size: 26, fill: GOLD, outline: '#5c3a00', life: 1, decay: 0.8 };
    state.popups.push(swipe.combo);
  }
  if (swipe.hits === COMBO_MIN) playArcadeTone('star');
}

/** A sliced frost bomb costs one life and freezes everything on screen. */
function detonate(state: GameState, api: PlayfieldApi, bomb: Item): void {
  for (const item of state.items) {
    spawnParticles(state, item.x, item.y, item === bomb ? 26 : 7, FROST_COLORS, item === bomb ? 260 : 120);
  }
  state.items = [];
  state.swipe = null;
  state.flash = 1;
  state.spawnTimer = Math.max(state.spawnTimer, BOMB_RECOVERY_SEC);
  state.popups.push({
    x: clamp(bomb.x, 70, STAGE_W - 70),
    y: clamp(bomb.y, 50, STAGE_H - 50),
    text: 'FROSTED!',
    sub: null,
    size: 24,
    fill: '#1e3a8a',
    outline: '#ffffff',
    life: 1,
    decay: 0.9,
  });
  api.loseLife();
}

/** Slices everything the blade segment a→b crosses, in order along the stroke; a bomb ends the swipe. */
function sliceAlong(state: GameState, api: PlayfieldApi, swipe: Swipe, ax: number, ay: number, bx: number, by: number): void {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx * dx + dy * dy < MIN_SEGMENT_PX * MIN_SEGMENT_PX) return;

  const hits: { item: Item; t: number }[] = [];
  for (const item of state.items) {
    if (!isSliceable(item)) continue;
    const t = segmentHitParam(ax, ay, bx, by, item.x, item.y, item.r + SLICE_TOLERANCE);
    if (t !== null) hits.push({ item, t });
  }
  hits.sort((a, b) => a.t - b.t);

  const angle = Math.atan2(dy, dx);
  for (const { item } of hits) {
    if (item.kind === 'bomb') {
      detonate(state, api, item);
      return;
    }
    sliceTreat(state, api, item, item.kind, angle);
    registerSwipeHit(state, api, swipe, item.x, item.y);
  }
}

/** Keyboard slice: the treat that will drop off the bottom soonest. */
function sliceMostUrgent(state: GameState, api: PlayfieldApi): void {
  let target: Item | null = null;
  let soonest = Infinity;
  for (const item of state.items) {
    if (item.kind === 'bomb' || !isSliceable(item)) continue;
    const t = timeToExit(item);
    if (t < soonest) {
      soonest = t;
      target = item;
    }
  }
  if (!target || target.kind === 'bomb') return;

  const reach = target.r + 12;
  for (let i = 0; i <= 4; i += 1) {
    const f = i / 4 - 0.5;
    pushTrail(state, target.x + Math.cos(KEYBOARD_SLICE_ANGLE) * reach * 2 * f, target.y + Math.sin(KEYBOARD_SLICE_ANGLE) * reach * 2 * f);
  }
  sliceTreat(state, api, target, target.kind, KEYBOARD_SLICE_ANGLE);
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState): void {
  const sky = ctx.createLinearGradient(0, 0, 0, STAGE_H);
  sky.addColorStop(0, '#ffffff');
  sky.addColorStop(1, '#edf3f8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
  for (const dot of state.snow) {
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, TAU);
    ctx.fill();
  }

  // Snowdrift along the bottom edge — treats that sink past it are missed.
  ctx.beginPath();
  ctx.moveTo(0, STAGE_H);
  ctx.lineTo(0, STAGE_H - 10);
  ctx.bezierCurveTo(70, STAGE_H - 20, 120, STAGE_H - 4, 180, STAGE_H - 12);
  ctx.bezierCurveTo(240, STAGE_H - 20, 300, STAGE_H - 4, STAGE_W, STAGE_H - 13);
  ctx.lineTo(STAGE_W, STAGE_H);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawOrnament(ctx: CanvasRenderingContext2D, r: number, tint: string): void {
  ctx.strokeStyle = '#8a6d1f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -r - 7, 3.5, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fillRect(-r * 0.28, -r - 5, r * 0.56, 8);

  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = tint === GOLD ? CRIMSON : GOLD;
  ctx.fillRect(-r, -3, r * 2, 6);
  const gloss = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, -r * 0.2, -r * 0.2, r);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

function drawCandyCane(ctx: CanvasRenderingContext2D, r: number): void {
  const cane = new Path2D();
  cane.moveTo(r * 0.25, r * 0.9);
  cane.lineTo(r * 0.25, -r * 0.3);
  cane.arc(-r * 0.12, -r * 0.3, r * 0.37, 0, Math.PI, true);

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#c7ccd4';
  ctx.lineWidth = 13;
  ctx.stroke(cane);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.stroke(cane);
  ctx.lineCap = 'butt';
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = CRIMSON;
  ctx.stroke(cane);
  ctx.setLineDash([]);
}

function drawGingerbread(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.strokeStyle = GINGER;
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.36;
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -r * 0.12);
  ctx.lineTo(r * 0.72, -r * 0.12);
  ctx.stroke();
  ctx.lineWidth = r * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.15);
  ctx.lineTo(-r * 0.48, r * 0.82);
  ctx.moveTo(0, r * 0.15);
  ctx.lineTo(r * 0.48, r * 0.82);
  ctx.stroke();

  ctx.fillStyle = GINGER;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.08, r * 0.36, r * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 0.52, r * 0.36, 0, TAU);
  ctx.fill();

  // Icing details.
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(-r * 0.13, -r * 0.6, 1.9, 0, TAU);
  ctx.arc(r * 0.13, -r * 0.6, 1.9, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 0.5, r * 0.15, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  for (const x of [-r * 0.6, r * 0.6]) {
    ctx.moveTo(x, -r * 0.25);
    ctx.lineTo(x, r * 0.01);
  }
  ctx.stroke();
  ctx.fillStyle = CRIMSON;
  ctx.beginPath();
  ctx.arc(0, -r * 0.05, 2.4, 0, TAU);
  ctx.arc(0, r * 0.22, 2.4, 0, TAU);
  ctx.fill();
}

function drawBerries(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.fillStyle = PINE;
  ctx.strokeStyle = '#0a4a2d';
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.42, -r * 0.35, r * 0.55, r * 0.24, side * 0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(side * r * 0.05, -r * 0.18);
    ctx.lineTo(side * r * 0.85, -r * 0.55);
    ctx.stroke();
  }

  const berries: [number, number][] = [
    [-r * 0.3, r * 0.15],
    [r * 0.3, r * 0.15],
    [0, -r * 0.18],
  ];
  for (const [bx, by] of berries) {
    ctx.fillStyle = CRIMSON;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.36, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(bx - r * 0.11, by - r * 0.11, r * 0.09, 0, TAU);
    ctx.fill();
  }
}

function drawBomb(ctx: CanvasRenderingContext2D, r: number, clock: number, animate: boolean): void {
  const fuseX = r * 0.45;
  const fuseY = -r - 9;
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r + 2);
  ctx.quadraticCurveTo(r * 0.1, -r - 10, fuseX, fuseY);
  ctx.stroke();

  const flicker = animate ? 0.75 + 0.25 * Math.sin(clock * 30) : 1;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.moveTo(fuseX + Math.cos(a) * 4, fuseY + Math.sin(a) * 4);
    ctx.lineTo(fuseX + Math.cos(a) * 8 * flicker, fuseY + Math.sin(a) * 8 * flicker);
  }
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(fuseX, fuseY, 4 * flicker, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(fuseX, fuseY, 1.8, 0, TAU);
  ctx.fill();

  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#3b5bab');
  body.addColorStop(1, '#0b1f4d');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#bfdbfe';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Snowflake emblem.
  const arm = r * 0.62;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let k = 0; k < 6; k += 1) {
    const a = (k * Math.PI) / 3;
    const bx = Math.cos(a) * arm * 0.6;
    const by = Math.sin(a) * arm * 0.6;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * arm, Math.sin(a) * arm);
    for (const spread of [-0.6, 0.6]) {
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + spread) * arm * 0.28, by + Math.sin(a + spread) * arm * 0.28);
    }
  }
  ctx.stroke();
}

function drawItemArt(ctx: CanvasRenderingContext2D, kind: ItemKind, tint: string, r: number, state: GameState): void {
  switch (kind) {
    case 'ornament':
      drawOrnament(ctx, r, tint);
      break;
    case 'candy':
      drawCandyCane(ctx, r);
      break;
    case 'gingerbread':
      drawGingerbread(ctx, r);
      break;
    case 'berry':
      drawBerries(ctx, r);
      break;
    case 'bomb':
      drawBomb(ctx, r, state.clock, !state.reducedMotion);
      break;
  }
}

function drawHalves(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const half of state.halves) {
    const reach = half.r + 16;
    ctx.save();
    ctx.globalAlpha = clamp(half.life, 0, 1);
    ctx.translate(half.x, half.y);
    ctx.rotate(half.rot + half.cut);
    ctx.beginPath();
    ctx.rect(-reach, half.side === 1 ? 0 : -reach, reach * 2, reach);
    ctx.clip();
    ctx.rotate(-half.cut);
    drawItemArt(ctx, half.kind, half.tint, half.r, state);
    // Cream cut face along the blade line.
    ctx.rotate(half.cut);
    ctx.strokeStyle = 'rgba(255, 248, 230, 0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-half.r * 0.8, 0);
    ctx.lineTo(half.r * 0.8, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawItems(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const item of state.items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot);
    drawItemArt(ctx, item.kind, item.tint, item.r, state);
    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTrail(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.lineCap = 'round';
  for (let i = 1; i < state.trail.length; i += 1) {
    const p0 = state.trail[i - 1];
    const p1 = state.trail[i];
    const life = clamp(p1.life, 0, 1);
    ctx.strokeStyle = `rgba(215, 0, 21, ${life})`;
    ctx.lineWidth = 8 * life;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 211, 105, ${life})`;
    ctx.lineWidth = 3 * life;
    ctx.stroke();
  }
}

function drawPopups(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const popup of state.popups) {
    ctx.globalAlpha = clamp(popup.life * 1.5, 0, 1);
    ctx.font = `900 ${popup.size}px ${FONT_STACK}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = popup.outline;
    ctx.strokeText(popup.text, popup.x, popup.y);
    ctx.fillStyle = popup.fill;
    ctx.fillText(popup.text, popup.x, popup.y);
    if (popup.sub) {
      const subY = popup.y + popup.size * 0.85;
      ctx.font = `800 ${Math.round(popup.size * 0.55)}px ${FONT_STACK}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(popup.sub, popup.x, subY);
      ctx.fillStyle = popup.outline;
      ctx.fillText(popup.sub, popup.x, subY);
    }
  }
  ctx.globalAlpha = 1;
}

/** Keeps the backing store at logical size × devicePixelRatio (capped) and returns the scale. */
function syncBackingStore(canvas: HTMLCanvasElement): number {
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const width = Math.round(STAGE_W * dpr);
  const height = Math.round(STAGE_H * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return dpr;
}

function render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState): void {
  const dpr = syncBackingStore(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, state);
  drawHalves(ctx, state);
  drawItems(ctx, state);
  drawParticles(ctx, state);
  drawTrail(ctx, state);
  if (state.flash > 0) {
    const peak = state.reducedMotion ? 0.35 : 0.6;
    ctx.fillStyle = `rgba(214, 232, 255, ${state.flash * peak})`;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
  drawPopups(ctx, state);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function prefersFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function FruitSlashGame({ api }: PlayfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameState | null>(null);
  if (gameRef.current === null) gameRef.current = createGameState();
  const game = gameRef.current;

  const hintId = useId();
  // Keyboard hint is shown on hover-capable devices; elsewhere it stays available to screen readers.
  const [showKeyHint] = useState(prefersFinePointer);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    game.reducedMotion = motionQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent) => {
      game.reducedMotion = event.matches;
    };
    motionQuery.addEventListener('change', onMotionChange);

    let rafId = 0;
    let lastTs = performance.now();
    const frame = (now: number) => {
      const dt = clamp((now - lastTs) / 1000, 0, MAX_DT);
      lastTs = now;
      if (api.isLive()) stepSimulation(game, api, dt);
      stepEffects(game, dt);
      render(ctx, canvas, game);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, [api, game]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (isInteractiveTarget(event.target)) return;
      event.preventDefault();
      if (event.repeat || !api.isLive()) return;
      sliceMostUrgent(game, api);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [api, game]);

  const toStage = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * STAGE_W, 0, STAGE_W),
      y: clamp(((event.clientY - rect.top) / rect.height) * STAGE_H, 0, STAGE_H),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (game.swipe) return; // one blade at a time
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = toStage(event);
    game.swipe = { pointerId: event.pointerId, x, y, hits: 0, combo: null };
    if (api.isLive()) pushTrail(game, x, y);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const swipe = game.swipe;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const { x, y } = toStage(event);
    if (api.isLive()) {
      pushTrail(game, x, y);
      sliceAlong(game, api, swipe, swipe.x, swipe.y, x, y);
    }
    swipe.x = x;
    swipe.y = y;
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (game.swipe?.pointerId === event.pointerId) game.swipe = null;
  };

  return (
    <>
      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          role="img"
          aria-label="Berry Slash: Christmas treats are tossed up from the bottom. Swipe across them to slice them, don't let any fall, and avoid the dark blue frost bombs."
          aria-describedby={hintId}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
        />
      </div>
      <p id={hintId} className={showKeyHint ? 'game-hint-pill' : 'visually-hidden'}>
        Keyboard: press Space to slice the treat closest to falling
      </p>
    </>
  );
}

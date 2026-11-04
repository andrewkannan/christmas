import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PlayfieldApi, PlayfieldProps } from '../../games/playfield.ts';
import { GAME_RULES } from '../../games/rules.ts';
import { createRng, randInt, randomSeed, type Rng } from '../../games/rng.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

type Lane = 0 | 1 | 2;
type PickupKind = 'coin' | 'gift' | 'star';
type EntityKind = PickupKind | 'barrier';

interface TrackEntity {
  kind: EntityKind;
  lane: Lane;
  /** Rendered lane position; eases toward `lane` when the star magnet pulls a pickup across. */
  drawLane: number;
  /** Depth along the street: 0 at the horizon, 1 at Santa's plane. */
  z: number;
  done: boolean;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

interface PointerTrack {
  id: number;
  startX: number;
  startY: number;
  swiped: boolean;
}

interface DashState {
  rng: Rng;
  lane: Lane;
  /** Open lanes of the most recently spawned row — the lanes a surviving player can be in. */
  prevOpenLanes: readonly Lane[];
  entities: TrackEntity[];
  popups: ScorePopup[];
  spawnTimer: number;
  scroll: number;
  /** Live-elapsed second at which the star magnet ends. */
  magnetUntil: number;
  /** Live-elapsed second at which post-hit invulnerability ends. */
  invulnerableUntil: number;
  visualX: number;
  hop: number;
  hitFlash: number;
  shake: number;
  pointer: PointerTrack | null;
}

interface Difficulty {
  speed: number;
  spawnInterval: number;
  barrierChance: number;
  doubleBarrierChance: number;
}

// Logical stage (CSS aspect ratio 3:4) and pseudo-3D projection.
const STAGE_W = 360;
const STAGE_H = 480;
const HORIZON_Y = 108;
const PLAYER_Y = 418;
const ROAD_TOP_HALF = 56;
const ROAD_BOTTOM_HALF = 162;
const LANE_SPREAD_HORIZON = 34;
const LANE_SPREAD_PLAYER = 104;
const MAX_DPR = 2;

const ROUND_SEC = GAME_RULES['santa-dash'].timeLimitSec;
const MAX_DT = 0.05;
const LANES: readonly Lane[] = [0, 1, 2];

const POINTS: Record<PickupKind, number> = { coin: 1, gift: 3, star: 5 };
const PICKUP_CHANCE = 0.85;
const STAR_CHANCE = 0.06;
const GIFT_CHANCE = 0.26;

const MAGNET_SEC = 4;
const MAGNET_REACH_Z = 0.45;
const INVULNERABLE_SEC = 1.2;
const HIT_CLEAR_Z = 0.55;
const COLLIDE_MIN_Z = 0.9;
const COLLIDE_MAX_Z = 1.04;
const DESPAWN_Z = 1.15;
const FADE_IN_Z = 0.08;

const FIRST_SPAWN_DELAY_SEC = 0.35;
const MIN_SPAWN_INTERVAL_SEC = 0.3;

const HOP_SEC = 0.16;
const HOP_PX = 14;
const HIT_FLASH_SEC = 0.3;
const SHAKE_SEC = 0.3;
const SHAKE_PX = 6;
const POPUP_SEC = 0.8;
const POPUP_RISE_PX = 40;
const BLINK_PERIOD_MS = 340;

const SWIPE_PX = 24;
const TAP_SLOP_PX = 12;

const COLORS = {
  crimson: '#d70015',
  pine: '#0f6840',
  gold: '#f5b942',
  goldDeep: '#a86a0c',
  ink: '#1d1d1f',
  snow: '#f8fafc',
  road: '#e2e8f0',
  roadHit: '#fde2e4',
  skyTop: '#dbeafe',
  white: '#ffffff',
} as const;

const POPUP_COLORS: Record<PickupKind, string> = {
  coin: COLORS.goldDeep,
  gift: COLORS.pine,
  star: COLORS.crimson,
};

/** Every way to block one or two lanes. Three blocked lanes is never an option. */
const BARRIER_SETS: Record<1 | 2, readonly (readonly Lane[])[]> = {
  1: [[0], [1], [2]],
  2: [
    [0, 1],
    [0, 2],
    [1, 2],
  ],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth ramp over the round's time cap (smoothstep keeps the start gentle and the end steady). */
function difficultyAt(elapsedSec: number): Difficulty {
  const t = Math.min(1, Math.max(0, elapsedSec / ROUND_SEC));
  const eased = t * t * (3 - 2 * t);
  return {
    speed: lerp(0.6, 1.1, eased),
    spawnInterval: Math.max(MIN_SPAWN_INTERVAL_SEC, lerp(0.85, 0.38, eased)),
    barrierChance: lerp(0.45, 0.8, eased),
    doubleBarrierChance: lerp(0.08, 0.4, eased),
  };
}

/** A row is fair when every lane a player could survive the previous row in is one lane change from safety. */
function isDodgeable(prevOpen: readonly Lane[], nextOpen: readonly Lane[]): boolean {
  return prevOpen.every((from) => nextOpen.some((to) => Math.abs(from - to) <= 1));
}

function openLanesFor(blocked: readonly Lane[]): Lane[] {
  return LANES.filter((lane) => !blocked.includes(lane));
}

function pickBarrierLanes(rng: Rng, prevOpen: readonly Lane[], d: Difficulty): readonly Lane[] {
  const roll = rng();
  let count = roll < d.doubleBarrierChance ? 2 : roll < d.barrierChance ? 1 : 0;
  while (count > 0) {
    const fair = BARRIER_SETS[count as 1 | 2].filter((set) => isDodgeable(prevOpen, openLanesFor(set)));
    if (fair.length > 0) return fair[randInt(rng, fair.length)];
    count -= 1;
  }
  return [];
}

function pickPickupKind(rng: Rng): PickupKind {
  const roll = rng();
  if (roll < STAR_CHANCE) return 'star';
  if (roll < STAR_CHANCE + GIFT_CHANCE) return 'gift';
  return 'coin';
}

function laneCenterX(lane: number, z: number): number {
  const spread = lerp(LANE_SPREAD_HORIZON, LANE_SPREAD_PLAYER, z);
  return STAGE_W / 2 + (lane - 1) * spread;
}

function zToY(z: number): number {
  const curved = z * z * 0.65 + z * 0.35;
  return HORIZON_Y + (PLAYER_Y - HORIZON_Y) * curved;
}

function createDashState(): DashState {
  return {
    rng: createRng(randomSeed()),
    lane: 1,
    prevOpenLanes: LANES,
    entities: [],
    popups: [],
    spawnTimer: FIRST_SPAWN_DELAY_SEC,
    scroll: 0,
    magnetUntil: 0,
    invulnerableUntil: 0,
    visualX: laneCenterX(1, 1),
    hop: 0,
    hitFlash: 0,
    shake: 0,
    pointer: null,
  };
}

// ---------------------------------------------------------------------------
// Simulation (only advanced while the round is live)
// ---------------------------------------------------------------------------

function spawnRow(st: DashState, d: Difficulty): void {
  const blocked = pickBarrierLanes(st.rng, st.prevOpenLanes, d);
  const open = openLanesFor(blocked);
  st.prevOpenLanes = open;

  for (const lane of blocked) {
    st.entities.push({ kind: 'barrier', lane, drawLane: lane, z: 0, done: false });
  }
  if (st.rng() < PICKUP_CHANCE) {
    const lane = open[randInt(st.rng, open.length)];
    st.entities.push({ kind: pickPickupKind(st.rng), lane, drawLane: lane, z: 0, done: false });
  }
}

function collectPickup(st: DashState, api: PlayfieldApi, ent: TrackEntity, kind: PickupKind, elapsed: number): void {
  ent.done = true;
  const points = POINTS[kind];
  api.addScore(points);
  st.popups.push({
    x: laneCenterX(st.lane, 1),
    y: PLAYER_Y - 58,
    text: `+${points}`,
    color: POPUP_COLORS[kind],
    age: 0,
  });
  if (kind === 'star') {
    st.magnetUntil = elapsed + MAGNET_SEC;
    playArcadeTone('star');
    triggerHaptic(22);
  } else {
    playArcadeTone('pickup');
    triggerHaptic(kind === 'gift' ? 14 : 8);
  }
}

function hitBarrier(st: DashState, api: PlayfieldApi, elapsed: number): void {
  // Clear the immediate danger so the player isn't hit again straight after the shell's pause.
  st.entities = st.entities.filter(
    (e) => !e.done && e.z < DESPAWN_Z && !(e.kind === 'barrier' && e.z > HIT_CLEAR_Z),
  );
  st.invulnerableUntil = elapsed + INVULNERABLE_SEC;
  st.hitFlash = HIT_FLASH_SEC;
  st.shake = SHAKE_SEC;
  api.loseLife();
}

function stepSimulation(st: DashState, api: PlayfieldApi, dt: number): void {
  const elapsed = api.elapsedSec();
  const d = difficultyAt(elapsed);

  st.scroll = (st.scroll + d.speed * dt * 8) % 1;
  st.spawnTimer -= dt;
  if (st.spawnTimer <= 0) {
    spawnRow(st, d);
    st.spawnTimer += d.spawnInterval;
  }

  const magnetOn = elapsed < st.magnetUntil;
  const laneEase = Math.min(1, dt * 12);
  for (const ent of st.entities) {
    ent.z += d.speed * dt;
    if (magnetOn && (ent.kind === 'coin' || ent.kind === 'gift') && ent.z > MAGNET_REACH_Z) {
      ent.lane = st.lane;
    }
    ent.drawLane += (ent.lane - ent.drawLane) * laneEase;
  }

  const invulnerable = elapsed < st.invulnerableUntil;
  for (const ent of st.entities) {
    if (ent.done || ent.lane !== st.lane || ent.z < COLLIDE_MIN_Z || ent.z > COLLIDE_MAX_Z) continue;
    if (ent.kind === 'barrier') {
      if (invulnerable) continue;
      hitBarrier(st, api, elapsed);
      return; // exactly one life per hit; the shell pauses from here
    }
    collectPickup(st, api, ent, ent.kind, elapsed);
  }

  st.entities = st.entities.filter((e) => !e.done && e.z < DESPAWN_Z);
}

/** Cosmetic easing and timers; runs every frame (even while paused) so effects settle naturally. */
function stepVisuals(st: DashState, dt: number): void {
  st.visualX += (laneCenterX(st.lane, 1) - st.visualX) * Math.min(1, dt * 18);
  st.hop = Math.max(0, st.hop - dt);
  st.hitFlash = Math.max(0, st.hitFlash - dt);
  st.shake = Math.max(0, st.shake - dt);
  for (const p of st.popups) p.age += dt;
  st.popups = st.popups.filter((p) => p.age < POPUP_SEC);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function syncBackingStore(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const width = Math.round(STAGE_W * dpr);
  const height = Math.round(STAGE_H * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / STAGE_W, 0, 0, height / STAGE_H, 0, 0);
}

function drawStreet(ctx: CanvasRenderingContext2D, st: DashState): void {
  const cx = STAGE_W / 2;

  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 20);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.white);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, STAGE_W, HORIZON_Y + 20);

  ctx.fillStyle = COLORS.snow;
  ctx.fillRect(0, HORIZON_Y, STAGE_W, STAGE_H - HORIZON_Y);

  ctx.fillStyle = st.hitFlash > 0 ? COLORS.roadHit : COLORS.road;
  ctx.beginPath();
  ctx.moveTo(cx - ROAD_TOP_HALF, HORIZON_Y);
  ctx.lineTo(cx + ROAD_TOP_HALF, HORIZON_Y);
  ctx.lineTo(cx + ROAD_BOTTOM_HALF, STAGE_H);
  ctx.lineTo(cx - ROAD_BOTTOM_HALF, STAGE_H);
  ctx.closePath();
  ctx.fill();

  // Candy-cane curbs
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.crimson;
  ctx.beginPath();
  ctx.moveTo(cx - ROAD_TOP_HALF, HORIZON_Y);
  ctx.lineTo(cx - ROAD_BOTTOM_HALF, STAGE_H);
  ctx.moveTo(cx + ROAD_TOP_HALF, HORIZON_Y);
  ctx.lineTo(cx + ROAD_BOTTOM_HALF, STAGE_H);
  ctx.stroke();
  ctx.strokeStyle = COLORS.white;
  ctx.setLineDash([10, 10]);
  ctx.lineDashOffset = -st.scroll * 20;
  ctx.stroke();

  // Perspective lane dividers
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 14]);
  ctx.lineDashOffset = -st.scroll * 28;
  ctx.beginPath();
  ctx.moveTo(cx - 19, HORIZON_Y);
  ctx.lineTo(cx - 54, STAGE_H);
  ctx.moveTo(cx + 19, HORIZON_Y);
  ctx.lineTo(cx + 54, STAGE_H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pine trees along the snowy avenue
  ctx.fillStyle = COLORS.pine;
  for (let i = 0; i < 4; i++) {
    const tz = (i * 0.25 + st.scroll * 0.25) % 1;
    const ty = zToY(tz);
    const scale = 0.35 + tz * 0.85;
    for (const side of [-1, 1]) {
      const tx = cx + side * (72 + tz * 118);
      ctx.beginPath();
      ctx.moveTo(tx, ty - 34 * scale);
      ctx.lineTo(tx - 15 * scale, ty);
      ctx.lineTo(tx + 15 * scale, ty);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function traceStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawEntity(ctx: CanvasRenderingContext2D, ent: TrackEntity): void {
  const scale = 0.35 + ent.z * 0.78;
  ctx.save();
  ctx.globalAlpha = Math.min(1, ent.z / FADE_IN_Z);
  ctx.translate(laneCenterX(ent.drawLane, ent.z), zToY(ent.z));
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (ent.kind) {
    case 'barrier':
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.roundRect(-28, -24, 56, 26, 6);
      ctx.fill();
      ctx.fillStyle = COLORS.crimson;
      ctx.fillRect(-24, -20, 48, 12);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(-10, -20, 10, 12);
      ctx.fillRect(10, -20, 10, 12);
      break;
    case 'gift':
      ctx.fillStyle = COLORS.pine;
      ctx.beginPath();
      ctx.roundRect(-18, -32, 36, 34, 7);
      ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(-4, -32, 8, 34);
      ctx.fillRect(-18, -18, 36, 7);
      ctx.beginPath();
      ctx.arc(-6, -35, 5, 0, Math.PI * 2);
      ctx.arc(6, -35, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'star':
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(0, -18, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.white;
      traceStar(ctx, 0, -18, 12, 5);
      ctx.fill();
      break;
    case 'coin':
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(0, -15, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Bell silhouette
      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.quadraticCurveTo(-6, -22, 0, -22);
      ctx.quadraticCurveTo(6, -22, 7, -9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -7.5, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function drawSanta(ctx: CanvasRenderingContext2D, st: DashState, magnetOn: boolean, alpha: number, now: number): void {
  const lift = st.hop > 0 ? Math.sin((st.hop / HOP_SEC) * Math.PI) * HOP_PX : 0;
  ctx.save();
  ctx.translate(st.visualX, PLAYER_Y - lift);

  if (magnetOn) {
    ctx.strokeStyle = 'rgba(245, 185, 66, 0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -14, 34 + Math.sin(now / 80) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = alpha;
  // Sleigh body and gold runners
  ctx.fillStyle = COLORS.crimson;
  ctx.beginPath();
  ctx.roundRect(-24, -28, 48, 28, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(-26, -3, 52, 5);
  // Santa hat
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(0, -34, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.crimson;
  ctx.beginPath();
  ctx.moveTo(-11, -34);
  ctx.lineTo(11, -34);
  ctx.lineTo(3, -50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(3, -51, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPopups(ctx: CanvasRenderingContext2D, popups: readonly ScorePopup[], reducedMotion: boolean): void {
  ctx.save();
  ctx.font = '800 20px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.white;
  for (const p of popups) {
    const t = p.age / POPUP_SEC;
    const y = reducedMotion ? p.y : p.y - t * POPUP_RISE_PX;
    ctx.globalAlpha = 1 - t;
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, y);
  }
  ctx.restore();
}

function drawMagnetBanner(ctx: CanvasRenderingContext2D, remainingFraction: number): void {
  const barW = 120;
  ctx.save();
  ctx.fillStyle = COLORS.goldDeep;
  ctx.font = '800 13px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ Star magnet ★', STAGE_W / 2, 28);
  ctx.fillStyle = 'rgba(168, 106, 12, 0.18)';
  ctx.beginPath();
  ctx.roundRect(STAGE_W / 2 - barW / 2, 36, barW, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.roundRect(STAGE_W / 2 - barW / 2, 36, barW * remainingFraction, 5, 2.5);
  ctx.fill();
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  st: DashState,
  elapsed: number,
  now: number,
  reducedMotion: boolean,
): void {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.save();
  if (st.shake > 0 && !reducedMotion) {
    const amp = SHAKE_PX * (st.shake / SHAKE_SEC);
    ctx.translate(Math.sin(now * 0.09) * amp, Math.cos(now * 0.11) * amp * 0.5);
  }

  drawStreet(ctx, st);
  // Everything moves at the same speed, so spawn order is depth order: draw newest (farthest) first.
  for (let i = st.entities.length - 1; i >= 0; i--) drawEntity(ctx, st.entities[i]);

  const magnetLeft = st.magnetUntil - elapsed;
  const invulnerable = elapsed < st.invulnerableUntil;
  const blinkOff = Math.floor(now / (BLINK_PERIOD_MS / 2)) % 2 === 1;
  const santaAlpha = !invulnerable ? 1 : reducedMotion ? 0.5 : blinkOff ? 0.25 : 1;
  drawSanta(ctx, st, magnetLeft > 0, santaAlpha, now);
  drawPopups(ctx, st.popups, reducedMotion);
  ctx.restore();

  if (magnetLeft > 0) drawMagnetBanner(ctx, Math.min(1, magnetLeft / MAGNET_SEC));
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

function keyToLaneDelta(key: string): -1 | 0 | 1 {
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return -1;
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return 1;
  return 0;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Santa Dash playfield: a 3-lane Christmas runner. The GameShell owns HUD, lives, timer and results. */
export function SantaStreetDash({ api }: PlayfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef(api);
  // Stable mutable game state, created once per mount; mutated by the loop and never used for rendering.
  const [st] = useState(createDashState);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const shiftLane = useCallback(
    (delta: -1 | 1) => {
      if (!apiRef.current.isLive()) return;
      const next = Math.max(0, Math.min(2, st.lane + delta)) as Lane;
      if (next === st.lane) return;
      st.lane = next;
      st.hop = HOP_SEC;
      playArcadeTone('tap');
      triggerHaptic(10);
    },
    [st],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rafId = 0;
    let lastTs = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(MAX_DT, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;
      const liveApi = apiRef.current;
      if (liveApi.isLive()) stepSimulation(st, liveApi, dt);
      stepVisuals(st, dt);
      syncBackingStore(canvas, ctx);
      drawFrame(ctx, st, liveApi.elapsedSec(), now, motionQuery.matches);
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [st]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTextEntryTarget(e.target)) return;
      if (!apiRef.current.isLive()) return;
      const delta = keyToLaneDelta(e.key);
      if (delta !== 0) {
        e.preventDefault();
        if (!e.repeat) shiftLane(delta);
      } else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        // Stop page scroll mid-run, but let Space still activate a focused button.
        e.preventDefault();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shiftLane]);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary) return;
    st.pointer = { id: e.pointerId, startX: e.clientX, startY: e.clientY, swiped: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety for swipes that leave the canvas; tracking still works without it.
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = st.pointer;
    if (!p || p.id !== e.pointerId || p.swiped) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      p.swiped = true;
      shiftLane(dx < 0 ? -1 : 1);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = st.pointer;
    if (!p || p.id !== e.pointerId) return;
    st.pointer = null;
    if (p.swiped || Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > TAP_SLOP_PX) return;
    // Tap the left or right third of the street to step one lane that way.
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    if (rel < 1 / 3) shiftLane(-1);
    else if (rel > 2 / 3) shiftLane(1);
  };

  const onPointerCancel = () => {
    st.pointer = null;
  };

  return (
    <>
      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          role="img"
          aria-label="Santa Dash: steer Santa's sleigh across three lanes to collect bells, gifts and stars while dodging barriers."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      </div>

      {/* Pointer-down for instant touch response; onClick with detail 0 covers keyboard activation only. */}
      <div className="arcade-pad" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button
          type="button"
          className="arcade-pad__btn"
          aria-label="Move to left lane"
          onPointerDown={(e) => {
            if (e.button === 0) shiftLane(-1);
          }}
          onClick={(e) => {
            if (e.detail === 0) shiftLane(-1);
          }}
        >
          <span aria-hidden="true">◀</span> Left lane
        </button>
        <button
          type="button"
          className="arcade-pad__btn"
          aria-label="Move to right lane"
          onPointerDown={(e) => {
            if (e.button === 0) shiftLane(1);
          }}
          onClick={(e) => {
            if (e.detail === 0) shiftLane(1);
          }}
        >
          Right lane <span aria-hidden="true">▶</span>
        </button>
      </div>
    </>
  );
}

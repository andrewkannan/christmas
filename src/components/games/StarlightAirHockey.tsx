import { useEffect, useRef } from 'react';
import type { HockeyRoomSnapshot } from '../../types.ts';
import {
  clamp,
  clampPlayerHalfPoint,
  createHockeyMatchState,
  GOAL_LEFT,
  GOAL_RIGHT,
  GOAL_WIDTH,
  HOCKEY_WIN_GOALS,
  PUCK_RADIUS,
  RINK_HEIGHT,
  RINK_MID_Y,
  RINK_WIDTH,
  setPlayerStrikerTarget,
  STAR_GATE_RADIUS,
  stepHockeyMatch,
  STRIKER_RADIUS,
  toRoomSnapshot,
} from '../../games/hockeyLogic.ts';
import type { PlayfieldProps } from '../../games/playfield.ts';
import { createRng, randomSeed } from '../../games/rng.ts';
import {
  fetchHockeyRoomSnapshot,
  leaveHockeyRoomKeepalive,
  sendHockeyStrikerInput,
} from '../../lib/api.ts';
import { playArcadeTone, triggerHaptic } from '../../lib/sound.ts';

const CANVAS_W = 360;
const CANVAS_H = 480;
const RADAR_TOP = 8;
const RADAR_BOTTOM = 58;
const PORTAL_Y = 64;
const ICE_BOTTOM = 472;
const HALF_SPAN_CANVAS = ICE_BOTTOM - PORTAL_Y; // 408px for 450 rink units

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  ttl: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  age: number;
  ttl: number;
}

interface TrailPoint {
  x: number;
  y: number;
  turbo: boolean;
}

function playerYToCanvasY(py: number): number {
  if (py >= RINK_MID_Y) {
    return PORTAL_Y + ((py - RINK_MID_Y) / RINK_MID_Y) * HALF_SPAN_CANVAS;
  }
  // Opponent half [0..450] maps into the compact top radar [RADAR_TOP..RADAR_BOTTOM]
  return RADAR_TOP + (py / RINK_MID_Y) * (RADAR_BOTTOM - RADAR_TOP);
}

function canvasToPlayerHalf(cx: number, cy: number): { x: number; y: number } {
  const ratio = clamp((cy - PORTAL_Y) / HALF_SPAN_CANVAS, 0, 1);
  const py = RINK_MID_Y + ratio * RINK_MID_Y;
  return clampPlayerHalfPoint(cx, py);
}

export function StarlightAirHockey({ api, hockeySession, onMatchTallies }: PlayfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef(api);
  apiRef.current = api;
  const talliesCbRef = useRef(onMatchTallies);
  talliesCbRef.current = onMatchTallies;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const session = hockeySession ?? {
      mode: 'solo' as const,
      myName: 'Player 1',
      opponentName: 'Frosty Elf Bot',
    };
    const isLiveRoom =
      (session.mode === 'host' || session.mode === 'joiner') &&
      Boolean(session.roomCode && session.playerToken);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rng = createRng(randomSeed());

    // Local simulation state (used when mode === 'solo')
    const soloState = createHockeyMatchState({
      code: 'SOLO',
      hostName: session.myName,
      joinerName: session.opponentName,
      joinerIsBot: true,
      status: 'playing',
      rng,
    });

    // Latest snapshot (updated from local engine in solo mode, or from SSE/HTTP in live 2-phone mode)
    let latestSnap: HockeyRoomSnapshot =
      session.initialSnapshot ?? toRoomSnapshot(soloState, 'host', performance.now());
    let snapReceivedAt = performance.now();

    // Local striker target in player-centric bottom-half coords [450..900]
    let myTarget = clampPlayerHalfPoint(RINK_WIDTH / 2, RINK_HEIGHT - 86);
    let myRenderPos = { ...myTarget };
    let pointerActive = false;
    let activePointerId: number | null = null;
    const heldKeys = new Set<string>();

    // Score & goal tracking so we push exact deltas to GameShell
    let reportedScore = 0;
    let lastGoalSeq = latestSnap.lastGoal?.seq ?? 0;
    let lastTalliesKey = '';
    let feverAnnounced = false;
    let goalFlashMs = 0;
    let goalFlashMine = true;

    const popups: FloatingPopup[] = [];
    const sparks: Spark[] = [];
    const trails = new Map<number, TrailPoint[]>();

    const addPopup = (x: number, y: number, text: string, color: string, ttl = 0.85) => {
      popups.push({ x, y, text, color, age: 0, ttl });
    };

    const emitSparks = (cx: number, cy: number, color: string, count: number) => {
      if (reducedMotion) return;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rng() * 0.4;
        const speed = 60 + rng() * 140;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          age: 0,
          ttl: 0.36 + rng() * 0.22,
        });
      }
    };

    const syncSnapshotEffects = (snap: HockeyRoomSnapshot) => {
      // Sync arcade points to GameShell HUD
      const delta = snap.myArcadeScore - reportedScore;
      if (delta > 0 && apiRef.current.isLive()) {
        apiRef.current.addScore(delta);
        reportedScore += delta;
      }

      // Sync goal scoreboard to GameShell HUD
      const oppLabel = snap.oppStriker.botControlled
        ? 'Elf Bot'
        : snap.oppStriker.name || session.opponentName;
      const talliesKey = `${snap.myGoals}:${snap.oppGoals}:${oppLabel}`;
      if (talliesKey !== lastTalliesKey) {
        lastTalliesKey = talliesKey;
        talliesCbRef.current?.({
          myGoals: snap.myGoals,
          oppGoals: snap.oppGoals,
          opponentName: oppLabel,
        });
      }

      // Goal celebration banner, sound & sparks
      if (snap.lastGoal && snap.lastGoal.seq > lastGoalSeq) {
        lastGoalSeq = snap.lastGoal.seq;
        if (snap.lastGoal.scorer === 'me') {
          goalFlashMs = 750;
          goalFlashMine = true;
          playArcadeTone('win');
          triggerHaptic([35, 25, 50]);
          addPopup(
            CANVAS_W / 2,
            PORTAL_Y + 46,
            snap.lastGoal.turbo ? `TURBO GOAL! +${snap.lastGoal.points}` : `GOAL! +${snap.lastGoal.points}`,
            '#fbbf24',
            1.1
          );
          emitSparks(CANVAS_W / 2, PORTAL_Y + 6, '#fde047', 16);
        } else {
          goalFlashMs = 620;
          goalFlashMine = false;
          playArcadeTone('hit');
          triggerHaptic(45);
          addPopup(CANVAS_W / 2, ICE_BOTTOM - 64, `${oppLabel.toUpperCase()} SCORED`, '#f87171', 0.95);
          emitSparks(CANVAS_W / 2, ICE_BOTTOM - 8, '#f87171', 12);
        }
      }

      // Double Puck Fever callout
      if (!feverAnnounced && snap.pucks.length >= 2) {
        feverAnnounced = true;
        playArcadeTone('star');
        addPopup(CANVAS_W / 2, PORTAL_Y + 95, 'DOUBLE PUCK FEVER!', '#fde047', 1.25);
      }

      // Live room match completion
      if (isLiveRoom && snap.status === 'finished') {
        const finalDelta = snap.myArcadeScore - reportedScore;
        if (finalDelta > 0 && apiRef.current.isLive()) {
          apiRef.current.addScore(finalDelta);
          reportedScore += finalDelta;
        }
        const reason =
          snap.myGoals >= snap.winGoals || snap.oppGoals >= snap.winGoals ? 'knockout' : 'time';
        apiRef.current.endRound(reason);
      }
    };

    // Initial tally report
    syncSnapshotEffects(latestSnap);

    // --- Live 2-Phone Networking (SSE + Input Sync + Fallback Poll) ---
    let es: EventSource | null = null;
    let fallbackPollTimer: number | null = null;
    let inputLoopTimer: number | null = null;
    let unmounted = false;
    let lastSentX = -1;
    let lastSentY = -1;
    let lastSentAtMs = 0;
    let inputInFlight = false;

    if (isLiveRoom && session.roomCode && session.playerToken) {
      const roomCode = session.roomCode;
      const token = session.playerToken;

      const ingestRemoteSnapshot = (snap: HockeyRoomSnapshot) => {
        if (unmounted) return;
        if (snap.serverTimeMs < latestSnap.serverTimeMs && snap.status === latestSnap.status) {
          return;
        }
        const prevScore = latestSnap.myArcadeScore;
        const prevSeq = latestSnap.lastGoal?.seq ?? 0;
        latestSnap = snap;
        snapReceivedAt = performance.now();

        // Show strike/gate popup on non-goal score bumps in live mode
        const nonGoalGain =
          (snap.lastGoal?.seq ?? 0) === prevSeq ? snap.myArcadeScore - prevScore : 0;
        if (nonGoalGain > 0 && snap.status === 'playing') {
          playArcadeTone(nonGoalGain >= 5 ? 'star' : 'pickup');
          triggerHaptic(16);
          addPopup(
            myRenderPos.x,
            playerYToCanvasY(myRenderPos.y) - 28,
            nonGoalGain >= 5 ? `STAR GATE +${nonGoalGain}` : `+${nonGoalGain}`,
            nonGoalGain >= 5 ? '#fde047' : '#86efac'
          );
        }

        syncSnapshotEffects(snap);
      };

      const isRoomFinished = () => latestSnap.status === 'finished';

      const startFallbackPolling = () => {
        if (unmounted || fallbackPollTimer !== null) return;
        const poll = async () => {
          if (unmounted || isRoomFinished()) return;
          try {
            const { snapshot } = await fetchHockeyRoomSnapshot(roomCode, token);
            ingestRemoteSnapshot(snapshot);
          } catch {
            // Transient mobile data hiccup — keep trying smoothly
          }
          if (!unmounted && !isRoomFinished()) {
            fallbackPollTimer = window.setTimeout(poll, 200);
          }
        };
        fallbackPollTimer = window.setTimeout(poll, 160);
      };

      if (typeof EventSource !== 'undefined') {
        es = new EventSource(
          `/api/versus/rooms/${encodeURIComponent(roomCode)}/stream?token=${encodeURIComponent(token)}`
        );
        es.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(evt.data) as HockeyRoomSnapshot;
            ingestRemoteSnapshot(parsed);
          } catch {
            // Ignore malformed SSE frame
          }
        };
        es.onerror = () => {
          startFallbackPolling();
        };
      } else {
        startFallbackPolling();
      }

      // Send throttled striker coordinates (~25Hz while moving + 900ms keepalive heartbeat)
      const pumpInput = async () => {
        if (unmounted || isRoomFinished()) return;
        const now = performance.now();
        const moved = Math.hypot(myTarget.x - lastSentX, myTarget.y - lastSentY) > 1.2;
        const needsHeartbeat = now - lastSentAtMs > 900;

        if (!inputInFlight && (moved || needsHeartbeat)) {
          inputInFlight = true;
          const sendX = Math.round(myTarget.x * 10) / 10;
          const sendY = Math.round(myTarget.y * 10) / 10;
          lastSentX = sendX;
          lastSentY = sendY;
          lastSentAtMs = now;
          try {
            const { snapshot } = await sendHockeyStrikerInput(roomCode, token, sendX, sendY);
            ingestRemoteSnapshot(snapshot);
          } catch {
            // Next tick will retry
          } finally {
            inputInFlight = false;
          }
        }

        if (!unmounted && !isRoomFinished()) {
          inputLoopTimer = window.setTimeout(pumpInput, 40);
        }
      };
      inputLoopTimer = window.setTimeout(pumpInput, 40);
    }

    // --- Pointer & Keyboard Controls ---
    const mapClientToCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = ((clientX - rect.left) / Math.max(1, rect.width)) * CANVAS_W;
      const cy = ((clientY - rect.top) / Math.max(1, rect.height)) * CANVAS_H;
      return { cx, cy };
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      activePointerId = e.pointerId;
      pointerActive = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events in tests may not have active pointer id
      }
      const { cx, cy } = mapClientToCanvas(e.clientX, e.clientY);
      // Slight finger-offset (-18px) so thumb doesn't cover the striker puck contact point!
      myTarget = canvasToPlayerHalf(cx, cy - 14);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerActive || (activePointerId !== null && e.pointerId !== activePointerId)) return;
      e.preventDefault();
      const { cx, cy } = mapClientToCanvas(e.clientX, e.clientY);
      myTarget = canvasToPlayerHalf(cx, cy - 14);
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      pointerActive = false;
      activePointerId = null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'a' ||
        e.key === 'd' ||
        e.key === 'w' ||
        e.key === 's'
      ) {
        if (apiRef.current.isLive()) {
          e.preventDefault();
        }
        heldKeys.add(e.key);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.key);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // --- 60fps Update & Retina Canvas Renderer ---
    let raf = 0;
    let lastFrameMs = performance.now();

    const renderFrame = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0, (now - lastFrameMs) / 1000));
      lastFrameMs = now;

      // Keyboard movement
      if (apiRef.current.isLive() && heldKeys.size > 0) {
        const keySpeed = 420 * dtSec;
        let dx = 0;
        let dy = 0;
        if (heldKeys.has('ArrowLeft') || heldKeys.has('a')) dx -= keySpeed;
        if (heldKeys.has('ArrowRight') || heldKeys.has('d')) dx += keySpeed;
        if (heldKeys.has('ArrowUp') || heldKeys.has('w')) dy -= keySpeed;
        if (heldKeys.has('ArrowDown') || heldKeys.has('s')) dy += keySpeed;
        if (dx !== 0 || dy !== 0) {
          myTarget = clampPlayerHalfPoint(myTarget.x + dx, myTarget.y + dy);
        }
      }

      // Smooth local striker follow (instantaneous feel)
      myRenderPos.x += (myTarget.x - myRenderPos.x) * Math.min(1, dtSec * 36);
      myRenderPos.y += (myTarget.y - myRenderPos.y) * Math.min(1, dtSec * 36);

      if (!isLiveRoom) {
        // Solo mode: step deterministic local physics while shell is live
        if (apiRef.current.isLive()) {
          setPlayerStrikerTarget(soloState, 'host', myTarget.x, myTarget.y);
          const stepEvts = stepHockeyMatch(soloState, dtSec * 1000, rng);
          latestSnap = toRoomSnapshot(soloState, 'host', now);
          snapReceivedAt = now;

          if (stepEvts.hostStrikePts > 0) {
            playArcadeTone('pickup');
            triggerHaptic(15);
            addPopup(
              myRenderPos.x,
              playerYToCanvasY(myRenderPos.y) - 28,
              stepEvts.hostStrikePts >= 4 ? `SMASH +${stepEvts.hostStrikePts}` : `+${stepEvts.hostStrikePts}`,
              '#86efac'
            );
            emitSparks(myRenderPos.x, playerYToCanvasY(myRenderPos.y) - 18, '#86efac', 7);
          }
          if (stepEvts.starGateBy === 'host') {
            playArcadeTone('star');
            addPopup(latestSnap.starGateX, PORTAL_Y + 24, 'STAR GATE +5', '#fde047', 0.95);
            emitSparks(latestSnap.starGateX, PORTAL_Y, '#fde047', 10);
          }

          syncSnapshotEffects(latestSnap);

          if (stepEvts.finishedNow && soloState.endReason) {
            const rem = latestSnap.myArcadeScore - reportedScore;
            if (rem > 0) {
              apiRef.current.addScore(rem);
              reportedScore += rem;
            }
            apiRef.current.endRound(soloState.endReason);
          }
        }
      }

      if (goalFlashMs > 0) {
        goalFlashMs = Math.max(0, goalFlashMs - dtSec * 1000);
      }

      // Advance particles & popups
      for (let i = popups.length - 1; i >= 0; i--) {
        popups[i].age += dtSec;
        popups[i].y -= 26 * dtSec;
        if (popups[i].age >= popups[i].ttl) popups.splice(i, 1);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        sparks[i].age += dtSec;
        sparks[i].x += sparks[i].vx * dtSec;
        sparks[i].y += sparks[i].vy * dtSec;
        if (sparks[i].age >= sparks[i].ttl) sparks.splice(i, 1);
      }

      // Size Retina backing store cleanly
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.round(CANVAS_W * dpr);
      const targetH = Math.round(CANVAS_H * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Dead-reckoning extrapolation window for live 2-phone mode (capped at 55ms so pucks never overshoot walls)
      const extrapSec =
        isLiveRoom && latestSnap.status === 'playing'
          ? clamp((now - snapReceivedAt) / 1000, 0, 0.055)
          : 0;

      // 1. Deep Midnight-Sapphire Rink Cabinet Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bgGrad.addColorStop(0, '#071426');
      bgGrad.addColorStop(0.14, '#0c2340');
      bgGrad.addColorStop(0.16, '#eaf6ff');
      bgGrad.addColorStop(0.62, '#f5faff');
      bgGrad.addColorStop(1, '#dceefe');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // 2. Top Opponent Phone Radar Strip (y: 8..58)
      ctx.save();
      ctx.fillStyle = 'rgba(7, 20, 38, 0.92)';
      ctx.fillRect(8, RADAR_TOP - 2, CANVAS_W - 16, RADAR_BOTTOM - RADAR_TOP + 4);

      // Opponent Goal Mouth at very top of Radar
      ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
      ctx.fillRect(GOAL_LEFT, RADAR_TOP - 2, GOAL_WIDTH, 8);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(GOAL_LEFT, RADAR_TOP + 5);
      ctx.lineTo(GOAL_LEFT, RADAR_TOP - 1);
      ctx.lineTo(GOAL_RIGHT, RADAR_TOP - 1);
      ctx.lineTo(GOAL_RIGHT, RADAR_TOP + 5);
      ctx.stroke();

      // Opponent Name & Score Pill inside Radar
      const oppNameDisplay = (
        latestSnap.oppStriker.botControlled
          ? 'ELF BOT'
          : latestSnap.oppStriker.name || session.opponentName
      )
        .slice(0, 14)
        .toUpperCase();
      ctx.font = '700 9.5px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
      ctx.textAlign = 'left';
      ctx.fillText(`▲ ${oppNameDisplay}`, 16, RADAR_TOP + 15);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`FIRST TO ${HOCKEY_WIN_GOALS}`, CANVAS_W - 16, RADAR_TOP + 15);

      // Opponent Striker Projected on Radar
      const oppX = clamp(
        latestSnap.oppStriker.x + latestSnap.oppStriker.vx * extrapSec,
        STRIKER_RADIUS,
        RINK_WIDTH - STRIKER_RADIUS
      );
      const oppY = clamp(
        latestSnap.oppStriker.y + latestSnap.oppStriker.vy * extrapSec,
        STRIKER_RADIUS,
        RINK_MID_Y - STRIKER_RADIUS
      );
      const oppCanvasY = playerYToCanvasY(oppY);
      ctx.beginPath();
      ctx.ellipse(oppX, oppCanvasY, 15, 7.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();

      // 3. Ice Markings on Player's Half (y: 64..472)
      ctx.save();
      // Subtle diagonal ice sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.moveTo(40, PORTAL_Y);
      ctx.lineTo(135, PORTAL_Y);
      ctx.lineTo(55, ICE_BOTTOM);
      ctx.lineTo(0, ICE_BOTTOM);
      ctx.closePath();
      ctx.fill();

      // Center Faceoff Semi-Circle at Top Portal Seam
      ctx.strokeStyle = 'rgba(215, 0, 21, 0.22)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, PORTAL_Y, 64, 0, Math.PI);
      ctx.stroke();

      // Blue Zone Defensive Line
      const blueLineY = PORTAL_Y + HALF_SPAN_CANVAS * 0.44;
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.24)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, blueLineY);
      ctx.lineTo(CANVAS_W - 10, blueLineY);
      ctx.stroke();

      // Subtle Center Ice Watermark
      ctx.textAlign = 'center';
      ctx.font = '800 13px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(15, 104, 64, 0.16)';
      ctx.fillText('★ STARLIGHT RINK ★', CANVAS_W / 2, PORTAL_Y + HALF_SPAN_CANVAS * 0.36);

      // Player's Defended Goal Crease & Goal Posts at Bottom (y = 472)
      ctx.fillStyle = 'rgba(215, 0, 21, 0.1)';
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, ICE_BOTTOM, GOAL_WIDTH / 2 + 6, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(215, 0, 21, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bottom Side Walls + Glowing Goal Slot
      ctx.strokeStyle = '#0f6840';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, PORTAL_Y);
      ctx.lineTo(8, ICE_BOTTOM);
      ctx.lineTo(GOAL_LEFT, ICE_BOTTOM);
      ctx.moveTo(GOAL_RIGHT, ICE_BOTTOM);
      ctx.lineTo(CANVAS_W - 8, ICE_BOTTOM);
      ctx.lineTo(CANVAS_W - 8, PORTAL_Y);
      ctx.stroke();

      // Defended Goal Mouth Glow
      ctx.fillStyle = 'rgba(215, 0, 21, 0.18)';
      ctx.fillRect(GOAL_LEFT, ICE_BOTTOM - 3, GOAL_WIDTH, 10);
      ctx.font = '800 9px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(185, 28, 28, 0.72)';
      ctx.fillText('DEFEND YOUR GOAL', CANVAS_W / 2, ICE_BOTTOM - 10);
      ctx.restore();

      // 4. Blazing STARLIGHT PORTAL SEAM + Drifting Golden Star Gate (y = 64)
      ctx.save();
      const portalGrad = ctx.createLinearGradient(0, PORTAL_Y - 4, 0, PORTAL_Y + 6);
      portalGrad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
      portalGrad.addColorStop(0.5, '#ffffff');
      portalGrad.addColorStop(1, 'rgba(16, 185, 129, 0.3)');
      ctx.fillStyle = portalGrad;
      ctx.fillRect(8, PORTAL_Y - 3, CANVAS_W - 16, 6);

      // Golden Star Gate Ring on Portal Seam
      const gateX = latestSnap.starGateX;
      if (latestSnap.starGateActive) {
        const pulse = reducedMotion ? 1 : 1 + Math.sin(now * 0.008) * 0.08;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(gateX, PORTAL_Y, STAR_GATE_RADIUS * pulse, 8 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
        ctx.fill();
      }
      ctx.restore();

      // 5. Goal Celebration Flash Overlay
      if (goalFlashMs > 0 && !reducedMotion) {
        const alpha = (goalFlashMs / 750) * 0.24;
        ctx.fillStyle = goalFlashMine
          ? `rgba(250, 204, 21, ${alpha})`
          : `rgba(239, 68, 68, ${alpha})`;
        ctx.fillRect(8, PORTAL_Y, CANVAS_W - 16, HALF_SPAN_CANVAS);
      }

      // 6. Render Pucks (Both on Opponent Radar and Full-Scale on Your Rink!)
      const activeIds = new Set<number>();
      for (const puck of latestSnap.pucks) {
        activeIds.add(puck.id);
        const px = clamp(puck.x + puck.vx * extrapSec, PUCK_RADIUS, RINK_WIDTH - PUCK_RADIUS);
        const py = clamp(puck.y + puck.vy * extrapSec, PUCK_RADIUS, RINK_HEIGHT - PUCK_RADIUS);
        const cy = playerYToCanvasY(py);
        const onMyHalf = py >= RINK_MID_Y - 6;

        if (onMyHalf) {
          // Record motion trail on player's ice
          let tList = trails.get(puck.id);
          if (!tList) {
            tList = [];
            trails.set(puck.id, tList);
          }
          if (!reducedMotion) {
            tList.push({ x: px, y: cy, turbo: puck.turbo });
            if (tList.length > 8) tList.shift();
            for (let ti = 0; ti < tList.length; ti++) {
              const pt = tList[ti];
              const frac = (ti + 1) / (tList.length + 1);
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, PUCK_RADIUS * frac * 0.85, 0, Math.PI * 2);
              ctx.fillStyle = pt.turbo
                ? `rgba(251, 191, 36, ${frac * 0.38})`
                : `rgba(215, 0, 21, ${frac * 0.25})`;
              ctx.fill();
            }
          }

          // Full-size sculpted Puck
          ctx.save();
          ctx.shadowColor = puck.turbo ? 'rgba(245, 158, 11, 0.65)' : 'rgba(15, 23, 42, 0.28)';
          ctx.shadowBlur = puck.turbo ? 14 : 7;
          ctx.beginPath();
          ctx.arc(px, cy, PUCK_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = puck.turbo ? '#f59e0b' : '#1e293b';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px, cy, PUCK_RADIUS - 3.5, 0, Math.PI * 2);
          ctx.fillStyle = puck.turbo ? '#fef08a' : '#d70015';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px, cy, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();
        } else {
          // Puck is currently on the OTHER phone's ice — draw crisp radar puck + incoming indicator!
          trails.delete(puck.id);
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, cy, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = puck.turbo ? '#fde047' : '#f43f5e';
          ctx.fill();
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          // Incoming caret on the Portal Seam when puck is streaking downward toward your phone!
          if (puck.vy > 45) {
            ctx.fillStyle = puck.turbo ? '#fde047' : '#fb7185';
            ctx.beginPath();
            ctx.moveTo(px, PORTAL_Y + 9);
            ctx.lineTo(px - 6, PORTAL_Y + 1);
            ctx.lineTo(px + 6, PORTAL_Y + 1);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }
      for (const id of Array.from(trails.keys())) {
        if (!activeIds.has(id)) trails.delete(id);
      }

      // 7. Render Player's Sculpted Striker Mallet
      const myCx = myRenderPos.x;
      const myCy = playerYToCanvasY(myRenderPos.y);
      ctx.save();
      ctx.shadowColor = 'rgba(215, 0, 21, 0.35)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;

      // Outer crimson bumper
      ctx.beginPath();
      ctx.arc(myCx, myCy, STRIKER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#d70015';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Inner recessed ivory/gold ring
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.arc(myCx, myCy, STRIKER_RADIUS - 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fffbeb';
      ctx.fill();

      // Center handle knob
      ctx.beginPath();
      ctx.arc(myCx, myCy - 1, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = '#b91c1c';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(myCx - 2.2, myCy - 3, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fill();
      ctx.restore();

      // Gentle touch prompt before first move
      if (!pointerActive && heldKeys.size === 0 && apiRef.current.elapsedSec() < 3.5) {
        ctx.save();
        ctx.font = '700 11px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.fillText('Drag mallet anywhere on your ice!', CANVAS_W / 2, myCy - 36);
        ctx.restore();
      }

      // 8. Sparks & Floating Score Popups
      for (const sp of sparks) {
        const alpha = Math.max(0, 1 - sp.age / sp.ttl);
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const pop of popups) {
        const alpha = Math.max(0, 1 - pop.age / pop.ttl);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '900 13.5px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.82)';
        const clampedX = clamp(pop.x, 66, CANVAS_W - 66);
        ctx.strokeText(pop.text, clampedX, pop.y);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, clampedX, pop.y);
        ctx.restore();
      }

      raf = requestAnimationFrame(renderFrame);
    };

    raf = requestAnimationFrame(renderFrame);

    return () => {
      unmounted = true;
      cancelAnimationFrame(raf);
      es?.close();
      if (fallbackPollTimer !== null) window.clearTimeout(fallbackPollTimer);
      if (inputLoopTimer !== null) window.clearTimeout(inputLoopTimer);
      if (isLiveRoom && session.roomCode && session.playerToken && latestSnap.status !== 'finished') {
        leaveHockeyRoomKeepalive(session.roomCode, session.playerToken);
      }
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [hockeySession]);

  return (
    <div className="game-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        role="img"
        aria-label="Starlight Air Hockey rink: drag your striker mallet on the lower ice to defend your goal and smash the puck upward across the Starlight Portal into your opponent's goal."
      />
    </div>
  );
}

import crypto from 'node:crypto';
import type { Response } from 'express';
import type {
  CreateHockeyRoomResponse,
  HockeyRole,
  HockeyRoomSnapshot,
  JoinHockeyRoomResponse,
} from '../src/types.ts';
import {
  createHockeyMatchState,
  setPlayerStrikerTarget,
  stepHockeyMatch,
  toRoomSnapshot,
  type HockeyMatchState,
} from '../src/games/hockeyLogic.ts';
import { createRng } from '../src/games/rng.ts';

const TICK_INTERVAL_MS = 33; // ~30Hz authoritative physics & broadcast
const WAITING_ROOM_TTL_MS = 10 * 60 * 1000;
const FINISHED_ROOM_TTL_MS = 2 * 60 * 1000;
const STALE_INPUT_BOT_FALLBACK_MS = 4_500;
const MAX_ACTIVE_ROOMS = 400;

interface SseClient {
  role: HockeyRole;
  res: Response;
}

interface ManagedRoom {
  code: string;
  hostToken: string;
  joinerToken: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  lastStepAtMs: number;
  hostLastInputMs: number;
  joinerLastInputMs: number;
  hostLeft: boolean;
  joinerLeft: boolean;
  rng: ReturnType<typeof createRng>;
  state: HockeyMatchState;
  clients: Set<SseClient>;
  tickTimer: ReturnType<typeof setInterval> | null;
  keepaliveTimer: ReturnType<typeof setInterval> | null;
}

export type RoomErrorResult = {
  ok: false;
  status: 400 | 403 | 404 | 409 | 429;
  error: string;
};

export class HockeyRoomManager {
  private readonly rooms = new Map<string, ManagedRoom>();
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
  }

  private pruneExpiredRooms(): void {
    const now = this.now();
    for (const [code, room] of this.rooms.entries()) {
      const ageSinceUpdate = now - room.updatedAtMs;
      const expiredWaiting = room.state.status === 'waiting' && ageSinceUpdate > WAITING_ROOM_TTL_MS;
      const expiredFinished =
        room.state.status === 'finished' && ageSinceUpdate > FINISHED_ROOM_TTL_MS;
      const abandonedLive = ageSinceUpdate > WAITING_ROOM_TTL_MS;

      if (expiredWaiting || expiredFinished || abandonedLive) {
        this.destroyRoom(code);
      }
    }
  }

  private destroyRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.tickTimer) {
      clearInterval(room.tickTimer);
      room.tickTimer = null;
    }
    if (room.keepaliveTimer) {
      clearInterval(room.keepaliveTimer);
      room.keepaliveTimer = null;
    }
    for (const client of room.clients) {
      try {
        client.res.end();
      } catch {
        // Ignore already-closed sockets
      }
    }
    room.clients.clear();
    this.rooms.delete(code);
  }

  private generateUniqueCode(): string | null {
    for (let attempt = 0; attempt < 80; attempt++) {
      const code = String(crypto.randomInt(1000, 10000));
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    return null;
  }

  private resolveRole(room: ManagedRoom, token: string): HockeyRole | null {
    if (!token) return null;
    if (token === room.hostToken) return 'host';
    if (room.joinerToken && token === room.joinerToken) return 'joiner';
    return null;
  }

  private broadcast(room: ManagedRoom): void {
    if (room.clients.size === 0) return;
    const now = this.now();
    let hostPayload: string | null = null;
    let joinerPayload: string | null = null;

    for (const client of room.clients) {
      try {
        if (client.role === 'host') {
          if (hostPayload === null) {
            hostPayload = `data: ${JSON.stringify(toRoomSnapshot(room.state, 'host', now))}\n\n`;
          }
          client.res.write(hostPayload);
        } else {
          if (joinerPayload === null) {
            joinerPayload = `data: ${JSON.stringify(toRoomSnapshot(room.state, 'joiner', now))}\n\n`;
          }
          client.res.write(joinerPayload);
        }
      } catch {
        room.clients.delete(client);
      }
    }
  }

  private startMatchLoop(room: ManagedRoom): void {
    if (room.tickTimer) return;
    room.lastStepAtMs = this.now();

    const timer = setInterval(() => {
      this.stepRoomToNow(room);
    }, TICK_INTERVAL_MS);
    timer.unref?.();
    room.tickTimer = timer;
  }

  public stepRoomToNow(room: ManagedRoom): void {
    const now = this.now();
    const rawDt = now - room.lastStepAtMs;
    if (rawDt <= 0) return;
    room.lastStepAtMs = now;
    room.updatedAtMs = now;

    if (room.state.status === 'playing') {
      // Seamless mobile-signal resilience: if a phone stalls >4.5s or leaves mid-round,
      // Frosty Elf Bot covers that striker until the player sends input again.
      const hostStale = room.hostLeft || now - room.hostLastInputMs > STALE_INPUT_BOT_FALLBACK_MS;
      const joinerStale =
        room.joinerLeft || now - room.joinerLastInputMs > STALE_INPUT_BOT_FALLBACK_MS;
      room.state.host.botControlled = hostStale;
      room.state.host.connected = !room.hostLeft;
      room.state.joiner.botControlled = joinerStale;
      room.state.joiner.connected = !room.joinerLeft;
    }

    // Catch up in safe <=50ms chunks if event loop paused briefly
    let remaining = Math.min(rawDt, 250);
    while (remaining > 0 && (room.state.status === 'countdown' || room.state.status === 'playing')) {
      const stepMs = Math.min(remaining, 50);
      stepHockeyMatch(room.state, stepMs, room.rng);
      remaining -= stepMs;
    }

    this.broadcast(room);

    if (room.state.status === 'finished' && room.tickTimer) {
      clearInterval(room.tickTimer);
      room.tickTimer = null;
    }
  }

  public createRoom(hostNameRaw: string): { ok: true; data: CreateHockeyRoomResponse } | RoomErrorResult {
    this.pruneExpiredRooms();
    if (this.rooms.size >= MAX_ACTIVE_ROOMS) {
      return { ok: false, status: 429, error: 'All versus tables are busy right now. Try Solo or wait a moment!' };
    }

    const code = this.generateUniqueCode();
    if (!code) {
      return { ok: false, status: 429, error: 'Could not allocate a 4-digit room code. Please try again.' };
    }

    const now = this.now();
    const hostName = hostNameRaw.trim().slice(0, 32) || 'Player 1';
    const hostToken = crypto.randomBytes(16).toString('hex');
    const rng = createRng(crypto.randomInt(1, 0x7fffffff));
    const state = createHockeyMatchState({
      code,
      hostName,
      joinerName: 'Waiting…',
      joinerIsBot: false,
      status: 'waiting',
      rng,
    });

    const room: ManagedRoom = {
      code,
      hostToken,
      joinerToken: null,
      createdAtMs: now,
      updatedAtMs: now,
      lastStepAtMs: now,
      hostLastInputMs: now,
      joinerLastInputMs: now,
      hostLeft: false,
      joinerLeft: false,
      rng,
      state,
      clients: new Set(),
      tickTimer: null,
      keepaliveTimer: null,
    };

    const keepalive = setInterval(() => {
      for (const client of room.clients) {
        try {
          client.res.write(': keepalive\n\n');
        } catch {
          room.clients.delete(client);
        }
      }
    }, 15_000);
    keepalive.unref?.();
    room.keepaliveTimer = keepalive;

    this.rooms.set(code, room);

    return {
      ok: true,
      data: {
        code,
        playerToken: hostToken,
        role: 'host',
        snapshot: toRoomSnapshot(room.state, 'host', now),
      },
    };
  }

  public joinRoom(
    codeRaw: string,
    joinerNameRaw: string
  ): { ok: true; data: JoinHockeyRoomResponse } | RoomErrorResult {
    this.pruneExpiredRooms();
    const code = codeRaw.trim();
    if (!/^\d{4}$/.test(code)) {
      return { ok: false, status: 400, error: 'Please enter a 4-digit room code (1000–9999).' };
    }

    const room = this.rooms.get(code);
    if (!room) {
      return {
        ok: false,
        status: 404,
        error: `Room ${code} was not found or expired. Ask your partner for a fresh 4-digit code.`,
      };
    }

    if (room.hostLeft || room.joinerToken !== null || room.state.status !== 'waiting') {
      return {
        ok: false,
        status: 409,
        error: `Room ${code} already has 2 players in action!`,
      };
    }

    const now = this.now();
    const joinerToken = crypto.randomBytes(16).toString('hex');
    const joinerName = joinerNameRaw.trim().slice(0, 32) || 'Challenger';

    room.joinerToken = joinerToken;
    room.updatedAtMs = now;
    room.lastStepAtMs = now;
    room.hostLastInputMs = now;
    room.joinerLastInputMs = now;

    room.state.joiner.name = joinerName;
    room.state.joiner.connected = true;
    room.state.joiner.botControlled = false;
    room.state.status = 'countdown';

    this.startMatchLoop(room);
    this.broadcast(room);

    return {
      ok: true,
      data: {
        code,
        playerToken: joinerToken,
        role: 'joiner',
        snapshot: toRoomSnapshot(room.state, 'joiner', now),
      },
    };
  }

  public getSnapshot(
    codeRaw: string,
    token: string
  ): { ok: true; snapshot: HockeyRoomSnapshot } | RoomErrorResult {
    const code = codeRaw.trim();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, status: 404, error: 'Versus room not found.' };
    }
    const role = this.resolveRole(room, token);
    if (!role) {
      return { ok: false, status: 403, error: 'Unauthorized room token.' };
    }
    if (room.state.status === 'countdown' || room.state.status === 'playing') {
      this.stepRoomToNow(room);
    }
    return {
      ok: true,
      snapshot: toRoomSnapshot(room.state, role, this.now()),
    };
  }

  public updateInput(
    codeRaw: string,
    token: string,
    x: number,
    y: number
  ): { ok: true; snapshot: HockeyRoomSnapshot } | RoomErrorResult {
    const code = codeRaw.trim();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, status: 404, error: 'Versus room not found.' };
    }
    const role = this.resolveRole(room, token);
    if (!role) {
      return { ok: false, status: 403, error: 'Unauthorized room token.' };
    }

    const now = this.now();
    room.updatedAtMs = now;
    if (role === 'host') {
      room.hostLastInputMs = now;
      room.hostLeft = false;
      room.state.host.botControlled = false;
      room.state.host.connected = true;
    } else {
      room.joinerLastInputMs = now;
      room.joinerLeft = false;
      room.state.joiner.botControlled = false;
      room.state.joiner.connected = true;
    }

    setPlayerStrikerTarget(room.state, role, x, y);

    if (room.state.status === 'countdown' || room.state.status === 'playing') {
      this.stepRoomToNow(room);
    }

    return {
      ok: true,
      snapshot: toRoomSnapshot(room.state, role, this.now()),
    };
  }

  public leaveRoom(codeRaw: string, token: string): { ok: true } | RoomErrorResult {
    const code = codeRaw.trim();
    const room = this.rooms.get(code);
    if (!room) return { ok: true };
    const role = this.resolveRole(room, token);
    if (!role) {
      return { ok: false, status: 403, error: 'Unauthorized room token.' };
    }

    if (room.state.status === 'waiting') {
      // Mark closed immediately for joiners, and expire after a short 3s grace window
      // so any already-in-flight EventSource GET closes with 200 instead of logging a 404.
      room.hostLeft = true;
      room.updatedAtMs = this.now() - WAITING_ROOM_TTL_MS + 3_000;
      const cleanup = setTimeout(() => this.destroyRoom(code), 3_000);
      cleanup.unref?.();
      return { ok: true };
    }

    if (role === 'host') {
      room.hostLeft = true;
      room.state.host.connected = false;
      room.state.host.botControlled = true;
    } else {
      room.joinerLeft = true;
      room.state.joiner.connected = false;
      room.state.joiner.botControlled = true;
    }

    if (room.hostLeft && room.joinerLeft) {
      this.destroyRoom(code);
    } else {
      this.broadcast(room);
    }
    return { ok: true };
  }

  public attachStream(codeRaw: string, token: string, res: Response): RoomErrorResult | null {
    const code = codeRaw.trim();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, status: 404, error: 'Versus room not found.' };
    }
    const role = this.resolveRole(room, token);
    if (!role) {
      return { ok: false, status: 403, error: 'Unauthorized room token.' };
    }

    res.socket?.setNoDelay?.(true);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    if (room.hostLeft && room.state.status === 'waiting') {
      res.end();
      return null;
    }

    const client: SseClient = { role, res };
    room.clients.add(client);

    const initial = toRoomSnapshot(room.state, role, this.now());
    res.write(`data: ${JSON.stringify(initial)}\n\n`);

    res.on('close', () => {
      room.clients.delete(client);
    });

    return null;
  }

  public disposeAll(): void {
    for (const code of Array.from(this.rooms.keys())) {
      this.destroyRoom(code);
    }
  }
}

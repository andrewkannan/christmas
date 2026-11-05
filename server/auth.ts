import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { TeamSessionUser, TeamUserRole } from '../src/types.ts';

const COOKIE_NAME = 'xmas_team_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 16; // 16 hours (full outreach day)
const PASSCODE_DIGEST_PEPPER = 'xmas-team-passcode-v1';

const FALLBACK_DEV_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || FALLBACK_DEV_SECRET;
}

export function getConfiguredTeamPin(): string {
  return process.env.TEAM_PIN || '1225';
}

export function verifyTeamPin(candidate: string): boolean {
  const expected = getConfiguredTeamPin();
  const hashA = crypto.createHash('sha256').update(candidate).digest();
  const hashB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Normalizes personal passcodes (e.g. " ak2708 " -> "AK2708") so evangelists can sign in
 * comfortably from mobile keyboards regardless of Shift/caps state.
 */
export function normalizePasscode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidPasscodeFormat(raw: string): boolean {
  return /^[A-Za-z0-9]{4,24}$/.test(raw.trim());
}

/**
 * Deterministic SHA-256 lookup digest used strictly to enforce UNIQUE passcodes across
 * team members and perform O(1) candidate lookup before verifying the salted scrypt hash.
 */
export function computePasscodeDigest(rawPasscode: string): string {
  const normalized = normalizePasscode(rawPasscode);
  return crypto
    .createHash('sha256')
    .update(`${PASSCODE_DIGEST_PEPPER}:${normalized}`)
    .digest('hex');
}

/**
 * Salted scrypt key derivation for storing personal team passcodes safely at rest.
 */
export function hashPasscodeScrypt(rawPasscode: string): string {
  const normalized = normalizePasscode(rawPasscode);
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(normalized, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasscodeScrypt(rawPasscode: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const normalized = normalizePasscode(rawPasscode);
    const actualBuf = crypto.scryptSync(normalized, salt, 64);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

export interface ParsedTeamSessionPayload {
  accessRole: TeamUserRole;
  memberId: number | null;
  memberName: string;
  authMethod: 'master_pin' | 'passcode';
  exp: number;
}

export function createSessionCookieValue(user?: TeamSessionUser): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const sessionUser: TeamSessionUser = user ?? {
    id: null,
    name: 'Team Admin',
    role: 'admin',
    authMethod: 'master_pin',
  };
  const payload = Buffer.from(
    JSON.stringify({
      role: 'team',
      accessRole: sessionUser.role,
      memberId: sessionUser.id,
      memberName: sessionUser.name,
      authMethod: sessionUser.authMethod,
      exp,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseSessionCookieValue(
  rawValue: string | undefined
): ParsedTeamSessionPayload | null {
  if (!rawValue || !rawValue.includes('.')) return null;
  const [payload, sig] = rawValue.split('.');
  if (!payload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      accessRole?: string;
      memberId?: number | null;
      memberName?: string;
      authMethod?: string;
      exp?: number;
    };
    if (parsed.role !== 'team' || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      return null;
    }
    const accessRole: TeamUserRole = parsed.accessRole === 'member' ? 'member' : 'admin';
    const authMethod: 'master_pin' | 'passcode' =
      parsed.authMethod === 'passcode' ? 'passcode' : 'master_pin';
    const memberId =
      typeof parsed.memberId === 'number' && Number.isInteger(parsed.memberId) && parsed.memberId > 0
        ? parsed.memberId
        : null;
    const memberName =
      typeof parsed.memberName === 'string' && parsed.memberName.trim()
        ? parsed.memberName.trim().slice(0, 60)
        : 'Team Admin';
    return {
      accessRole,
      memberId,
      memberName,
      authMethod,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function verifySessionCookieValue(rawValue: string | undefined): boolean {
  return parseSessionCookieValue(rawValue) !== null;
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  const protoHeader = req.headers['x-forwarded-proto'];
  const forwardedProto =
    typeof protoHeader === 'string' ? protoHeader.split(',')[0].trim().toLowerCase() : '';
  return Boolean(req.secure || forwardedProto === 'https');
}

export function setTeamSessionCookie(
  req: Request,
  res: Response,
  user?: TeamSessionUser
): void {
  const token = createSessionCookieValue(user);
  const directives = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttpsRequest(req)) directives.push('Secure');
  res.setHeader('Set-Cookie', directives.join('; '));
}

export function clearTeamSessionCookie(req: Request, res: Response): void {
  const directives = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttpsRequest(req)) directives.push('Secure');
  res.setHeader('Set-Cookie', directives.join('; '));
}

export function getRequestCookiePayload(req: Request): ParsedTeamSessionPayload | null {
  const cookies = parseCookies(req.headers.cookie);
  return parseSessionCookieValue(cookies[COOKIE_NAME]);
}

export function isRequestAuthenticated(req: Request): boolean {
  return getRequestCookiePayload(req) !== null;
}

export function requireTeamAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isRequestAuthenticated(req)) {
    res.status(401).json({ error: 'Team PIN session required.' });
    return;
  }
  next();
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const existing = (this.hits.get(key) || []).filter((ts) => ts > cutoff);
    if (existing.length >= this.maxAttempts) {
      this.hits.set(key, existing);
      return false;
    }
    existing.push(now);
    this.hits.set(key, existing);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

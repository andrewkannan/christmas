import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const COOKIE_NAME = 'xmas_team_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 16; // 16 hours (full outreach day)

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

export function createSessionCookieValue(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ role: 'team', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionCookieValue(rawValue: string | undefined): boolean {
  if (!rawValue || !rawValue.includes('.')) return false;
  const [payload, sig] = rawValue.split('.');
  if (!payload || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'team' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
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

export function setTeamSessionCookie(req: Request, res: Response): void {
  const token = createSessionCookieValue();
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

export function isRequestAuthenticated(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionCookieValue(cookies[COOKIE_NAME]);
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

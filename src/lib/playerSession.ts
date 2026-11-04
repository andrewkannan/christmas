import type { PublicClaimResult, TrackEventInput } from '../types.ts';

const VISITOR_KEY = 'xmas_arcade_visitor_id_v1';
const SAVED_PASS_KEY = 'xmas_arcade_saved_pass_v1';

let memoryVisitorId = '';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 6) return existing;
    const created = generateId('vis');
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    if (!memoryVisitorId) memoryVisitorId = generateId('vis');
    return memoryVisitorId;
  }
}

export function resetVisitorIdForNewFriend(): string {
  const next = generateId('vis');
  memoryVisitorId = next;
  try {
    window.localStorage.setItem(VISITOR_KEY, next);
  } catch {
    // Ignore storage quota / private mode
  }
  return next;
}

export function loadSavedPass(): PublicClaimResult | null {
  try {
    const raw = window.localStorage.getItem(SAVED_PASS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicClaimResult;
    if (parsed && parsed.claimToken && parsed.redemptionCode) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePassLocally(claim: PublicClaimResult): void {
  try {
    window.localStorage.setItem(SAVED_PASS_KEY, JSON.stringify(claim));
  } catch {
    // Ignore private mode restrictions
  }
}

export function clearSavedPassLocally(): void {
  try {
    window.localStorage.removeItem(SAVED_PASS_KEY);
  } catch {
    // Ignore
  }
}

export async function trackArcadeEvent(
  params: Omit<TrackEventInput, 'visitorId'>,
  onPassRefreshed?: (updated: PublicClaimResult) => void
): Promise<void> {
  const payload: TrackEventInput = {
    visitorId: getOrCreateVisitorId(),
    ...params,
  };

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        claim?: PublicClaimResult | null;
      } | null;
      if (data?.claim) {
        savePassLocally(data.claim);
        onPassRefreshed?.(data.claim);
      }
    }
  } catch {
    // Telemetry is best-effort and never blocks gameplay
  }
}

import type {
  ActiveGameId,
  EventSettings,
  LeadSubmissionInput,
  LeaderboardResponse,
  MasterAnalyticsResponse,
  PublicClaimResult,
  RunFinishResult,
  TeamLeadRecord,
  TeamLeadsResponse,
} from '../types.ts';
import type { RoundEndReason } from '../games/rules.ts';

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchPublicConfig(): Promise<{
  settings: EventSettings;
  googleCalendarUrl: string;
}> {
  const res = await fetch('/api/public/config');
  return parseJsonOrThrow(res);
}

export async function fetchSavedPass(
  claimToken: string
): Promise<{ claim: PublicClaimResult }> {
  const res = await fetch(`/api/public/pass/${encodeURIComponent(claimToken)}`);
  return parseJsonOrThrow(res);
}

const ROUND_REQUEST_TIMEOUT_MS = 8000;

export async function startGameRun(payload: {
  gameId: ActiveGameId;
  visitorId: string;
  claimToken?: string;
  volunteerName?: string;
}): Promise<{ runId: string }> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(ROUND_REQUEST_TIMEOUT_MS),
  });
  return parseJsonOrThrow(res);
}

export async function finishGameRun(
  runId: string,
  payload: { visitorId: string; score: number; endReason: RoundEndReason }
): Promise<RunFinishResult> {
  const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    signal: AbortSignal.timeout(ROUND_REQUEST_TIMEOUT_MS),
  });
  return parseJsonOrThrow(res);
}

export async function fetchLeaderboards(claimToken?: string): Promise<LeaderboardResponse> {
  const qs = claimToken ? `?claimToken=${encodeURIComponent(claimToken)}` : '';
  const res = await fetch(`/api/leaderboard${qs}`, {
    signal: AbortSignal.timeout(ROUND_REQUEST_TIMEOUT_MS),
  });
  return parseJsonOrThrow(res);
}

export async function submitWinnerLead(
  payload: LeadSubmissionInput
): Promise<{ claim: PublicClaimResult }> {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function markGiftClaimedPublic(
  claimToken: string
): Promise<{ claim: PublicClaimResult }> {
  const res = await fetch(`/api/public/claim/${encodeURIComponent(claimToken)}`, {
    method: 'POST',
  });
  return parseJsonOrThrow(res);
}

export async function checkTeamSession(): Promise<{ authenticated: boolean }> {
  const res = await fetch('/api/team/session', { credentials: 'include' });
  return parseJsonOrThrow(res);
}

export async function loginTeamPin(pin: string): Promise<{ authenticated: boolean }> {
  const res = await fetch('/api/team/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return parseJsonOrThrow(res);
}

export async function logoutTeam(): Promise<void> {
  await fetch('/api/team/logout', { method: 'POST', credentials: 'include' });
}

export async function fetchMasterAnalytics(): Promise<MasterAnalyticsResponse> {
  const res = await fetch('/api/team/master-stats', { credentials: 'include' });
  return parseJsonOrThrow(res);
}

export async function fetchTeamLeads(): Promise<TeamLeadsResponse> {
  const res = await fetch('/api/team/leads', { credentials: 'include' });
  return parseJsonOrThrow(res);
}

export async function patchTeamLead(
  id: number,
  patch: { giftClaimed?: boolean; whatsappSent?: boolean; notes?: string }
): Promise<{ lead: TeamLeadRecord }> {
  const res = await fetch(`/api/team/leads/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJsonOrThrow(res);
}

export async function saveTeamEventSettings(settings: EventSettings): Promise<{
  settings: EventSettings;
  googleCalendarUrl: string;
}> {
  const res = await fetch('/api/team/settings', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return parseJsonOrThrow(res);
}

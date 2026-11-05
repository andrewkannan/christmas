import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_CAMPAIGN_TARGETS,
  type ActiveGameId,
  type AnalyticsEventType,
  type CampaignTargets,
  type EventSettings,
  type FollowUpStatus,
  type FullGameLeaderboard,
  type GameAnalyticsRow,
  type GameId,
  type GameLeaderboard,
  type LeadPatchInput,
  type MasterAnalyticsResponse,
  type PublicClaimResult,
  type RecentActivityItem,
  type RunFinishResult,
  type TeamDashboardStats,
  type TeamLeadRecord,
  type TrackEventInput,
  type VolunteerAnalyticsRow,
} from '../src/types.ts';
import { RUN_EXPIRY_MS, isPlausibleScore, type RoundEndReason } from '../src/games/rules.ts';
import { formatBoardName } from '../src/games/boardName.ts';
import {
  DEFAULT_REMINDER_TEMPLATE,
  buildPersonalPassUrl,
  buildPersonalWhatsAppUrl,
  buildReminderWhatsAppUrl,
} from './phone.ts';

const ACTIVE_GAMES: ActiveGameId[] = [
  'ice-hockey',
  'santa-dash',
  'gift-tetris',
  'gift-slash',
  'candy-match',
];
const LEGACY_GAMES: GameId[] = ['claw-machine', 'gift-rush', 'tap-duel', 'starlight-drop'];

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  churchName: 'CCC JB Bilingual',
  eventTitle: 'Christmas Night of Wonder',
  eventSubtitle: 'Live Acoustic Carols, Hot Cocoa, Festive Games & A Story of Hope',
  eventDateIso: '2026-12-24T19:30',
  timezoneOffset: '+08:00',
  durationMinutes: 120,
  venueName: 'Starlight Atrium Hall, Level 3',
  venueAddress: '18 Central Walk (2 mins from Central Station)',
  mapsUrl: 'https://maps.google.com',
  wazeUrl: '',
  defaultCountryCode: '60',
  giftDescription: 'Christmas Blessing Gift',
  whatsappTemplate:
    'Hey {name}! 🎄 So fun playing the Christmas Arcade with you earlier ({volunteer} here!).\n\nHere is your personal invite to *{eventTitle}*:\n📅 {eventDate}\n📍 {venueName} ({venueAddress})\n\n🎟 Open your E-Ticket & play more games anytime: {inviteUrl}\n\nBring a friend along—we would love to host you! ✨',
  reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
  campaignTargets: { ...DEFAULT_CAMPAIGN_TARGETS },
};

interface RawLeadRow {
  id: number;
  client_request_id: string;
  visitor_id: string;
  redemption_code: string;
  claim_token: string;
  name: string;
  raw_phone: string;
  normalized_phone: string;
  game_played: GameId;
  score: number;
  target_score: number;
  volunteer_name: string;
  gift_claimed: number;
  whatsapp_sent: number;
  followup_status: FollowUpStatus;
  notes: string;
  notes_updated_at: string;
  created_at: string;
}

interface LeadEventAggRow {
  lead_id: number;
  total_games: number;
  after_games: number;
  shares: number;
  downloads: number;
  calendar_adds: number;
  invite_views: number;
  last_active_at: string | null;
}

export class ArcadeDatabase {
  private readonly db: DatabaseSync;
  private readonly now: () => number;

  constructor(dbPath: string, options: { now?: () => number } = {}) {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.now = options.now ?? Date.now;
    this.init();
  }

  private init(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_request_id TEXT NOT NULL UNIQUE,
        visitor_id TEXT NOT NULL DEFAULT '',
        redemption_code TEXT NOT NULL UNIQUE,
        claim_token TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        raw_phone TEXT NOT NULL,
        normalized_phone TEXT NOT NULL,
        game_played TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        target_score INTEGER NOT NULL DEFAULT 15,
        volunteer_name TEXT NOT NULL DEFAULT '',
        gift_claimed INTEGER NOT NULL DEFAULT 0,
        whatsapp_sent INTEGER NOT NULL DEFAULT 0,
        followup_status TEXT NOT NULL DEFAULT 'new',
        notes TEXT NOT NULL DEFAULT '',
        notes_updated_at TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_volunteer ON leads(volunteer_name);

      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT NOT NULL,
        lead_id INTEGER,
        event_type TEXT NOT NULL,
        game_id TEXT NOT NULL DEFAULT '',
        score INTEGER NOT NULL DEFAULT 0,
        is_post_interaction INTEGER NOT NULL DEFAULT 0,
        volunteer_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_lead_id ON analytics_events(lead_id);
      CREATE INDEX IF NOT EXISTS idx_events_visitor_id ON analytics_events(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON analytics_events(created_at DESC);

      -- One row per played round. Timing comes from the server clock, never the client.
      CREATE TABLE IF NOT EXISTS game_runs (
        id TEXT PRIMARY KEY,
        visitor_id TEXT NOT NULL,
        lead_id INTEGER,
        game_id TEXT NOT NULL,
        is_post_interaction INTEGER NOT NULL DEFAULT 0,
        volunteer_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'started',
        score INTEGER NOT NULL DEFAULT 0,
        end_reason TEXT NOT NULL DEFAULT '',
        started_ms INTEGER NOT NULL,
        finished_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_runs_board ON game_runs(game_id, status, score DESC);
      CREATE INDEX IF NOT EXISTS idx_runs_visitor ON game_runs(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_runs_lead ON game_runs(lead_id);
    `);

    // Safe backwards-compatible migrations for pre-existing leads tables
    const cols = this.db.prepare('PRAGMA table_info(leads)').all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'visitor_id')) {
      this.db.exec("ALTER TABLE leads ADD COLUMN visitor_id TEXT NOT NULL DEFAULT ''");
    }
    if (!cols.some((c) => c.name === 'followup_status')) {
      this.db.exec("ALTER TABLE leads ADD COLUMN followup_status TEXT NOT NULL DEFAULT 'new'");
      this.db.exec(
        "UPDATE leads SET followup_status = 'contacted' WHERE whatsapp_sent = 1 AND followup_status = 'new'"
      );
    }
    if (!cols.some((c) => c.name === 'notes_updated_at')) {
      this.db.exec("ALTER TABLE leads ADD COLUMN notes_updated_at TEXT NOT NULL DEFAULT ''");
    }

    const existing = this.db.prepare('SELECT json FROM settings WHERE id = 1').get() as
      | { json: string }
      | undefined;
    if (!existing) {
      this.db
        .prepare('INSERT INTO settings (id, json, updated_at) VALUES (1, ?, ?)')
        .run(JSON.stringify(DEFAULT_EVENT_SETTINGS), new Date().toISOString());
    } else {
      try {
        const parsed = JSON.parse(existing.json) as Partial<EventSettings>;
        let changed = false;
        if (parsed.giftDescription === 'Christmas Blessing Gift Pack') {
          parsed.giftDescription = 'Christmas Blessing Gift';
          changed = true;
        }
        if (parsed.churchName === 'Hope Community') {
          parsed.churchName = 'CCC JB Bilingual';
          changed = true;
        }
        if (!parsed.campaignTargets) {
          parsed.campaignTargets = { ...DEFAULT_CAMPAIGN_TARGETS };
          changed = true;
        }
        if (changed) {
          this.db
            .prepare('UPDATE settings SET json = ?, updated_at = ? WHERE id = 1')
            .run(JSON.stringify({ ...DEFAULT_EVENT_SETTINGS, ...parsed }), new Date().toISOString());
        }
      } catch {
        // Leave corrupted row for getSettings() fallback
      }
    }
  }

  getSettings(): EventSettings {
    const row = this.db.prepare('SELECT json FROM settings WHERE id = 1').get() as
      | { json: string }
      | undefined;
    if (!row) {
      return {
        ...DEFAULT_EVENT_SETTINGS,
        campaignTargets: { ...DEFAULT_CAMPAIGN_TARGETS },
      };
    }
    try {
      const parsed = JSON.parse(row.json) as Partial<EventSettings>;
      const mergedTargets: CampaignTargets = {
        ...DEFAULT_CAMPAIGN_TARGETS,
        ...(parsed.campaignTargets ?? {}),
      };
      return {
        ...DEFAULT_EVENT_SETTINGS,
        ...parsed,
        campaignTargets: mergedTargets,
      };
    } catch {
      return {
        ...DEFAULT_EVENT_SETTINGS,
        campaignTargets: { ...DEFAULT_CAMPAIGN_TARGETS },
      };
    }
  }

  updateSettings(nextSettings: EventSettings): EventSettings {
    const current = this.getSettings();
    const merged: EventSettings = {
      ...current,
      ...nextSettings,
      reminderTemplate: nextSettings.reminderTemplate ?? current.reminderTemplate ?? DEFAULT_REMINDER_TEMPLATE,
      campaignTargets: {
        ...DEFAULT_CAMPAIGN_TARGETS,
        ...(current.campaignTargets ?? {}),
        ...(nextSettings.campaignTargets ?? {}),
      },
    };
    this.db
      .prepare('UPDATE settings SET json = ?, updated_at = ? WHERE id = 1')
      .run(JSON.stringify(merged), new Date().toISOString());
    return this.getSettings();
  }

  private generateUniqueRedemptionCode(): string {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let attempt = 0; attempt < 10; attempt++) {
      let suffix = '';
      for (let i = 0; i < 4; i++) {
        suffix += alphabet[crypto.randomInt(0, alphabet.length)];
      }
      const candidate = `XMAS-${suffix}`;
      const clash = this.db
        .prepare('SELECT 1 FROM leads WHERE redemption_code = ?')
        .get(candidate);
      if (!clash) return candidate;
    }
    return `XMAS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  recordAnalyticsEvent(input: TrackEventInput): void {
    const cleanVisitorId = input.visitorId.trim().slice(0, 80);
    let resolvedLeadId: number | null = null;
    let resolvedVolunteer = (input.volunteerName || '').trim().slice(0, 40);

    if (input.claimToken) {
      const leadRow = this.db
        .prepare('SELECT id, volunteer_name FROM leads WHERE claim_token = ?')
        .get(input.claimToken.trim()) as { id: number; volunteer_name: string } | undefined;
      if (leadRow) {
        resolvedLeadId = leadRow.id;
        if (!resolvedVolunteer && leadRow.volunteer_name) {
          resolvedVolunteer = leadRow.volunteer_name;
        }
      }
    }

    if (resolvedLeadId === null && cleanVisitorId) {
      const byVisitor = this.db
        .prepare('SELECT id, volunteer_name FROM leads WHERE visitor_id = ? ORDER BY id DESC LIMIT 1')
        .get(cleanVisitorId) as { id: number; volunteer_name: string } | undefined;
      if (byVisitor) {
        resolvedLeadId = byVisitor.id;
        if (!resolvedVolunteer && byVisitor.volunteer_name) {
          resolvedVolunteer = byVisitor.volunteer_name;
        }
      }
    }

    const isPost = input.isPostInteraction ? 1 : 0;
    const scoreVal = typeof input.score === 'number' && Number.isFinite(input.score)
      ? Math.max(0, Math.min(9999, Math.round(input.score)))
      : 0;

    this.db
      .prepare(
        `INSERT INTO analytics_events (
          visitor_id, lead_id, event_type, game_id, score, is_post_interaction, volunteer_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cleanVisitorId || 'anon',
        resolvedLeadId,
        input.eventType,
        input.gameId || '',
        scoreVal,
        isPost,
        resolvedVolunteer,
        new Date().toISOString()
      );
  }

  createOrGetLead(params: {
    clientRequestId: string;
    visitorId?: string;
    name: string;
    rawPhone: string;
    normalizedPhone: string;
    gamePlayed: GameId;
    score: number;
    targetScore: number;
    volunteerName: string;
  }): PublicClaimResult {
    const existing = this.db
      .prepare('SELECT * FROM leads WHERE client_request_id = ?')
      .get(params.clientRequestId) as unknown as RawLeadRow | undefined;

    if (existing) {
      return this.toEnrichedPublicClaimResult(existing);
    }

    const redemptionCode = this.generateUniqueRedemptionCode();
    const claimToken = crypto.randomBytes(18).toString('base64url');
    const createdAt = new Date().toISOString();
    const cleanVisitorId = (params.visitorId || '').trim().slice(0, 80);

    this.db
      .prepare(
        `INSERT INTO leads (
          client_request_id, visitor_id, redemption_code, claim_token, name, raw_phone, normalized_phone,
          game_played, score, target_score, volunteer_name, gift_claimed, whatsapp_sent, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', ?)`
      )
      .run(
        params.clientRequestId,
        cleanVisitorId,
        redemptionCode,
        claimToken,
        params.name.trim(),
        params.rawPhone.trim(),
        params.normalizedPhone,
        params.gamePlayed,
        Math.round(params.score),
        Math.round(params.targetScore),
        params.volunteerName.trim(),
        createdAt
      );

    const inserted = this.db
      .prepare('SELECT * FROM leads WHERE client_request_id = ?')
      .get(params.clientRequestId) as unknown as RawLeadRow;

    // Retroactively link pre-registration street events and rounds from this phone's visitorId to this lead
    if (cleanVisitorId) {
      this.db
        .prepare('UPDATE analytics_events SET lead_id = ? WHERE visitor_id = ? AND lead_id IS NULL')
        .run(inserted.id, cleanVisitorId);
      this.db
        .prepare('UPDATE game_runs SET lead_id = ? WHERE visitor_id = ? AND lead_id IS NULL')
        .run(inserted.id, cleanVisitorId);
    }

    // Ensure at least one initial game_complete is recorded for this lead if client didn't emit one prior
    const priorGame = this.db
      .prepare("SELECT 1 FROM analytics_events WHERE lead_id = ? AND event_type = 'game_complete' LIMIT 1")
      .get(inserted.id);

    if (!priorGame) {
      this.db
        .prepare(
          `INSERT INTO analytics_events (
            visitor_id, lead_id, event_type, game_id, score, is_post_interaction, volunteer_name, created_at
          ) VALUES (?, ?, 'game_complete', ?, ?, 0, ?, ?)`
        )
        .run(
          cleanVisitorId || `lead-${inserted.id}`,
          inserted.id,
          inserted.game_played,
          inserted.score,
          inserted.volunteer_name,
          createdAt
        );
    }

    return this.toEnrichedPublicClaimResult(inserted);
  }

  getPassByClaimToken(claimToken: string): PublicClaimResult | null {
    const row = this.db
      .prepare('SELECT * FROM leads WHERE claim_token = ?')
      .get(claimToken.trim()) as unknown as RawLeadRow | undefined;
    if (!row) return null;
    return this.toEnrichedPublicClaimResult(row);
  }

  markGiftClaimedByToken(claimToken: string): PublicClaimResult | null {
    const existing = this.db
      .prepare('SELECT * FROM leads WHERE claim_token = ?')
      .get(claimToken) as unknown as RawLeadRow | undefined;

    if (!existing) return null;

    this.db.prepare('UPDATE leads SET gift_claimed = 1 WHERE id = ?').run(existing.id);

    const updated = this.db
      .prepare('SELECT * FROM leads WHERE id = ?')
      .get(existing.id) as unknown as RawLeadRow;
    return this.toEnrichedPublicClaimResult(updated);
  }

  private getLeadAggregatesMap(): Map<number, LeadEventAggRow> {
    const rows = this.db
      .prepare(
        `SELECT
          lead_id,
          SUM(CASE WHEN event_type = 'game_complete' THEN 1 ELSE 0 END) AS total_games,
          SUM(CASE WHEN event_type = 'game_complete' AND is_post_interaction = 1 THEN 1 ELSE 0 END) AS after_games,
          SUM(CASE WHEN event_type = 'invite_share_whatsapp' THEN 1 ELSE 0 END) AS shares,
          SUM(CASE WHEN event_type = 'ticket_download' THEN 1 ELSE 0 END) AS downloads,
          SUM(CASE WHEN event_type IN ('calendar_google', 'calendar_ics') THEN 1 ELSE 0 END) AS calendar_adds,
          SUM(CASE WHEN event_type = 'e_invite_view' THEN 1 ELSE 0 END) AS invite_views,
          MAX(created_at) AS last_active_at
        FROM analytics_events
        WHERE lead_id IS NOT NULL
        GROUP BY lead_id`
      )
      .all() as unknown as LeadEventAggRow[];

    const map = new Map<number, LeadEventAggRow>();
    for (const r of rows) {
      map.set(r.lead_id, r);
    }
    return map;
  }

  listTeamLeads(publicBaseUrl: string): {
    leads: TeamLeadRecord[];
    stats: TeamDashboardStats;
  } {
    const settings = this.getSettings();
    const rows = this.db
      .prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 1000')
      .all() as unknown as RawLeadRow[];
    const aggMap = this.getLeadAggregatesMap();

    const byVolunteer: Record<string, number> = {};
    let giftsClaimed = 0;
    let whatsappSentCount = 0;
    let withRemarksCount = 0;
    let confirmedRsvpCount = 0;
    let repliedCount = 0;
    let hotLeadsCount = 0;

    const leads: TeamLeadRecord[] = rows.map((row) => {
      const volKey = row.volunteer_name || 'Unassigned';
      byVolunteer[volKey] = (byVolunteer[volKey] || 0) + 1;
      if (row.gift_claimed) giftsClaimed += 1;
      if (row.whatsapp_sent) whatsappSentCount += 1;
      if (row.notes && row.notes.trim().length > 0) withRemarksCount += 1;
      const status: FollowUpStatus = row.followup_status || (row.whatsapp_sent ? 'contacted' : 'new');
      if (status === 'confirmed') confirmedRsvpCount += 1;
      if (status === 'replied' || status === 'confirmed') repliedCount += 1;

      const agg = aggMap.get(row.id);
      const afterGames = agg?.after_games ?? 0;
      const shares = agg?.shares ?? 0;
      const calendarAdds = agg?.calendar_adds ?? 0;
      if (calendarAdds > 0 || shares > 0 || afterGames >= 2) {
        hotLeadsCount += 1;
      }

      const waParams = {
        normalizedPhone: row.normalized_phone,
        guestName: row.name,
        volunteerName: row.volunteer_name,
        claimToken: row.claim_token,
        settings,
        publicBaseUrl,
      };

      return {
        id: row.id,
        redemptionCode: row.redemption_code,
        name: row.name,
        rawPhone: row.raw_phone,
        normalizedPhone: row.normalized_phone,
        whatsappUrl: buildPersonalWhatsAppUrl(waParams),
        reminderWhatsappUrl: buildReminderWhatsAppUrl(waParams),
        personalInviteUrl: buildPersonalPassUrl(publicBaseUrl, row.claim_token),
        gamePlayed: row.game_played,
        score: row.score,
        targetScore: row.target_score,
        volunteerName: row.volunteer_name,
        giftClaimed: Boolean(row.gift_claimed),
        whatsappSent: Boolean(row.whatsapp_sent),
        followUpStatus: status,
        notes: row.notes,
        notesUpdatedAt: row.notes_updated_at || '',
        createdAt: row.created_at,
        totalGamesPlayed: Math.max(1, agg?.total_games ?? 1),
        gamesAfterInteraction: afterGames,
        inviteShares: shares,
        ticketDownloads: agg?.downloads ?? 0,
        calendarAdds,
        eInviteViews: agg?.invite_views ?? 0,
        lastActiveAt: agg?.last_active_at || row.created_at,
      };
    });

    return {
      leads,
      stats: {
        totalLeads: rows.length,
        giftsClaimed,
        whatsappSentCount,
        withRemarksCount,
        confirmedRsvpCount,
        repliedCount,
        hotLeadsCount,
        byVolunteer,
      },
    };
  }

  updateLeadStatus(
    id: number,
    patch: LeadPatchInput,
    publicBaseUrl: string
  ): TeamLeadRecord | null {
    const existing = this.db
      .prepare('SELECT * FROM leads WHERE id = ?')
      .get(id) as unknown as RawLeadRow | undefined;
    if (!existing) return null;

    const currentStatus: FollowUpStatus =
      existing.followup_status || (existing.whatsapp_sent ? 'contacted' : 'new');

    const nextGift =
      patch.giftClaimed !== undefined ? (patch.giftClaimed ? 1 : 0) : existing.gift_claimed;

    let nextWa =
      patch.whatsappSent !== undefined ? (patch.whatsappSent ? 1 : 0) : existing.whatsapp_sent;
    let nextStatus: FollowUpStatus = currentStatus;

    if (patch.followUpStatus !== undefined) {
      nextStatus = patch.followUpStatus;
      if (
        patch.whatsappSent === undefined &&
        (nextStatus === 'contacted' || nextStatus === 'replied' || nextStatus === 'confirmed') &&
        !existing.whatsapp_sent
      ) {
        nextWa = 1;
      }
      if (patch.whatsappSent === undefined && nextStatus === 'new') {
        nextWa = 0;
      }
    } else if (patch.whatsappSent === true && currentStatus === 'new') {
      nextStatus = 'contacted';
    } else if (patch.whatsappSent === false && currentStatus === 'contacted') {
      nextStatus = 'new';
    }

    const nextNotes =
      patch.notes !== undefined ? patch.notes.trim().slice(0, 1000) : existing.notes;
    const nextNotesUpdatedAt =
      patch.notes !== undefined && nextNotes !== existing.notes
        ? nextNotes
          ? new Date(this.now()).toISOString()
          : ''
        : existing.notes_updated_at || '';
    const nextVolunteer =
      patch.volunteerName !== undefined
        ? patch.volunteerName.trim().slice(0, 40)
        : existing.volunteer_name;

    this.db
      .prepare(
        `UPDATE leads
         SET gift_claimed = ?,
             whatsapp_sent = ?,
             followup_status = ?,
             notes = ?,
             notes_updated_at = ?,
             volunteer_name = ?
         WHERE id = ?`
      )
      .run(
        nextGift,
        nextWa,
        nextStatus,
        nextNotes,
        nextNotesUpdatedAt,
        nextVolunteer,
        id
      );

    // Log team WhatsApp follow-up action when newly marked sent
    if (nextWa === 1 && !existing.whatsapp_sent) {
      this.db
        .prepare(
          `INSERT INTO analytics_events (
            visitor_id, lead_id, event_type, game_id, score, is_post_interaction, volunteer_name, created_at
          ) VALUES (?, ?, 'team_whatsapp_followup', '', 0, 1, ?, ?)`
        )
        .run(
          existing.visitor_id || `lead-${existing.id}`,
          existing.id,
          nextVolunteer,
          new Date(this.now()).toISOString()
        );
    }

    const { leads } = this.listTeamLeads(publicBaseUrl);
    return leads.find((l) => l.id === id) || null;
  }

  getMasterAnalytics(): MasterAnalyticsResponse {
    const settings = this.getSettings();
    const targets: CampaignTargets = settings.campaignTargets ?? { ...DEFAULT_CAMPAIGN_TARGETS };

    const eventSums = this.db
      .prepare(
        `SELECT
          SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS total_views,
          SUM(CASE WHEN event_type = 'page_view' AND volunteer_name != '' THEN 1 ELSE 0 END) AS qr_views,
          SUM(CASE WHEN event_type = 'page_view' AND is_post_interaction = 1 THEN 1 ELSE 0 END) AS return_views,
          SUM(CASE WHEN event_type = 'game_start' THEN 1 ELSE 0 END) AS games_started,
          SUM(CASE WHEN event_type = 'game_complete' THEN 1 ELSE 0 END) AS games_played,
          SUM(CASE WHEN event_type = 'game_complete' AND is_post_interaction = 0 THEN 1 ELSE 0 END) AS games_during,
          SUM(CASE WHEN event_type = 'game_complete' AND is_post_interaction = 1 THEN 1 ELSE 0 END) AS games_after,
          SUM(CASE WHEN event_type = 'e_invite_view' THEN 1 ELSE 0 END) AS invite_views,
          SUM(CASE WHEN event_type = 'e_invite_view' AND is_post_interaction = 1 THEN 1 ELSE 0 END) AS repeat_invite_views,
          SUM(CASE WHEN event_type = 'ticket_download' THEN 1 ELSE 0 END) AS ticket_downloads,
          SUM(CASE WHEN event_type = 'invite_share_whatsapp' THEN 1 ELSE 0 END) AS invite_shares,
          SUM(CASE WHEN event_type = 'calendar_google' THEN 1 ELSE 0 END) AS cal_google,
          SUM(CASE WHEN event_type = 'calendar_ics' THEN 1 ELSE 0 END) AS cal_ics,
          SUM(CASE WHEN event_type = 'maps_click' THEN 1 ELSE 0 END) AS maps_clicks,
          SUM(CASE WHEN event_type = 'team_whatsapp_followup' THEN 1 ELSE 0 END) AS team_wa_clicks
        FROM analytics_events`
      )
      .get() as Record<string, number | null>;

    const uniqueVisitorsRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT vid) AS cnt FROM (
          SELECT visitor_id AS vid FROM analytics_events WHERE visitor_id != ''
          UNION
          SELECT CASE WHEN visitor_id != '' THEN visitor_id ELSE ('lead-' || id) END AS vid FROM leads
        )`
      )
      .get() as { cnt: number };

    const uniqueAfterRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT COALESCE(CAST(lead_id AS TEXT), visitor_id)) AS cnt
         FROM analytics_events
         WHERE event_type = 'game_complete' AND is_post_interaction = 1`
      )
      .get() as { cnt: number };

    const leadCounts = this.db
      .prepare(
        `SELECT
          COUNT(*) AS total_leads,
          SUM(CASE WHEN gift_claimed = 1 THEN 1 ELSE 0 END) AS gifts_claimed,
          SUM(CASE WHEN whatsapp_sent = 1 THEN 1 ELSE 0 END) AS wa_sent,
          SUM(CASE WHEN followup_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_rsvps,
          SUM(CASE WHEN followup_status IN ('replied', 'confirmed') THEN 1 ELSE 0 END) AS replied_contacts,
          SUM(CASE WHEN TRIM(notes) != '' THEN 1 ELSE 0 END) AS with_remarks
        FROM leads`
      )
      .get() as {
      total_leads: number;
      gifts_claimed: number | null;
      wa_sent: number | null;
      confirmed_rsvps: number | null;
      replied_contacts: number | null;
      with_remarks: number | null;
    };

    const totalLeads = leadCounts.total_leads || 0;
    const uniqueVisitors = Math.max(uniqueVisitorsRow.cnt || 0, totalLeads);
    const totalGamesPlayed = eventSums.games_played || 0;
    const totalPageViews = Math.max(eventSums.total_views || 0, totalLeads);

    const visitorToLeadRatePct =
      uniqueVisitors > 0 ? Math.min(100, Math.round((totalLeads / uniqueVisitors) * 1000) / 10) : 0;

    const avgGamesPerLead =
      totalLeads > 0 ? Math.round((totalGamesPlayed / totalLeads) * 10) / 10 : 0;

    // Breakdown by Mini-Game
    const rawGameRows = this.db
      .prepare(
        `SELECT
          game_id,
          SUM(CASE WHEN event_type = 'game_start' THEN 1 ELSE 0 END) AS starts,
          SUM(CASE WHEN event_type = 'game_complete' THEN 1 ELSE 0 END) AS completions,
          SUM(CASE WHEN event_type = 'game_complete' AND is_post_interaction = 0 THEN 1 ELSE 0 END) AS during_cnt,
          SUM(CASE WHEN event_type = 'game_complete' AND is_post_interaction = 1 THEN 1 ELSE 0 END) AS after_cnt,
          AVG(CASE WHEN event_type = 'game_complete' THEN score ELSE NULL END) AS avg_score,
          MAX(CASE WHEN event_type = 'game_complete' THEN score ELSE 0 END) AS high_score
        FROM analytics_events
        WHERE game_id != ''
        GROUP BY game_id`
      )
      .all() as Array<{
      game_id: GameId;
      starts: number;
      completions: number;
      during_cnt: number;
      after_cnt: number;
      avg_score: number | null;
      high_score: number | null;
    }>;

    const byGameMap = new Map(rawGameRows.map((r) => [r.game_id, r]));
    const orderedGameIds: GameId[] = [
      ...ACTIVE_GAMES,
      ...LEGACY_GAMES.filter((gid) => {
        const row = byGameMap.get(gid);
        return Boolean(row && (row.starts > 0 || row.completions > 0));
      }),
    ];
    const byGame: GameAnalyticsRow[] = orderedGameIds.map((gid) => {
      const r = byGameMap.get(gid);
      const completions = r?.completions ?? 0;
      const starts = Math.max(r?.starts ?? 0, completions);
      return {
        gameId: gid,
        starts,
        completions,
        duringInteraction: r?.during_cnt ?? 0,
        afterInteraction: r?.after_cnt ?? 0,
        avgScore: r?.avg_score ? Math.round(r.avg_score * 10) / 10 : 0,
        highScore: r?.high_score ?? 0,
      };
    });

    // Breakdown by Volunteer / QR Board
    const volunteerEventRows = this.db
      .prepare(
        `SELECT
          CASE WHEN volunteer_name = '' THEN 'General / Direct' ELSE volunteer_name END AS vol,
          SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
          COUNT(DISTINCT visitor_id) AS uniq_vis,
          SUM(CASE WHEN event_type = 'game_complete' THEN 1 ELSE 0 END) AS games_played,
          SUM(CASE WHEN event_type = 'game_complete' AND is_post_interaction = 1 THEN 1 ELSE 0 END) AS games_after,
          SUM(CASE WHEN event_type = 'invite_share_whatsapp' THEN 1 ELSE 0 END) AS shares
        FROM analytics_events
        GROUP BY vol`
      )
      .all() as Array<{
      vol: string;
      views: number;
      uniq_vis: number;
      games_played: number;
      games_after: number;
      shares: number;
    }>;

    const volunteerLeadRows = this.db
      .prepare(
        `SELECT
          CASE WHEN volunteer_name = '' THEN 'General / Direct' ELSE volunteer_name END AS vol,
          COUNT(*) AS leads_cnt,
          SUM(CASE WHEN gift_claimed = 1 THEN 1 ELSE 0 END) AS gifts_cnt,
          SUM(CASE WHEN whatsapp_sent = 1 THEN 1 ELSE 0 END) AS wa_cnt,
          SUM(CASE WHEN followup_status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_cnt,
          SUM(CASE WHEN TRIM(notes) != '' THEN 1 ELSE 0 END) AS remarks_cnt
        FROM leads
        GROUP BY vol`
      )
      .all() as Array<{
      vol: string;
      leads_cnt: number;
      gifts_cnt: number | null;
      wa_cnt: number | null;
      confirmed_cnt: number | null;
      remarks_cnt: number | null;
    }>;

    const allVolNames = new Set<string>([
      ...volunteerEventRows.map((r) => r.vol),
      ...volunteerLeadRows.map((r) => r.vol),
    ]);
    const evByVol = new Map(volunteerEventRows.map((r) => [r.vol, r]));
    const ldByVol = new Map(volunteerLeadRows.map((r) => [r.vol, r]));

    const byVolunteer: VolunteerAnalyticsRow[] = Array.from(allVolNames)
      .map((vol) => {
        const ev = evByVol.get(vol);
        const ld = ldByVol.get(vol);
        const leadsCnt = ld?.leads_cnt ?? 0;
        return {
          volunteerName: vol,
          views: Math.max(ev?.views ?? 0, leadsCnt),
          uniqueVisitors: Math.max(ev?.uniq_vis ?? 0, leadsCnt),
          gamesPlayed: ev?.games_played ?? 0,
          gamesAfterInteraction: ev?.games_after ?? 0,
          leadsCount: leadsCnt,
          giftsClaimed: ld?.gifts_cnt ?? 0,
          sharedInvites: ev?.shares ?? 0,
          whatsappFollowedUp: ld?.wa_cnt ?? 0,
          confirmedRsvps: ld?.confirmed_cnt ?? 0,
          withRemarks: ld?.remarks_cnt ?? 0,
        };
      })
      .sort((a, b) => b.leadsCount - a.leadsCount || b.views - a.views);

    // Recent Activity Stream (latest 30 events)
    const rawRecent = this.db
      .prepare(
        `SELECT
          e.id,
          e.event_type,
          e.volunteer_name,
          e.game_id,
          e.score,
          e.is_post_interaction,
          e.created_at,
          l.name AS guest_name,
          l.redemption_code AS redemption_code
        FROM analytics_events e
        LEFT JOIN leads l ON l.id = e.lead_id
        ORDER BY e.id DESC
        LIMIT 30`
      )
      .all() as Array<{
      id: number;
      event_type: AnalyticsEventType;
      volunteer_name: string;
      game_id: string;
      score: number;
      is_post_interaction: number;
      created_at: string;
      guest_name: string | null;
      redemption_code: string | null;
    }>;

    const recentActivity: RecentActivityItem[] = rawRecent.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      guestName: r.guest_name,
      redemptionCode: r.redemption_code,
      volunteerName: r.volunteer_name,
      gameId: r.game_id,
      score: r.score,
      isPostInteraction: Boolean(r.is_post_interaction),
      createdAt: r.created_at,
    }));

    return {
      overview: {
        totalPageViews,
        uniqueVisitors,
        qrScanViews: eventSums.qr_views || 0,
        returnViewsAfterInteraction: eventSums.return_views || 0,
        totalGamesStarted: Math.max(eventSums.games_started || 0, totalGamesPlayed),
        totalGamesPlayed,
        gamesDuringInteraction: eventSums.games_during || 0,
        gamesAfterInteraction: eventSums.games_after || 0,
        uniquePlayersAfterInteraction: uniqueAfterRow.cnt || 0,
        avgGamesPerLead,
        totalLeads,
        visitorToLeadRatePct,
        giftsClaimed: leadCounts.gifts_claimed || 0,
        eInviteViews: eventSums.invite_views || 0,
        repeatEInviteViews: eventSums.repeat_invite_views || 0,
        eTicketDownloads: eventSums.ticket_downloads || 0,
        invitationsShared: eventSums.invite_shares || 0,
        googleCalendarAdds: eventSums.cal_google || 0,
        icsCalendarDownloads: eventSums.cal_ics || 0,
        mapsDirectionsClicks: eventSums.maps_clicks || 0,
        teamWhatsappFollowupsSent: leadCounts.wa_sent || 0,
        teamWhatsappClicksTotal: eventSums.team_wa_clicks || 0,
        confirmedRsvps: leadCounts.confirmed_rsvps || 0,
        repliedContacts: leadCounts.replied_contacts || 0,
        contactsWithRemarks: leadCounts.with_remarks || 0,
      },
      targets,
      byGame,
      byVolunteer,
      recentActivity,
    };
  }

  private resolveLeadId(claimToken: string | undefined, visitorId: string): number | null {
    if (claimToken) {
      const byToken = this.db
        .prepare('SELECT id FROM leads WHERE claim_token = ?')
        .get(claimToken.trim()) as { id: number } | undefined;
      if (byToken) return byToken.id;
    }
    if (visitorId) {
      const byVisitor = this.db
        .prepare('SELECT id FROM leads WHERE visitor_id = ? ORDER BY id DESC LIMIT 1')
        .get(visitorId) as { id: number } | undefined;
      if (byVisitor) return byVisitor.id;
    }
    return null;
  }

  /**
   * Starts a server-timed round and logs the game_start analytics event. Returns the opaque run id.
   * A round counts as "after the street interaction" when the player already has a registered pass.
   */
  startRun(params: {
    gameId: ActiveGameId;
    visitorId: string;
    claimToken?: string;
    volunteerName?: string;
  }): string {
    const visitorId = params.visitorId.trim().slice(0, 80);
    const runId = crypto.randomBytes(18).toString('base64url');
    const leadId = this.resolveLeadId(params.claimToken, visitorId);
    const isPostInteraction = leadId !== null;

    this.db
      .prepare(
        `INSERT INTO game_runs (id, visitor_id, lead_id, game_id, is_post_interaction, volunteer_name, started_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runId,
        visitorId,
        leadId,
        params.gameId,
        isPostInteraction ? 1 : 0,
        (params.volunteerName || '').trim().slice(0, 40),
        this.now()
      );

    this.recordAnalyticsEvent({
      eventType: 'game_start',
      visitorId,
      claimToken: params.claimToken,
      gameId: params.gameId,
      isPostInteraction,
      volunteerName: params.volunteerName,
    });

    return runId;
  }

  /**
   * Finishes a round. The score is verified against the server-measured duration and the game's caps.
   * Rejected scores are kept for audit but never reach the leaderboard (and count as 0 in analytics).
   */
  finishRun(params: {
    runId: string;
    visitorId: string;
    score: number;
    endReason: RoundEndReason;
  }): { ok: true; result: RunFinishResult } | { ok: false; status: 404 | 409; error: string } {
    const run = this.db.prepare('SELECT * FROM game_runs WHERE id = ?').get(params.runId) as
      | {
          id: string;
          visitor_id: string;
          lead_id: number | null;
          game_id: ActiveGameId;
          is_post_interaction: number;
          volunteer_name: string;
          status: string;
          started_ms: number;
        }
      | undefined;

    // Same response for "missing" and "someone else's run" so run ids can't be probed.
    if (!run || run.visitor_id !== params.visitorId.trim()) {
      return { ok: false, status: 404, error: 'Round not found.' };
    }
    if (run.status !== 'started') {
      return { ok: false, status: 409, error: 'Round already finished.' };
    }

    const nowMs = this.now();
    const elapsedSec = (nowMs - run.started_ms) / 1000;
    const expired = nowMs - run.started_ms > RUN_EXPIRY_MS;
    const score = Math.max(0, Math.round(params.score));
    const verified = !expired && isPlausibleScore(run.game_id, score, elapsedSec);

    // Link to a lead registered since the run started (e.g. claimed gift mid-session).
    const leadId = run.lead_id ?? this.resolveLeadId(undefined, run.visitor_id);

    const previousBest = this.db
      .prepare(
        `SELECT MAX(score) AS best FROM game_runs
         WHERE game_id = ? AND status = 'verified' AND id != ?
           AND (${leadId !== null ? 'lead_id = ?' : 'visitor_id = ?'})`
      )
      .get(run.game_id, run.id, leadId ?? run.visitor_id) as { best: number | null };

    this.db
      .prepare(
        `UPDATE game_runs SET status = ?, score = ?, end_reason = ?, finished_ms = ?, lead_id = ?
         WHERE id = ?`
      )
      .run(verified ? 'verified' : 'rejected', score, params.endReason, nowMs, leadId, run.id);

    this.db
      .prepare(
        `INSERT INTO analytics_events (
          visitor_id, lead_id, event_type, game_id, score, is_post_interaction, volunteer_name, created_at
        ) VALUES (?, ?, 'game_complete', ?, ?, ?, ?, ?)`
      )
      .run(
        run.visitor_id,
        leadId,
        run.game_id,
        verified ? score : 0,
        run.is_post_interaction,
        run.volunteer_name,
        new Date(nowMs).toISOString()
      );

    const board = this.getGameBoard(run.game_id, leadId);
    const isPersonalBest = verified && score > 0 && score > (previousBest.best ?? 0);

    let claim: PublicClaimResult | null = null;
    if (leadId !== null) {
      const leadRow = this.db
        .prepare('SELECT * FROM leads WHERE id = ?')
        .get(leadId) as unknown as RawLeadRow | undefined;
      claim = leadRow ? this.toEnrichedPublicClaimResult(leadRow) : null;
    }

    return {
      ok: true,
      result: {
        status: verified ? 'verified' : 'rejected',
        score,
        rank: leadId !== null ? (board.me?.rank ?? null) : null,
        wouldRank: leadId === null && verified && score > 0 ? this.getWouldRank(run.game_id, score) : null,
        isPersonalBest,
        board,
        claim,
      },
    };
  }

  /** All-time top 3 for one game (best verified score per registered player), plus the viewer's own rank. */
  getGameBoard(gameId: ActiveGameId, viewerLeadId: number | null): GameLeaderboard {
    const rows = this.db
      .prepare(
        `WITH best AS (
           SELECT lead_id, score, finished_ms,
                  ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY score DESC, finished_ms ASC) AS rn
           FROM game_runs
           WHERE game_id = ? AND status = 'verified' AND lead_id IS NOT NULL AND score > 0
         ),
         board AS (
           SELECT b.lead_id, b.score, l.name,
                  ROW_NUMBER() OVER (ORDER BY b.score DESC, b.finished_ms ASC, b.lead_id ASC) AS rank
           FROM best b JOIN leads l ON l.id = b.lead_id
           WHERE b.rn = 1
         )
         SELECT lead_id, score, name, rank, (SELECT COUNT(*) FROM board) AS total
         FROM board
         WHERE rank <= 3 OR lead_id = ?
         ORDER BY rank`
      )
      .all(gameId, viewerLeadId ?? -1) as Array<{
      lead_id: number;
      score: number;
      name: string;
      rank: number;
      total: number;
    }>;

    const mine = viewerLeadId !== null ? rows.find((r) => r.lead_id === viewerLeadId) : undefined;

    return {
      gameId,
      totalPlayers: rows[0]?.total ?? 0,
      top: rows
        .filter((r) => r.rank <= 3)
        .map((r) => ({
          rank: r.rank,
          name: formatBoardName(r.name),
          score: r.score,
          isMe: r.lead_id === viewerLeadId,
        })),
      me: mine ? { rank: mine.rank, score: mine.score } : null,
    };
  }

  /** Rank an unregistered score would take (ties go to whoever got there first). */
  private getWouldRank(gameId: ActiveGameId, score: number): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS ahead FROM (
           SELECT lead_id, MAX(score) AS best FROM game_runs
           WHERE game_id = ? AND status = 'verified' AND lead_id IS NOT NULL AND score > 0
           GROUP BY lead_id
         ) WHERE best >= ?`
      )
      .get(gameId, score) as { ahead: number };
    return row.ahead + 1;
  }

  getLeaderboards(claimToken?: string): GameLeaderboard[] {
    let viewerLeadId: number | null = null;
    if (claimToken) {
      const lead = this.db
        .prepare('SELECT id FROM leads WHERE claim_token = ?')
        .get(claimToken.trim()) as { id: number } | undefined;
      viewerLeadId = lead?.id ?? null;
    }
    return ACTIVE_GAMES.map((gameId) => this.getGameBoard(gameId, viewerLeadId));
  }

  /**
   * Unlimited all-time standings for a single game.
   * Deduplicates strictly to one row per registered player (their all-time best verified score),
   * never showing repeated lower trials, ordered by score DESC then earliest achievement.
   */
  getFullGameLeaderboard(gameId: ActiveGameId, claimToken?: string): FullGameLeaderboard {
    let viewerLeadId: number | null = null;
    if (claimToken) {
      const lead = this.db
        .prepare('SELECT id FROM leads WHERE claim_token = ?')
        .get(claimToken.trim()) as { id: number } | undefined;
      viewerLeadId = lead?.id ?? null;
    }

    const rows = this.db
      .prepare(
        `WITH best AS (
           SELECT lead_id, score, finished_ms,
                  ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY score DESC, finished_ms ASC) AS rn
           FROM game_runs
           WHERE game_id = ? AND status = 'verified' AND lead_id IS NOT NULL AND score > 0
         )
         SELECT b.lead_id, b.score, b.finished_ms, l.name,
                ROW_NUMBER() OVER (ORDER BY b.score DESC, b.finished_ms ASC, b.lead_id ASC) AS rank
         FROM best b JOIN leads l ON l.id = b.lead_id
         WHERE b.rn = 1
         ORDER BY rank`
      )
      .all(gameId) as Array<{
      lead_id: number;
      score: number;
      finished_ms: number | null;
      name: string;
      rank: number;
    }>;

    const mine = viewerLeadId !== null ? rows.find((r) => r.lead_id === viewerLeadId) : undefined;

    return {
      gameId,
      totalPlayers: rows.length,
      entries: rows.map((r) => ({
        rank: r.rank,
        name: formatBoardName(r.name),
        score: r.score,
        isMe: r.lead_id === viewerLeadId,
        achievedAt: new Date(r.finished_ms ?? this.now()).toISOString(),
      })),
      me: mine ? { rank: mine.rank, score: mine.score } : null,
    };
  }

  close(): void {
    this.db.close();
  }

  private toEnrichedPublicClaimResult(row: RawLeadRow): PublicClaimResult {
    const scoreRows = this.db
      .prepare(
        `SELECT game_id, COUNT(*) AS cnt, SUM(is_post_interaction) AS after_cnt, MAX(score) AS best
         FROM analytics_events
         WHERE lead_id = ? AND event_type = 'game_complete'
         GROUP BY game_id`
      )
      .all(row.id) as Array<{
      game_id: GameId;
      cnt: number;
      after_cnt: number | null;
      best: number | null;
    }>;

    let totalGamesPlayed = 0;
    let gamesAfterInteraction = 0;
    const bestScores: Partial<Record<GameId, number>> = {
      [row.game_played]: row.score,
    };

    for (const sr of scoreRows) {
      totalGamesPlayed += sr.cnt;
      gamesAfterInteraction += sr.after_cnt || 0;
      if (sr.game_id && typeof sr.best === 'number') {
        bestScores[sr.game_id] = Math.max(bestScores[sr.game_id] || 0, sr.best);
      }
    }

    return {
      redemptionCode: row.redemption_code,
      claimToken: row.claim_token,
      name: row.name,
      gamePlayed: row.game_played,
      score: row.score,
      targetScore: row.target_score,
      volunteerName: row.volunteer_name,
      giftClaimed: Boolean(row.gift_claimed),
      createdAt: row.created_at,
      totalGamesPlayed: Math.max(1, totalGamesPlayed),
      gamesAfterInteraction,
      bestScores,
    };
  }
}

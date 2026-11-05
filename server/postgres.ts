import pg from 'pg';
import type { FollowUpStatus, GameId } from '../src/types.ts';

const { Pool } = pg;

export interface PersistedSettingsRow {
  id: number;
  json: string;
  updated_at: string;
}

export interface PersistedLeadRow {
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

export interface PersistedAnalyticsEventRow {
  id: number;
  visitor_id: string;
  lead_id: number | null;
  event_type: string;
  game_id: string;
  score: number;
  is_post_interaction: number;
  volunteer_name: string;
  created_at: string;
}

export interface PersistedGameRunRow {
  id: string;
  visitor_id: string;
  lead_id: number | null;
  game_id: string;
  is_post_interaction: number;
  volunteer_name: string;
  status: string;
  score: number;
  end_reason: string;
  started_ms: number;
  finished_ms: number | null;
}

export interface HydratedSnapshot {
  settings: PersistedSettingsRow | null;
  leads: PersistedLeadRow[];
  events: PersistedAnalyticsEventRow[];
  runs: PersistedGameRunRow[];
}

export interface RemotePersistenceAdapter {
  readonly kind: 'postgres';
  loadSnapshot(): Promise<HydratedSnapshot>;
  upsertSettings(row: PersistedSettingsRow): Promise<void>;
  upsertLead(row: PersistedLeadRow): Promise<void>;
  upsertAnalyticsEvent(row: PersistedAnalyticsEventRow): Promise<void>;
  upsertGameRun(row: PersistedGameRunRow): Promise<void>;
  linkVisitorToLead(leadId: number, visitorId: string): Promise<void>;
  close(): Promise<void>;
}

export interface QueryablePool {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: R[] }>;
  end(): Promise<void>;
}

export const POSTGRES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
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

  CREATE INDEX IF NOT EXISTS idx_pg_leads_created_at ON leads(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pg_leads_volunteer ON leads(volunteer_name);

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    lead_id INTEGER,
    event_type TEXT NOT NULL,
    game_id TEXT NOT NULL DEFAULT '',
    score INTEGER NOT NULL DEFAULT 0,
    is_post_interaction INTEGER NOT NULL DEFAULT 0,
    volunteer_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_pg_events_type ON analytics_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_pg_events_lead_id ON analytics_events(lead_id);
  CREATE INDEX IF NOT EXISTS idx_pg_events_visitor_id ON analytics_events(visitor_id);

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
    started_ms BIGINT NOT NULL,
    finished_ms BIGINT
  );

  CREATE INDEX IF NOT EXISTS idx_pg_runs_board ON game_runs(game_id, status, score DESC);
  CREATE INDEX IF NOT EXISTS idx_pg_runs_visitor ON game_runs(visitor_id);
  CREATE INDEX IF NOT EXISTS idx_pg_runs_lead ON game_runs(lead_id);
`;

/**
 * Resolves a PostgreSQL connection string from Railway or standard environment variables.
 * Supports DATABASE_URL, DATABASE_PRIVATE_URL, POSTGRES_URL, DATABASE_PUBLIC_URL, or PG* vars.
 */
export function resolvePostgresConnectionUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const candidates = [
    env.DATABASE_URL,
    env.DATABASE_PRIVATE_URL,
    env.POSTGRES_URL,
    env.DATABASE_PUBLIC_URL,
  ];
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (trimmed && /^postgres(ql)?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  const host = env.PGHOST?.trim();
  const user = env.PGUSER?.trim();
  const database = env.PGDATABASE?.trim();
  if (host && user && database) {
    const port = env.PGPORT?.trim() || '5432';
    const password = env.PGPASSWORD ?? '';
    const auth = password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
      : encodeURIComponent(user);
    return `postgresql://${auth}@${host}:${port}/${encodeURIComponent(database)}`;
  }

  return null;
}

function shouldPreferPlainTcp(connectionString: string, env: NodeJS.ProcessEnv): boolean {
  const sslMode = (env.PGSSLMODE || '').trim().toLowerCase();
  if (sslMode === 'disable') return true;
  if (sslMode === 'require' || sslMode === 'verify-full' || sslMode === 'verify-ca') return false;
  if (/sslmode=(require|verify)/i.test(connectionString)) return false;
  if (/sslmode=disable/i.test(connectionString)) return true;

  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.railway.internal') ||
      host.endsWith('.internal')
    );
  } catch {
    return false;
  }
}

export class PostgresPersistenceAdapter implements RemotePersistenceAdapter {
  readonly kind = 'postgres' as const;
  private readonly pool: QueryablePool;

  constructor(pool: QueryablePool) {
    this.pool = pool;
  }

  async initSchema(): Promise<void> {
    await this.pool.query(POSTGRES_SCHEMA_SQL);
  }

  async loadSnapshot(): Promise<HydratedSnapshot> {
    const [settingsRes, leadsRes, eventsRes, runsRes] = await Promise.all([
      this.pool.query<{ id: number; json: string | Record<string, unknown>; updated_at: string }>(
        'SELECT id, json, updated_at FROM settings WHERE id = 1'
      ),
      this.pool.query<Record<string, unknown>>('SELECT * FROM leads ORDER BY id ASC'),
      this.pool.query<Record<string, unknown>>('SELECT * FROM analytics_events ORDER BY id ASC'),
      this.pool.query<Record<string, unknown>>('SELECT * FROM game_runs ORDER BY started_ms ASC'),
    ]);

    const rawSetting = settingsRes.rows[0];
    const settings: PersistedSettingsRow | null = rawSetting
      ? {
          id: 1,
          json:
            typeof rawSetting.json === 'string'
              ? rawSetting.json
              : JSON.stringify(rawSetting.json),
          updated_at: String(rawSetting.updated_at),
        }
      : null;

    const leads: PersistedLeadRow[] = leadsRes.rows.map((r) => ({
      id: Number(r.id),
      client_request_id: String(r.client_request_id),
      visitor_id: String(r.visitor_id ?? ''),
      redemption_code: String(r.redemption_code),
      claim_token: String(r.claim_token),
      name: String(r.name),
      raw_phone: String(r.raw_phone),
      normalized_phone: String(r.normalized_phone),
      game_played: String(r.game_played) as GameId,
      score: Number(r.score ?? 0),
      target_score: Number(r.target_score ?? 15),
      volunteer_name: String(r.volunteer_name ?? ''),
      gift_claimed: r.gift_claimed ? 1 : 0,
      whatsapp_sent: r.whatsapp_sent ? 1 : 0,
      followup_status: String(r.followup_status || 'new') as FollowUpStatus,
      notes: String(r.notes ?? ''),
      notes_updated_at: String(r.notes_updated_at ?? ''),
      created_at: String(r.created_at),
    }));

    const events: PersistedAnalyticsEventRow[] = eventsRes.rows.map((r) => ({
      id: Number(r.id),
      visitor_id: String(r.visitor_id),
      lead_id: r.lead_id !== null && r.lead_id !== undefined ? Number(r.lead_id) : null,
      event_type: String(r.event_type),
      game_id: String(r.game_id ?? ''),
      score: Number(r.score ?? 0),
      is_post_interaction: r.is_post_interaction ? 1 : 0,
      volunteer_name: String(r.volunteer_name ?? ''),
      created_at: String(r.created_at),
    }));

    const runs: PersistedGameRunRow[] = runsRes.rows.map((r) => ({
      id: String(r.id),
      visitor_id: String(r.visitor_id),
      lead_id: r.lead_id !== null && r.lead_id !== undefined ? Number(r.lead_id) : null,
      game_id: String(r.game_id),
      is_post_interaction: r.is_post_interaction ? 1 : 0,
      volunteer_name: String(r.volunteer_name ?? ''),
      status: String(r.status ?? 'started'),
      score: Number(r.score ?? 0),
      end_reason: String(r.end_reason ?? ''),
      started_ms: Number(r.started_ms),
      finished_ms:
        r.finished_ms !== null && r.finished_ms !== undefined ? Number(r.finished_ms) : null,
    }));

    return { settings, leads, events, runs };
  }

  async upsertSettings(row: PersistedSettingsRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings (id, json, updated_at)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET
         json = EXCLUDED.json,
         updated_at = EXCLUDED.updated_at`,
      [row.json, row.updated_at]
    );
  }

  async upsertLead(row: PersistedLeadRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO leads (
         id, client_request_id, visitor_id, redemption_code, claim_token,
         name, raw_phone, normalized_phone, game_played, score, target_score,
         volunteer_name, gift_claimed, whatsapp_sent, followup_status,
         notes, notes_updated_at, created_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18
       )
       ON CONFLICT (id) DO UPDATE SET
         visitor_id = EXCLUDED.visitor_id,
         name = EXCLUDED.name,
         raw_phone = EXCLUDED.raw_phone,
         normalized_phone = EXCLUDED.normalized_phone,
         game_played = EXCLUDED.game_played,
         score = EXCLUDED.score,
         target_score = EXCLUDED.target_score,
         volunteer_name = EXCLUDED.volunteer_name,
         gift_claimed = EXCLUDED.gift_claimed,
         whatsapp_sent = EXCLUDED.whatsapp_sent,
         followup_status = EXCLUDED.followup_status,
         notes = EXCLUDED.notes,
         notes_updated_at = EXCLUDED.notes_updated_at`,
      [
        row.id,
        row.client_request_id,
        row.visitor_id,
        row.redemption_code,
        row.claim_token,
        row.name,
        row.raw_phone,
        row.normalized_phone,
        row.game_played,
        row.score,
        row.target_score,
        row.volunteer_name,
        row.gift_claimed,
        row.whatsapp_sent,
        row.followup_status,
        row.notes,
        row.notes_updated_at,
        row.created_at,
      ]
    );
  }

  async upsertAnalyticsEvent(row: PersistedAnalyticsEventRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO analytics_events (
         id, visitor_id, lead_id, event_type, game_id,
         score, is_post_interaction, volunteer_name, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         lead_id = EXCLUDED.lead_id`,
      [
        row.id,
        row.visitor_id,
        row.lead_id,
        row.event_type,
        row.game_id,
        row.score,
        row.is_post_interaction,
        row.volunteer_name,
        row.created_at,
      ]
    );
  }

  async upsertGameRun(row: PersistedGameRunRow): Promise<void> {
    await this.pool.query(
      `INSERT INTO game_runs (
         id, visitor_id, lead_id, game_id, is_post_interaction,
         volunteer_name, status, score, end_reason, started_ms, finished_ms
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         lead_id = EXCLUDED.lead_id,
         status = EXCLUDED.status,
         score = EXCLUDED.score,
         end_reason = EXCLUDED.end_reason,
         finished_ms = EXCLUDED.finished_ms`,
      [
        row.id,
        row.visitor_id,
        row.lead_id,
        row.game_id,
        row.is_post_interaction,
        row.volunteer_name,
        row.status,
        row.score,
        row.end_reason,
        row.started_ms,
        row.finished_ms,
      ]
    );
  }

  async linkVisitorToLead(leadId: number, visitorId: string): Promise<void> {
    await Promise.all([
      this.pool.query(
        'UPDATE analytics_events SET lead_id = $1 WHERE visitor_id = $2 AND lead_id IS NULL',
        [leadId, visitorId]
      ),
      this.pool.query(
        'UPDATE game_runs SET lead_id = $1 WHERE visitor_id = $2 AND lead_id IS NULL',
        [leadId, visitorId]
      ),
    ]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

async function openVerifiedPool(
  connectionString: string,
  useSsl: boolean
): Promise<pg.Pool> {
  const pool = new Pool({
    connectionString,
    max: 6,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
  try {
    await pool.query('SELECT 1');
    return pool;
  } catch (err) {
    await pool.end().catch(() => {});
    throw err;
  }
}

/**
 * Connects to PostgreSQL with automatic SSL mode negotiation (Railway internal plain TCP
 * vs Railway public proxy / cloud TLS) and startup warm-up retries.
 */
export async function connectPostgresFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Promise<PostgresPersistenceAdapter | null> {
  const connectionString = resolvePostgresConnectionUrl(env);
  if (!connectionString) {
    return null;
  }

  const preferPlain = shouldPreferPlainTcp(connectionString, env);
  const sslOrder = preferPlain ? [false, true] : [true, false];
  const retryDelaysMs = [0, 750, 1500, 3000];
  let lastError: unknown = null;

  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    for (const useSsl of sslOrder) {
      try {
        const pool = await openVerifiedPool(connectionString, useSsl);
        const adapter = new PostgresPersistenceAdapter(pool as unknown as QueryablePool);
        await adapter.initSchema();
        return adapter;
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to connect to PostgreSQL via DATABASE_URL.');
}

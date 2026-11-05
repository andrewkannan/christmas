import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/index.ts';
import {
  PostgresPersistenceAdapter,
  resolvePostgresConnectionUrl,
  type HydratedSnapshot,
  type PersistedAnalyticsEventRow,
  type PersistedGameRunRow,
  type PersistedLeadRow,
  type PersistedSettingsRow,
  type QueryablePool,
  type RemotePersistenceAdapter,
} from '../server/postgres.ts';

class SharedMemoryPostgresStore implements RemotePersistenceAdapter {
  readonly kind = 'postgres' as const;
  settings: PersistedSettingsRow | null = null;
  leads = new Map<number, PersistedLeadRow>();
  events = new Map<number, PersistedAnalyticsEventRow>();
  runs = new Map<string, PersistedGameRunRow>();
  closedCount = 0;

  async loadSnapshot(): Promise<HydratedSnapshot> {
    return {
      settings: this.settings ? { ...this.settings } : null,
      leads: [...this.leads.values()].sort((a, b) => a.id - b.id).map((r) => ({ ...r })),
      events: [...this.events.values()].sort((a, b) => a.id - b.id).map((r) => ({ ...r })),
      runs: [...this.runs.values()]
        .sort((a, b) => a.started_ms - b.started_ms)
        .map((r) => ({ ...r })),
    };
  }

  async upsertSettings(row: PersistedSettingsRow): Promise<void> {
    this.settings = { ...row };
  }

  async upsertLead(row: PersistedLeadRow): Promise<void> {
    this.leads.set(row.id, { ...row });
  }

  async upsertAnalyticsEvent(row: PersistedAnalyticsEventRow): Promise<void> {
    this.events.set(row.id, { ...row });
  }

  async upsertGameRun(row: PersistedGameRunRow): Promise<void> {
    this.runs.set(row.id, { ...row });
  }

  async linkVisitorToLead(leadId: number, visitorId: string): Promise<void> {
    for (const ev of this.events.values()) {
      if (ev.visitor_id === visitorId && ev.lead_id === null) {
        ev.lead_id = leadId;
      }
    }
    for (const run of this.runs.values()) {
      if (run.visitor_id === visitorId && run.lead_id === null) {
        run.lead_id = leadId;
      }
    }
  }

  async close(): Promise<void> {
    this.closedCount += 1;
  }
}

describe('Railway PostgreSQL URL resolution & adapter mapping', () => {
  it('resolves DATABASE_URL, Railway fallbacks, and discrete PG* variables cleanly', () => {
    expect(
      resolvePostgresConnectionUrl({
        DATABASE_URL: 'postgresql://postgres:pw@postgres.railway.internal:5432/railway',
      })
    ).toBe('postgresql://postgres:pw@postgres.railway.internal:5432/railway');

    expect(
      resolvePostgresConnectionUrl({
        DATABASE_PRIVATE_URL: 'postgres://postgres:pw@internal:5432/railway',
      })
    ).toBe('postgres://postgres:pw@internal:5432/railway');

    expect(
      resolvePostgresConnectionUrl({
        PGHOST: 'roundhouse.proxy.rlwy.net',
        PGPORT: '41234',
        PGUSER: 'postgres',
        PGPASSWORD: 'p@ss:word!',
        PGDATABASE: 'railway',
      })
    ).toBe('postgresql://postgres:p%40ss%3Aword!@roundhouse.proxy.rlwy.net:41234/railway');

    expect(resolvePostgresConnectionUrl({})).toBeNull();
  });

  it('coerces pg BIGINT string timestamps and maps parameterized SQL in PostgresPersistenceAdapter', async () => {
    const executedQueries: Array<{ text: string; values?: unknown[] }> = [];
    const mockPool: QueryablePool = {
      async query<R extends Record<string, unknown>>(text: string, values?: unknown[]) {
        executedQueries.push({ text, values });
        if (text.includes('FROM settings')) {
          return {
            rows: [
              {
                id: 1,
                json: '{"churchName":"CCC JB Bilingual"}',
                updated_at: '2026-11-05T10:00:00.000Z',
              } as unknown as R,
            ],
          };
        }
        if (text.includes('FROM leads')) {
          return {
            rows: [
              {
                id: '1',
                client_request_id: 'req-1',
                visitor_id: 'vis-1',
                redemption_code: 'XMAS-AAAA',
                claim_token: 'tok-1',
                name: 'Mei Ling',
                raw_phone: '0123456789',
                normalized_phone: '60123456789',
                game_played: 'santa-dash',
                score: 18,
                target_score: 15,
                volunteer_name: 'Andrew',
                gift_claimed: 1,
                whatsapp_sent: 1,
                followup_status: 'confirmed',
                notes: 'Coming with family',
                notes_updated_at: '2026-11-05T10:05:00.000Z',
                created_at: '2026-11-05T10:01:00.000Z',
              } as unknown as R,
            ],
          };
        }
        if (text.includes('FROM analytics_events')) {
          return {
            rows: [
              {
                id: '4',
                visitor_id: 'vis-1',
                lead_id: '1',
                event_type: 'share_whatsapp',
                game_id: '',
                score: 0,
                is_post_interaction: 1,
                volunteer_name: 'Andrew',
                created_at: '2026-11-05T10:06:00.000Z',
              } as unknown as R,
            ],
          };
        }
        if (text.includes('FROM game_runs')) {
          return {
            rows: [
              {
                id: 'run-1',
                visitor_id: 'vis-1',
                lead_id: '1',
                game_id: 'santa-dash',
                is_post_interaction: 0,
                volunteer_name: 'Andrew',
                status: 'verified',
                score: 18,
                end_reason: 'lives',
                started_ms: '1762336800000',
                finished_ms: '1762336812000',
              } as unknown as R,
            ],
          };
        }
        return { rows: [] };
      },
      async end() {},
    };

    const adapter = new PostgresPersistenceAdapter(mockPool);
    await adapter.initSchema();
    const snap = await adapter.loadSnapshot();

    expect(snap.settings?.json).toContain('CCC JB Bilingual');
    expect(snap.leads[0]?.id).toBe(1);
    expect(snap.leads[0]?.followup_status).toBe('confirmed');
    expect(snap.events[0]?.lead_id).toBe(1);
    expect(snap.runs[0]?.started_ms).toBe(1762336800000);
    expect(snap.runs[0]?.finished_ms).toBe(1762336812000);

    await adapter.upsertSettings({
      id: 1,
      json: '{"churchName":"CCC JB Bilingual"}',
      updated_at: '2026-11-05T11:00:00.000Z',
    });
    await adapter.linkVisitorToLead(1, 'vis-1');
    expect(executedQueries.some((q) => q.text.includes('INSERT INTO settings'))).toBe(true);
    expect(executedQueries.some((q) => q.text.includes('UPDATE game_runs SET lead_id'))).toBe(true);
  });
});

describe('Simulated Railway git push container wipe & PostgreSQL hydration', () => {
  it('preserves contacts, pastoral remarks, RSVPs, leaderboards, settings, and ID sequences across a full container wipe', async () => {
    process.env.TEAM_PIN = '7788';
    const sharedPg = new SharedMemoryPostgresStore();
    let fakeClock = 1_762_340_000_000;

    // 1. Boot Container #1 (fresh container attached to Railway PostgreSQL)
    const c1 = createApp(':memory:', { now: () => fakeClock });
    await c1.db.attachRemoteAdapter(sharedPg);

    const health1 = await request(c1.app).get('/api/health').expect(200);
    expect(health1.body).toEqual({
      ok: true,
      storageEngine: 'postgres',
      persistent: true,
    });

    const agent1 = request.agent(c1.app);
    await agent1.post('/api/team/login').send({ pin: '7788' }).expect(200);

    // Update campaign settings & targets in Container #1
    const currentCfg = await request(c1.app).get('/api/public/config').expect(200);
    await agent1
      .put('/api/team/settings')
      .send({
        ...currentCfg.body.settings,
        venueName: 'JB Grand Ballroom, Level 5',
        campaignTargets: {
          ...currentCfg.body.settings.campaignTargets,
          leads: 650,
        },
      })
      .expect(200);

    // Simulate street guest playing Santa Dash, unlocking VIP pass, claiming gift, and sharing
    const visitorId = 'vis-railway-persist-001';
    await request(c1.app)
      .post('/api/events')
      .send({ visitorId, eventType: 'page_view', volunteerName: 'Andrew' })
      .expect(201);

    const startRunRes = await request(c1.app)
      .post('/api/runs')
      .send({
        visitorId,
        gameId: 'santa-dash',
        volunteerName: 'Andrew',
      })
      .expect(201);

    fakeClock += 10_000; // 10s server-verified round
    await request(c1.app)
      .post(`/api/runs/${startRunRes.body.runId}/finish`)
      .send({ visitorId, score: 22, endReason: 'lives' })
      .expect(200);

    const leadRes = await request(c1.app)
      .post('/api/leads')
      .send({
        name: 'Grace Wong',
        phone: '012-778 9900',
        countryCode: '60',
        gamePlayed: 'santa-dash',
        score: 22,
        targetScore: 18,
        volunteerName: 'Andrew',
        clientRequestId: 'req-grace-persist-01',
        visitorId,
      })
      .expect(201);

    await request(c1.app)
      .post(`/api/public/claim/${leadRes.body.claim.claimToken}`)
      .expect(200);

    await request(c1.app)
      .post('/api/events')
      .send({
        visitorId,
        eventType: 'invite_share_whatsapp',
        isPostInteraction: true,
        volunteerName: 'Andrew',
      })
      .expect(201);

    // Evangelist saves pastoral remark + Confirmed RSVP in /team
    await agent1
      .patch('/api/team/leads/1')
      .send({
        whatsappSent: true,
        followUpStatus: 'confirmed',
        notes: 'Met at JB City Square; coming with her sister on Dec 24!',
      })
      .expect(200);

    // 2. Simulate git push: destroy Container #1 completely!
    await c1.db.closeAsync();

    // 3. Boot Container #2 with a brand-new empty SQLite database, hydrated from Railway PostgreSQL
    fakeClock += 60_000;
    const c2 = createApp(':memory:', { now: () => fakeClock });
    const hydration = await c2.db.attachRemoteAdapter(sharedPg);
    expect(hydration.hydratedLeads).toBe(1);
    expect(hydration.hydratedRuns).toBe(1);
    expect(hydration.hydratedEvents).toBeGreaterThanOrEqual(2);

    // Public config & custom targets survived the container wipe
    const cfgAfter = await request(c2.app).get('/api/public/config').expect(200);
    expect(cfgAfter.body.settings.venueName).toBe('JB Grand Ballroom, Level 5');
    expect(cfgAfter.body.settings.campaignTargets.leads).toBe(650);

    // Public leaderboard rank #1 survived the container wipe
    const boardAfter = await request(c2.app).get('/api/leaderboard').expect(200);
    const dashBoard = boardAfter.body.games.find(
      (g: { gameId: string }) => g.gameId === 'santa-dash'
    );
    expect(dashBoard.top[0]).toMatchObject({
      rank: 1,
      name: 'Grace W.',
      score: 22,
    });

    // Team CRM leads, remarks, RSVP stage, and storage status survived the container wipe
    const agent2 = request.agent(c2.app);
    await agent2.post('/api/team/login').send({ pin: '7788' }).expect(200);

    const leadsAfter = await agent2.get('/api/team/leads').expect(200);
    expect(leadsAfter.body.leads).toHaveLength(1);
    expect(leadsAfter.body.leads[0]).toMatchObject({
      id: 1,
      name: 'Grace Wong',
      giftClaimed: true,
      whatsappSent: true,
      followUpStatus: 'confirmed',
      notes: 'Met at JB City Square; coming with her sister on Dec 24!',
      inviteShares: 1,
    });

    const masterAfter = await agent2.get('/api/team/master-stats').expect(200);
    expect(masterAfter.body.storage).toEqual({
      engine: 'postgres',
      persistent: true,
      warning: null,
    });
    expect(masterAfter.body.overview.confirmedRsvps).toBe(1);
    expect(masterAfter.body.overview.contactsWithRemarks).toBe(1);

    // 4. Register a brand-new guest AFTER redeploy — auto-increment sequence continues at id = 2 cleanly
    await request(c2.app)
      .post('/api/leads')
      .send({
        name: 'Daniel Tan',
        phone: '016-554 3322',
        countryCode: '60',
        gamePlayed: 'candy-match',
        score: 30,
        targetScore: 18,
        volunteerName: 'Sarah',
        clientRequestId: 'req-daniel-persist-02',
        visitorId: 'vis-railway-persist-002',
      })
      .expect(201);

    const leadsWithSecond = await agent2.get('/api/team/leads').expect(200);
    expect(leadsWithSecond.body.leads).toHaveLength(2);
    const ids = leadsWithSecond.body.leads.map((l: { id: number }) => l.id).sort();
    expect(ids).toEqual([1, 2]);
    expect(sharedPg.leads.size).toBe(2);

    await c2.db.closeAsync();
  });

  it('flags ephemeral unlinked SQLite warning when running in Railway without DATABASE_URL or Volume', () => {
    const prevRailway = process.env.RAILWAY_ENVIRONMENT;
    const prevVolume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
    process.env.RAILWAY_ENVIRONMENT = 'production';
    delete process.env.RAILWAY_VOLUME_MOUNT_PATH;

    const { db } = createApp(':memory:');
    try {
      const status = db.getStorageStatus();
      expect(status.engine).toBe('sqlite');
      expect(status.persistent).toBe(false);
      expect(status.warning).toContain('DATABASE_URL');
    } finally {
      db.close();
      if (prevRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
      else process.env.RAILWAY_ENVIRONMENT = prevRailway;
      if (prevVolume !== undefined) process.env.RAILWAY_VOLUME_MOUNT_PATH = prevVolume;
    }
  });
});

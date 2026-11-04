import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../server/index.ts';
import type { ArcadeDatabase } from '../server/db.ts';
import { GAME_RULES, RUN_EXPIRY_MS } from '../src/games/rules.ts';

/**
 * Server-verified rounds and all-time leaderboards.
 * A controllable clock lets us simulate how long a round "really" took on the server.
 */
describe('Verified rounds & all-time leaderboard', () => {
  let app: Express;
  let db: ArcadeDatabase;
  let clockMs: number;

  beforeEach(() => {
    process.env.TEAM_PIN = '7788';
    clockMs = Date.UTC(2026, 11, 24, 12, 0, 0);
    const created = createApp(':memory:', { now: () => clockMs });
    app = created.app;
    db = created.db;
  });

  afterEach(() => {
    db.close();
  });

  async function playRound(opts: {
    gameId?: string;
    visitorId: string;
    score: number;
    seconds: number;
    claimToken?: string;
    endReason?: 'time' | 'lives' | 'moves';
  }) {
    const start = await request(app)
      .post('/api/runs')
      .send({ gameId: opts.gameId ?? 'santa-dash', visitorId: opts.visitorId, claimToken: opts.claimToken })
      .expect(201);
    clockMs += opts.seconds * 1000;
    return request(app)
      .post(`/api/runs/${start.body.runId}/finish`)
      .send({ visitorId: opts.visitorId, score: opts.score, endReason: opts.endReason ?? 'lives' })
      .expect(200);
  }

  let phoneCounter = 0;
  async function register(name: string, visitorId: string) {
    phoneCounter += 1;
    const res = await request(app)
      .post('/api/leads')
      .send({
        name,
        phone: `012-3456${String(100 + phoneCounter)}`,
        countryCode: '60',
        gamePlayed: 'santa-dash',
        score: 1,
        targetScore: 18,
        volunteerName: 'Andrew',
        clientRequestId: `req-${visitorId}`,
        visitorId,
      })
      .expect(201);
    return res.body.claim.claimToken as string;
  }

  it('verifies a plausible score and tells an unregistered player where they would rank', async () => {
    const res = await playRound({ visitorId: 'vis-anon-0001', score: 40, seconds: 30 });
    expect(res.body.status).toBe('verified');
    expect(res.body.score).toBe(40);
    expect(res.body.rank).toBeNull();
    expect(res.body.wouldRank).toBe(1);
    expect(res.body.board.top).toEqual([]); // anonymous scores never appear on the public board
    expect(res.body.claim).toBeNull();
  });

  it('rejects impossible scores (too fast, above the cap) and keeps them off the board', async () => {
    const tooFast = await playRound({ visitorId: 'vis-cheat-001', score: 50, seconds: 1 });
    expect(tooFast.body.status).toBe('rejected');

    const rules = GAME_RULES['santa-dash'];
    const overCap = await playRound({
      visitorId: 'vis-cheat-001',
      score: rules.maxScore + 1,
      seconds: 120,
    });
    expect(overCap.body.status).toBe('rejected');

    const token = await register('Cheater McTest', 'vis-cheat-001');
    const board = await request(app).get('/api/leaderboard').query({ claimToken: token });
    const dash = board.body.games.find((g: { gameId: string }) => g.gameId === 'santa-dash');
    expect(dash.top).toEqual([]);
    expect(dash.me).toBeNull();
  });

  it('links anonymous rounds on registration and shows only a privacy-formatted name', async () => {
    await playRound({ visitorId: 'vis-mei-00001', score: 55, seconds: 40 });
    const token = await register('Mei Ling Tan', 'vis-mei-00001');

    const board = await request(app).get('/api/leaderboard').query({ claimToken: token });
    const raw = JSON.stringify(board.body);
    expect(raw).not.toContain('Mei Ling Tan');
    expect(raw).not.toMatch(/3456\d{3}/); // no phone fragments

    const dash = board.body.games.find((g: { gameId: string }) => g.gameId === 'santa-dash');
    expect(dash.top).toEqual([{ rank: 1, name: 'Mei T.', score: 55, isMe: true }]);
    expect(dash.me).toEqual({ rank: 1, score: 55 });
    expect(board.body.games).toHaveLength(5);
  });

  it('keeps one entry per player (their best), breaks ties by who got there first, and caps at top 3', async () => {
    const players = [
      { name: 'Aaron Lee', vis: 'vis-aaron-001', scores: [20, 70] },
      { name: 'Bella Wong', vis: 'vis-bella-001', scores: [60] },
      { name: 'Chen Wei', vis: 'vis-chenw-001', scores: [60] }, // ties Bella but later
      { name: 'Devi Raj', vis: 'vis-devir-001', scores: [10] },
    ];
    const tokens: Record<string, string> = {};
    for (const p of players) {
      tokens[p.name] = await register(p.name, p.vis);
      for (const s of p.scores) {
        await playRound({ visitorId: p.vis, score: s, seconds: 30, claimToken: tokens[p.name] });
      }
    }

    const asDevi = await request(app).get('/api/leaderboard').query({ claimToken: tokens['Devi Raj'] });
    const dash = asDevi.body.games.find((g: { gameId: string }) => g.gameId === 'santa-dash');
    expect(dash.totalPlayers).toBe(4);
    expect(dash.top.map((e: { name: string; score: number }) => [e.name, e.score])).toEqual([
      ['Aaron L.', 70],
      ['Bella W.', 60],
      ['Chen W.', 60],
    ]);
    expect(dash.me).toEqual({ rank: 4, score: 10 }); // outside the top 3 but still told their rank
  });

  it('returns the registered player rank, personal best flag and refreshed pass on finish', async () => {
    const token = await register('Siti Nurhaliza binti Ahmad', 'vis-siti-0001');
    const first = await playRound({ visitorId: 'vis-siti-0001', score: 30, seconds: 30, claimToken: token });
    expect(first.body.rank).toBe(1);
    expect(first.body.isPersonalBest).toBe(true);
    expect(first.body.board.top[0].name).toBe('Siti A.');
    expect(first.body.claim.bestScores['santa-dash']).toBe(30);

    const worse = await playRound({ visitorId: 'vis-siti-0001', score: 12, seconds: 30, claimToken: token });
    expect(worse.body.isPersonalBest).toBe(false);
    expect(worse.body.rank).toBe(1);
  });

  it('refuses to finish a round twice, for another phone, or after expiry', async () => {
    const start = await request(app)
      .post('/api/runs')
      .send({ gameId: 'candy-match', visitorId: 'vis-owner-001' })
      .expect(201);
    clockMs += 20_000;

    await request(app)
      .post(`/api/runs/${start.body.runId}/finish`)
      .send({ visitorId: 'vis-thief-001', score: 10, endReason: 'moves' })
      .expect(404);

    await request(app)
      .post(`/api/runs/${start.body.runId}/finish`)
      .send({ visitorId: 'vis-owner-001', score: 10, endReason: 'moves' })
      .expect(200);

    await request(app)
      .post(`/api/runs/${start.body.runId}/finish`)
      .send({ visitorId: 'vis-owner-001', score: 10, endReason: 'moves' })
      .expect(409);

    const expiredRes = await playRound({
      gameId: 'gift-slash',
      visitorId: 'vis-owner-001',
      score: 5,
      seconds: RUN_EXPIRY_MS / 1000 + 1,
    });
    expect(expiredRes.body.status).toBe('rejected');
  });

  it('validates round payloads', async () => {
    await request(app).post('/api/runs').send({ gameId: 'gift-rush', visitorId: 'vis-x-00001' }).expect(400);
    await request(app).post('/api/runs').send({ gameId: 'santa-dash' }).expect(400);
    await request(app)
      .post('/api/runs/short/finish')
      .send({ visitorId: 'vis-x-00001', score: 1, endReason: 'time' })
      .expect(400);
    await request(app).get('/api/leaderboard').query({ claimToken: 'x' }).expect(400);
    await request(app).get('/api/leaderboard/gift-rush').expect(400);
    await request(app).get('/api/leaderboard/santa-dash').query({ claimToken: 'x' }).expect(400);
  });

  it('returns unlimited full player ranking history per game with only each player best score', async () => {
    const roster = [
      { name: 'Alicia Tan', vis: 'vis-full-01', trials: [15, 88, 42] },
      { name: 'Brandon Lim', vis: 'vis-full-02', trials: [76, 31] },
      { name: 'Chloe Ng', vis: 'vis-full-03', trials: [70] },
      { name: 'Darren Ong', vis: 'vis-full-04', trials: [22, 64, 59, 18] },
      { name: 'Esther Yap', vis: 'vis-full-05', trials: [55] },
      { name: 'Farhan Ali', vis: 'vis-full-06', trials: [48, 48] },
      { name: 'Grace Ho', vis: 'vis-full-07', trials: [39] },
      { name: 'Hannah Koh', vis: 'vis-full-08', trials: [9, 27, 14] },
    ];

    const tokens: Record<string, string> = {};
    for (const p of roster) {
      tokens[p.name] = await register(p.name, p.vis);
      for (const s of p.trials) {
        await playRound({
          gameId: 'santa-dash',
          visitorId: p.vis,
          score: s,
          seconds: 35,
          claimToken: tokens[p.name],
        });
      }
    }

    const res = await request(app)
      .get('/api/leaderboard/santa-dash')
      .query({ claimToken: tokens['Darren Ong'] })
      .expect(200);

    expect(res.body.gameId).toBe('santa-dash');
    expect(res.body.totalPlayers).toBe(8);
    expect(res.body.entries).toHaveLength(8);
    expect(
      res.body.entries.map((e: { rank: number; name: string; score: number; isMe: boolean }) => [
        e.rank,
        e.name,
        e.score,
        e.isMe,
      ])
    ).toEqual([
      [1, 'Alicia T.', 88, false],
      [2, 'Brandon L.', 76, false],
      [3, 'Chloe N.', 70, false],
      [4, 'Darren O.', 64, true],
      [5, 'Esther Y.', 55, false],
      [6, 'Farhan A.', 48, false],
      [7, 'Grace H.', 39, false],
      [8, 'Hannah K.', 27, false],
    ]);
    expect(res.body.me).toEqual({ rank: 4, score: 64 });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('Darren Ong');
    expect(serialized).not.toMatch(/3456\d{3}/);
  });

  it('feeds rounds into the master analytics (rejected rounds count as 0 points)', async () => {
    await playRound({ gameId: 'claw-machine', visitorId: 'vis-stats-001', score: 12, seconds: 20 });
    await playRound({ gameId: 'claw-machine', visitorId: 'vis-stats-001', score: 190, seconds: 4 });

    const login = await request(app).post('/api/team/login').send({ pin: '7788' });
    const cookie = login.headers['set-cookie'];
    const stats = await request(app).get('/api/team/master-stats').set('Cookie', cookie).expect(200);
    const claw = stats.body.byGame.find((g: { gameId: string }) => g.gameId === 'claw-machine');
    expect(claw.starts).toBe(2);
    expect(claw.completions).toBe(2);
    expect(claw.highScore).toBe(12);
  });
});

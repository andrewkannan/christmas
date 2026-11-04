import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/index.ts';
import { normalizePhoneForWhatsApp } from '../server/phone.ts';
import { sanitizeCsvCell } from '../server/routes.ts';
import type { ArcadeDatabase } from '../server/db.ts';
import type { Express } from 'express';

describe('Phone normalization for WhatsApp', () => {
  it('converts local Malaysian numbers starting with 0 to 60 prefix', () => {
    const res = normalizePhoneForWhatsApp('012-345 6789', '60');
    expect(res.valid).toBe(true);
    expect(res.normalizedPhone).toBe('60123456789');
  });

  it('converts 8-digit Singapore numbers with countryCode 65', () => {
    const res = normalizePhoneForWhatsApp('9123 4567', '65');
    expect(res.valid).toBe(true);
    expect(res.normalizedPhone).toBe('6591234567');
  });

  it('respects explicit + international prefix without double-prepending', () => {
    const res = normalizePhoneForWhatsApp('+65 8123-4567', '60');
    expect(res.valid).toBe(true);
    expect(res.normalizedPhone).toBe('6581234567');
  });

  it('rejects all-identical dummy phone numbers', () => {
    const res = normalizePhoneForWhatsApp('0000000000', '60');
    expect(res.valid).toBe(false);
  });
});

describe('CSV injection sanitization', () => {
  it('prefixes dangerous spreadsheet formula starters with a single quote', () => {
    expect(sanitizeCsvCell('=CMD()')).toBe("'=CMD()");
    expect(sanitizeCsvCell('+6012345')).toBe("'+6012345");
    expect(sanitizeCsvCell('@malicious')).toBe("'@malicious");
  });
});

describe('Christmas Pocket Arcade API & Security', () => {
  let app: Express;
  let db: ArcadeDatabase;

  beforeEach(() => {
    process.env.TEAM_PIN = '7788';
    const created = createApp(':memory:');
    app = created.app;
    db = created.db;
  });

  afterEach(() => {
    db.close();
  });

  it('serves public event config and valid RFC 5545 .ics calendar file', async () => {
    const cfg = await request(app).get('/api/public/config').expect(200);
    expect(cfg.body.settings.eventTitle).toContain('Christmas');
    expect(cfg.body.settings.giftDescription).toBe('Christmas Blessing Gift');
    expect(cfg.body.googleCalendarUrl).toContain('calendar.google.com');

    const ics = await request(app).get('/api/calendar.ics').expect(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.headers['content-disposition']).toContain('inline');
    expect(ics.text).toContain('BEGIN:VCALENDAR');
    expect(ics.text).toContain('BEGIN:VEVENT');
  });

  it('submits a winner lead idempotently and allows marking gift claimed via token', async () => {
    const payload = {
      name: 'Sarah Lim',
      phone: '017-889 2211',
      countryCode: '60',
      gamePlayed: 'gift-rush',
      score: 24,
      targetScore: 18,
      volunteerName: 'Andrew',
      clientRequestId: 'req-sarah-001',
    };

    const res1 = await request(app).post('/api/leads').send(payload).expect(201);
    expect(res1.body.claim.redemptionCode).toMatch(/^XMAS-/);
    expect(res1.body.claim.giftClaimed).toBe(false);

    // Duplicate retry returns exact same redemption code without creating a second row
    const res2 = await request(app).post('/api/leads').send(payload).expect(201);
    expect(res2.body.claim.redemptionCode).toBe(res1.body.claim.redemptionCode);

    // Mark gift claimed via unguessable claimToken
    const claimRes = await request(app)
      .post(`/api/public/claim/${res1.body.claim.claimToken}`)
      .expect(200);
    expect(claimRes.body.claim.giftClaimed).toBe(true);
  });

  it('blocks unauthenticated access to team leads and enforces PIN rate limiting', async () => {
    await request(app).get('/api/team/leads').expect(401);
    await request(app).get('/api/team/leads/export.csv').expect(401);
    await request(app).get('/api/team/master-stats').expect(401);

    // 5 wrong PIN attempts -> 6th attempt gets 429 rate limited
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/team/login')
        .set('X-Forwarded-For', '203.0.113.99')
        .send({ pin: '0000' })
        .expect(401);
    }
    await request(app)
      .post('/api/team/login')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ pin: '7788' })
      .expect(429);
  });

  it('allows authenticated team session to view leads, toggle status, export CSV, and update settings', async () => {
    await request(app)
      .post('/api/leads')
      .send({
        name: '=EvilFormulaName',
        phone: '0123456789',
        countryCode: '60',
        gamePlayed: 'tap-duel',
        score: 30,
        targetScore: 15,
        volunteerName: 'Grace',
        clientRequestId: 'req-grace-01',
      })
      .expect(201);

    const agent = request.agent(app);
    await agent
      .post('/api/team/login')
      .set('X-Forwarded-For', '198.51.100.12')
      .send({ pin: '7788' })
      .expect(200);

    const leadsRes = await agent.get('/api/team/leads').expect(200);
    expect(leadsRes.body.leads).toHaveLength(1);
    expect(leadsRes.body.leads[0].normalizedPhone).toBe('60123456789');
    expect(leadsRes.body.leads[0].whatsappUrl).toContain('https://wa.me/60123456789?text=');

    const leadId = leadsRes.body.leads[0].id as number;
    const patched = await agent
      .patch(`/api/team/leads/${leadId}`)
      .send({ whatsappSent: true, giftClaimed: true, notes: 'Loves acoustic music' })
      .expect(200);
    expect(patched.body.lead.whatsappSent).toBe(true);
    expect(patched.body.lead.giftClaimed).toBe(true);

    const csvRes = await agent.get('/api/team/leads/export.csv').expect(200);
    expect(csvRes.text).toContain("'=EvilFormulaName");

    const currentSettings = (await agent.get('/api/public/config').expect(200)).body.settings;
    const updatedSettingsRes = await agent
      .put('/api/team/settings')
      .send({
        ...currentSettings,
        defaultCountryCode: '65',
        churchName: 'City Light Youth',
        wazeUrl: 'https://waze.com/ul?q=City%20Light%20Youth&navigate=yes',
      })
      .expect(200);
    expect(updatedSettingsRes.body.settings.defaultCountryCode).toBe('65');
    expect(updatedSettingsRes.body.settings.churchName).toBe('City Light Youth');
    expect(updatedSettingsRes.body.settings.wazeUrl).toContain('waze.com');

    const qrRes = await agent
      .get('/api/team/qr.svg?url=https%3A%2F%2Farcade.example.com%2F%3Fvs%3DAndrew')
      .expect(200);
    expect(qrRes.headers['content-type']).toContain('image/svg+xml');
    const svgMarkup = qrRes.text ?? Buffer.from(qrRes.body).toString('utf8');
    expect(svgMarkup).toContain('<svg');
  });

  it('serves built SPA index.html for both /?vs=Andrew and /team routes', async () => {
    const rootHtml = await request(app).get('/?vs=Andrew&target=18').expect(200);
    expect(rootHtml.text).toContain('<div id="root"></div>');

    const teamHtml = await request(app).get('/team').expect(200);
    expect(teamHtml.text).toContain('<div id="root"></div>');
  });

  it('returns clean zeroed Master Analytics on an empty database and rejects spoofed team events', async () => {
    // Public /api/events must reject team-only eventType 'team_whatsapp_followup'
    await request(app)
      .post('/api/events')
      .send({
        visitorId: 'vis-spoof-01',
        eventType: 'team_whatsapp_followup',
      })
      .expect(400);

    const httpsLogin = await request(app)
      .post('/api/team/login')
      .set('X-Forwarded-For', '198.51.100.43')
      .set('X-Forwarded-Proto', 'https')
      .send({ pin: '7788' })
      .expect(200);
    expect(String(httpsLogin.headers['set-cookie'])).toContain('Secure');

    const agent = request.agent(app);
    await agent
      .post('/api/team/login')
      .set('X-Forwarded-For', '198.51.100.44')
      .send({ pin: '7788' })
      .expect(200);

    const emptyMaster = await agent.get('/api/team/master-stats').expect(200);
    expect(emptyMaster.body.overview.totalPageViews).toBe(0);
    expect(emptyMaster.body.overview.totalGamesPlayed).toBe(0);
    expect(emptyMaster.body.overview.gamesAfterInteraction).toBe(0);
    expect(emptyMaster.body.overview.visitorToLeadRatePct).toBe(0);
    expect(emptyMaster.body.byGame).toHaveLength(5);
  });

  it('restores saved phone sessions without leaking phone PII and tracks full Master Analytics across street + post-interaction play', async () => {
    const visitorId = 'vis-daniel-street-01';

    // 1. Passerby scans Andrew's QR board and plays Claw Grab on the street
    await request(app)
      .post('/api/events')
      .send({
        visitorId,
        eventType: 'page_view',
        isPostInteraction: false,
        volunteerName: 'Andrew',
      })
      .expect(201);

    await request(app)
      .post('/api/events')
      .send({
        visitorId,
        eventType: 'game_start',
        gameId: 'claw-machine',
        isPostInteraction: false,
        volunteerName: 'Andrew',
      })
      .expect(201);

    await request(app)
      .post('/api/events')
      .send({
        visitorId,
        eventType: 'game_complete',
        gameId: 'claw-machine',
        score: 22,
        isPostInteraction: false,
        volunteerName: 'Andrew',
      })
      .expect(201);

    // 2. Guest enters Name + Phone -> retroactively links street events to their new lead
    const leadRes = await request(app)
      .post('/api/leads')
      .send({
        name: 'Daniel Tan',
        phone: '016-555 8899',
        countryCode: '60',
        gamePlayed: 'claw-machine',
        score: 22,
        targetScore: 18,
        volunteerName: 'Andrew',
        clientRequestId: 'req-daniel-001',
        visitorId,
      })
      .expect(201);

    const claimToken = leadRes.body.claim.claimToken as string;
    expect(leadRes.body.claim.totalGamesPlayed).toBe(1);
    expect(leadRes.body.claim.gamesAfterInteraction).toBe(0);
    expect(leadRes.body.claim.bestScores['claw-machine']).toBe(22);

    // 3. Guest views E-Invite, downloads PNG ticket, and saves to Google Calendar on the spot
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'e_invite_view', isPostInteraction: false })
      .expect(201);
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'ticket_download', isPostInteraction: false })
      .expect(201);
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'calendar_google', isPostInteraction: false })
      .expect(201);

    // 4. Later at home, guest reopens saved session via ?pass=claimToken -> verify zero phone PII exposure
    const savedPassRes = await request(app).get(`/api/public/pass/${claimToken}`).expect(200);
    expect(savedPassRes.body.claim.name).toBe('Daniel Tan');
    expect(savedPassRes.body.claim.rawPhone).toBeUndefined();
    expect(savedPassRes.body.claim.normalizedPhone).toBeUndefined();

    // 5. Post-interaction return view + 4 more games across all 5 new game IDs + 2 WhatsApp shares + .ics + Maps click
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'page_view', isPostInteraction: true })
      .expect(201);
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'e_invite_view', isPostInteraction: true })
      .expect(201);

    const replay1 = await request(app)
      .post('/api/events')
      .send({
        visitorId,
        claimToken,
        eventType: 'game_complete',
        gameId: 'claw-machine',
        score: 36,
        isPostInteraction: true,
      })
      .expect(201);
    expect(replay1.body.claim.bestScores['claw-machine']).toBe(36);

    for (const [gid, sc] of [
      ['santa-dash', 30],
      ['gift-tetris', 42],
      ['gift-slash', 28],
      ['candy-match', 34],
    ] as const) {
      await request(app)
        .post('/api/events')
        .send({
          visitorId,
          claimToken,
          eventType: 'game_complete',
          gameId: gid,
          score: sc,
          isPostInteraction: true,
        })
        .expect(201);
    }

    const afterAll5 = await request(app).get(`/api/public/pass/${claimToken}`).expect(200);
    expect(afterAll5.body.claim.totalGamesPlayed).toBe(6);
    expect(afterAll5.body.claim.gamesAfterInteraction).toBe(5);
    expect(afterAll5.body.claim.bestScores['gift-tetris']).toBe(42);
    expect(afterAll5.body.claim.bestScores['candy-match']).toBe(34);

    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'invite_share_whatsapp', isPostInteraction: true })
      .expect(201);
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'invite_share_whatsapp', isPostInteraction: true })
      .expect(201);
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'calendar_ics', isPostInteraction: true })
      .expect(201);
    await request(app)
      .post('/api/events')
      .send({ visitorId, claimToken, eventType: 'maps_click', isPostInteraction: true })
      .expect(201);

    // 6. Team logs in, marks gift claimed & WhatsApp sent, and inspects Master Analytics + Leads + CSV
    const agent = request.agent(app);
    await agent
      .post('/api/team/login')
      .set('X-Forwarded-For', '198.51.100.55')
      .send({ pin: '7788' })
      .expect(200);

    const teamLeadsBefore = await agent.get('/api/team/leads').expect(200);
    const danielLead = teamLeadsBefore.body.leads[0];
    expect(decodeURIComponent(danielLead.whatsappUrl)).toContain(`/?pass=${claimToken}`);
    expect(danielLead.totalGamesPlayed).toBe(6);
    expect(danielLead.gamesAfterInteraction).toBe(5);
    expect(danielLead.inviteShares).toBe(2);
    expect(danielLead.ticketDownloads).toBe(1);
    expect(danielLead.calendarAdds).toBe(2);

    await agent
      .patch(`/api/team/leads/${danielLead.id}`)
      .send({ giftClaimed: true, whatsappSent: true })
      .expect(200);

    const masterRes = await agent.get('/api/team/master-stats').expect(200);
    const ov = masterRes.body.overview;
    expect(ov.totalPageViews).toBe(2);
    expect(ov.uniqueVisitors).toBe(1);
    expect(ov.qrScanViews).toBe(2);
    expect(ov.returnViewsAfterInteraction).toBe(1);
    expect(ov.totalGamesPlayed).toBe(6);
    expect(ov.gamesDuringInteraction).toBe(1);
    expect(ov.gamesAfterInteraction).toBe(5);
    expect(ov.uniquePlayersAfterInteraction).toBe(1);
    expect(ov.totalLeads).toBe(1);
    expect(ov.giftsClaimed).toBe(1);
    expect(ov.eInviteViews).toBe(2);
    expect(ov.repeatEInviteViews).toBe(1);
    expect(ov.eTicketDownloads).toBe(1);
    expect(ov.invitationsShared).toBe(2);
    expect(ov.googleCalendarAdds).toBe(1);
    expect(ov.icsCalendarDownloads).toBe(1);
    expect(ov.mapsDirectionsClicks).toBe(1);
    expect(ov.teamWhatsappFollowupsSent).toBe(1);
    expect(ov.teamWhatsappClicksTotal).toBe(1);

    const clawRow = masterRes.body.byGame.find(
      (g: { gameId: string }) => g.gameId === 'claw-machine'
    );
    expect(clawRow.completions).toBe(2);
    expect(clawRow.duringInteraction).toBe(1);
    expect(clawRow.afterInteraction).toBe(1);
    expect(clawRow.highScore).toBe(36);

    const andrewVol = masterRes.body.byVolunteer.find(
      (v: { volunteerName: string }) => v.volunteerName === 'Andrew'
    );
    expect(andrewVol.leadsCount).toBe(1);
    expect(andrewVol.gamesAfterInteraction).toBe(5);
    expect(andrewVol.sharedInvites).toBe(2);

    expect(masterRes.body.recentActivity[0].guestName).toBe('Daniel Tan');

    const csvExport = await agent.get('/api/team/leads/export.csv').expect(200);
    expect(csvExport.text).toContain('Games Played After Interaction');
    expect(csvExport.text).toContain('Invitations Shared');
  });
});

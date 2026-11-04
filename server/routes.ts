import express from 'express';
import type { Request } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { ArcadeDatabase } from './db.ts';
import {
  clearTeamSessionCookie,
  isRequestAuthenticated,
  requireTeamAuth,
  setTeamSessionCookie,
  SlidingWindowRateLimiter,
  verifyTeamPin,
} from './auth.ts';
import { buildGoogleCalendarUrl, buildIcsContent } from './calendar.ts';
import { normalizePhoneForWhatsApp } from './phone.ts';

const GameIdEnum = z.enum([
  'claw-machine',
  'santa-dash',
  'gift-tetris',
  'gift-slash',
  'candy-match',
  'gift-rush',
  'tap-duel',
  'starlight-drop',
]);

const LeadSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name.')
    .max(80, 'Name must be 80 characters or fewer.'),
  phone: z.string().trim().min(5, 'Please enter your mobile number.').max(30),
  countryCode: z
    .string()
    .trim()
    .regex(/^\+?\d{1,4}$/, 'Invalid country code.')
    .default('60'),
  gamePlayed: GameIdEnum,
  score: z.number().int().min(0).max(9999),
  targetScore: z.number().int().min(1).max(9999).default(15),
  volunteerName: z.string().trim().max(40).default(''),
  clientRequestId: z.string().trim().min(6).max(80),
  visitorId: z.string().trim().max(80).optional(),
});

const TrackEventSchema = z.object({
  visitorId: z.string().trim().min(3).max(80),
  claimToken: z.string().trim().max(80).optional(),
  eventType: z.enum([
    'page_view',
    'game_start',
    'game_complete',
    'e_invite_view',
    'ticket_download',
    'invite_share_whatsapp',
    'calendar_google',
    'calendar_ics',
    'maps_click',
  ]),
  gameId: GameIdEnum.optional(),
  score: z.number().int().min(0).max(9999).optional(),
  isPostInteraction: z.boolean().optional(),
  volunteerName: z.string().trim().max(40).optional(),
});

const SettingsSchema = z.object({
  churchName: z.string().trim().min(1).max(80),
  eventTitle: z.string().trim().min(1).max(100),
  eventSubtitle: z.string().trim().max(180),
  eventDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  timezoneOffset: z.string().regex(/^[+-]\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(15).max(720),
  venueName: z.string().trim().min(1).max(120),
  venueAddress: z.string().trim().max(200),
  mapsUrl: z.string().trim().max(300),
  defaultCountryCode: z.string().regex(/^\d{1,4}$/),
  giftDescription: z.string().trim().min(1).max(100),
  whatsappTemplate: z.string().trim().min(10).max(1000),
});

const LeadPatchSchema = z.object({
  giftClaimed: z.boolean().optional(),
  whatsappSent: z.boolean().optional(),
  notes: z.string().max(300).optional(),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function getPublicBaseUrl(req: Request): string {
  const proto =
    (typeof req.headers['x-forwarded-proto'] === 'string' &&
      req.headers['x-forwarded-proto'].split(',')[0].trim()) ||
    req.protocol ||
    'http';
  const host = req.get('host') || 'localhost:5173';
  return `${proto}://${host}`;
}

export function sanitizeCsvCell(raw: string | number | boolean): string {
  let str = String(raw ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function createApiRouter(db: ArcadeDatabase) {
  const router = express.Router();
  const pinLimiter = new SlidingWindowRateLimiter(5, 15 * 60 * 1000);
  const leadLimiter = new SlidingWindowRateLimiter(45, 5 * 60 * 1000);
  const telemetryLimiter = new SlidingWindowRateLimiter(240, 5 * 60 * 1000);

  router.get('/public/config', (_req, res) => {
    const settings = db.getSettings();
    res.json({
      settings,
      googleCalendarUrl: buildGoogleCalendarUrl(settings),
    });
  });

  router.get('/calendar.ics', (req, res) => {
    const settings = db.getSettings();
    const ics = buildIcsContent(settings, getPublicBaseUrl(req));
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="christmas-invitation.ics"');
    res.send(ics);
  });

  router.post('/events', (req, res) => {
    const ip = getClientIp(req);
    if (!telemetryLimiter.isAllowed(ip)) {
      res.status(429).json({ error: 'Rate limit exceeded.' });
      return;
    }

    const parsed = TrackEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid telemetry payload.' });
      return;
    }

    db.recordAnalyticsEvent(parsed.data);

    // If linked to a saved pass, return refreshed pass stats so client high scores stay in sync
    const refreshedPass = parsed.data.claimToken
      ? db.getPassByClaimToken(parsed.data.claimToken)
      : null;

    res.status(201).json({ ok: true, claim: refreshedPass });
  });

  router.get('/public/pass/:claimToken', (req, res) => {
    const token = String(req.params.claimToken || '').trim();
    if (token.length < 10 || token.length > 80) {
      res.status(400).json({ error: 'Invalid pass token.' });
      return;
    }
    const pass = db.getPassByClaimToken(token);
    if (!pass) {
      res.status(404).json({ error: 'Saved pass not found.' });
      return;
    }
    res.json({ claim: pass });
  });

  router.post('/leads', (req, res) => {
    const ip = getClientIp(req);
    if (!leadLimiter.isAllowed(ip)) {
      res.status(429).json({
        error: 'Too many submissions right now. Please wait a moment and try again.',
      });
      return;
    }

    const parsed = LeadSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Please check your details.';
      res.status(400).json({ error: firstIssue });
      return;
    }

    const data = parsed.data;
    const phoneCheck = normalizePhoneForWhatsApp(data.phone, data.countryCode);
    if (!phoneCheck.valid) {
      res.status(400).json({ error: phoneCheck.error || 'Invalid mobile number.' });
      return;
    }

    const result = db.createOrGetLead({
      clientRequestId: data.clientRequestId,
      visitorId: data.visitorId,
      name: data.name,
      rawPhone: data.phone,
      normalizedPhone: phoneCheck.normalizedPhone,
      gamePlayed: data.gamePlayed,
      score: data.score,
      targetScore: data.targetScore,
      volunteerName: data.volunteerName,
    });

    res.status(201).json({ claim: result });
  });

  router.post('/public/claim/:claimToken', (req, res) => {
    const token = String(req.params.claimToken || '').trim();
    if (token.length < 10 || token.length > 80) {
      res.status(400).json({ error: 'Invalid claim token.' });
      return;
    }
    const updated = db.markGiftClaimedByToken(token);
    if (!updated) {
      res.status(404).json({ error: 'Winner pass not found.' });
      return;
    }
    res.json({ claim: updated });
  });

  // --- Team PIN Auth & Protected Organizer Endpoints ---

  router.get('/team/session', (req, res) => {
    res.json({ authenticated: isRequestAuthenticated(req) });
  });

  router.post('/team/login', (req, res) => {
    const ip = getClientIp(req);
    if (!pinLimiter.isAllowed(ip)) {
      res.status(429).json({
        error: 'Too many incorrect PIN attempts. Please wait 15 minutes before retrying.',
      });
      return;
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!pin || !verifyTeamPin(pin)) {
      res.status(401).json({ error: 'Incorrect Team PIN.' });
      return;
    }

    pinLimiter.reset(ip);
    setTeamSessionCookie(req, res);
    res.json({ authenticated: true });
  });

  router.post('/team/logout', (req, res) => {
    clearTeamSessionCookie(req, res);
    res.json({ authenticated: false });
  });

  router.get('/team/master-stats', requireTeamAuth, (_req, res) => {
    res.json(db.getMasterAnalytics());
  });

  router.get('/team/leads', requireTeamAuth, (req, res) => {
    const payload = db.listTeamLeads(getPublicBaseUrl(req));
    res.json(payload);
  });

  router.patch('/team/leads/:id', requireTeamAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid lead ID.' });
      return;
    }
    const parsed = LeadPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid update payload.' });
      return;
    }
    const updated = db.updateLeadStatus(id, parsed.data, getPublicBaseUrl(req));
    if (!updated) {
      res.status(404).json({ error: 'Contact not found.' });
      return;
    }
    res.json({ lead: updated });
  });

  router.get('/team/leads/export.csv', requireTeamAuth, (req, res) => {
    const { leads } = db.listTeamLeads(getPublicBaseUrl(req));
    const headers = [
      'ID',
      'Redemption Code',
      'Name',
      'WhatsApp Number',
      'Volunteer',
      'First Game',
      'First Score',
      'Total Games Played',
      'Games Played After Interaction',
      'Invitations Shared',
      'E-Tickets Downloaded',
      'Calendar Adds',
      'E-Invite Views',
      'Gift Claimed',
      'WhatsApp Sent',
      'Notes',
      'Created At',
      'Last Active At',
    ];
    const rows = leads.map((l) =>
      [
        l.id,
        l.redemptionCode,
        l.name,
        l.normalizedPhone,
        l.volunteerName || 'General',
        l.gamePlayed,
        l.score,
        l.totalGamesPlayed,
        l.gamesAfterInteraction,
        l.inviteShares,
        l.ticketDownloads,
        l.calendarAdds,
        l.eInviteViews,
        l.giftClaimed ? 'Yes' : 'No',
        l.whatsappSent ? 'Yes' : 'No',
        l.notes,
        l.createdAt,
        l.lastActiveAt,
      ]
        .map(sanitizeCsvCell)
        .join(',')
    );

    const csv = `\uFEFF${headers.join(',')}\r\n${rows.join('\r\n')}\r\n`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="christmas-outreach-contacts.csv"');
    res.send(csv);
  });

  router.put('/team/settings', requireTeamAuth, (req, res) => {
    const parsed = SettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Invalid event settings.';
      res.status(400).json({ error: msg });
      return;
    }
    const updated = db.updateSettings(parsed.data);
    res.json({
      settings: updated,
      googleCalendarUrl: buildGoogleCalendarUrl(updated),
    });
  });

  router.get('/team/qr.svg', requireTeamAuth, async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl) || targetUrl.length > 500) {
      res.status(400).json({ error: 'Valid http(s) URL required.' });
      return;
    }
    try {
      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 2,
        width: 360,
        color: {
          dark: '#0b1914',
          light: '#ffffff',
        },
      });
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.send(svg);
    } catch {
      res.status(500).json({ error: 'Failed to generate QR code.' });
    }
  });

  return router;
}

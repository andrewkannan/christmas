import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { TeamSessionUser } from '../src/types.ts';
import type { ArcadeDatabase } from './db.ts';
import {
  clearTeamSessionCookie,
  getRequestCookiePayload,
  setTeamSessionCookie,
  SlidingWindowRateLimiter,
  verifyTeamPin,
} from './auth.ts';
import { buildGoogleCalendarUrl, buildIcsContent } from './calendar.ts';
import { HockeyRoomManager } from './hockeyRooms.ts';
import { normalizePhoneForWhatsApp } from './phone.ts';

const GameIdEnum = z.enum([
  'ice-hockey',
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
    'waze_click',
  ]),
  gameId: GameIdEnum.optional(),
  score: z.number().int().min(0).max(9999).optional(),
  isPostInteraction: z.boolean().optional(),
  volunteerName: z.string().trim().max(40).optional(),
});

const ActivityLogCategoryEnum = z.enum([
  'all',
  'page_views',
  'return_views',
  'games_started',
  'games_after',
  'registered_contacts',
  'physical_gifts',
  'viral_actions',
  'directions',
  'maps_only',
  'waze_only',
  'invite_views',
  'shares',
  'tickets',
  'calendar',
  'team_whatsapp',
]);

const ActivityLogQuerySchema = z.object({
  category: ActivityLogCategoryEnum.optional().default('all'),
  gameId: z.string().trim().max(40).optional(),
  leadId: z.coerce.number().int().positive().optional(),
  volunteer: z.string().trim().max(60).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(250),
});

const CampaignTargetsSchema = z.object({
  pageViews: z.number().int().min(1).max(1_000_000).default(1500),
  gamesStarted: z.number().int().min(1).max(1_000_000).default(500),
  leads: z.number().int().min(1).max(1_000_000).default(500),
  giftsHandedOut: z.number().int().min(1).max(1_000_000).default(500),
  gamesAfter: z.number().int().min(1).max(1_000_000).default(100),
  viralActions: z.number().int().min(1).max(1_000_000).default(100),
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
  wazeUrl: z.string().trim().max(300).optional().default(''),
  defaultCountryCode: z.string().regex(/^\d{1,4}$/),
  giftDescription: z.string().trim().min(1).max(100),
  whatsappTemplate: z.string().trim().min(10).max(1000),
  reminderTemplate: z.string().trim().max(1000).optional(),
  campaignTargets: CampaignTargetsSchema.optional(),
});

const LeadPatchSchema = z.object({
  giftClaimed: z.boolean().optional(),
  whatsappSent: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  followUpStatus: z.enum(['new', 'contacted', 'replied', 'confirmed', 'not_free']).optional(),
  volunteerName: z.string().trim().max(40).optional(),
});

const CreateTeamUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter the team member name.')
    .max(60, 'Name must be 60 characters or fewer.'),
  passcode: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9]{4,24}$/,
      'Passcode must be 4–24 letters or numbers with no spaces (e.g. AK2708).'
    ),
  role: z.enum(['admin', 'member']).optional().default('member'),
});

const PatchTeamUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter the team member name.')
    .max(60, 'Name must be 60 characters or fewer.')
    .optional(),
  role: z.enum(['admin', 'member']).optional(),
  active: z.boolean().optional(),
  passcode: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9]{4,24}$/,
      'Passcode must be 4–24 letters or numbers with no spaces (e.g. AK2708).'
    )
    .optional(),
});

const ActiveGameIdEnum = z.enum([
  'ice-hockey',
  'santa-dash',
  'gift-tetris',
  'gift-slash',
  'candy-match',
]);

const RunStartSchema = z.object({
  gameId: ActiveGameIdEnum,
  visitorId: z.string().trim().min(3).max(80),
  claimToken: z.string().trim().max(80).optional(),
  volunteerName: z.string().trim().max(40).optional(),
});

const RunFinishSchema = z.object({
  visitorId: z.string().trim().min(3).max(80),
  score: z.number().int().min(0).max(100000),
  endReason: z.enum(['time', 'lives', 'moves', 'knockout']),
});

const CreateVersusRoomSchema = z.object({
  hostName: z.string().trim().max(32).optional().default('Player 1'),
});

const JoinVersusRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the 4-digit room code (1000–9999).'),
  joinerName: z.string().trim().max(32).optional().default('Challenger'),
});

const VersusInputSchema = z.object({
  token: z.string().trim().min(16).max(80),
  x: z.number().finite().min(-50).max(410),
  y: z.number().finite().min(400).max(950),
});

const VersusLeaveSchema = z.object({
  token: z.string().trim().min(16).max(80),
});

const ClaimTokenQuerySchema = z.string().trim().min(10).max(80).optional();

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

function asyncHandler(
  fn: (req: Request, res: express.Response, next: express.NextFunction) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createApiRouter(db: ArcadeDatabase, options: { now?: () => number } = {}) {
  const router = express.Router();
  const hockeyRooms = new HockeyRoomManager(options);
  const pinLimiter = new SlidingWindowRateLimiter(5, 15 * 60 * 1000);
  const leadLimiter = new SlidingWindowRateLimiter(45, 5 * 60 * 1000);
  const telemetryLimiter = new SlidingWindowRateLimiter(240, 5 * 60 * 1000);
  const roomActionLimiter = new SlidingWindowRateLimiter(80, 5 * 60 * 1000);
  const versusInputLimiter = new SlidingWindowRateLimiter(5000, 60 * 1000);

  router.get('/health', (_req, res) => {
    const status = db.getStorageStatus();
    res.json({
      ok: true,
      storageEngine: status.engine,
      persistent: status.persistent,
    });
  });

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
    res.setHeader('Content-Disposition', 'inline; filename="christmas-invitation.ics"');
    res.send(ics);
  });

  router.post(
    '/events',
    asyncHandler(async (req, res) => {
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
      await db.flushPersistence();

      // If linked to a saved pass, return refreshed pass stats so client high scores stay in sync
      const refreshedPass = parsed.data.claimToken
        ? db.getPassByClaimToken(parsed.data.claimToken)
        : null;

      res.status(201).json({ ok: true, claim: refreshedPass });
    })
  );

  router.post(
    '/runs',
    asyncHandler(async (req, res) => {
      const ip = getClientIp(req);
      if (!telemetryLimiter.isAllowed(ip)) {
        res.status(429).json({ error: 'Rate limit exceeded.' });
        return;
      }
      const parsed = RunStartSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid round payload.' });
        return;
      }
      const runId = db.startRun(parsed.data);
      await db.flushPersistence();
      res.status(201).json({ runId });
    })
  );

  router.post(
    '/runs/:runId/finish',
    asyncHandler(async (req, res) => {
      const ip = getClientIp(req);
      if (!telemetryLimiter.isAllowed(ip)) {
        res.status(429).json({ error: 'Rate limit exceeded.' });
        return;
      }
      const runId = String(req.params.runId || '').trim();
      const parsed = RunFinishSchema.safeParse(req.body);
      if (runId.length < 10 || runId.length > 80 || !parsed.success) {
        res.status(400).json({ error: 'Invalid round result.' });
        return;
      }
      const outcome = db.finishRun({ runId, ...parsed.data });
      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      await db.flushPersistence();
      res.json(outcome.result);
    })
  );

  router.get('/leaderboard', (req, res) => {
    const token = ClaimTokenQuerySchema.safeParse(
      typeof req.query.claimToken === 'string' && req.query.claimToken ? req.query.claimToken : undefined
    );
    if (!token.success) {
      res.status(400).json({ error: 'Invalid pass token.' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ games: db.getLeaderboards(token.data) });
  });

  router.get('/leaderboard/:gameId', (req, res) => {
    const gameParsed = ActiveGameIdEnum.safeParse(req.params.gameId);
    if (!gameParsed.success) {
      res.status(400).json({ error: 'Invalid game ID.' });
      return;
    }
    const token = ClaimTokenQuerySchema.safeParse(
      typeof req.query.claimToken === 'string' && req.query.claimToken ? req.query.claimToken : undefined
    );
    if (!token.success) {
      res.status(400).json({ error: 'Invalid pass token.' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(db.getFullGameLeaderboard(gameParsed.data, token.data));
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

  router.post(
    '/leads',
    asyncHandler(async (req, res) => {
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
      await db.flushPersistence();

      res.status(201).json({ claim: result });
    })
  );

  router.post(
    '/public/claim/:claimToken',
    asyncHandler(async (req, res) => {
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
      await db.flushPersistence();
      res.json({ claim: updated });
    })
  );

  // --- Team Passcode / Master PIN Auth & Protected Organizer Endpoints ---

  const resolveTeamSessionUser = (req: Request): TeamSessionUser | null => {
    const payload = getRequestCookiePayload(req);
    if (!payload) return null;
    if (payload.authMethod === 'master_pin') {
      return {
        id: null,
        name: 'Team Admin',
        role: 'admin',
        authMethod: 'master_pin',
      };
    }
    if (payload.authMethod === 'passcode' && payload.memberId !== null) {
      const member = db.getTeamUserById(payload.memberId);
      if (!member || !member.active) return null;
      return {
        id: member.id,
        name: member.name,
        role: member.role,
        authMethod: 'passcode',
      };
    }
    return null;
  };

  const requireActiveTeamAuth = (req: Request, res: Response, next: NextFunction): void => {
    const user = resolveTeamSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Team passcode or PIN session required.' });
      return;
    }
    next();
  };

  const requireTeamAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = resolveTeamSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Team passcode or PIN session required.' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Team Leader / Admin permission required.' });
      return;
    }
    next();
  };

  router.get('/team/session', (req, res) => {
    const user = resolveTeamSessionUser(req);
    res.json({ authenticated: Boolean(user), user });
  });

  router.post(
    '/team/login',
    asyncHandler(async (req, res) => {
      const ip = getClientIp(req);
      if (!pinLimiter.isAllowed(ip)) {
        res.status(429).json({
          error: 'Too many incorrect passcode or PIN attempts. Please wait 15 minutes before retrying.',
        });
        return;
      }

      const rawCode =
        typeof req.body?.passcode === 'string' && req.body.passcode.trim()
          ? req.body.passcode.trim()
          : typeof req.body?.pin === 'string'
            ? req.body.pin.trim()
            : '';

      if (!rawCode) {
        res.status(401).json({ error: 'Incorrect passcode or Team PIN.' });
        return;
      }

      if (verifyTeamPin(rawCode)) {
        const masterAdmin: TeamSessionUser = {
          id: null,
          name: 'Team Admin',
          role: 'admin',
          authMethod: 'master_pin',
        };
        pinLimiter.reset(ip);
        setTeamSessionCookie(req, res, masterAdmin);
        res.json({ authenticated: true, user: masterAdmin });
        return;
      }

      const memberUser = db.authenticateTeamUserByPasscode(rawCode);
      if (!memberUser) {
        res.status(401).json({ error: 'Incorrect passcode or Team PIN.' });
        return;
      }

      await db.flushPersistence();
      pinLimiter.reset(ip);
      setTeamSessionCookie(req, res, memberUser);
      res.json({ authenticated: true, user: memberUser });
    })
  );

  router.post('/team/logout', (req, res) => {
    clearTeamSessionCookie(req, res);
    res.json({ authenticated: false, user: null });
  });

  router.get('/team/users', requireActiveTeamAuth, (_req, res) => {
    res.json({ users: db.listTeamUsers() });
  });

  router.post(
    '/team/users',
    requireTeamAdmin,
    asyncHandler(async (req, res) => {
      const parsed = CreateTeamUserSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Please check the member name and passcode.';
        res.status(400).json({ error: msg });
        return;
      }

      const outcome = db.createTeamUser(parsed.data);
      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }

      await db.flushPersistence();
      res.status(201).json({ user: outcome.user });
    })
  );

  router.patch(
    '/team/users/:id',
    requireTeamAdmin,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid team member ID.' });
        return;
      }

      const parsed = PatchTeamUserSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Invalid team member update payload.';
        res.status(400).json({ error: msg });
        return;
      }

      const actor = resolveTeamSessionUser(req);
      if (actor && actor.id === id) {
        if (parsed.data.active === false) {
          res.status(400).json({ error: 'You cannot pause your own active account.' });
          return;
        }
        if (parsed.data.role === 'member') {
          res.status(400).json({
            error: 'You cannot remove your own Team Leader / Admin role while signed in.',
          });
          return;
        }
      }

      const outcome = db.updateTeamUser(id, parsed.data);
      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }

      await db.flushPersistence();
      res.json({ user: outcome.user });
    })
  );

  router.delete(
    '/team/users/:id',
    requireTeamAdmin,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid team member ID.' });
        return;
      }

      const actor = resolveTeamSessionUser(req);
      if (actor && actor.id === id) {
        res.status(400).json({ error: 'You cannot remove your own active account.' });
        return;
      }

      const deleted = db.deleteTeamUser(id);
      if (!deleted) {
        res.status(404).json({ error: 'Team member not found.' });
        return;
      }

      await db.flushPersistence();
      res.json({ ok: true });
    })
  );

  router.get('/team/master-stats', requireActiveTeamAuth, (_req, res) => {
    res.json(db.getMasterAnalytics());
  });

  router.get('/team/activity-log', requireActiveTeamAuth, (req, res) => {
    const parsed = ActivityLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid activity log filter parameters.' });
      return;
    }
    res.json(db.listActivityLogs(parsed.data));
  });

  router.get('/team/leads', requireActiveTeamAuth, (req, res) => {
    const payload = db.listTeamLeads(getPublicBaseUrl(req));
    res.json(payload);
  });

  router.patch(
    '/team/leads/:id',
    requireActiveTeamAuth,
    asyncHandler(async (req, res) => {
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
      await db.flushPersistence();
      res.json({ lead: updated });
    })
  );

  router.get('/team/leads/export.csv', requireActiveTeamAuth, (req, res) => {
    const { leads } = db.listTeamLeads(getPublicBaseUrl(req));
    const headers = [
      'ID',
      'Redemption Code',
      'Name',
      'WhatsApp Number',
      'Volunteer',
      'Follow-Up Status',
      'Engagement Tier',
      'Gift Claimed',
      'WhatsApp Sent',
      'Remarks',
      'Remarks Updated At',
      'First Game',
      'First Score',
      'Total Games Played',
      'Games Played After Interaction',
      'Invitations Shared',
      'E-Tickets Downloaded',
      'Calendar Adds',
      'E-Invite Views',
      'Google Maps Clicks',
      'Waze Clicks',
      'Created At',
      'Last Active At',
    ];
    const rows = leads.map((l) => {
      const engagementTier =
        l.calendarAdds > 0 || l.inviteShares > 0 || l.gamesAfterInteraction >= 2
          ? 'Hot'
          : l.gamesAfterInteraction === 1 ||
              l.ticketDownloads > 0 ||
              l.directionsClicks > 0 ||
              l.eInviteViews > 1
            ? 'Warm'
            : 'Street';
      return [
        l.id,
        l.redemptionCode,
        l.name,
        l.normalizedPhone,
        l.volunteerName || 'General',
        l.followUpStatus,
        engagementTier,
        l.giftClaimed ? 'Yes' : 'No',
        l.whatsappSent ? 'Yes' : 'No',
        l.notes,
        l.notesUpdatedAt,
        l.gamePlayed,
        l.score,
        l.totalGamesPlayed,
        l.gamesAfterInteraction,
        l.inviteShares,
        l.ticketDownloads,
        l.calendarAdds,
        l.eInviteViews,
        l.googleMapsClicks,
        l.wazeClicks,
        l.createdAt,
        l.lastActiveAt,
      ]
        .map(sanitizeCsvCell)
        .join(',');
    });

    const csv = `\uFEFF${headers.join(',')}\r\n${rows.join('\r\n')}\r\n`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="christmas-outreach-contacts.csv"');
    res.send(csv);
  });

  router.put(
    '/team/settings',
    requireTeamAdmin,
    asyncHandler(async (req, res) => {
      const parsed = SettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Invalid event settings.';
        res.status(400).json({ error: msg });
        return;
      }
      const updated = db.updateSettings(parsed.data);
      await db.flushPersistence();
      res.json({
        settings: updated,
        googleCalendarUrl: buildGoogleCalendarUrl(updated),
      });
    })
  );

  router.get('/team/qr.svg', requireActiveTeamAuth, async (req, res) => {
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

  // --- 2-Phone Live Versus Rooms (Starlight Air Hockey) ---

  router.post('/versus/rooms', (req, res) => {
    const ip = getClientIp(req);
    if (!roomActionLimiter.isAllowed(ip)) {
      res.status(429).json({ error: 'Too many room requests. Please wait a moment.' });
      return;
    }
    const parsed = CreateVersusRoomSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid room setup.' });
      return;
    }
    const outcome = hockeyRooms.createRoom(parsed.data.hostName);
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json(outcome.data);
  });

  router.post('/versus/rooms/join', (req, res) => {
    const ip = getClientIp(req);
    if (!roomActionLimiter.isAllowed(ip)) {
      res.status(429).json({ error: 'Too many join attempts. Please wait a moment.' });
      return;
    }
    const parsed = JoinVersusRoomSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Enter a valid 4-digit room code.';
      res.status(400).json({ error: msg });
      return;
    }
    const outcome = hockeyRooms.joinRoom(parsed.data.code, parsed.data.joinerName);
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(outcome.data);
  });

  router.get('/versus/rooms/:code/stream', (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const err = hockeyRooms.attachStream(req.params.code, token, res);
    if (err) {
      res.status(err.status).json({ error: err.error });
    }
  });

  router.get('/versus/rooms/:code', (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const outcome = hockeyRooms.getSnapshot(req.params.code, token);
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ snapshot: outcome.snapshot });
  });

  router.post('/versus/rooms/:code/input', (req, res) => {
    const ip = getClientIp(req);
    if (!versusInputLimiter.isAllowed(ip)) {
      res.status(429).json({ error: 'Input rate limit exceeded.' });
      return;
    }
    const parsed = VersusInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid striker input.' });
      return;
    }
    const outcome = hockeyRooms.updateInput(
      req.params.code,
      parsed.data.token,
      parsed.data.x,
      parsed.data.y
    );
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ snapshot: outcome.snapshot });
  });

  router.post('/versus/rooms/:code/leave', (req, res) => {
    const parsed = VersusLeaveSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid leave payload.' });
      return;
    }
    const outcome = hockeyRooms.leaveRoom(req.params.code, parsed.data.token);
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}

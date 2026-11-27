export type ActiveGameId =
  | 'ice-hockey'
  | 'santa-dash'
  | 'gift-tetris'
  | 'gift-slash'
  | 'candy-match';

export type LegacyGameId = 'claw-machine' | 'gift-rush' | 'tap-duel' | 'starlight-drop';

export type GameId = ActiveGameId | LegacyGameId;

export interface ArcadeGameMeta {
  id: ActiveGameId;
  title: string;
  shortTag: string;
  durationLabel: string;
  controlHint: string;
  emoji: string;
  accentBg: string;
  accentFg: string;
}

export const ACTIVE_ARCADE_GAMES: readonly ArcadeGameMeta[] = [
  {
    id: 'santa-dash',
    title: 'Santa Dash',
    shortTag: '3-Lane Run',
    durationLabel: '3 lives',
    controlHint: 'Swipe Left / Right',
    emoji: '🛷',
    accentBg: 'linear-gradient(135deg, #15803d, #0f5132)',
    accentFg: '#ffffff',
  },
  {
    id: 'gift-tetris',
    title: 'Block Stack',
    shortTag: 'Gift Tetris',
    durationLabel: '3 lives',
    controlHint: 'Tap Rotate · Drop Rows',
    emoji: '🧱',
    accentBg: 'linear-gradient(135deg, #d97706, #b45309)',
    accentFg: '#ffffff',
  },
  {
    id: 'gift-slash',
    title: 'Berry Slash',
    shortTag: 'Fruit Ninja',
    durationLabel: '3 lives',
    controlHint: 'Swipe Across Ornaments',
    emoji: '⚔️',
    accentBg: 'linear-gradient(135deg, #e11d48, #9f1239)',
    accentFg: '#ffffff',
  },
  {
    id: 'candy-match',
    title: 'Candy Match',
    shortTag: 'Candy Crush',
    durationLabel: '20 moves',
    controlHint: 'Swap 3 Candies',
    emoji: '🍬',
    accentBg: 'linear-gradient(135deg, #0284c7, #0369a1)',
    accentFg: '#ffffff',
  },
  {
    id: 'ice-hockey',
    title: 'Starlight Hockey',
    shortTag: '2P Versus · 1P',
    durationLabel: '4-Digit Duel',
    controlHint: 'Drag Striker · Smash Puck Across Phones!',
    emoji: '🏒',
    accentBg: 'linear-gradient(135deg, #d70015, #99000f)',
    accentFg: '#ffffff',
  },
] as const;

export const GAME_LABELS_MAP: Record<string, string> = {
  'ice-hockey': '🏒 Starlight Hockey',
  'claw-machine': '🧸 Claw Grab',
  'santa-dash': '🛷 Santa Dash',
  'gift-tetris': '🧱 Block Stack',
  'gift-slash': '⚔️ Berry Slash',
  'candy-match': '🍬 Candy Match',
  'gift-rush': '⚡ Gift Rush',
  'tap-duel': '🥊 Tap Duel',
  'starlight-drop': '🎯 Starlight Drop',
};

export type AnalyticsEventType =
  | 'page_view'
  | 'game_start'
  | 'game_complete'
  | 'lead_registered'
  | 'gift_claimed'
  | 'e_invite_view'
  | 'ticket_download'
  | 'invite_share_whatsapp'
  | 'calendar_google'
  | 'calendar_ics'
  | 'maps_click'
  | 'waze_click'
  | 'team_whatsapp_followup';

export type ActivityLogCategory =
  | 'all'
  | 'page_views'
  | 'return_views'
  | 'games_started'
  | 'games_after'
  | 'registered_contacts'
  | 'physical_gifts'
  | 'viral_actions'
  | 'directions'
  | 'maps_only'
  | 'waze_only'
  | 'invite_views'
  | 'shares'
  | 'tickets'
  | 'calendar'
  | 'team_whatsapp';

export type FollowUpStatus = 'new' | 'contacted' | 'replied' | 'confirmed' | 'not_free';

export interface CampaignTargets {
  pageViews: number;
  gamesStarted: number;
  leads: number;
  giftsHandedOut: number;
  gamesAfter: number;
  viralActions: number;
}

export const DEFAULT_CAMPAIGN_TARGETS: CampaignTargets = {
  pageViews: 1500,
  gamesStarted: 500,
  leads: 500,
  giftsHandedOut: 500,
  gamesAfter: 100,
  viralActions: 100,
};

export const DEFAULT_CHURCH_ZONES: readonly string[] = [
  'Zone 1 · JB Central & City',
  'Zone 2 · Mount Austin & Tebrau',
  'Zone 3 · Skudai & Tampoi',
  'Zone 4 · Bukit Indah & Iskandar Puteri',
  'Zone 5 · Permas Jaya & Masai',
  'Zone 6 · Kulai & Senai',
  'Zone 7 · Youth & Young Adults',
  'Zone 8 · Mandarin & Bilingual Fellowship',
  'Zone 9 · Kids & Family Ministry',
  'Other / New Member',
] as const;

export interface EventSettings {
  churchName: string;
  eventTitle: string;
  eventSubtitle: string;
  eventDateIso: string; // YYYY-MM-DDTHH:mm local time
  timezoneOffset: string; // e.g. "+08:00"
  durationMinutes: number;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  wazeUrl?: string;
  defaultCountryCode: string; // digits only, e.g. "60" or "65"
  giftDescription: string;
  whatsappTemplate: string;
  reminderTemplate?: string;
  campaignTargets?: CampaignTargets;
  crownTargetSouls?: number;
  crownCountArcadeLeads?: boolean;
  churchZones?: string[];
}

export interface LeadSubmissionInput {
  name: string;
  phone: string;
  countryCode: string;
  gamePlayed: GameId;
  score: number;
  targetScore: number;
  volunteerName: string;
  clientRequestId: string;
  visitorId?: string;
}

export interface PublicClaimResult {
  redemptionCode: string;
  claimToken: string;
  name: string;
  gamePlayed: GameId;
  score: number;
  targetScore: number;
  volunteerName: string;
  giftClaimed: boolean;
  createdAt: string;
  totalGamesPlayed?: number;
  gamesAfterInteraction?: number;
  bestScores?: Partial<Record<GameId, number>>;
}

export interface TrackEventInput {
  visitorId: string;
  claimToken?: string;
  eventType: AnalyticsEventType;
  gameId?: GameId;
  score?: number;
  isPostInteraction?: boolean;
  volunteerName?: string;
}

export interface LeadPatchInput {
  giftClaimed?: boolean;
  whatsappSent?: boolean;
  notes?: string;
  followUpStatus?: FollowUpStatus;
  volunteerName?: string;
  attended?: boolean;
}

export interface TeamLeadRecord {
  id: number;
  redemptionCode: string;
  name: string;
  rawPhone: string;
  normalizedPhone: string;
  whatsappUrl: string;
  reminderWhatsappUrl: string;
  personalInviteUrl: string;
  gamePlayed: GameId;
  score: number;
  targetScore: number;
  volunteerName: string;
  giftClaimed: boolean;
  whatsappSent: boolean;
  followUpStatus: FollowUpStatus;
  notes: string;
  notesUpdatedAt: string;
  createdAt: string;
  attended?: boolean;
  attendedAt?: string;
  totalGamesPlayed: number;
  gamesAfterInteraction: number;
  inviteShares: number;
  ticketDownloads: number;
  calendarAdds: number;
  eInviteViews: number;
  directionsClicks: number;
  googleMapsClicks: number;
  wazeClicks: number;
  lastActiveAt: string;
}

export interface TeamDashboardStats {
  totalLeads: number;
  giftsClaimed: number;
  whatsappSentCount: number;
  withRemarksCount: number;
  confirmedRsvpCount: number;
  repliedCount: number;
  hotLeadsCount: number;
  byVolunteer: Record<string, number>;
}

export interface TeamLeadsResponse {
  leads: TeamLeadRecord[];
  stats: TeamDashboardStats;
}

export interface MasterOverviewTotals {
  totalPageViews: number;
  uniqueVisitors: number;
  qrScanViews: number;
  returnViewsAfterInteraction: number;
  totalGamesStarted: number;
  totalGamesPlayed: number;
  gamesDuringInteraction: number;
  gamesAfterInteraction: number;
  uniquePlayersAfterInteraction: number;
  avgGamesPerLead: number;
  totalLeads: number;
  visitorToLeadRatePct: number;
  giftsClaimed: number;
  eInviteViews: number;
  repeatEInviteViews: number;
  eTicketDownloads: number;
  invitationsShared: number;
  googleCalendarAdds: number;
  icsCalendarDownloads: number;
  mapsDirectionsClicks: number;
  googleMapsClicks: number;
  wazeClicks: number;
  teamWhatsappFollowupsSent: number;
  teamWhatsappClicksTotal: number;
  confirmedRsvps: number;
  repliedContacts: number;
  contactsWithRemarks: number;
}

export interface GameAnalyticsRow {
  gameId: GameId;
  starts: number;
  completions: number;
  duringInteraction: number;
  afterInteraction: number;
  avgScore: number;
  highScore: number;
}

export interface VolunteerAnalyticsRow {
  volunteerName: string;
  views: number;
  uniqueVisitors: number;
  gamesPlayed: number;
  gamesAfterInteraction: number;
  leadsCount: number;
  giftsClaimed: number;
  sharedInvites: number;
  whatsappFollowedUp: number;
  confirmedRsvps: number;
  withRemarks: number;
}

export interface RecentActivityItem {
  id: number;
  eventType: AnalyticsEventType;
  leadId: number | null;
  guestName: string | null;
  guestPhone: string | null;
  redemptionCode: string | null;
  visitorTag: string;
  volunteerName: string;
  gameId: string;
  score: number;
  isPostInteraction: boolean;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  eventType: AnalyticsEventType;
  leadId: number | null;
  guestName: string | null;
  guestPhone: string | null;
  redemptionCode: string | null;
  followUpStatus: FollowUpStatus | null;
  visitorId: string;
  visitorTag: string;
  volunteerName: string;
  gameId: string;
  score: number;
  isPostInteraction: boolean;
  createdAt: string;
}

export interface ActivityLogResponse {
  category: ActivityLogCategory;
  totalMatching: number;
  entries: ActivityLogEntry[];
}

export interface StorageStatusInfo {
  engine: 'postgres' | 'sqlite';
  persistent: boolean;
  warning: string | null;
}

export interface MasterAnalyticsResponse {
  overview: MasterOverviewTotals;
  targets: CampaignTargets;
  storage?: StorageStatusInfo;
  byGame: GameAnalyticsRow[];
  byVolunteer: VolunteerAnalyticsRow[];
  recentActivity: RecentActivityItem[];
}

/** One row on a public leaderboard. Names are always privacy-formatted ("Mei L."). */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
}

export interface GameLeaderboard {
  gameId: ActiveGameId;
  totalPlayers: number;
  top: LeaderboardEntry[];
  /** The requesting player's own all-time best and rank, when a valid claim token was supplied. */
  me: { rank: number; score: number } | null;
}

export interface LeaderboardResponse {
  games: GameLeaderboard[];
}

/** One player's all-time personal best row in the unlimited game standings. */
export interface FullLeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
  achievedAt: string;
}

export interface FullGameLeaderboard {
  gameId: ActiveGameId;
  totalPlayers: number;
  entries: FullLeaderboardEntry[];
  me: { rank: number; score: number } | null;
}

export type RunStatus = 'verified' | 'rejected';

export interface RunFinishResult {
  status: RunStatus;
  score: number;
  /** Rank of this player's all-time best on this game (registered players only). */
  rank: number | null;
  /** Where this score WOULD place if the player registered (unregistered players only). */
  wouldRank: number | null;
  /** True when this run beat the player's previous best on the board. */
  isPersonalBest: boolean;
  board: GameLeaderboard;
  claim: PublicClaimResult | null;
}

export type HockeyRole = 'host' | 'joiner';
export type HockeySessionMode = 'solo' | 'host' | 'joiner';
export type HockeyRoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

export interface HockeySessionConfig {
  mode: HockeySessionMode;
  roomCode?: string;
  playerToken?: string;
  myName: string;
  opponentName: string;
  initialSnapshot?: HockeyRoomSnapshot;
}

export interface HockeyMatchTallies {
  myGoals: number;
  oppGoals: number;
  opponentName: string;
}

export interface HockeyPuckSnapshot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  turbo: boolean;
}

export interface HockeyStrikerSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  connected: boolean;
  botControlled: boolean;
  name: string;
}

export interface HockeyGoalBanner {
  scorer: 'me' | 'opp';
  points: number;
  turbo: boolean;
  seq: number;
}

/**
 * Player-centric room snapshot: coordinates are already oriented so THIS player's half
 * is always the bottom half (y in [450, 900]) and the opponent's half is above the top portal (y in [0, 450]).
 */
export interface HockeyRoomSnapshot {
  code: string;
  role: HockeyRole;
  status: HockeyRoomStatus;
  countdown: number;
  elapsedMs: number;
  timeLeftMs: number;
  winGoals: number;
  myGoals: number;
  oppGoals: number;
  myArcadeScore: number;
  oppArcadeScore: number;
  myStriker: HockeyStrikerSnapshot;
  oppStriker: HockeyStrikerSnapshot;
  pucks: HockeyPuckSnapshot[];
  starGateX: number;
  starGateActive: boolean;
  lastGoal: HockeyGoalBanner | null;
  serverTimeMs: number;
}

export interface CreateHockeyRoomResponse {
  code: string;
  playerToken: string;
  role: 'host';
  snapshot: HockeyRoomSnapshot;
}

export interface JoinHockeyRoomResponse {
  code: string;
  playerToken: string;
  role: 'joiner';
  snapshot: HockeyRoomSnapshot;
}

export type TeamUserRole = 'admin' | 'member';

export interface TeamSessionUser {
  id: number | null;
  name: string;
  role: TeamUserRole;
  authMethod: 'master_pin' | 'passcode';
}

export interface TeamMemberRecord {
  id: number;
  name: string;
  role: TeamUserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface TeamUsersResponse {
  users: TeamMemberRecord[];
}

export type BoothGameId =
  | 'star-plinko'
  | 'wise-gifts'
  | 'blessing-basket'
  | 'tree-light';

export type BoothRelationship = 'Friend' | 'Family' | 'Colleague' | 'Neighbor';

export interface BoothGameMeta {
  id: BoothGameId;
  title: string;
  subtitle: string;
  generationTag: string;
  durationLabel: string;
  controlHint: string;
  emoji: string;
  accentBg: string;
  accentFg: string;
}

export const BOOTH_ARCADE_GAMES: readonly BoothGameMeta[] = [
  {
    id: 'star-plinko',
    title: 'Star of Bethlehem Drop',
    subtitle: 'Drop 3 glowing Christmas stars through musical pegs into Golden Seat buckets!',
    generationTag: 'Seniors, Kids & All Ages · 1-Tap',
    durationLabel: '3 Star Drops',
    controlHint: '1-Tap Drop · Zero Stress · 100% Win',
    emoji: '🌟',
    accentBg: 'linear-gradient(135deg, #d97706, #92400e)',
    accentFg: '#ffffff',
  },
  {
    id: 'wise-gifts',
    title: '3 Wise Gifts Shuffle',
    subtitle: 'Follow the Nativity Star hidden inside 3 shuffling golden gift boxes!',
    generationTag: 'Aunties, Uncles & Families · 3 Speeds',
    durationLabel: '3 Rounds',
    controlHint: 'Gentle, Festive or Turbo Speed',
    emoji: '🎁',
    accentBg: 'linear-gradient(135deg, #d70015, #99000f)',
    accentFg: '#ffffff',
  },
  {
    id: 'blessing-basket',
    title: 'Overflowing Blessing Basket',
    subtitle: 'Slide the wide Christmas basket to catch Joy, Peace, Hope & Love for your friend!',
    generationTag: 'Kids, Parents & Seniors · Forgiving Catch',
    durationLabel: '20 Seconds',
    controlHint: 'Slide or Tap Left / Right · No Bombs',
    emoji: '🧺',
    accentBg: 'linear-gradient(135deg, #15803d, #0f5132)',
    accentFg: '#ffffff',
  },
  {
    id: 'tree-light',
    title: 'Light Up the Christmas Tree',
    subtitle: 'Ring the dual Christmas bells & answer the Star Bonus to ignite the giant tree!',
    generationTag: 'Youth, Young Adults & Duos · High Energy',
    durationLabel: '20 Seconds',
    controlHint: 'Rapid Bell Tap + Bonus Trivia Star',
    emoji: '🎄',
    accentBg: 'linear-gradient(135deg, #0284c7, #0369a1)',
    accentFg: '#ffffff',
  },
] as const;

export const BOOTH_GAME_LABELS_MAP: Record<BoothGameId, string> = {
  'star-plinko': '🌟 Star of Bethlehem Drop',
  'wise-gifts': '🎁 3 Wise Gifts Shuffle',
  'blessing-basket': '🧺 Overflowing Blessing Basket',
  'tree-light': '🎄 Light Up the Christmas Tree',
};

export interface BoothWinnerSubmissionInput {
  memberName: string;
  memberPhone: string;
  countryCode: string;
  friendName: string;
  relationship: BoothRelationship;
  seatsReserved: number;
  friendPhone?: string;
  gamePlayed: BoothGameId;
  score: number;
  clientRequestId: string;
}

export interface BoothWinnerPatchInput {
  tokenHandedOut?: boolean;
  whatsappSent?: boolean;
  friendOpened?: boolean;
  notes?: string;
  seatsReserved?: number;
}

export interface BoothWinnerRecord {
  id: number;
  voucherCode: string;
  memberName: string;
  memberPhone: string;
  normalizedPhone: string;
  friendName: string;
  relationship: BoothRelationship;
  seatsReserved: number;
  friendPhone: string;
  gamePlayed: BoothGameId;
  score: number;
  tokenHandedOut: boolean;
  whatsappSent: boolean;
  friendOpened: boolean;
  notes: string;
  createdAt: string;
  friendInviteUrl: string;
  friendWhatsappUrl: string;
  memberFollowupWhatsappUrl: string;
}

export interface BoothWinnersStats {
  totalMembersPlayed: number;
  totalNewSoulSeats: number;
  tokensHandedOut: number;
  whatsappSentCount: number;
  friendsOpenedCount: number;
  byGame: Record<BoothGameId, number>;
  byRelationship: Record<string, number>;
}

export interface BoothWinnersResponse {
  winners: BoothWinnerRecord[];
  stats: BoothWinnersStats;
}

export interface BoothPublicTickerItem {
  voucherCode: string;
  memberName: string;
  friendName: string;
  relationship: BoothRelationship;
  seatsReserved: number;
  gamePlayed: BoothGameId;
  score: number;
  createdAt: string;
}

export interface BoothPublicSummaryResponse {
  totalMembersPlayed: number;
  totalNewSoulSeats: number;
  tokensHandedOut: number;
  recentWinners: BoothPublicTickerItem[];
}

/* ==========================================================================
   /register (Church Member Soul Registration), /present (King of Glory Crown),
   and /admin (Unified Christmas Registration & Attendance Console)
   ========================================================================== */

export interface SoulRegistrationInput {
  memberName: string;
  memberPhone: string;
  churchZone: string;
  soulName: string;
  memberCount: number;
  soulPhone: string;
  address?: string;
  countryCode?: string;
  clientRequestId?: string;
}

/**
 * /register guest self sign-up (from the physical "Jesus, the King of Glory" invitation card).
 * Stored in soul_registrations with church_zone = GUEST_SIGNUP_ZONE so it shows up in /admin
 * and counts toward the /present crown with no database migration.
 */
export const GUEST_SIGNUP_ZONE = 'Guest Self Sign-up';
export const GUEST_SIGNUP_DEFAULT_INVITER = 'Self sign-up (invitation card)';

export interface GuestSignupInput {
  guestName: string;
  guestPhone: string;
  seats: number;
  invitedBy?: string;
  countryCode?: string;
  clientRequestId?: string;
}

export interface GuestSignupResult {
  confirmationCode: string;
  guestName: string;
  guestPhone: string;
  seats: number;
  invitedBy: string;
  createdAt: string;
}

export interface SoulRegistrationPatchInput {
  attended?: boolean;
  whatsappSent?: boolean;
  notes?: string;
  memberCount?: number;
  churchZone?: string;
  address?: string;
}

export interface SoulRegistrationRecord {
  id: number;
  confirmationCode: string;
  memberName: string;
  memberPhone: string;
  memberNormalizedPhone: string;
  churchZone: string;
  soulName: string;
  memberCount: number;
  soulPhone: string;
  soulNormalizedPhone: string;
  address: string;
  attended: boolean;
  attendedAt: string;
  whatsappSent: boolean;
  notes: string;
  createdAt: string;
  soulWhatsappUrl: string;
  memberWhatsappUrl: string;
}

export interface CrownZoneStat {
  zone: string;
  registrationsCount: number;
  soulsCount: number;
  attendedSoulsCount: number;
}

export interface CrownFeedItem {
  id: string;
  source: 'register' | 'arcade';
  confirmationCode: string;
  memberName: string;
  churchZone: string;
  soulName: string;
  memberCount: number;
  createdAt: string;
}

export interface CrownStatusResponse {
  targetSouls: number;
  countArcadeLeads: boolean;
  totalProgressSouls: number;
  registeredSoulsHeadcount: number;
  registeredGroupsCount: number;
  arcadeLeadsCount: number;
  attendedSoulsCount: number;
  fillPercentage: number;
  churchZones: string[];
  zoneLeaderboard: CrownZoneStat[];
  recentRegistrations: CrownFeedItem[];
}

export interface CrownSettingsPatchInput {
  crownTargetSouls?: number;
  crownCountArcadeLeads?: boolean;
  churchZones?: string[];
}

export interface AdminUnifiedRecord {
  uid: string;
  source: 'register' | 'arcade';
  recordId: number;
  code: string;
  soulName: string;
  soulPhone: string;
  soulNormalizedPhone: string;
  memberCount: number;
  address: string;
  memberName: string;
  memberPhone: string;
  memberNormalizedPhone: string;
  churchZone: string;
  gamePlayed: string;
  score: number;
  attended: boolean;
  attendedAt: string;
  whatsappSent: boolean;
  giftClaimed: boolean;
  notes: string;
  createdAt: string;
  soulWhatsappUrl: string;
  memberWhatsappUrl: string;
}

export interface AdminOverviewStats {
  crownTargetSouls: number;
  crownCountArcadeLeads: boolean;
  crownProgressSouls: number;
  crownFillPercentage: number;
  totalUnifiedRecords: number;
  totalCombinedHeadcount: number;
  registerRecordsCount: number;
  registerHeadcount: number;
  arcadeRecordsCount: number;
  attendedRecordsCount: number;
  attendedHeadcount: number;
  whatsappSentCount: number;
}

export interface AdminOverviewResponse {
  stats: AdminOverviewStats;
  crownStatus: CrownStatusResponse;
  records: AdminUnifiedRecord[];
}


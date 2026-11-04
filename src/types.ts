export type ActiveGameId =
  | 'claw-machine'
  | 'santa-dash'
  | 'gift-tetris'
  | 'gift-slash'
  | 'candy-match';

export type LegacyGameId = 'gift-rush' | 'tap-duel' | 'starlight-drop';

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
    id: 'claw-machine',
    title: 'Claw Grab',
    shortTag: 'UFO Crane',
    durationLabel: '3 lives',
    controlHint: 'Slide & Drop Claw',
    emoji: '🧸',
    accentBg: 'linear-gradient(135deg, #ff3b30, #d70015)',
    accentFg: '#ffffff',
  },
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
] as const;

export const GAME_LABELS_MAP: Record<string, string> = {
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
  | 'e_invite_view'
  | 'ticket_download'
  | 'invite_share_whatsapp'
  | 'calendar_google'
  | 'calendar_ics'
  | 'maps_click'
  | 'team_whatsapp_followup';

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

export interface TeamLeadRecord {
  id: number;
  redemptionCode: string;
  name: string;
  rawPhone: string;
  normalizedPhone: string;
  whatsappUrl: string;
  gamePlayed: GameId;
  score: number;
  targetScore: number;
  volunteerName: string;
  giftClaimed: boolean;
  whatsappSent: boolean;
  notes: string;
  createdAt: string;
  totalGamesPlayed: number;
  gamesAfterInteraction: number;
  inviteShares: number;
  ticketDownloads: number;
  calendarAdds: number;
  eInviteViews: number;
  lastActiveAt: string;
}

export interface TeamDashboardStats {
  totalLeads: number;
  giftsClaimed: number;
  whatsappSentCount: number;
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
  teamWhatsappFollowupsSent: number;
  teamWhatsappClicksTotal: number;
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
}

export interface RecentActivityItem {
  id: number;
  eventType: AnalyticsEventType;
  guestName: string | null;
  redemptionCode: string | null;
  volunteerName: string;
  gameId: string;
  score: number;
  isPostInteraction: boolean;
  createdAt: string;
}

export interface MasterAnalyticsResponse {
  overview: MasterOverviewTotals;
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

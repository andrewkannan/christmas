export type GameId = 'gift-rush' | 'tap-duel' | 'starlight-drop';

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

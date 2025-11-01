export interface ClientInitializationOptions {
  leagueId?: number;
  teamId?: number;
  espnS2?: string;
  SWID?: string;
  scoringPeriodId?: number;
}

export interface ClientAuthCookies {
  espnS2: string;
  SWID: string;
}

export interface WeekRequestOptions {
  seasonId: number;
  matchupPeriodId: number;
  scoringPeriodId: number;
}

export interface DraftInfoOptions {
  seasonId: number;
  scoringPeriodId?: number;
}

export interface TeamsAtWeekOptions {
  seasonId: number;
  scoringPeriodId: number;
}

export interface GamesForPeriodOptions {
  startDate: string;
  endDate: string;
}

export interface LeagueInfoOptions {
  seasonId: number;
}

export interface ProTeamSchedulesOptions {
  seasonId: number;
}

declare class Client {
  constructor(options?: ClientInitializationOptions);

  leagueId?: number;

  espnS2?: string;

  SWID?: string;

  setCookies(cookies: ClientAuthCookies): void;

  getBoxscoreForWeek(options: WeekRequestOptions): Promise<unknown>;

  getDraftInfo(options: DraftInfoOptions): Promise<unknown>;

  getHistoricalScoreboardForWeek(options: WeekRequestOptions): Promise<unknown>;

  getFreeAgents(options: { seasonId: number; scoringPeriodId: number }): Promise<unknown>;

  getTeamsAtWeek(options: TeamsAtWeekOptions): Promise<unknown>;

  getHistoricalTeamsAtWeek(options: TeamsAtWeekOptions): Promise<unknown>;

  getNFLGamesForPeriod(options: GamesForPeriodOptions): Promise<unknown>;

  getLeagueInfo(options: LeagueInfoOptions): Promise<unknown>;

  getProTeamSchedules(options: ProTeamSchedulesOptions): Promise<unknown>;
}

export default Client;

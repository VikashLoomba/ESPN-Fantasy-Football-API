#!/usr/bin/env node
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-extraneous-dependencies
import { config as loadEnv } from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type ClientInstance from '../src/client/client.js';

type RequiredEnvVar = 'TEAM_ID' | 'LEAGUE_ID' | 'ESPN_SWID' | 'ESPN_S2';

interface ServerConfig {
  teamId: number;
  leagueId: number;
  espnS2: string;
  swid: string;
  version: string;
  seasonId: number;
  scoringPeriodId: number;
}

type LineupEntry = {
  rosteredPosition: string | null;
  projectedPoints: number | null;
  totalPoints: number | null;
};

interface MatchupContext {
  lineupsByTeam: Map<number, Map<number, LineupEntry>>;
  opponentTeamId: number | null;
}

type ByeWeekMap = Map<number, number>;

const REQUIRED_ENV_VARS: RequiredEnvVar[] = ['TEAM_ID', 'LEAGUE_ID', 'ESPN_SWID', 'ESPN_S2'];

function loadConfiguration(): ServerConfig {
  loadEnv();

  const missingEnv = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }

  const teamId = Number(process.env.TEAM_ID);
  if (!Number.isInteger(teamId)) {
    throw new Error('TEAM_ID must be an integer.');
  }

  const leagueId = Number(process.env.LEAGUE_ID);
  if (!Number.isInteger(leagueId)) {
    throw new Error('LEAGUE_ID must be an integer.');
  }

  const seasonIdRaw = process.env.SEASON_ID;
  const seasonId = seasonIdRaw ? Number(seasonIdRaw) : 2025;
  if (!Number.isInteger(seasonId)) {
    throw new Error('SEASON_ID must be an integer if provided.');
  }

  const scoringPeriodRaw = process.env.SCORING_PERIOD_ID;
  const scoringPeriodId = scoringPeriodRaw ? Number(scoringPeriodRaw) : 1;
  if (!Number.isInteger(scoringPeriodId)) {
    throw new Error('SCORING_PERIOD_ID must be an integer if provided.');
  }

  return {
    teamId,
    leagueId,
    espnS2: process.env.ESPN_S2 as string,
    swid: process.env.ESPN_SWID as string,
    version: process.env.npm_package_version ?? '0.0.0',
    seasonId,
    scoringPeriodId
  };
}

function toStructured(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function buildToolResult(data: unknown) {
  const structured = toStructured(data);
  let text: string;
  if (typeof structured === 'string') {
    text = structured;
  } else {
    text = JSON.stringify(structured, null, 2);
  }

  const structuredContent = structured && typeof structured === 'object' && !Array.isArray(structured) ?
    structured :
    { value: structured };

  return {
    content: [
      {
        type: 'text' as const,
        text
      }
    ],
    structuredContent
  };
}

type ClientConstructor = typeof import('../src/client/client.js').default;

let ClientCtor: ClientConstructor;

try {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const bundled = require('../node.js') as { Client?: ClientConstructor };
  if (bundled && bundled.Client) {
    ClientCtor = bundled.Client;
  }
} catch (error) {
  // Ignore missing bundle and fall back to source in test/dev environments.
}

if (!ClientCtor) {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const sourceModule = require('../src/client/client.js');
  const fallback = sourceModule?.default ?? sourceModule?.Client ?? sourceModule;
  ClientCtor = fallback as ClientConstructor;
}

function registerTools(server: McpServer, client: ClientInstance, config: ServerConfig) {
  const calculatePointTotal = (stats: Record<string, unknown> | undefined) => {
    if (!stats || typeof stats !== 'object') {
      return null;
    }

    let total = 0;
    let hasValue = false;

    Object.entries(stats).forEach(([key, value]) => {
      if (key === 'usesPoints') {
        return;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        total += value;
        hasValue = true;
      }
    });

    return hasValue ? Number(total.toFixed(2)) : null;
  };

  const formatDate = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');

  async function fetchTeams() {
    const teams = await client.getTeamsAtWeek({
      seasonId: config.seasonId,
      scoringPeriodId: config.scoringPeriodId
    });

    return teams as any[];
  }

  let cachedProTeamByeWeeks: ByeWeekMap | null = null;

  async function fetchProTeamByeWeekMap(): Promise<ByeWeekMap> {
    if (cachedProTeamByeWeeks) {
      return cachedProTeamByeWeeks;
    }

    try {
      const proTeams = await client.getProTeamSchedules({
        seasonId: config.seasonId
      }) as Array<{ id?: number; byeWeek?: number }> | undefined;

      const byeWeekMap: ByeWeekMap = new Map();
      (proTeams ?? []).forEach((team) => {
        if (team && typeof team.id === 'number' && typeof team.byeWeek === 'number') {
          byeWeekMap.set(team.id, team.byeWeek);
        }
      });

      cachedProTeamByeWeeks = byeWeekMap;
      return byeWeekMap;
    } catch {
      cachedProTeamByeWeeks = new Map<number, number>();
      return cachedProTeamByeWeeks;
    }
  }

  async function fetchMatchupContext(targetTeamId: number = config.teamId): Promise<MatchupContext> {
    try {
      const matchupPeriodId = config.scoringPeriodId;
      const boxscores = await client.getBoxscoreForWeek({
        seasonId: config.seasonId,
        scoringPeriodId: config.scoringPeriodId,
        matchupPeriodId
      }) as any[];

      const matchup = boxscores.find(
        (entry) => entry.homeTeamId === targetTeamId || entry.awayTeamId === targetTeamId
      );

      if (!matchup) {
        return {
          lineupsByTeam: new Map<number, Map<number, LineupEntry>>(),
          opponentTeamId: null
        };
      }

      const buildLineupMap = (roster: any[] | undefined) => new Map<number, LineupEntry>(
        (roster ?? []).map((player: { id: number; rosteredPosition?: string; projectedPointBreakdown?: Record<string, unknown>; totalPoints?: number; }) => ([
          player.id,
          {
            rosteredPosition: player.rosteredPosition ?? null,
            projectedPoints: calculatePointTotal(player.projectedPointBreakdown as Record<string, unknown> | undefined),
            totalPoints: typeof player.totalPoints === 'number' ? Number(player.totalPoints.toFixed(2)) : null
          }
        ]))
      );

      const homeLineup = buildLineupMap(matchup.homeRoster);
      const awayLineup = buildLineupMap(matchup.awayRoster);
      const opponentTeamId = matchup.homeTeamId === targetTeamId ? matchup.awayTeamId : matchup.homeTeamId;

      return {
        lineupsByTeam: new Map<number, Map<number, LineupEntry>>([
          [matchup.homeTeamId, homeLineup],
          [matchup.awayTeamId, awayLineup]
        ]),
        opponentTeamId: typeof opponentTeamId === 'number' ? opponentTeamId : null
      };
    } catch {
      return {
        lineupsByTeam: new Map<number, Map<number, LineupEntry>>(),
        opponentTeamId: null
      };
    }
  }

  async function buildRosterSummary(
    targetTeamId: number = config.teamId,
    options: { lineupMap?: Map<number, LineupEntry>; teams?: any[]; byeWeekByProTeam?: ByeWeekMap } = {}
  ) {
    const teams = options.teams ?? await fetchTeams();
    const team = teams.find((entry) => entry.id === targetTeamId);
    if (!team) {
      throw new Error(`Unable to locate team ${targetTeamId} for scoring period ${config.scoringPeriodId}.`);
    }

    let lineupMap: Map<number, LineupEntry>;
    if (options.lineupMap) {
      lineupMap = options.lineupMap;
    } else if (targetTeamId === config.teamId) {
      const matchupContext = await fetchMatchupContext(targetTeamId);
      lineupMap = matchupContext.lineupsByTeam.get(targetTeamId) ?? new Map<number, LineupEntry>();
    } else {
      lineupMap = new Map<number, LineupEntry>();
    }

    const byeWeekByProTeam = options.byeWeekByProTeam ?? await fetchProTeamByeWeekMap();
    const scoringPeriodId = config.scoringPeriodId;

    const roster = team.roster.map((player: any) => {
      const slotInfo = lineupMap.get(player.id);
      const outlook = player.outlooksByWeek?.[String(config.scoringPeriodId)];
      const proTeamValue = player.proTeamAbbreviation ?? player.proTeam;
      const proTeamId = typeof player.proTeamId === 'number' ? player.proTeamId : undefined;
      const mappedByeWeekNumber = proTeamId != null ? byeWeekByProTeam.get(proTeamId) : undefined;
      const byeWeekNumber = typeof mappedByeWeekNumber === 'number' ? mappedByeWeekNumber : undefined;
      const byeWeek = proTeamValue === 'Bye' || player.proTeam === 'Bye' || byeWeekNumber === scoringPeriodId;

      return {
        id: player.id,
        name: player.fullName,
        defaultPosition: player.defaultPosition,
        rosteredPosition: slotInfo?.rosteredPosition ?? null,
        proTeam: proTeamValue,
        availabilityStatus: player.availabilityStatus,
        injuryStatus: player.injuryStatus,
        isInjured: player.isInjured,
        outlook,
        projectedPoints: slotInfo?.projectedPoints ?? null,
        totalPoints: slotInfo?.totalPoints ?? null,
        byeWeek,
        byeWeekNumber: byeWeekNumber ?? null
      };
    });

    return {
      team: {
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        ownerName: team.ownerName
      },
      scoringPeriodId: config.scoringPeriodId,
      roster
    };
  }

  server.tool(
    'setCookies',
    {
      espnS2: z.string(),
      SWID: z.string()
    },
    async ({ espnS2, SWID }) => {
      client.setCookies({ espnS2, SWID });
      return buildToolResult({ success: true });
    }
  );

  server.tool(
    'getBoxscoreForWeek',
    async () => {
      const boxscores = await client.getBoxscoreForWeek({
        seasonId: config.seasonId,
        matchupPeriodId: config.scoringPeriodId,
        scoringPeriodId: config.scoringPeriodId
      });
      return buildToolResult(boxscores);
    }
  );

  server.tool(
    'getDraftInfo',
    async () => {
      const draftInfo = await client.getDraftInfo({
        seasonId: config.seasonId,
        scoringPeriodId: config.scoringPeriodId
      });
      return buildToolResult(draftInfo);
    }
  );

  server.tool(
    'getHistoricalScoreboardForWeek',
    async () => {
      const scoreboard = await client.getHistoricalScoreboardForWeek({
        seasonId: config.seasonId,
        matchupPeriodId: config.scoringPeriodId,
        scoringPeriodId: config.scoringPeriodId
      });
      return buildToolResult(scoreboard);
    }
  );

  server.tool(
    'getFreeAgents',
    async () => {
      const freeAgents = await client.getFreeAgents({
        seasonId: config.seasonId,
        scoringPeriodId: config.scoringPeriodId
      });
      return buildToolResult(freeAgents);
    }
  );

  server.tool(
    'getTeamsAtWeek',
    {
      teamId: z.number().int().optional(),
      scoringPeriodId: z.number().int().optional(),
      includeAll: z.boolean().optional()
    },
    async ({ teamId, scoringPeriodId, includeAll } = {}) => {
      const effectiveScoringPeriodId = scoringPeriodId ?? config.scoringPeriodId;
      const teams = await fetchTeams();

      if (includeAll) {
        return buildToolResult({
          scoringPeriodId: effectiveScoringPeriodId,
          teams
        });
      }

      const targetTeamId = teamId ?? config.teamId;
      if (!targetTeamId) {
        return buildToolResult({
          scoringPeriodId: effectiveScoringPeriodId,
          teams
        });
      }

      const team = teams.find((entry) => entry.id === targetTeamId);
      if (!team) {
        throw new Error(`Team with id ${targetTeamId} not found for scoring period ${effectiveScoringPeriodId}.`);
      }

      return buildToolResult(team);
    }
  );

  server.tool(
    'getHistoricalTeamsAtWeek',
    async () => {
      const teams = await client.getHistoricalTeamsAtWeek({
        seasonId: config.seasonId,
        scoringPeriodId: config.scoringPeriodId
      });
      return buildToolResult(teams);
    }
  );

  server.tool(
    'getNFLGamesForPeriod',
    {
      startDate: z.string().regex(/^\d{8}$/, 'startDate must be in YYYYMMDD format'),
      endDate: z.string().regex(/^\d{8}$/, 'endDate must be in YYYYMMDD format')
    },
    async ({ startDate, endDate }) => {
      const games = await client.getNFLGamesForPeriod({ startDate, endDate });
      return buildToolResult(games);
    }
  );

  server.tool(
    'getLeagueInfo',
    async () => {
      const info = await client.getLeagueInfo({ seasonId: config.seasonId });
      return buildToolResult(info);
    }
  );

  server.tool(
    'getMyTeamDetails',
    async () => {
      const teams = await fetchTeams();
      const byeWeekByProTeam = await fetchProTeamByeWeekMap();
      const matchupContext = await fetchMatchupContext(config.teamId);

      const teamLineup = matchupContext.lineupsByTeam.get(config.teamId) ?? new Map<number, LineupEntry>();
      const rosterSummary = await buildRosterSummary(config.teamId, {
        lineupMap: teamLineup,
        teams,
        byeWeekByProTeam
      });

      let opponentSummary: Awaited<ReturnType<typeof buildRosterSummary>> | null = null;
      if (typeof matchupContext.opponentTeamId === 'number') {
        const opponentLineup = matchupContext.lineupsByTeam.get(matchupContext.opponentTeamId) ?? new Map<number, LineupEntry>();
        opponentSummary = await buildRosterSummary(matchupContext.opponentTeamId, {
          lineupMap: opponentLineup,
          teams,
          byeWeekByProTeam
        });
      }

      return buildToolResult({
        ...rosterSummary,
        opponent: opponentSummary
      });
    }
  );

  server.tool(
    'getPlayerStatus',
    {
      playerName: z.string()
    },
    async ({ playerName }) => {
      const effectiveScoringPeriodId = config.scoringPeriodId ?? config.scoringPeriodId;
      const byeWeekByProTeam = await fetchProTeamByeWeekMap();
      const rosterSummary = await buildRosterSummary(config.teamId, { byeWeekByProTeam });

      const lowercaseQuery = playerName.toLowerCase();
      let player = rosterSummary.roster.find((entry: { name: string; }) => entry.name.toLowerCase() === lowercaseQuery);

      if (!player) {
        player = rosterSummary.roster.find((entry: { name: string; }) => entry.name.toLowerCase().includes(lowercaseQuery));
      }

      if (!player) {
        throw new Error(`Player "${playerName}" was not found on team ${rosterSummary.team.name}.`);
      }

      return buildToolResult({
        team: rosterSummary.team,
        scoringPeriodId: effectiveScoringPeriodId,
        player
      });
    }
  );

  server.tool(
    'getTeamSchedule',
    {
      nflTeamAbbreviation: z.string().optional(),
      playerName: z.string().optional(),

      startDate: z.string().regex(/^\d{8}$/, 'startDate must be in YYYYMMDD format').optional(),
      endDate: z.string().regex(/^\d{8}$/, 'endDate must be in YYYYMMDD format').optional()
    },
    async ({
      nflTeamAbbreviation, playerName, startDate, endDate
    }) => {
      // const effectiveScoringPeriodId = config.scoringPeriodId;
      let derivedAbbreviation = nflTeamAbbreviation;

      if (!derivedAbbreviation && (playerName || config.teamId)) {
        const byeWeekByProTeam = await fetchProTeamByeWeekMap();
        const rosterSummary = await buildRosterSummary(
          config.teamId,
          { byeWeekByProTeam }
        );

        if (playerName) {
          const lowercaseQuery = playerName.toLowerCase();
          let player = rosterSummary.roster.find((entry: { name: string; }) => entry.name.toLowerCase() === lowercaseQuery);
          if (!player) {
            player = rosterSummary.roster.find((entry: { name: string; }) => entry.name.toLowerCase().includes(lowercaseQuery));
          }

          if (!player) {
            throw new Error(`Player "${playerName}" was not found on team ${rosterSummary.team.name}.`);
          }

          derivedAbbreviation = player.proTeam ?? undefined;
        }

        if (!derivedAbbreviation) {
          const counts = new Map<string, number>();
          rosterSummary.roster.forEach((entry: { proTeam: string; }) => {
            if (!entry.proTeam || entry.proTeam === 'Bye') {
              return;
            }
            counts.set(entry.proTeam, (counts.get(entry.proTeam) ?? 0) + 1);
          });

          const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
          derivedAbbreviation = sorted[0]?.[0];
        }
      }

      if (!derivedAbbreviation) {
        throw new Error(
          'Unable to determine NFL team. Provide nflTeamAbbreviation, playerName, or teamId.'
        );
      }

      const today = new Date();
      const defaultStart = formatDate(today);
      const defaultEnd = formatDate(new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000)));

      const games = await client.getNFLGamesForPeriod({
        startDate: startDate ?? defaultStart,
        endDate: endDate ?? defaultEnd
      }) as any[];

      const filtered = games.filter(
        (game) => game.homeTeam?.teamAbbrev === derivedAbbreviation ||
          game.awayTeam?.teamAbbrev === derivedAbbreviation
      );

      return buildToolResult({
        nflTeamAbbreviation: derivedAbbreviation,
        // eslint-disable-next-line no-nested-ternary
        derivedFrom: nflTeamAbbreviation ? 'provided' : playerName ? `player:${playerName}` : 'teamRoster',
        startDate: startDate ?? defaultStart,
        endDate: endDate ?? defaultEnd,
        games: filtered
      });
    }
  );
}

export function createEspnMcpServer() {
  const config = loadConfiguration();

  const client = new ClientCtor({
    leagueId: config.leagueId,
    teamId: config.teamId,
    espnS2: config.espnS2,
    SWID: config.swid,
    scoringPeriodId: config.scoringPeriodId
  });

  const server = new McpServer({
    name: 'espn-fantasy-football-mcp',
    version: config.version
  });

  registerTools(server, client, config);

  return { server, client };
}

export async function startEspnMcpServer() {
  const { server } = createEspnMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return { server, transport };
}

if (require.main === module) {
  startEspnMcpServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}

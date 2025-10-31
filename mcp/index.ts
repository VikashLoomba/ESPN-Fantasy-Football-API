#!/usr/bin/env node
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
    async () => {
      const teams = await client.getTeamsAtWeek({
        seasonId: config.seasonId,
        scoringPeriodId: config.scoringPeriodId
      });
      return buildToolResult(teams);
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
}

export function createEspnMcpServer() {
  const config = loadConfiguration();

  const client = new ClientCtor({
    leagueId: config.leagueId,
    teamId: config.teamId,
    espnS2: config.espnS2,
    SWID: config.swid
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

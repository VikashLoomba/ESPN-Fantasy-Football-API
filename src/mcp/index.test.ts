import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { createEspnMcpServer } from '../../mcp/index';
import Client from '../../src/client/client.js';

jest.mock('dotenv', () => ({ config: jest.fn() }));

const ORIGINAL_ENV = { ...process.env };

describe('espn MCP server', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.TEAM_ID = '1';
    process.env.LEAGUE_ID = '2';
    process.env.ESPN_SWID = '{SWID}';
    process.env.ESPN_S2 = 'S2';
    process.env.npm_package_version = 'test-version';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws when a required environment variable is missing', () => {
    delete process.env.TEAM_ID;
    expect(() => createEspnMcpServer()).toThrow(/TEAM_ID/);
  });

  it('registers each public Client method as a tool', async () => {
    const { server } = createEspnMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const serverConnection = server.connect(serverTransport);
    const testClient = new McpClient({ name: 'test-client', version: '0.0.0-test' });

    await testClient.connect(clientTransport);
    await serverConnection;

    const response = await testClient.listTools();
    const toolNames = response.tools.map((tool) => tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        'setCookies',
        'getBoxscoreForWeek',
        'getDraftInfo',
        'getHistoricalScoreboardForWeek',
        'getFreeAgents',
        'getTeamsAtWeek',
        'getHistoricalTeamsAtWeek',
        'getNFLGamesForPeriod',
        'getLeagueInfo'
      ])
    );

    await testClient.close();
    await server.close();
  });

  it('invokes the underlying client method when a tool is called', async () => {
    const leagueInfo = { name: 'Test League' };
    const getLeagueInfoSpy = jest
      .spyOn(Client.prototype, 'getLeagueInfo')
      .mockResolvedValue(leagueInfo as never);

    const { server } = createEspnMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const serverConnection = server.connect(serverTransport);
    const testClient = new McpClient({ name: 'test-client', version: '0.0.0-test' });

    await testClient.connect(clientTransport);
    await serverConnection;

    const result = await testClient.callTool({
      name: 'getLeagueInfo',
      arguments: { seasonId: 2024 }
    });

    expect(getLeagueInfoSpy).toHaveBeenCalledWith({ seasonId: 2024 });
    expect(result.structuredContent).toMatchObject(leagueInfo);
    expect(result.content?.[0]?.text ?? '').toContain('Test League');

    await testClient.close();
    await server.close();
  });
});

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';

jest.mock('../../node.js', () => {
  const createMockClient = () => ({
    setCookies: jest.fn(),
    getBoxscoreForWeek: jest.fn(),
    getDraftInfo: jest.fn(),
    getHistoricalScoreboardForWeek: jest.fn(),
    getFreeAgents: jest.fn(),
    getTeamsAtWeek: jest.fn(),
    getHistoricalTeamsAtWeek: jest.fn(),
    getNFLGamesForPeriod: jest.fn(),
    getLeagueInfo: jest.fn()
  });

  const clients: Array<ReturnType<typeof createMockClient>> = [];
  const Client = jest.fn(() => {
    const client = createMockClient();
    clients.push(client);
    return client;
  });

  return { Client, __mockClients: clients };
});

jest.mock('dotenv', () => ({ config: jest.fn() }));

import { createEspnMcpServer } from '../../mcp/index';

const {
  Client: ClientMock,
  __mockClients: mockClients
} = jest.requireMock('../../node.js') as {
  Client: jest.Mock;
  __mockClients: Array<{
    setCookies: jest.Mock;
    getBoxscoreForWeek: jest.Mock;
    getDraftInfo: jest.Mock;
    getHistoricalScoreboardForWeek: jest.Mock;
    getFreeAgents: jest.Mock;
    getTeamsAtWeek: jest.Mock;
    getHistoricalTeamsAtWeek: jest.Mock;
    getNFLGamesForPeriod: jest.Mock;
    getLeagueInfo: jest.Mock;
  }>;
};

const ORIGINAL_ENV = { ...process.env };

describe('espn MCP server', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    ClientMock.mockClear();
    mockClients.splice(0, mockClients.length);
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

    const { server } = createEspnMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const serverConnection = server.connect(serverTransport);
    const testClient = new McpClient({ name: 'test-client', version: '0.0.0-test' });

    await testClient.connect(clientTransport);
    await serverConnection;

    const clientMock = mockClients[0];
    if (!clientMock) {
      throw new Error('Client mock not instantiated');
    }

    clientMock.getLeagueInfo.mockResolvedValue(leagueInfo as never);

    const result = await testClient.callTool({
      name: 'getLeagueInfo',
      arguments: { seasonId: 2024 }
    });

    const firstContent = Array.isArray(result.content) ? result.content[0] : undefined;
    let firstContentText = '';
    if (
      firstContent &&
      typeof firstContent === 'object' &&
      'text' in firstContent &&
      typeof firstContent.text === 'string'
    ) {
      firstContentText = firstContent.text;
    }

    expect(clientMock.getLeagueInfo).toHaveBeenCalledWith({ seasonId: 2024 });
    expect(result.structuredContent).toMatchObject(leagueInfo);
    expect(firstContentText).toContain('Test League');

    await testClient.close();
    await server.close();
  });
});

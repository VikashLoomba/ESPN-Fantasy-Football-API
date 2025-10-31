"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEspnMcpServer = createEspnMcpServer;
exports.startEspnMcpServer = startEspnMcpServer;
var dotenv_1 = require("dotenv");
var mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var zod_1 = require("zod");
var client_js_1 = require("../src/client/client.js");
var REQUIRED_ENV_VARS = ['TEAM_ID', 'LEAGUE_ID', 'ESPN_SWID', 'ESPN_S2'];
function loadConfiguration() {
    var _a;
    (0, dotenv_1.config)();
    var missingEnv = REQUIRED_ENV_VARS.filter(function (key) { return !process.env[key]; });
    if (missingEnv.length > 0) {
        throw new Error("Missing required environment variables: ".concat(missingEnv.join(', ')));
    }
    var teamId = Number(process.env.TEAM_ID);
    if (!Number.isInteger(teamId)) {
        throw new Error('TEAM_ID must be an integer.');
    }
    var leagueId = Number(process.env.LEAGUE_ID);
    if (!Number.isInteger(leagueId)) {
        throw new Error('LEAGUE_ID must be an integer.');
    }
    return {
        teamId: teamId,
        leagueId: leagueId,
        espnS2: process.env.ESPN_S2,
        swid: process.env.ESPN_SWID,
        version: (_a = process.env.npm_package_version) !== null && _a !== void 0 ? _a : '0.0.0'
    };
}
function toStructured(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch (_a) {
        return value;
    }
}
function buildToolResult(data) {
    var structured = toStructured(data);
    var text = typeof structured === 'string'
        ? structured
        : JSON.stringify(structured, null, 2);
    return {
        content: [
            {
                type: 'text',
                text: text
            }
        ],
        structuredContent: structured
    };
}
function registerTools(server, client) {
    var _this = this;
    server.tool('setCookies', {
        espnS2: zod_1.z.string(),
        SWID: zod_1.z.string()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var espnS2 = _b.espnS2, SWID = _b.SWID;
        return __generator(this, function (_c) {
            client.setCookies({ espnS2: espnS2, SWID: SWID });
            return [2 /*return*/, buildToolResult({ success: true })];
        });
    }); });
    server.tool('getBoxscoreForWeek', {
        seasonId: zod_1.z.number().int(),
        matchupPeriodId: zod_1.z.number().int(),
        scoringPeriodId: zod_1.z.number().int()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var boxscores;
        var seasonId = _b.seasonId, matchupPeriodId = _b.matchupPeriodId, scoringPeriodId = _b.scoringPeriodId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getBoxscoreForWeek({
                        seasonId: seasonId,
                        matchupPeriodId: matchupPeriodId,
                        scoringPeriodId: scoringPeriodId
                    })];
                case 1:
                    boxscores = _c.sent();
                    return [2 /*return*/, buildToolResult(boxscores)];
            }
        });
    }); });
    server.tool('getDraftInfo', {
        seasonId: zod_1.z.number().int(),
        scoringPeriodId: zod_1.z.number().int().optional()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var draftInfo;
        var seasonId = _b.seasonId, scoringPeriodId = _b.scoringPeriodId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getDraftInfo(scoringPeriodId !== undefined
                        ? { seasonId: seasonId, scoringPeriodId: scoringPeriodId }
                        : { seasonId: seasonId })];
                case 1:
                    draftInfo = _c.sent();
                    return [2 /*return*/, buildToolResult(draftInfo)];
            }
        });
    }); });
    server.tool('getHistoricalScoreboardForWeek', {
        seasonId: zod_1.z.number().int(),
        matchupPeriodId: zod_1.z.number().int(),
        scoringPeriodId: zod_1.z.number().int()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var scoreboard;
        var seasonId = _b.seasonId, matchupPeriodId = _b.matchupPeriodId, scoringPeriodId = _b.scoringPeriodId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getHistoricalScoreboardForWeek({
                        seasonId: seasonId,
                        matchupPeriodId: matchupPeriodId,
                        scoringPeriodId: scoringPeriodId
                    })];
                case 1:
                    scoreboard = _c.sent();
                    return [2 /*return*/, buildToolResult(scoreboard)];
            }
        });
    }); });
    server.tool('getFreeAgents', {
        seasonId: zod_1.z.number().int(),
        scoringPeriodId: zod_1.z.number().int()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var freeAgents;
        var seasonId = _b.seasonId, scoringPeriodId = _b.scoringPeriodId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getFreeAgents({
                        seasonId: seasonId,
                        scoringPeriodId: scoringPeriodId
                    })];
                case 1:
                    freeAgents = _c.sent();
                    return [2 /*return*/, buildToolResult(freeAgents)];
            }
        });
    }); });
    server.tool('getTeamsAtWeek', {
        seasonId: zod_1.z.number().int(),
        scoringPeriodId: zod_1.z.number().int()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var teams;
        var seasonId = _b.seasonId, scoringPeriodId = _b.scoringPeriodId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getTeamsAtWeek({
                        seasonId: seasonId,
                        scoringPeriodId: scoringPeriodId
                    })];
                case 1:
                    teams = _c.sent();
                    return [2 /*return*/, buildToolResult(teams)];
            }
        });
    }); });
    server.tool('getHistoricalTeamsAtWeek', {
        seasonId: zod_1.z.number().int(),
        scoringPeriodId: zod_1.z.number().int()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var teams;
        var seasonId = _b.seasonId, scoringPeriodId = _b.scoringPeriodId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getHistoricalTeamsAtWeek({
                        seasonId: seasonId,
                        scoringPeriodId: scoringPeriodId
                    })];
                case 1:
                    teams = _c.sent();
                    return [2 /*return*/, buildToolResult(teams)];
            }
        });
    }); });
    server.tool('getNFLGamesForPeriod', {
        startDate: zod_1.z.string().regex(/^\d{8}$/, 'startDate must be in YYYYMMDD format'),
        endDate: zod_1.z.string().regex(/^\d{8}$/, 'endDate must be in YYYYMMDD format')
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var games;
        var startDate = _b.startDate, endDate = _b.endDate;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getNFLGamesForPeriod({ startDate: startDate, endDate: endDate })];
                case 1:
                    games = _c.sent();
                    return [2 /*return*/, buildToolResult(games)];
            }
        });
    }); });
    server.tool('getLeagueInfo', {
        seasonId: zod_1.z.number().int()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var info;
        var seasonId = _b.seasonId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client.getLeagueInfo({ seasonId: seasonId })];
                case 1:
                    info = _c.sent();
                    return [2 /*return*/, buildToolResult(info)];
            }
        });
    }); });
}
function createEspnMcpServer() {
    var config = loadConfiguration();
    var client = new client_js_1.default({
        leagueId: config.leagueId,
        teamId: config.teamId,
        espnS2: config.espnS2,
        SWID: config.swid
    });
    var server = new mcp_js_1.McpServer({
        name: 'espn-fantasy-football-mcp',
        version: config.version
    });
    registerTools(server, client);
    return { server: server, client: client };
}
function startEspnMcpServer() {
    return __awaiter(this, void 0, void 0, function () {
        var server, transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    server = createEspnMcpServer().server;
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { server: server, transport: transport }];
            }
        });
    });
}
if (require.main === module) {
    startEspnMcpServer().catch(function (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        process.exit(1);
    });
}

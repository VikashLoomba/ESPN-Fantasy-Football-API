#!/usr/bin/env node
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEspnMcpServer = createEspnMcpServer;
exports.startEspnMcpServer = startEspnMcpServer;
var dotenv_1 = require("dotenv");
var mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var zod_1 = require("zod");
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
    var seasonIdRaw = process.env.SEASON_ID;
    var seasonId = seasonIdRaw ? Number(seasonIdRaw) : 2025;
    if (!Number.isInteger(seasonId)) {
        throw new Error('SEASON_ID must be an integer if provided.');
    }
    var scoringPeriodRaw = process.env.SCORING_PERIOD_ID;
    var scoringPeriodId = scoringPeriodRaw ? Number(scoringPeriodRaw) : 1;
    if (!Number.isInteger(scoringPeriodId)) {
        throw new Error('SCORING_PERIOD_ID must be an integer if provided.');
    }
    return {
        teamId: teamId,
        leagueId: leagueId,
        espnS2: process.env.ESPN_S2,
        swid: process.env.ESPN_SWID,
        version: (_a = process.env.npm_package_version) !== null && _a !== void 0 ? _a : '0.0.0',
        seasonId: seasonId,
        scoringPeriodId: scoringPeriodId
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
    var text;
    if (typeof structured === 'string') {
        text = structured;
    }
    else {
        text = JSON.stringify(structured, null, 2);
    }
    var structuredContent = structured && typeof structured === 'object' && !Array.isArray(structured) ?
        structured :
        { value: structured };
    return {
        content: [
            {
                type: 'text',
                text: text
            }
        ],
        structuredContent: structuredContent
    };
}
var ClientCtor;
try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    var bundled = require('../node.js');
    if (bundled && bundled.Client) {
        ClientCtor = bundled.Client;
    }
}
catch (error) {
    // Ignore missing bundle and fall back to source in test/dev environments.
}
if (!ClientCtor) {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    var sourceModule = require('../src/client/client.js');
    var fallback = (_b = (_a = sourceModule === null || sourceModule === void 0 ? void 0 : sourceModule.default) !== null && _a !== void 0 ? _a : sourceModule === null || sourceModule === void 0 ? void 0 : sourceModule.Client) !== null && _b !== void 0 ? _b : sourceModule;
    ClientCtor = fallback;
}
function registerTools(server, client, config) {
    var _this = this;
    var calculatePointTotal = function (stats) {
        if (!stats || typeof stats !== 'object') {
            return null;
        }
        var total = 0;
        var hasValue = false;
        Object.entries(stats).forEach(function (_a) {
            var key = _a[0], value = _a[1];
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
    var formatDate = function (date) { return date.toISOString().slice(0, 10).replace(/-/g, ''); };
    function fetchTeams(scoringPeriodId) {
        return __awaiter(this, void 0, void 0, function () {
            var teams;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, client.getTeamsAtWeek({
                            seasonId: config.seasonId,
                            scoringPeriodId: scoringPeriodId
                        })];
                    case 1:
                        teams = _a.sent();
                        return [2 /*return*/, teams];
                }
            });
        });
    }
    function fetchTeam(scoringPeriodId, teamId) {
        return __awaiter(this, void 0, void 0, function () {
            var teams;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetchTeams(scoringPeriodId)];
                    case 1:
                        teams = _a.sent();
                        return [2 /*return*/, {
                                teams: teams,
                                team: teams.find(function (entry) { return entry.id === teamId; })
                            }];
                }
            });
        });
    }
    function fetchLineup(scoringPeriodId) {
        return __awaiter(this, void 0, void 0, function () {
            var matchupPeriodId, boxscores, matchup, roster, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        matchupPeriodId = scoringPeriodId;
                        return [4 /*yield*/, client.getBoxscoreForWeek({
                                seasonId: config.seasonId,
                                scoringPeriodId: scoringPeriodId,
                                matchupPeriodId: matchupPeriodId
                            })];
                    case 1:
                        boxscores = _b.sent();
                        matchup = boxscores.find(function (entry) { return entry.homeTeamId === config.teamId || entry.awayTeamId === config.teamId; });
                        if (!matchup) {
                            return [2 /*return*/, new Map()];
                        }
                        roster = matchup.homeTeamId === config.teamId ? matchup.homeRoster : matchup.awayRoster;
                        return [2 /*return*/, new Map(roster.map(function (player) {
                                var _a;
                                return ([
                                    player.id,
                                    {
                                        rosteredPosition: (_a = player.rosteredPosition) !== null && _a !== void 0 ? _a : null,
                                        projectedPoints: calculatePointTotal(player.projectedPointBreakdown),
                                        totalPoints: typeof player.totalPoints === 'number' ? Number(player.totalPoints.toFixed(2)) : null
                                    }
                                ]);
                            }))];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, new Map()];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function buildRosterSummary(scoringPeriodId) {
        return __awaiter(this, void 0, void 0, function () {
            var team, lineupMap, roster;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetchTeam(scoringPeriodId, config.teamId)];
                    case 1:
                        team = (_a.sent()).team;
                        if (!team) {
                            throw new Error("Unable to locate team ".concat(config.teamId, " for scoring period ").concat(scoringPeriodId, "."));
                        }
                        return [4 /*yield*/, fetchLineup(scoringPeriodId)];
                    case 2:
                        lineupMap = _a.sent();
                        roster = team.roster.map(function (player) {
                            var _a, _b, _c, _d, _e;
                            var slotInfo = lineupMap.get(player.id);
                            var outlook = (_a = player.outlooksByWeek) === null || _a === void 0 ? void 0 : _a[String(scoringPeriodId)];
                            return {
                                id: player.id,
                                name: player.fullName,
                                defaultPosition: player.defaultPosition,
                                rosteredPosition: (_b = slotInfo === null || slotInfo === void 0 ? void 0 : slotInfo.rosteredPosition) !== null && _b !== void 0 ? _b : null,
                                proTeam: (_c = player.proTeamAbbreviation) !== null && _c !== void 0 ? _c : player.proTeam,
                                availabilityStatus: player.availabilityStatus,
                                injuryStatus: player.injuryStatus,
                                isInjured: player.isInjured,
                                outlook: outlook,
                                projectedPoints: (_d = slotInfo === null || slotInfo === void 0 ? void 0 : slotInfo.projectedPoints) !== null && _d !== void 0 ? _d : null,
                                totalPoints: (_e = slotInfo === null || slotInfo === void 0 ? void 0 : slotInfo.totalPoints) !== null && _e !== void 0 ? _e : null
                            };
                        });
                        return [2 /*return*/, {
                                team: {
                                    id: team.id,
                                    name: team.name,
                                    abbreviation: team.abbreviation,
                                    ownerName: team.ownerName
                                },
                                scoringPeriodId: scoringPeriodId,
                                roster: roster
                            }];
                }
            });
        });
    }
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
    server.tool('getBoxscoreForWeek', function () { return __awaiter(_this, void 0, void 0, function () {
        var boxscores;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.getBoxscoreForWeek({
                        seasonId: config.seasonId,
                        matchupPeriodId: config.scoringPeriodId,
                        scoringPeriodId: config.scoringPeriodId
                    })];
                case 1:
                    boxscores = _a.sent();
                    return [2 /*return*/, buildToolResult(boxscores)];
            }
        });
    }); });
    server.tool('getDraftInfo', function () { return __awaiter(_this, void 0, void 0, function () {
        var draftInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.getDraftInfo({
                        seasonId: config.seasonId,
                        scoringPeriodId: config.scoringPeriodId
                    })];
                case 1:
                    draftInfo = _a.sent();
                    return [2 /*return*/, buildToolResult(draftInfo)];
            }
        });
    }); });
    server.tool('getHistoricalScoreboardForWeek', function () { return __awaiter(_this, void 0, void 0, function () {
        var scoreboard;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.getHistoricalScoreboardForWeek({
                        seasonId: config.seasonId,
                        matchupPeriodId: config.scoringPeriodId,
                        scoringPeriodId: config.scoringPeriodId
                    })];
                case 1:
                    scoreboard = _a.sent();
                    return [2 /*return*/, buildToolResult(scoreboard)];
            }
        });
    }); });
    server.tool('getFreeAgents', function () { return __awaiter(_this, void 0, void 0, function () {
        var freeAgents;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.getFreeAgents({
                        seasonId: config.seasonId,
                        scoringPeriodId: config.scoringPeriodId
                    })];
                case 1:
                    freeAgents = _a.sent();
                    return [2 /*return*/, buildToolResult(freeAgents)];
            }
        });
    }); });
    server.tool('getTeamsAtWeek', {
        teamId: zod_1.z.number().int().optional(),
        scoringPeriodId: zod_1.z.number().int().optional(),
        includeAll: zod_1.z.boolean().optional()
    }, function () {
        var args_1 = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args_1[_i] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([], args_1, true), void 0, function (_a) {
            var effectiveScoringPeriodId, teams, targetTeamId, team;
            var _b = _a === void 0 ? {} : _a, teamId = _b.teamId, scoringPeriodId = _b.scoringPeriodId, includeAll = _b.includeAll;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        effectiveScoringPeriodId = scoringPeriodId !== null && scoringPeriodId !== void 0 ? scoringPeriodId : config.scoringPeriodId;
                        return [4 /*yield*/, fetchTeams(effectiveScoringPeriodId)];
                    case 1:
                        teams = _c.sent();
                        if (includeAll) {
                            return [2 /*return*/, buildToolResult({
                                    scoringPeriodId: effectiveScoringPeriodId,
                                    teams: teams
                                })];
                        }
                        targetTeamId = teamId !== null && teamId !== void 0 ? teamId : config.teamId;
                        if (!targetTeamId) {
                            return [2 /*return*/, buildToolResult({
                                    scoringPeriodId: effectiveScoringPeriodId,
                                    teams: teams
                                })];
                        }
                        team = teams.find(function (entry) { return entry.id === targetTeamId; });
                        if (!team) {
                            throw new Error("Team with id ".concat(targetTeamId, " not found for scoring period ").concat(effectiveScoringPeriodId, "."));
                        }
                        return [2 /*return*/, buildToolResult(team)];
                }
            });
        });
    });
    server.tool('getHistoricalTeamsAtWeek', function () { return __awaiter(_this, void 0, void 0, function () {
        var teams;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.getHistoricalTeamsAtWeek({
                        seasonId: config.seasonId,
                        scoringPeriodId: config.scoringPeriodId
                    })];
                case 1:
                    teams = _a.sent();
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
    server.tool('getLeagueInfo', function () { return __awaiter(_this, void 0, void 0, function () {
        var info;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.getLeagueInfo({ seasonId: config.seasonId })];
                case 1:
                    info = _a.sent();
                    return [2 /*return*/, buildToolResult(info)];
            }
        });
    }); });
    server.tool('getMyRoster', {
        scoringPeriodId: zod_1.z.number().int().optional()
    }, function () {
        var args_1 = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args_1[_i] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([], args_1, true), void 0, function (_a) {
            var effectiveScoringPeriodId, rosterSummary;
            var _b = _a === void 0 ? {} : _a, scoringPeriodId = _b.scoringPeriodId;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        effectiveScoringPeriodId = scoringPeriodId !== null && scoringPeriodId !== void 0 ? scoringPeriodId : config.scoringPeriodId;
                        return [4 /*yield*/, buildRosterSummary(effectiveScoringPeriodId)];
                    case 1:
                        rosterSummary = _c.sent();
                        return [2 /*return*/, buildToolResult(rosterSummary)];
                }
            });
        });
    });
    server.tool('getPlayerStatus', {
        playerName: zod_1.z.string(),
        scoringPeriodId: zod_1.z.number().int().optional()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var effectiveScoringPeriodId, rosterSummary, lowercaseQuery, player;
        var playerName = _b.playerName, scoringPeriodId = _b.scoringPeriodId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    effectiveScoringPeriodId = scoringPeriodId !== null && scoringPeriodId !== void 0 ? scoringPeriodId : config.scoringPeriodId;
                    return [4 /*yield*/, buildRosterSummary(effectiveScoringPeriodId)];
                case 1:
                    rosterSummary = _c.sent();
                    lowercaseQuery = playerName.toLowerCase();
                    player = rosterSummary.roster.find(function (entry) { return entry.name.toLowerCase() === lowercaseQuery; });
                    if (!player) {
                        player = rosterSummary.roster.find(function (entry) { return entry.name.toLowerCase().includes(lowercaseQuery); });
                    }
                    if (!player) {
                        throw new Error("Player \"".concat(playerName, "\" was not found on team ").concat(rosterSummary.team.name, "."));
                    }
                    return [2 /*return*/, buildToolResult({
                            team: rosterSummary.team,
                            scoringPeriodId: effectiveScoringPeriodId,
                            player: player
                        })];
            }
        });
    }); });
    server.tool('getTeamSchedule', {
        nflTeamAbbreviation: zod_1.z.string(),
        startDate: zod_1.z.string().regex(/^\d{8}$/, 'startDate must be in YYYYMMDD format').optional(),
        endDate: zod_1.z.string().regex(/^\d{8}$/, 'endDate must be in YYYYMMDD format').optional()
    }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var today, defaultStart, defaultEnd, games, filtered;
        var nflTeamAbbreviation = _b.nflTeamAbbreviation, startDate = _b.startDate, endDate = _b.endDate;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    today = new Date();
                    defaultStart = formatDate(today);
                    defaultEnd = formatDate(new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000)));
                    return [4 /*yield*/, client.getNFLGamesForPeriod({
                            startDate: startDate !== null && startDate !== void 0 ? startDate : defaultStart,
                            endDate: endDate !== null && endDate !== void 0 ? endDate : defaultEnd
                        })];
                case 1:
                    games = _c.sent();
                    filtered = games.filter(function (game) {
                        var _a, _b;
                        return ((_a = game.homeTeam) === null || _a === void 0 ? void 0 : _a.teamAbbrev) === nflTeamAbbreviation ||
                            ((_b = game.awayTeam) === null || _b === void 0 ? void 0 : _b.teamAbbrev) === nflTeamAbbreviation;
                    });
                    return [2 /*return*/, buildToolResult({
                            nflTeamAbbreviation: nflTeamAbbreviation,
                            startDate: startDate !== null && startDate !== void 0 ? startDate : defaultStart,
                            endDate: endDate !== null && endDate !== void 0 ? endDate : defaultEnd,
                            games: filtered
                        })];
            }
        });
    }); });
}
function createEspnMcpServer() {
    var config = loadConfiguration();
    var client = new ClientCtor({
        leagueId: config.leagueId,
        teamId: config.teamId,
        espnS2: config.espnS2,
        SWID: config.swid
    });
    var server = new mcp_js_1.McpServer({
        name: 'espn-fantasy-football-mcp',
        version: config.version
    });
    registerTools(server, client, config);
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

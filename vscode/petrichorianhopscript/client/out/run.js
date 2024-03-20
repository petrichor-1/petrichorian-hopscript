"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHSDebugServer = void 0;
// import * as vscode from 'vscode'
const fs = require("fs");
const hopscotchify_js_1 = require("../../../../core/hopscotchify.js");
const http = require("http");
const ws_1 = require("ws");
class PHSDebugServer {
    constructor(httpServer, wsServer, offset) {
        this.breakpoints = [];
        this._responseCallbacks = {};
        this._nextResponseId = 0;
        this.hasPlayed = false;
        this.httpServer = httpServer;
        this.offset = offset;
        wsServer.on("connection", connection => {
            this.webSocketConnection = connection;
            this.setBreakpoints(this.breakpoints);
            connection.on("message", messageData => {
                const data = JSON.parse(messageData.toString());
                switch (data.type) {
                    case "breakpoint":
                        const line = data.value.location.line - this.offset;
                        this.onBreakpointReachedAtLine(line, data.value.stateStack);
                        break;
                    case "response":
                        this._responseCallbacks[data.id](data.value);
                }
            });
        });
    }
    setBreakpointsFromNumbers(lines, source) {
        return this.setBreakpoints(lines.map(e => { return { line: e + this.offset, source: source }; }));
    }
    continue() {
        if (!this.webSocketConnection)
            return;
        this.webSocketConnection.send(JSON.stringify({ type: "continue" }));
    }
    stepToNextBlockInProject() {
        if (!this.webSocketConnection)
            return false;
        this.webSocketConnection.send(JSON.stringify({ type: "step", scope: "project" }));
        return true;
    }
    getVariablesOfBlockType(type, callback) {
        if (!this.webSocketConnection)
            return;
        const responseId = this.createResponseId();
        this._responseCallbacks[responseId] = callback;
        this.webSocketConnection.send(JSON.stringify({ type: "getvars", responseId, blockType: type }));
    }
    getStageObjectCloneIndicesForObjectWithID(id, callback) {
        if (!this.webSocketConnection)
            return;
        const responseId = this.createResponseId();
        this._responseCallbacks[responseId] = callback;
        this.webSocketConnection.send(JSON.stringify({ type: "getstageobjs", responseId, objectID: id }));
    }
    getVariablesForStageObject(id, cloneIndex, callback) {
        if (!this.webSocketConnection)
            return;
        const responseId = this.createResponseId();
        this._responseCallbacks[responseId] = callback;
        this.webSocketConnection.send(JSON.stringify({ type: "getobjectvars", responseId, objectID: id, cloneIndex }));
    }
    getLocalVariables(callback) {
        if (!this.webSocketConnection)
            return;
        const responseId = this.createResponseId();
        this._responseCallbacks[responseId] = callback;
        this.webSocketConnection.send(JSON.stringify({ type: "getlocals", responseId }));
    }
    getObjects(callback) {
        if (!this.webSocketConnection)
            return;
        const responseId = this.createResponseId();
        this._responseCallbacks[responseId] = callback;
        this.webSocketConnection.send(JSON.stringify({ type: "getobjects", responseId }));
    }
    createResponseId() {
        return this._nextResponseId++;
    }
    setBreakpoints(positions) {
        this.breakpoints = positions;
        if (!this.webSocketConnection)
            return;
        this.webSocketConnection.send(JSON.stringify({ type: "breakpoints", value: this.breakpoints }));
        if (this.hasPlayed)
            return;
        this.webSocketConnection.send(JSON.stringify({ type: "play" }));
        this.hasPlayed = true;
    }
    static async run(path) {
        const { server, offset } = await run(path);
        const wsServer = new ws_1.WebSocketServer({
            port: 1338
        });
        return new PHSDebugServer(server, wsServer, offset);
    }
}
exports.PHSDebugServer = PHSDebugServer;
async function run(path) {
    const fileFunctions = {
        read: (path) => fs.readFileSync(path).toString(),
        getHspreLikeFrom: (path, alreadyParsedPaths) => {
            if (path.endsWith('.hopscotch') || path.endsWith('.hspre'))
                return { hspreLike: JSON.parse(fs.readFileSync(path).toString()) };
            //TODO: hsprez
            const info = (0, hopscotchify_js_1.hopscotchify)(path, { checkParameterLabels: true, addBreakpointLines: true }, fileFunctions, alreadyParsedPaths);
            info.hspreLike = info.hopscotchified;
            return info;
        }
    };
    const options = { checkParameterLabels: true };
    const hsProject = (0, hopscotchify_js_1.hopscotchify)(path, options, fileFunctions, {}).hopscotchified;
    const versionInfo = await versionInfoForProject(hsProject);
    const server = http.createServer(async (message, response) => {
        response.writeHead(200);
        switch (message.url) {
            case "/project":
                try {
                    response.end(JSON.stringify(hsProject));
                }
                catch (error) {
                    response.end(error.toString());
                }
                break;
            case "/player.js":
                try {
                    response.end(await playerFor(versionInfo));
                }
                catch (error) {
                    response.end(error.toString());
                }
                break;
            default:
                try {
                    response.end(htmlOrGetFromFile(versionInfo));
                }
                catch (error) {
                    response.end(error.toString());
                }
        }
    });
    server.listen(1337, "localhost");
    // vscode.commands.executeCommand('js-debug-companion.launch', {browserType: "chrome", URL: "http://localhost:1337"})
    return { server, offset: 0 }; //fileMap[fileMap.length-1].starts}
}
let html;
function htmlOrGetFromFile(versionInfo) {
    if (!html)
        html = fs.readFileSync(__dirname + "/../player.html").toString();
    const pixiVersion = versionInfo.pixi;
    const pixiTag = `<script src="https://d3nbkco6xo1vz0.cloudfront.net/production/pixi/${pixiVersion}/pixi.min.js"></script>`;
    return html.replace(/__PETRICHOR__PIXI_SCRIPT__TAG__/, pixiTag);
}
let index;
async function getIndex() {
    if (!index) {
        const indexResponse = await fetch("https://d3nbkco6xo1vz0.cloudfront.net/production/EDITOR_INDEX");
        const gottenIndex = await indexResponse.json();
        if (!gottenIndex)
            return null;
        index = gottenIndex;
    }
    return index;
}
async function versionInfoForProject(hsProject) {
    const playerVersion = hsProject.playerVersion;
    if (!playerVersion)
        return "throw 'No player version!'";
    const index = await getIndex();
    if (!index)
        return "throw 'No index!'";
    return index.editor_table.webplayers[playerVersion];
}
let players = {};
async function playerFor(versionInfo) {
    return fs.readFileSync(__dirname + "/../webplayer.min.js").toString();
    const playerVersion = versionInfo.path;
    if (!players[playerVersion]) {
        const url = `https://d3nbkco6xo1vz0.cloudfront.net/production/${versionInfo.path}`;
        const player = await (await fetch(url)).text();
        players[playerVersion] = player;
    }
    return players[playerVersion];
}
//# sourceMappingURL=run.js.map
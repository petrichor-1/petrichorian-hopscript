"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
// import * as vscode from 'vscode'
const fs = require("fs");
const preludeify = require("../../../../core/preludeify.js");
const hopscotchify_js_1 = require("../../../../core/hopscotchify.js");
const http = require("http");
async function run(path) {
    // if (!vscode.workspace.isTrusted)
    // 	return // I don't think this is necessary, but it can't hurt
    const fullPath = path; //vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, path)
    const code = fs.readFileSync(fullPath /*.fsPath*/).toString();
    const { htnCode } = preludeify(code);
    const hsProject = (0, hopscotchify_js_1.hopscotchify)(htnCode, { checkParameterLabels: true });
    const versionInfo = await versionInfoForProject(hsProject);
    const server = http.createServer(async (message, response) => {
        response.writeHead(200);
        switch (message.url) {
            case "/project":
                response.end(JSON.stringify(hsProject));
                break;
            case "/player.js":
                response.end(await playerFor(versionInfo));
                break;
            default:
                response.end(htmlOrGetFromFile(versionInfo));
        }
    });
    server.listen(1337, "localhost");
    // vscode.commands.executeCommand('js-debug-companion.launch', {browserType: "chrome", URL: "http://localhost:1337"})
    return server;
}
exports.run = run;
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
    const playerVersion = versionInfo.path;
    if (!players[playerVersion]) {
        const url = `https://d3nbkco6xo1vz0.cloudfront.net/production/${versionInfo.path}`;
        const player = await (await fetch(url)).text();
        players[playerVersion] = player;
    }
    return players[playerVersion];
}
//# sourceMappingURL=run.js.map
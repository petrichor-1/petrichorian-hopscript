// import * as vscode from 'vscode'
import * as fs from 'fs'
import {hopscotchify} from '../../../../core/hopscotchify.js'
import * as http from 'http'
import {WebSocketServer} from 'ws'

interface PHSBreakpointPosition {
	line: number,
	source: string
}

export class PHSDebugServer {
	httpServer: http.Server
	webSocketConnection: any
	breakpoints: PHSBreakpointPosition[] = []
	offset: number //Temporary
	onBreakpointReachedAtLine: ((line: number, stateStack: any[]) => void) | undefined
	constructor(httpServer: http.Server, wsServer: WebSocketServer, offset: number) {
		this.httpServer = httpServer
		this.offset = offset
		wsServer.on("connection", connection => {
			this.webSocketConnection = connection
			this.setBreakpoints(this.breakpoints)
			connection.on("message", messageData => {
				const data = JSON.parse(messageData.toString())
				switch (data.type) {
				case "breakpoint":
					const line = data.value.location.line-this.offset
					this.onBreakpointReachedAtLine(line, data.value.stateStack)
					break
				case "response":
					this._responseCallbacks[data.id](data.value)
				}
			})
		})
	}
	public setBreakpointsFromNumbers(lines: number[], source: string) {
		return this.setBreakpoints(lines.map(e=>{return {line:e+this.offset, source: source}}))
	}
	public continue() {
		if (!this.webSocketConnection)
			return
		this.webSocketConnection.send(JSON.stringify({type:"continue"}))
	}
	public stepToNextBlockInProject(): boolean {
		if (!this.webSocketConnection)
			return false
		this.webSocketConnection.send(JSON.stringify({type:"step",scope:"project"}))
		return true
	}
	public getVariablesOfBlockType(type: number, callback: (variables: any) => undefined) {
		if (!this.webSocketConnection)
			return
		const responseId = this.createResponseId()
		this._responseCallbacks[responseId] = callback
		this.webSocketConnection.send(JSON.stringify({type:"getvars",responseId,blockType:type}))
	}
	public getStageObjectCloneIndicesForObjectWithID(id: string, callback: (objects: any) => undefined) {
		if (!this.webSocketConnection)
			return
		const responseId = this.createResponseId()
		this._responseCallbacks[responseId] = callback
		this.webSocketConnection.send(JSON.stringify({type:"getstageobjs",responseId, objectID: id}))
	}
	public getVariablesForStageObject(id: string, cloneIndex: number, callback: (variables: any) => undefined) {
		if (!this.webSocketConnection)
			return
		const responseId = this.createResponseId()
		this._responseCallbacks[responseId] = callback
		this.webSocketConnection.send(JSON.stringify({type:"getobjectvars",responseId, objectID: id, cloneIndex}))
	}
	public getLocalVariables(callback: (variables: any) => undefined) {
		if (!this.webSocketConnection)
			return
		const responseId = this.createResponseId()
		this._responseCallbacks[responseId] = callback
		this.webSocketConnection.send(JSON.stringify({type:"getlocals",responseId}))
	}
	public getObjects(callback: (objects: any) => undefined) {
		if (!this.webSocketConnection)
			return
		const responseId = this.createResponseId()
		this._responseCallbacks[responseId] = callback
		this.webSocketConnection.send(JSON.stringify({type:"getobjects",responseId}))
	}
	private _responseCallbacks: any = {}
	private _nextResponseId: number = 0
	private createResponseId(): number {
		return this._nextResponseId++
	}
	private hasPlayed = false
	private setBreakpoints(positions: PHSBreakpointPosition[]) {
		this.breakpoints = positions
		if (!this.webSocketConnection)
			return
		this.webSocketConnection.send(JSON.stringify({type: "breakpoints", value: this.breakpoints}))
		if (this.hasPlayed)
			return
		this.webSocketConnection.send(JSON.stringify({type:"play"}))
		this.hasPlayed = true
	}
	static async run(path:string): Promise<PHSDebugServer> {
		const {server, offset} = await run(path)
		const wsServer = new WebSocketServer({
			port: 1338
		});
		return new PHSDebugServer(server, wsServer, offset)
	}
}
async function run(path: string): Promise<any> {
	const fileFunctions = {
		read: (path: string) => fs.readFileSync(path).toString(),
		getHspreLikeFrom: (path: string, alreadyParsedPaths: any) => {
			if (path.endsWith('.hopscotch') || path.endsWith('.hspre'))
				return {hspreLike: JSON.parse(fs.readFileSync(path).toString())}
			//TODO: hsprez
			const info = hopscotchify(path, {checkParameterLabels: true, addBreakpointLines: true}, fileFunctions, alreadyParsedPaths)
			info.hspreLike = info.hopscotchified
			return info
		}
	}
	const options = {checkParameterLabels: true}
	const hsProject = hopscotchify(path, options, fileFunctions, {}).hopscotchified
	const versionInfo = await versionInfoForProject(hsProject)
	const server = http.createServer(async (message, response) => {
		response.writeHead(200)
		switch (message.url) {
		case "/project": 
			try {
				response.end(JSON.stringify(hsProject))
			} catch(error) {
				response.end(error.toString())
			}
			break
		case "/player.js":
			try {
				response.end(await playerFor(versionInfo))
			} catch(error) {
				response.end(error.toString())
			}
			break
		default:
			try {
				response.end(htmlOrGetFromFile(versionInfo))
			} catch(error) {
				response.end(error.toString())
			}
		}
	})
	server.listen(1337, "localhost")
	// vscode.commands.executeCommand('js-debug-companion.launch', {browserType: "chrome", URL: "http://localhost:1337"})
	return {server, offset: 0}//fileMap[fileMap.length-1].starts}
}

let html: String
function htmlOrGetFromFile(versionInfo: any): String {
	if (!html)
		html = fs.readFileSync(__dirname + "/../player.html").toString()
	const pixiVersion = versionInfo.pixi
	const pixiTag = `<script src="https://d3nbkco6xo1vz0.cloudfront.net/production/pixi/${pixiVersion}/pixi.min.js"></script>`
	return html.replace(/__PETRICHOR__PIXI_SCRIPT__TAG__/,pixiTag)
}
let index: any
async function getIndex(): Promise<any> {
	if (!index) {
		const indexResponse = await fetch("https://d3nbkco6xo1vz0.cloudfront.net/production/EDITOR_INDEX")
		const gottenIndex = await indexResponse.json()
		if (!gottenIndex)
			return null
		index = gottenIndex
	}
	return index
}
async function versionInfoForProject(hsProject): Promise<any> {
	const playerVersion = hsProject.playerVersion
	if (!playerVersion)
		return "throw 'No player version!'"
	const index = await getIndex()
	if (!index)
		return "throw 'No index!'"
	return index.editor_table.webplayers[playerVersion]
}
let players: any = {}
async function playerFor(versionInfo: any): Promise<string> {
	return fs.readFileSync(__dirname+"/../webplayer.min.js").toString()
	const playerVersion = versionInfo.path
	if (!players[playerVersion]) {
		const url = `https://d3nbkco6xo1vz0.cloudfront.net/production/${versionInfo.path}`
		const player = await (await fetch(url)).text()
		players[playerVersion] = player
	}
	return players[playerVersion]
}
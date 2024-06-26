"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HopscriptDebugSession = void 0;
const debugadapter_1 = require("@vscode/debugadapter");
const await_notify_1 = require("await-notify");
const run_1 = require("./run");
class HSObject {
    constructor(id) {
        this.id = id;
    }
}
class HSClone {
    constructor(id, cloneIndex) {
        this.id = id;
        this.cloneIndex = cloneIndex;
    }
}
class HopscriptDebugSession extends debugadapter_1.LoggingDebugSession {
    constructor() {
        super(...arguments);
        // a Mock runtime (or debugger)
        // private _runtime: HopscriptRuntime;
        this._configurationDone = new await_notify_1.Subject();
        this._variableHandles = new debugadapter_1.Handles();
    }
    /**
     * The 'initialize' request is the first request called by the frontend
     * to interrogate the features the debug adapter provides.
     */
    initializeRequest(response, args) {
        // build and return the capabilities of this debug adapter:
        response.body = response.body || {};
        // the adapter implements the configurationDone request.
        response.body.supportsConfigurationDoneRequest = true;
        this.sendResponse(response);
        // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
        // we request them early by sending an 'initializeRequest' to the frontend.
        // The frontend will end the configuration sequence by calling 'configurationDone' request.
        this.sendEvent(new debugadapter_1.InitializedEvent());
    }
    /**
     * Called at the end of the configuration sequence.
     * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
     */
    configurationDoneRequest(response, args) {
        super.configurationDoneRequest(response, args);
        // notify the launchRequest that configuration has finished
        this._configurationDone.notify();
    }
    disconnectRequest(response, args, request) {
        console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
    }
    async attachRequest(response, args) {
        return this.launchRequest(response, args);
    }
    async launchRequest(response, args) {
        debugadapter_1.logger.setup(debugadapter_1.Logger.LogLevel.Verbose, false);
        this.program = args.program;
        // wait 1 second until configuration has finished (and configurationDoneRequest has been called)
        await this._configurationDone.wait(1000);
        console.log("HELLO");
        try {
            this.server = await run_1.PHSDebugServer.run(args.program);
            this.server.onBreakpointReachedAtLine = (line, stateStack, source) => {
                this.latestStateStack = stateStack;
                this.sendEvent(new debugadapter_1.StoppedEvent('breakpoint at ' + line + ` in ${source}`, 1));
            };
            if (this.waitingBreakpointLines)
                this.server.setBreakpointsFromNumbers(this.waitingBreakpointLines, this.waitingBreakpointSource);
        }
        catch (error) {
            this.sendErrorResponse(response, error.toString());
            return;
        }
        // this.sendErrorResponse(response,1)
        this.sendResponse(response);
    }
    async setBreakPointsRequest(response, args, request) {
        if (this.server) {
            this.server.setBreakpointsFromNumbers(args.lines, args.source.path);
        }
        else {
            this.waitingBreakpointLines = args.lines;
            this.waitingBreakpointSource = args.source.path;
        }
        // pretend to verify breakpoint locations
        const actualBreakpoints0 = args.lines.map(async (l) => {
            const bp = new debugadapter_1.Breakpoint(true, l);
            bp.id = l;
            return bp;
        });
        const actualBreakpoints = await Promise.all(actualBreakpoints0);
        response.body = {
            breakpoints: actualBreakpoints
        };
        this.sendResponse(response);
    }
    threadsRequest(response) {
        // runtime supports no threads so just return a default thread.
        response.body = {
            threads: [
                new debugadapter_1.Thread(1, "Thread")
            ]
        };
        this.sendResponse(response);
    }
    stackTraceRequest(response, args) {
        if (!this.latestStateStack)
            return this.sendErrorResponse(response, 1);
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
        const endFrame = startFrame + maxLevels;
        const PetrichorPossibleFrameProgressStates = {
            preFrame: 0,
            stageProject: 1,
            stageScene: 2,
            stageRuleGroups: 3,
            inRuleGroup: 4,
            ruleInRuleGroup: 5,
            inRule: 6,
            inStageScript: 7,
            inExecutable: 8,
            inCustomRuleGroups: 9,
        };
        function nameForState(state) {
            switch (state.id) {
                case PetrichorPossibleFrameProgressStates.ruleInRuleGroup:
                    return `Rule #${state.ruleIndex}`;
                case PetrichorPossibleFrameProgressStates.inExecutable:
                    return `Block ${state.blockTypeName}(${state.parameterCount} parameters)`;
                default:
                    return "Unknown" + JSON.stringify(state);
            }
        }
        const result = [];
        for (let i = startFrame; result.length < endFrame && i < this.latestStateStack.length; i++) {
            const state = this.latestStateStack[i];
            if (![PetrichorPossibleFrameProgressStates.ruleInRuleGroup, PetrichorPossibleFrameProgressStates.inExecutable].includes(state.id))
                continue;
            result.push(state);
        }
        response.body = {
            stackFrames: result.map((state, ix) => {
                return new debugadapter_1.StackFrame(ix, nameForState(state), new debugadapter_1.Source(state.location?.source || "Unknown", state.location?.source || "Unknown"), (state.location?.start?.line || 0) - this.server.offset, state.location?.start?.column || 0);
            }).reverse(),
            totalFrames: result.length
        };
        this.sendResponse(response);
    }
    continueRequest(response, args) {
        this.server.continue();
        this.sendResponse(response);
    }
    stepInRequest(response, args) {
        if (!this.server.stepToNextBlockInProject())
            return this.sendErrorResponse(response, 1);
        this.sendResponse(response);
    }
    scopesRequest(response, args) {
        response.body = {
            scopes: [
                new debugadapter_1.Scope("Local", this._variableHandles.create("Local")),
                new debugadapter_1.Scope("Self", this._variableHandles.create("Self")),
                new debugadapter_1.Scope("Original_object", this._variableHandles.create("Original_object")),
                new debugadapter_1.Scope("Game", this._variableHandles.create("Game")),
                new debugadapter_1.Scope("Other objects", this._variableHandles.create("Objects"))
            ]
        };
        this.sendResponse(response);
    }
    async variablesRequest(response, args, request) {
        const scope = this._variableHandles.get(args.variablesReference);
        const gotVars = variables => {
            response.body = { variables: variables.map(v => {
                    const dapVariable = {
                        name: v.name,
                        value: `"${v.value}"`,
                        variablesReference: 0
                    };
                    return dapVariable;
                }) };
            this.sendResponse(response);
        };
        switch (scope) {
            case "Game":
                return this.server.getVariablesOfBlockType(8003, gotVars); // HSBlockType.Game
            case "Self":
                return this.server.getVariablesOfBlockType(8004, gotVars); // HSBlockType.Self
            case "Local":
                return this.server.getLocalVariables(gotVars);
            case "Original_object":
                return this.server.getVariablesOfBlockType(8005, gotVars); // HSBlockType.OriginalObject
            case "Objects":
                return this.server.getObjects(objects => {
                    response.body = { variables: objects.map(v => {
                            const dapVariable = {
                                name: v.name,
                                value: `text("${v.text}")`,
                                variablesReference: this._variableHandles.create(new HSObject(v.id)),
                            };
                            return dapVariable;
                        }) };
                    this.sendResponse(response);
                });
            default:
                if (scope instanceof HSObject) {
                    const hsObject = scope;
                    return this.server.getStageObjectCloneIndicesForObjectWithID(hsObject.id, objects => {
                        response.body = { variables: objects.map(v => {
                                const dapVariable = {
                                    name: v.name,
                                    value: `clone #${v.cloneIndex}`,
                                    variablesReference: this._variableHandles.create(new HSClone(v.id, v.cloneIndex)),
                                };
                                return dapVariable;
                            }) };
                        this.sendResponse(response);
                    });
                }
                else if (scope instanceof HSClone) {
                    const hsClone = scope;
                    return this.server.getVariablesForStageObject(hsClone.id, hsClone.cloneIndex, gotVars);
                }
                else {
                    return this.sendErrorResponse(response, 2);
                }
        }
        // response.body = {
        // 	variables: vs.map(v => this.convertFromRuntime(v))
        // };
        // this.sendResponse(response);
    }
}
exports.HopscriptDebugSession = HopscriptDebugSession;
//# sourceMappingURL=phsDebug.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HopscriptDebugSession = void 0;
const debugadapter_1 = require("@vscode/debugadapter");
const await_notify_1 = require("await-notify");
const run_1 = require("./run");
class HopscriptDebugSession extends debugadapter_1.LoggingDebugSession {
    constructor() {
        super(...arguments);
        // a Mock runtime (or debugger)
        // private _runtime: HopscriptRuntime;
        this._configurationDone = new await_notify_1.Subject();
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
        // wait 1 second until configuration has finished (and configurationDoneRequest has been called)
        await this._configurationDone.wait(1000);
        console.log("HELLO");
        try {
            await (0, run_1.run)(args.program);
        }
        catch (error) {
            this.sendErrorResponse(response, error.toString());
        }
        this.sendResponse(response);
    }
}
exports.HopscriptDebugSession = HopscriptDebugSession;
//# sourceMappingURL=phsDebug.js.map
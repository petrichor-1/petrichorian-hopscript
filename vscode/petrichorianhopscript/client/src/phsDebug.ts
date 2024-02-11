import {
	Logger, logger,
	LoggingDebugSession,
	InitializedEvent,
	Breakpoint,
	StoppedEvent,
	Thread,
	StackFrame
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { Subject } from 'await-notify';
import { PHSDebugServer } from './run';
import * as http from 'http'

export class HopscriptDebugSession extends LoggingDebugSession {
	// a Mock runtime (or debugger)
	// private _runtime: HopscriptRuntime;
	private _configurationDone = new Subject();

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		// build and return the capabilities of this debug adapter:
		response.body = response.body || {};

		// the adapter implements the configurationDone request.
		response.body.supportsConfigurationDoneRequest = true;

		this.sendResponse(response);

		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify();
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
		console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
	}

	protected async attachRequest(response: DebugProtocol.AttachResponse, args: any) {
		return this.launchRequest(response, args);
	}

	server: PHSDebugServer | undefined
	waitingBreakpointLines: number[]
	latestStateStack: any[]
	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: any) {
		logger.setup(Logger.LogLevel.Verbose, false);

		// wait 1 second until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait(1000);
		console.log("HELLO")
		try {
			this.server = await PHSDebugServer.run(args.program)
			this.server.onBreakpointReachedAtLine = (line, stateStack) => {
				this.latestStateStack = stateStack
				this.sendEvent(new StoppedEvent('breakpoint at ' + line, 1))
			}
			if (this.waitingBreakpointLines)
				this.server.setBreakpointsFromNumbers(this.waitingBreakpointLines)
		} catch(error) {
			this.sendErrorResponse(response,error.toString())
		}
		
		this.sendResponse(response);
	}

	protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request): Promise<void> {
		if (this.server) {
			this.server.setBreakpointsFromNumbers(args.lines)
		} else {
			this.waitingBreakpointLines = args.lines
		}
		// pretend to verify breakpoint locations
		const actualBreakpoints0 = args.lines.map(async l => {
			const bp = new Breakpoint(true, l) as DebugProtocol.Breakpoint;
			bp.id = l;
			return bp;
		});
		const actualBreakpoints = await Promise.all<DebugProtocol.Breakpoint>(actualBreakpoints0);
		response.body = {
			breakpoints: actualBreakpoints
		};
		this.sendResponse(response)
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		// runtime supports no threads so just return a default thread.
		response.body = {
			threads: [
				new Thread(1,"Thread")
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		if (!this.latestStateStack)
			return this.sendErrorResponse(response, 1)
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
		}
		function nameForState(state: any) {
			switch (state.id) {
			case PetrichorPossibleFrameProgressStates.ruleInRuleGroup:
				return `Rule #${state.ruleIndex}`
			case PetrichorPossibleFrameProgressStates.inExecutable:
				return `Block ${state.blockTypeName}(${state.parameterCount} parameters)`
			default:
				return "Unknown" + JSON.stringify(state)
			}
		}
		const result = []
		for (let i = startFrame; result.length < endFrame && i < this.latestStateStack.length; i++) {
			const state = this.latestStateStack[i]
			if (![PetrichorPossibleFrameProgressStates.ruleInRuleGroup, PetrichorPossibleFrameProgressStates.inExecutable].includes(state.id))
				continue
			result.push(state)
		}

		response.body = {
			stackFrames: result.map((state, ix) => {
				const sf: DebugProtocol.StackFrame = new StackFrame(ix, nameForState(state), state.location?.file, state.location?.line, state.location?.column)
				return sf;
			}),
			totalFrames: result.length
		};
		this.sendResponse(response);
	}
	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.server.continue()
		this.sendResponse(response);
	}
}


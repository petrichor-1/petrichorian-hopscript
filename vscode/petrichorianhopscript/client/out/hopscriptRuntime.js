// import { EventEmitter } from 'events';
// 
// interface Word {
// 	name: string;
// 	line: number;
// 	index: number;
// }
// 
// export function timeout(ms: number) {
// 	return new Promise(resolve => setTimeout(resolve, ms));
// }
// 
// 
// export class MockRuntime extends EventEmitter {
// 	/**
// 	 * Start executing the given program.
// 	 */
// 	public async start(program: string): Promise<void> {
// 		await this.loadSource(this.normalizePathAndCasing(program));
// 	}
// 
// 	private async loadSource(file: string): Promise<void> {
// 		if (this._sourceFile !== file) {
// 			this._sourceFile = this.normalizePathAndCasing(file);
// 			this.initializeContents(await this.fileAccessor.readFile(file));
// 		}
// 	}
// 
// 	private initializeContents(memory: Uint8Array) {
// 		
// 	}
// 
// 	/**
// 	 * return true on stop
// 	 */
// 	 private findNextStatement(reverse: boolean, stepEvent?: string): boolean {
// 
// 		for (let ln = this.currentLine; reverse ? ln >= 0 : ln < this.sourceLines.length; reverse ? ln-- : ln++) {
// 
// 			// is there a source breakpoint?
// 			const breakpoints = this.breakPoints.get(this._sourceFile);
// 			if (breakpoints) {
// 				const bps = breakpoints.filter(bp => bp.line === ln);
// 				if (bps.length > 0) {
// 
// 					// send 'stopped' event
// 					this.sendEvent('stopOnBreakpoint');
// 
// 					// the following shows the use of 'breakpoint' events to update properties of a breakpoint in the UI
// 					// if breakpoint is not yet verified, verify it now and send a 'breakpoint' update event
// 					if (!bps[0].verified) {
// 						bps[0].verified = true;
// 						this.sendEvent('breakpointValidated', bps[0]);
// 					}
// 
// 					this.currentLine = ln;
// 					return true;
// 				}
// 			}
// 
// 			const line = this.getLine(ln);
// 			if (line.length > 0) {
// 				this.currentLine = ln;
// 				break;
// 			}
// 		}
// 		if (stepEvent) {
// 			this.sendEvent(stepEvent);
// 			return true;
// 		}
// 		return false;
// 	}
// 
// 	/**
// 	 * "execute a line" of the readme markdown.
// 	 * Returns true if execution sent out a stopped event and needs to stop.
// 	 */
// 	private executeLine(ln: number, reverse: boolean): boolean {
// 
// 		// first "execute" the instructions associated with this line and potentially hit instruction breakpoints
// 		while (reverse ? this.instruction >= this.starts[ln] : this.instruction < this.ends[ln]) {
// 			reverse ? this.instruction-- : this.instruction++;
// 			if (this.instructionBreakpoints.has(this.instruction)) {
// 				this.sendEvent('stopOnInstructionBreakpoint');
// 				return true;
// 			}
// 		}
// 
// 		const line = this.getLine(ln);
// 
// 		// find variable accesses
// 		let reg0 = /\$([a-z][a-z0-9]*)(=(false|true|[0-9]+(\.[0-9]+)?|\".*\"|\{.*\}))?/ig;
// 		let matches0: RegExpExecArray | null;
// 		while (matches0 = reg0.exec(line)) {
// 			if (matches0.length === 5) {
// 
// 				let access: string | undefined;
// 
// 				const name = matches0[1];
// 				const value = matches0[3];
// 
// 				let v = new RuntimeVariable(name, value);
// 
// 				if (value && value.length > 0) {
// 
// 					if (value === 'true') {
// 						v.value = true;
// 					} else if (value === 'false') {
// 						v.value = false;
// 					} else if (value[0] === '"') {
// 						v.value = value.slice(1, -1);
// 					} else if (value[0] === '{') {
// 						v.value = [
// 							new RuntimeVariable('fBool', true),
// 							new RuntimeVariable('fInteger', 123),
// 							new RuntimeVariable('fString', 'hello'),
// 							new RuntimeVariable('flazyInteger', 321)
// 						];
// 					} else {
// 						v.value = parseFloat(value);
// 					}
// 
// 					if (this.variables.has(name)) {
// 						// the first write access to a variable is the "declaration" and not a "write access"
// 						access = 'write';
// 					}
// 					this.variables.set(name, v);
// 				} else {
// 					if (this.variables.has(name)) {
// 						// variable must exist in order to trigger a read access
// 						access = 'read';
// 					}
// 				}
// 
// 				const accessType = this.breakAddresses.get(name);
// 				if (access && accessType && accessType.indexOf(access) >= 0) {
// 					this.sendEvent('stopOnDataBreakpoint', access);
// 					return true;
// 				}
// 			}
// 		}
// 
// 		// if 'log(...)' found in source -> send argument to debug console
// 		const reg1 = /(log|prio|out|err)\(([^\)]*)\)/g;
// 		let matches1: RegExpExecArray | null;
// 		while (matches1 = reg1.exec(line)) {
// 			if (matches1.length === 3) {
// 				this.sendEvent('output', matches1[1], matches1[2], this._sourceFile, ln, matches1.index);
// 			}
// 		}
// 
// 		// if pattern 'exception(...)' found in source -> throw named exception
// 		const matches2 = /exception\((.*)\)/.exec(line);
// 		if (matches2 && matches2.length === 2) {
// 			const exception = matches2[1].trim();
// 			if (this.namedException === exception) {
// 				this.sendEvent('stopOnException', exception);
// 				return true;
// 			} else {
// 				if (this.otherExceptions) {
// 					this.sendEvent('stopOnException', undefined);
// 					return true;
// 				}
// 			}
// 		} else {
// 			// if word 'exception' found in source -> throw exception
// 			if (line.indexOf('exception') >= 0) {
// 				if (this.otherExceptions) {
// 					this.sendEvent('stopOnException', undefined);
// 					return true;
// 				}
// 			}
// 		}
// 
// 		// nothing interesting found -> continue
// 		return false;
// 	}
// 
// 	private async verifyBreakpoints(path: string): Promise<void> {
// 
// 		const bps = this.breakPoints.get(path);
// 		if (bps) {
// 			await this.loadSource(path);
// 			bps.forEach(bp => {
// 				if (!bp.verified && bp.line < this.sourceLines.length) {
// 					const srcLine = this.getLine(bp.line);
// 
// 					// if a line is empty or starts with '+' we don't allow to set a breakpoint but move the breakpoint down
// 					if (srcLine.length === 0 || srcLine.indexOf('+') === 0) {
// 						bp.line++;
// 					}
// 					// if a line starts with '-' we don't allow to set a breakpoint but move the breakpoint up
// 					if (srcLine.indexOf('-') === 0) {
// 						bp.line--;
// 					}
// 					// don't set 'verified' to true if the line contains the word 'lazy'
// 					// in this case the breakpoint will be verified 'lazy' after hitting it once.
// 					if (srcLine.indexOf('lazy') < 0) {
// 						bp.verified = true;
// 						this.sendEvent('breakpointValidated', bp);
// 					}
// 				}
// 			});
// 		}
// 	}
// 
// 	private sendEvent(event: string, ... args: any[]): void {
// 		setTimeout(() => {
// 			this.emit(event, ...args);
// 		}, 0);
// 	}
// 
// 	private normalizePathAndCasing(path: string) {
// 		if (this.fileAccessor.isWindows) {
// 			return path.replace(/\//g, '\\').toLowerCase();
// 		} else {
// 			return path.replace(/\\/g, '/');
// 		}
// 	}
// }
//# sourceMappingURL=hopscriptRuntime.js.map
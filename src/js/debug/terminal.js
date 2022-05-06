import { wrenJSONToJS } from "../json.js";
import { callHandle_toString } from "../vm-call-handles.js";
import { wrenCall, wrenEnsureSlots, wrenGetSlotString, wrenGetVariable, wrenHasVariable, wrenInterpret } from "../vm.js";

let init = false;
let terminalModule = "_terminal";

/**
 * @param {any} args
 * @returns {any} result
 */
export function terminalInterpret(...args) {
	let a = args[0];

	if (typeof a === "string") {
		return interpret(a);
	} else if (a.raw && a.map) {
		let raw = a.raw;
		let script = "";

		for (let i = 0; i < raw.length; i++) {
			if (i > 0) {
				script += a[i];
			}

			script += raw[i];
		}

		return interpret(script);
	} else {
		console.error(a);
		throw TypeError("call like this: wren`script`");
	}
}

/**
 * @param {string} s
 * @returns {any} result
 */
function interpret(s) {
	if (!init) {
		init = true;
		wrenInterpret(terminalModule, "var r__");
	}

	s = s.trim();

	let maybeExpression = false;

	if (!s.includes("\n")) {
		// Single line
		if (s.startsWith("var ")) {
			// Var initialization
			let r = /var\s+([_a-zA-Z][_a-zA-Z0-9]*)/.exec(s);
			if (r) {
				let varName = r[1];

				// Allow repeated variable declaration
				if (wrenHasVariable(terminalModule, varName)) {
					if (s.includes("=")) {
						// Remove [var ] from start if already declared.
						s = s.slice(4);
					} else {
						// Ignore repeated initialization.
						return
					}
				}

				let result = wrenInterpret(terminalModule, s);

				if (result === 0) {
					return getVariableAsJavaScript(varName);
				}

				return;
			}
		} else if (!startsWithStatement(s)) {
			// This should be an expression of some kind!
			maybeExpression = true;

			// For simple assignments, decare base as variable if it doesn't look like a class.
			let r = /^([_a-zA-Z][_a-zA-Z0-9]*)\s*=/.exec(s) || /^([_a-zA-Z][_a-zA-Z0-9]*)$/.exec(s);
			if (r) {
				let baseVarName = r[1];

				if (!wrenHasVariable(terminalModule, baseVarName)) {
					if (baseVarName[0] === baseVarName[0].toLowerCase()) {
						wrenInterpret(terminalModule, "var " + baseVarName);
					}
				}
			}
		}
	} else {
		maybeExpression = !startsWithStatement(s);
	}

	if (maybeExpression) {
		// Try as expression!
		let result = wrenInterpret(terminalModule, `r__=JSON.toString(${s})`);
	
		if (result === 0) {
			return getVariableAsJavaScript("r__", true);
		} else if (result === 2) {
			return "[error]";
		}
	}
		
	// Try just interpreting.
	let result = wrenInterpret(terminalModule, s);
	if (result === 0) {
		return "[success]";
	} else {
		return "[error]";
	}
}

/**
 * @param {string} s
 */
function startsWithStatement(s) {
	return s.startsWith("if ") || s.startsWith("if(") || s.startsWith("for ") || s.startsWith("for(") || s.startsWith("while ") || s.startsWith("while(") || s.startsWith("import ") || s.startsWith("class ");
}

/**
 * @param {string} varName
 */
function getVariableAsJavaScript(varName, json=false) {
	wrenEnsureSlots(1);
	wrenGetVariable(terminalModule, varName, 0);

	let result = wrenCall(callHandle_toString);
	if (result === 0) {
		let toStr = wrenGetSlotString(0);

		if (json) {
			return wrenJSONToJS(toStr);
		} else {
			return toStr;
		}
	}

	return "[error]";
}

/**
 * @param {string} s
 */
function fromBase64(s) {
	s = atob(s);
	let array = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) array[i] = s.charCodeAt(i);
	return array;
}

import { callHandle_toString, vm } from "../vm.js";

let init = false;
let terminalModule = "_terminal";

/**
 * @param {string} s
 * @returns {any} result
 */
export function terminalInterpret(s) {
	if (!init) {
		init = true;
		vm.interpret(terminalModule, 'import "sock" for Math,Vector,Color,Game,JSON\nvar r__');
	}

	s = s.trim();

	if (!s.includes("\n")) {
		// Single line
		if (s.startsWith("var ")) {
			// Var initialization
			let r = /var\s+([_a-zA-Z][_a-zA-Z0-9]*)/.exec(s);
			if (r) {
				let varName = r[1];

				// Allow repeated variable declaration
				if (vm.hasVariable(terminalModule, varName)) {
					if (s.includes("=")) {
						// Remove [var ] from start if already declared.
						s = s.slice(4);
					} else {
						// Ignore repeated initialization.
						return
					}
				}

				let result = vm.interpret(terminalModule, s);

				if (result === 0) {
					return getVariableAsJavaScript(varName);
				}

				return;
			}
		} else if (s.startsWith("if ") || s.startsWith("if(")) {
			// If
		} else if (s.startsWith("for ") || s.startsWith("for(")) {
			// For
		} else if (s.startsWith("while ") || s.startsWith("while(")) {
			// While
		} else if (s.startsWith("import ")) {
			// Import
		} else if (s.startsWith("class ")) {
			// Class definition
		} else {
			// This should be an expression of some kind!

			// For simple assignments, decare base as variable if it doesn't look like a class.
			let r = /^([_a-zA-Z][_a-zA-Z0-9]*)\s*=/.exec(s) || /^([_a-zA-Z][_a-zA-Z0-9]*)$/.exec(s);
			if (r) {
				let baseVarName = r[1];

				if (!vm.hasVariable(terminalModule, baseVarName)) {
					if (s[0] === s[0].toLowerCase()) {
						vm.interpret(terminalModule, "var " + baseVarName);
					}
				}
			}

			let result = vm.interpret(terminalModule, `r__=(${s})`);

			if (result === 0) {
				return getVariableAsJavaScript("r__");
			}

			return;
		}
	}

	// Just execute.
	vm.interpret(terminalModule, s);
}

/**
 * @param {string} varName
 */
function getVariableAsJavaScript(varName) {
	vm.ensureSlots(1);
	vm.getVariable(terminalModule, varName, 0);

	let type = vm.getSlotType(0);

	if (type === 0) {
		return vm.getSlotBool(0);
	} else if (type === 1) {
		return vm.getSlotDouble(0);
	} else if (type === 5) {
		return null;
	}

	let result = vm.call(callHandle_toString);
	if (result === 0) {
		let toStr = vm.getSlotString(0);

		return toStr;
	}

	return "[error]";
}

// /**
//  * @param {any} cache 
//  */
// function getJavaScriptCopy() {
// 	let root = vm.getSlotHandle(0);
// 
// 	vm.setSlotNewMap(0);
// 	let map = vm.getSlotHandle(0);
// 
// 	vm.setSlotHandle(0, root);
// 	let result = getJavaScriptCopyEx(root, map)
// 
// 	vm.releaseHandle(map);
// 	vm.releaseHandle(root);
// 
// 	return result;
// }
// 
// /**
//  * @param {number} handle
//  * @param {number} map
//  */
// function getJavaScriptCopyEx(handle, map) {
// 	let type = vm.getSlotType(0);
// 
// 	if (type === 3) {
// 		// List
// 		let count = vm.getListCount(0);
// 		let checked = Math.min(99, count);
// 
// 		vm.ensureSlots(3);
// 
// 		vm.setSlotHandle(2, map);
// 
// 		let items = [];
// 		for (let i = 0; i < checked; i++) {
// 			vm.getListElement(0, i, 1);
// 
// 			if (vm.getMapContainsKey(2, 1)) {
// 				
// 			}
// 		}
// 
// 		return items.map()
// 	} else {
// 		// Just use toString.
// 		let result = vm.call(callHandle_toString);
// 		if (result === 0) {
// 			return vm.getSlotString(0);
// 		}
// 	}
// }

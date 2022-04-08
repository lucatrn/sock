import { resolveForeignMethod, resolveForeignClass } from "./foreign.js";
import { httpGET } from "./network/http.js";
import { VM } from "./wren.js";

/** @type {VM} */
export let vm;

/** @type {Uint8Array} */
export let HEAPU8;

/** @type {Float64Array} */
export let HEAPF64;

export let callHandle_call_0 = 0;
export let callHandle_transfer_1 = 0;
export let callHandle_path_get = 0;
export let callHandle_init_0 = 0;
export let callHandle_init_2 = 0;
export let callHandle_load_0 = 0;
export let callHandle_load_1 = 0;
export let callHandle_loaded_3 = 0;
export let callHandle_update_0 = 0;
export let callHandle_update_1 = 0;
export let callHandle_update_2 = 0;


/**
 * null if no error.
 * @type {string|null}
 */
export let wrenErrorMessage = null;

/**
 * A string that accumulates Wren error information.
 * 
 * null if no error.
 * @type {string|null}
 */
export let wrenErrorString = null;

/**
 * Provides the module name, line number, location to the wren file at the top of the error stack.
 * @type {[string, number, string|null][]}
 */
export let wrenErrorStack = [];


export function createWrenVM() {
	vm = new VM({
		bindForeignMethodFn: resolveForeignMethod,
		bindForeignClassFn: resolveForeignClass,
		resolveModuleFn(importer, name) {
			if (name === "sock") return name;

			if (name[0] === "/") {
				return name;
			} else {
				let i = importer.lastIndexOf("/");
				
				return importer.slice(0, i + 1) + name;
			}
		},
		loadModuleFn: (moduleName) => {
			return httpGET("assets" + moduleName + ".wren", "arraybuffer");
		},
		errorFn(type, moduleName, lineNumber, message) {
			let s;
			if (type === 0) {
				// Compile error.
				wrenErrorMessage = message;

				s = `[WREN COMPILE ERROR]\n${message}\n  at ${formatModuleName(moduleName, lineNumber)}`;

				wrenErrorStack.push([ moduleName, lineNumber, null ]);
			} else if (type === 1) {
				// Runtime error.
				wrenErrorMessage = message;

				s = "[WREN RUNTIME ERROR]\n" + message;
			} else if (type === 2) {
				// Stack trace
				s = `  at ${message} ${formatModuleName(moduleName, lineNumber)}`;

				wrenErrorStack.push([ moduleName, lineNumber, message ]);
			}
			
			// Join with newlines.
			wrenErrorString = wrenErrorString ? wrenErrorString + "\n" + s : s;
		}
	});

	HEAPU8 = new Uint8Array(vm.heap);
	HEAPF64 = new Float64Array(vm.heap);

	callHandle_call_0 = vm.makeCallHandle("call()");
	callHandle_transfer_1 = vm.makeCallHandle("transfer(_)");
	callHandle_path_get = vm.makeCallHandle("path");
	callHandle_init_0 = vm.makeCallHandle("init_()");
	callHandle_init_2 = vm.makeCallHandle("init_(_,_)");
	callHandle_load_0 = vm.makeCallHandle("load_()");
	callHandle_load_1 = vm.makeCallHandle("load_(_)");
	callHandle_loaded_3 = vm.makeCallHandle("loaded_(_,_,_)");
	callHandle_update_0 = vm.makeCallHandle("update_()");
	callHandle_update_1 = vm.makeCallHandle("update_(_)");
	callHandle_update_2 = vm.makeCallHandle("update_(_,_)");
}

/**
 * @param {string} message
 */
export function abortFiber(message) {
	vm.ensureSlots(1);
	vm.setSlotString(0, message);
	vm.abortFiber(0);
}

/**
 * @param {string} name
 * @param {number} lineNumber
 * @returns {string}
 */
function formatModuleName(name, lineNumber) {
	if (name[0] === "/") {
		name = name.slice(1);
	}

	return name + ":" + lineNumber;
}

/**
 * @param {number} type
 * @returns {string}
 */
export function wrenTypeToName(type) {
	switch (type) {
		case 0: return "Bool";
		case 1: return "Num";
		case 2: return "foreign";
		case 3: return "List";
		case 4: return "Map";
		case 5: return "Null";
		case 6: return "String";
		case 7: return "Unknown";
	}
	return "?";
}

import { resolveForeignMethod, resolveForeignClass } from "./foreign.js";
import { httpGET } from "./network/http.js";
import sockEmscriptenFactory from "../js-generated/sock_c.js";

/**
 * The Emscripten module. Loaded asyncronusly.
 * @type {import("../js-generated/sock_c.js").SockEmscriptenModule}
 */
export let Module;

export function HEAP() {
	return Module.HEAPU8.buffer;
}

export function HEAPU8() {
	return Module.HEAPU8;
}

export function HEAPF64() {
	return Module.HEAPF64;
}

/**
 * Used to accumlate Wren writes.
 */
let writeBuffer = "";

/**
 * Holds a setTimeout() ID. Used for automatic `writeBuffer` flushing.
 * @type {number}
 */
let writeBufferTimeoutID;

/**
 * Pointer to Wren VM.
 * @type {number}
 */
export let vm;

export async function loadEmscripten() {
	// Load the Emscripten module.
	Module = await sockEmscriptenFactory();

	// Setup [Module.sock] object.
	// This is used by [src/js-esm/library.js] to enable C->JS communication.
	Module.sock = {
		/**
		 * @param {string} text
		 */
		write(text) {
			if (writeBufferTimeoutID) clearTimeout(writeBufferTimeoutID);

			let i = 0;
			let next;
			while ((next = text.indexOf("\n", i)) >= 0) {
				let line = writeBuffer + text.slice(i, next);
				writeBuffer = "";
				i = next + 1;
				console.log("[WREN] " + line);
			}
			writeBuffer += text.slice(i);
			
			// Flush write buffer if not written to in a while.
			if (writeBuffer) {
				writeBufferTimeoutID = setTimeout(() => {
					console.log("(WREN) " + writeBuffer);
					writeBuffer = "";
				}, 50);
			}
		},

		/**
		 * @param {number} type
		 * @param {string} moduleName
		 * @param {number} lineNumber
		 * @param {string} message
		 */
		error(type, moduleName, lineNumber, message) {
			wrenHasError = true;

			let s;
			if (type === 0) {
				// Compile error.
				wrenErrorMessage = message;

				s = `[WREN COMPILE ERROR]\n${message}\n  at ${formatModuleLineTrace(moduleName, lineNumber)}`;

				wrenErrorStack = [];
				wrenErrorStack.push([ moduleName, lineNumber, null ]);
			} else if (type === 1) {
				// Runtime error.
				wrenErrorMessage = message;

				s = "[WREN RUNTIME ERROR]\n" + message;

				wrenErrorStack = [];
			} else if (type === 2) {
				// Stack trace
				s = `  at ${message} ${formatModuleLineTrace(moduleName, lineNumber)}`;

				wrenErrorStack.push([ moduleName, lineNumber, message ]);
			}

			// Always log errors to console.
			console.error(s);
			
			// Join with newlines.
			wrenErrorString = wrenErrorString ? wrenErrorString + "\n" + s : s;
		},

		/**
		 * @param {string} moduleName
		 */
		loadModule(moduleName) {
			// Use fiber hack to do async load.
			httpGET("assets" + moduleName + ".wren", "arraybuffer").then(
				(buffer) => {
					let result = wrenInterpret(moduleName, buffer);

					if (result === 0) {
						wrenInterpret(moduleName, "self__.transfer()");
					}
				},
				(error) => {
					console.warn(`Error loading module source "${moduleName}"`, error);

					wrenInterpret(moduleName, "self__.transferError(" + stringToWrenString(String(error)) + ")");
				}
			);

			return "var self__=Fiber.current\nFiber.suspend()\nself__=null";
		},

		/**
		 * @param {string} module
		 * @param {string} className
		 * @param {boolean} isStatic
		 * @param {string} signature
		 * @returns {(vm: number) => void}
		 */
		bindMethod(module, className, isStatic, signature) {
			return resolveForeignMethod(module, className, isStatic, signature)
		},

		/**
		 * @param {string} module
		 * @param {string} className
		 * @returns {[(vm: number) => void, (vm: number) => void]}
		 */
		bindClass(module, className) {
			return resolveForeignClass(module, className);
		},
	};

	// Init C sock.
	vm = Module.ccall("sock_init", "number");
	if (vm === 0) throw Error("error loading VM");
}

/**
 * Interpret a Wren script in the given module.
 * @param {string} moduleName
 * @param {CStringSource} moduleSource 
 * @returns {WrenInterpretResult}
 */
export function wrenInterpret(moduleName, moduleSource) {
	let stack = 0;

	let src, srcType;
	if (typeof moduleSource === "string") {
		src = moduleSource;
		srcType = "string";
	} else {
		stack = Module.stackSave();
		src = stackAllocUTF8ArrayAsCString(moduleSource);
		srcType = "number";
	}

	let result = Module.ccall("wrenInterpret",
		"number",
		["number", "string", srcType],
		[vm, moduleName, src]
	);

	if (stack) {
		Module.stackRestore(stack);
	}

	return result;
}

/**
 * Check if a module has a variable of the given name.
 * @param {string} moduleName
 * @param {string} name 
 * @returns {boolean}
 */
export function wrenHasVariable(moduleName, name) {
	return Module.ccall("wrenHasVariable",
		"boolean",
		["number", "string", "string"],
		[vm, moduleName, name]
	);
}

/**
 * Check if a module has a variable of the given name.
 * @param {number} numSlots
 */
export function wrenEnsureSlots(numSlots) {
	Module.ccall("wrenEnsureSlots",
		null,
		["number", "number"],
		[vm, numSlots]
	);
}

/**
 * @param {number} slot
 * @returns {number}
 */
export function wrenGetSlotType(slot) {
	return Module.ccall("wrenGetSlotType",
		"number",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} slot
 * @returns {boolean}
 */
export function wrenGetSlotBool(slot) {
	return Module.ccall("wrenGetSlotBool",
		"booleam",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} slot
 * @returns {string}
 */
export function wrenGetSlotString(slot) {
	return Module.ccall("wrenGetSlotString",
		"string",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} slot
 * @returns {Uint8Array}
 */
export function getSlotBytes(slot) {
	let stack = Module.stackSave();

	let lenPtr = Module.stackAlloc(4);

	let ptr = Module.ccall("wrenGetSlotBytes",
		"number",
		["number", "number", "number"],
		[vm, slot, lenPtr]
	);

	let heap = HEAP();

	let length = new Int32Array(heap, lenPtr)[0];

	Module.stackRestore(stack);

	return new Uint8Array(heap, ptr, length);
}

/**
 * @param {number} slot
 * @returns {number}
 */
export function wrenGetSlotDouble(slot) {
	return Module.ccall("wrenGetSlotDouble",
		"number",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} slot
 * @returns {number}
 */
export function wrenGetListCount(slot) {
	return Module.ccall("wrenGetListCount",
		"number",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} listSlot
 * @param {number} index
 * @param {number} elementSlot
 */
export function wrenGetListElement(listSlot, index, elementSlot) {
	Module.ccall("wrenGetListElement",
		null,
		["number", "number", "number", "number"],
		[vm, listSlot, index, elementSlot]
	);
}

/**
 * @param {number} listSlot
 * @param {number} index
 * @param {number} elementSlot
 */
export function wrenSetListElement(listSlot, index, elementSlot) {
	Module.ccall("wrenSetListElement",
		null,
		["number", "number", "number", "number"],
		[vm, listSlot, index, elementSlot]
	);
}

/**
 * @param {number} listSlot
 * @param {number} index
 * @param {number} elementSlot
 */
export function wrenInsertInList(listSlot, index, elementSlot) {
	Module.ccall("wrenInsertInList",
		null,
		["number", "number", "number", "number"],
		[vm, listSlot, index, elementSlot]
	);
}

/**
 * @param {number} slot
 * @returns {number}
 */
export function wrenGetSlotForeign(slot) {
	return Module.ccall("wrenGetSlotForeign",
		"number",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} slot
 * @returns {number}
 */
export function wrenGetSlotHandle(slot) {
	return Module.ccall("wrenGetSlotHandle",
		"number",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {string} moduleName
 * @param {string} name
 * @param {number} slot
 */
export function wrenGetVariable(moduleName, name, slot) {
	Module.ccall("wrenGetVariable",
		null,
		["number", "string", "string", "number"],
		[vm, moduleName, name, slot]
	);
}

/**
 * @param {number} slot
 */
export function wrenSetSlotNull(slot) {
	Module.ccall("wrenSetSlotNull",
		null,
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} slot
 * @param {boolean} value
 */
export function wrenSetSlotBool(slot, value) {
	Module.ccall("wrenSetSlotBool",
		null,
		["number", "number", "boolean"],
		[vm, slot, value]
	);
}

/**
 * @param {number} slot
 * @param {number} value
 */
export function wrenSetSlotDouble(slot, value) {
	Module.ccall("wrenSetSlotDouble",
		null,
		["number", "number", "number"],
		[vm, slot, value]
	);
}

/**
 * @param {number} slot
 * @param {CStringSource} text
 */
export function wrenSetSlotString(slot, text) {
	let stack = 0;

	let textRaw, textType;
	if (typeof text === "string") {
		textRaw = text;
		textType = "string";
	} else {
		stack = Module.stackSave();
		textRaw = stackAllocUTF8ArrayAsCString(text);
		textType = "number";
	}

	Module.ccall('wrenSetSlotString',
		null,
		['number', 'number', textType],
		[vm, slot, textRaw]
	);

	if (stack) {
		Module.stackRestore(stack);
	}
}

/**
 * @param {number} slot
 * @param {number} handle
 */
export function wrenSetSlotHandle(slot, handle) {
	Module.ccall("wrenSetSlotHandle",
		null,
		["number", "number", "number"],
		[vm, slot, handle]
	);
}

/**
 * @param {number} slot
 * @param {number} classSlot
 * @param {number} size
 */
export function wrenSetSlotNewForeign(slot, classSlot, size) {
	return Module.ccall("wrenSetSlotNewForeign",
		"number",
		["number", "number", "number", "number"],
		[vm, slot, classSlot, size]
	);
}

/**
 * @param {number} slot
 */
export function wrenSetSlotNewList(slot) {
	Module.ccall("wrenSetSlotNewList",
		"number",
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {number} callHandle
 * @returns {WrenInterpretResult}
 */
export function wrenCall(callHandle) {
	return Module.ccall("wrenCall",
		"number",
		["number", "number"],
		[vm, callHandle]
	);
}

/**
 * @param {string} moduleName
 */
export function wrenAddImplicitImportModule(moduleName) {
	Module.ccall("wrenAddImplicitImportModule",
		null,
		["number", "string"],
		[vm, moduleName]
	);
}

/**
 * @param {number} handle
 */
export function wrenReleaseHandle(handle) {
	Module.ccall("wrenReleaseHandle",
		null,
		["number", "number"],
		[vm, handle]
	);
}

/**
 * @param {number} slot
 */
export function wrenAbortFiber(slot) {
	Module.ccall("wrenAbortFiber",
		null,
		["number", "number"],
		[vm, slot]
	);
}

/**
 * @param {string} message
 */
export function abortFiber(message) {
	wrenEnsureSlots(1);
	wrenSetSlotString(0, message);
	wrenAbortFiber(0);
}

/**
 * Format a JS string as a Wren string literal.
 * @param {string} s
 * @returns {string}
 */
function stringToWrenString(s) {
	let r = '"';

	for (let i = 0; i < s.length; i++) {
		let c = s[i];
		if (c === "\\") {
			r += "\\\\";
		} else if (c === "%" || c === '"') {
			r += "\\" + c;
		} else {
			r += c;
		}
	}

	return r + '"';
}

export let wrenHasError = false;

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
export let wrenErrorStack;

/**
 * @param {string} name
 * @param {number} lineNumber
 * @returns {string}
 */
function formatModuleLineTrace(name, lineNumber) {
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

/**
 * @param {ArrayBuffer | Uint8Array | Uint8ClampedArray} arraySource 
 * @returns {number}
 */
function stackAllocUTF8ArrayAsCString(arraySource) {
	let src = arraySource instanceof ArrayBuffer ? new Uint8Array(arraySource) : arraySource;

	let nullTerminated = src[src.length - 1] === 0;
	let len = nullTerminated ? src.length : src.length + 1;
	
	let ptr = Module.stackAlloc(len);

	let u8 = HEAPU8();

	u8.set(src, ptr);

	if (!nullTerminated) {
		u8[ptr + len - 1] = 0;
	}

	return ptr;
}

/**
 * A string that is passed to C/Wasm.
 * 
 * If provided as an array, it is interpreted as a UTF-8 byte array, which is copied directly into Wasm memory.
 * This avoids the overhead of converting a JavaScript string to UTF-8.
 * @typedef {string | ArrayBuffer | Uint8Array | Uint8ClampedArray} CStringSource
 */

/**
 * The result of a VM interpreting wren source.
 * - 0: The VM interpreted the source without error.
 * - 1: The VM experienced a compile error.
 * - 2: The VM experienced a runtime error.
 * @typedef {0 | 1 | 2} WrenInterpretResult
 */



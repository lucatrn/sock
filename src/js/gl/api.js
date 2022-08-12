import { wrenAbort, wrenGetSlotString, wrenGetSlotType, wrenSetSlotString } from "../vm.js";
import { gl } from "./gl.js";


/** @type {Record<string, number>} */
export const GL_FILTER_MAP = {
	linear: gl.LINEAR,
	nearest: gl.NEAREST,
};

/** @type {Record<string, number>} */
export const GL_WRAP_MAP = {
	clamp: gl.CLAMP_TO_EDGE,
	repeat: gl.REPEAT,
	mirror: gl.MIRRORED_REPEAT,
};

/**
 * @param {number} slot
 * @returns {number|null}
 */
export function wrenGlFilterStringToNumber(slot) {
	if (wrenGetSlotType(slot) !== 6) {
		wrenAbort("filter must be a String");
		return;
	}

	let name = wrenGetSlotString(slot);

	if (GL_FILTER_MAP.hasOwnProperty(name)) {
		return GL_FILTER_MAP[name];
	} else {
		wrenAbort(`invalid filter "${name}"`);
		return null;
	}
}

/**
 * @param {number} slot
 * @returns {number|null}
 */
export function wrenGlWrapModeStringToNumber(slot) {
	if (wrenGetSlotType(slot) !== 6) {
		wrenAbort("wrap mode must be a String");
		return;
	}

	let name = wrenGetSlotString(slot);

	if (GL_WRAP_MAP.hasOwnProperty(name)) {
		return GL_WRAP_MAP[name];
	} else {
		wrenAbort(`invalid wrap mode "${name}"`);
		return null;
	}
}

/**
 * @param {string} s
 */
export function glFilterStringToNumber(s) {
	if (GL_FILTER_MAP.hasOwnProperty(s)) {
		return GL_FILTER_MAP[s];
	} else {
		throw Error(`Invalid scale filter "${s}"`);
	}
}

/**
 * @param {string} s
 */
export function glWrapModeStringToNumber(s) {
	if (GL_WRAP_MAP.hasOwnProperty(s)) {
		return GL_WRAP_MAP[s];
	} else {
		throw Error(`Invalid wrap mode "${s}"`);
	}
}

/**
 * @param {number} n
 */
export function glFilterNumberToString(n) {
	for (let name in GL_FILTER_MAP) {
		if (GL_FILTER_MAP[name] === n) {
			return name;
		}
	}

	return "???";
}

/**
 * @param {number} n
 */
export function glWrapModeNumberToString(n) {
	for (let name in GL_WRAP_MAP) {
		if (GL_WRAP_MAP[name] === n) {
			return name;
		}
	}

	return "???";
}

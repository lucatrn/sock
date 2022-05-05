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

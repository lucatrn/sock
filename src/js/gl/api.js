import { wrenAbort, wrenGetSlotString, wrenGetSlotType, wrenSetSlotString } from "../vm.js";
import { gl, glExtMinMax } from "./gl.js";


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

/** @type {Record<string, number>} */
export const GL_BLEND_EQUATION_MAP = {
	add: gl.FUNC_ADD,
	subtract: gl.FUNC_SUBTRACT,
	reverse_subtract: gl.FUNC_REVERSE_SUBTRACT,
	min: glExtMinMax ? glExtMinMax.MIN_EXT : gl.FUNC_ADD,
	max: glExtMinMax ? glExtMinMax.MAX_EXT : gl.FUNC_ADD,
};

/** @type {Record<string, number>} */
export const GL_BLEND_CONST_MAP = {
	zero: gl.ZERO,
	one: gl.ONE,
	src_color: gl.SRC_COLOR,
	src_alpha: gl.SRC_ALPHA,
	dst_color: gl.DST_COLOR,
	dst_alpha: gl.DST_ALPHA,
	constant_color: gl.CONSTANT_COLOR,
	constant_alpha: gl.CONSTANT_ALPHA,
	one_minus_src_color: gl.ONE_MINUS_SRC_COLOR,
	one_minus_src_alpha: gl.ONE_MINUS_SRC_ALPHA,
	one_minus_dst_color: gl.ONE_MINUS_DST_COLOR,
	one_minus_dst_alpha: gl.ONE_MINUS_DST_ALPHA,
	one_minus_constant_color: gl.ONE_MINUS_CONSTANT_COLOR,
	one_minus_constant_alpha: gl.ONE_MINUS_CONSTANT_ALPHA,
};

/**
 * @param {number} slot
 * @returns {number|undefined}
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
		return;
	}
}

/**
 * @param {number} slot
 * @returns {number|undefined}
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
		return;
	}
}

/**
 * @param {number} slot
 * @returns {number|undefined}
 */
export function wrenGlBlendEquationStringToNumber(slot) {
	if (wrenGetSlotType(slot) !== 6) {
		wrenAbort("blend func must be a String");
		return;
	}

	let name = wrenGetSlotString(slot);

	if (GL_BLEND_EQUATION_MAP.hasOwnProperty(name)) {
		return GL_BLEND_EQUATION_MAP[name];
	} else {
		wrenAbort(`invalid blend func "${name}"`);
		return;
	}
}

/**
 * @param {number} slot
 * @returns {number|undefined}
 */
export function wrenGlBlendConstantStringToNumber(slot) {
	if (wrenGetSlotType(slot) !== 6) {
		wrenAbort("blend constant must be a String");
		return;
	}

	let name = wrenGetSlotString(slot);

	if (GL_BLEND_CONST_MAP.hasOwnProperty(name)) {
		return GL_BLEND_CONST_MAP[name];
	} else {
		wrenAbort(`invalid blend constant "${name}"`);
		return;
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


/**
 * Pack 0..1 color to 32bit integer.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} a 
 */
export function packFloatColor(r, g, b, a) {
	return packIntColor(r * 255.999, g * 255.999, b * 255.999, a * 255.999);
}

/**
 * Pack 0..255 color to 32bit integer.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} a 
 */
export function packIntColor(r, g, b, a) {
	return Math.trunc(a) * 16777216 + (b << 16) + (g << 8) + Math.trunc(r);
}

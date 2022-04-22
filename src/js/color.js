
export class Color {
	/**
	 * @param {number} r 0..255
	 * @param {number} b 0..255
	 * @param {number} g 0..255
	 * @param {number} a 0..255
	 */
	constructor(r, b, g, a) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}

	/**
	 * Get as unsigned 32bit int.
	 */
	get int() {
		return Math.trunc(this.a) * 16777216 + (this.b << 16) + (this.g << 8) + Math.trunc(this.r);
	}
}

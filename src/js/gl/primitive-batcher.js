import { Color } from "../api/color.js";
import { gl } from "./gl.js";

/**
 * Batches primitive vertices (position + color) into a single growing `ArrayBuffer`.
 * @abstract
 */
export class PrimitiveBatcher {
	constructor() {
		/**
		 * @protected
		 */
		this._capacity = 256;
		/**
		 * The vertex data buffer, 16bytes per vertex:
		 * 
		 * ```
		 *  x     y     z     rgba
		 * [----][----][----][----]
		 * ```
		 * @protected
		 */
		this._array = new ArrayBuffer(this._capacity * 16);
		/**
		 * @protected
		 */
		this._floats = new Float32Array(this._array);
		/**
		 * @protected
		 */
		this._bytes = new Uint8Array(this._array);
		/**
		 * @protected
		 */
		this._ints = new Uint32Array(this._array);
		/**
		 * @protected
		 */
		this._vertexCount = -1;
		/**
		 * @protected
		 */
		this._buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
		gl.bufferData(gl.ARRAY_BUFFER, this._array.byteLength, gl.DYNAMIC_DRAW);
	}

	free() {
		gl.deleteBuffer(this._buffer);
		this._floats = this._bytes = this._array = null;
	}
	
	/**
	 * @protected
	 */
	drawBatch() {
	}

	/**
	 * @param {number} vertexCount
	 * @protected
	 */
	checkResize(vertexCount) {
		if (this._vertexCount + vertexCount > this._capacity) {
			// Grow capacity.
			this._capacity *= 2;

			if (this._capacity >= 0xfffff) throw Error(`exceeded max batch capacity of ${0xfffff}, did you forget to call end()?`);

			// Create new buffer.
			this._array = new ArrayBuffer(this._capacity * 16);

			// Copy data from old buffer.
			let newInts = new Uint32Array(this._array);
			newInts.set(this._ints);

			// Create new views.
			this._floats = new Float32Array(this._array);
			this._bytes = new Uint8Array(this._array);
			this._ints = newInts;
		}
	}

	/**
	 * Add a single vertex.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @param {Color|number} color
	 * @protected
	 */
	addVertex(x, y, z, color) {
		let i4 = this._vertexCount * 4;

		this._floats[i4    ] = x;
		this._floats[i4 + 1] = y;
		this._floats[i4 + 2] = z;

		if (typeof color === "number") {
			this._ints[i4 + 3] = color;
		} else {
			let ib = this._vertexCount * 16 + 12;

			this._bytes[ib    ] = color.r * 255.999;
			this._bytes[ib + 1] = color.g * 255.999;
			this._bytes[ib + 2] = color.b * 255.999;
			this._bytes[ib + 3] = color.a * 255.999;
		}

		this._vertexCount++;
	}

	begin() {
		if (this._vertexCount >= 0) throw Error("already called begin()");
		this._vertexCount = 0;
	}

	end() {
		if (this._vertexCount < 0) throw Error("not yet called begin()");

		if (this._vertexCount > 0) {
			this.drawBatch();
		}

		this._vertexCount = -1;
	}
}

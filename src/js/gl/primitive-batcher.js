import { gl } from "./gl.js";

/**
 * Batches primitive vertices (position + color) into a single growing `ArrayBuffer`.
 * @abstract
 */
export class PrimitiveBatcher {
	constructor() {
		/**
		 * Number of vertices we can fit.
		 * @protected
		 */
		this._capacity = 128;
		/**
		 * Vertex data array.
		 * ```
		 *  x     y     z     rgba  u     v
		 * [----][----][----][----][----][----]
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
		this._vertexBuffer = gl.createBuffer();
		/**
		 * The number of vertices we can fit in the vertex buffer.
		 * @protected
		 */
		this._vertexBufferCapacity = 0;
	}

	free() {
		gl.deleteBuffer(this._vertexBuffer);
		this._array = this._bytes = this._floats = this._ints = null;
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
			console.log("expand vertex buffer");

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
	 * @param {number} color
	 * @protected
	 */
	addVertex(x, y, z, color) {
		let i4 = this._vertexCount * 4;

		this._floats[i4    ] = x;
		this._floats[i4 + 1] = y;
		this._floats[i4 + 2] = z;

		this._ints[i4 + 3] = color;

		this._vertexCount++;
	}

	inBatch() {
		return this._vertexCount >= 0;
	}

	begin() {
		if (this.inBatch()) throw Error("already called begin()");
		this._vertexCount = 0;
	}

	end() {
		if (!this.inBatch()) throw Error("not yet called begin()");

		if (this._vertexCount > 0) {
			this.drawBatch();
		}

		this._vertexCount = -1;
	}
}

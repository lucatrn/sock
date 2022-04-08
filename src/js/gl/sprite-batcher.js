import { getCameraMatrix } from "../api/camera.js";
import { Color } from "../api/color.js";
import { gl } from "./gl.js";
import { Shader } from "./shader.js";
import { Texture } from "./texture.js";

let shader = new Shader({
	attributes: {
		"vertex": "vec3",
		"color": "vec4",
		"uv": "vec2",
	},
	varyings: {
		"v_color": "lowp vec4",
		"v_uv": "highp vec2",
	},
	vertUniforms: {
		"mat": "mat3",
	},
	vert: [
		"v_uv = uv;",
		"v_color = color;",
		// "gl_Position = vec4(vertex, 1.0);",
		"vec3 tv = mat * vec3(vertex.x, vertex.y, 1.0);",
		"gl_Position = vec4(tv.x, tv.y, vertex.z, 1.0);",
	],
	fragUniforms: {
		"tex": "sampler2D",
	},
	frag: "gl_FragColor = texture2D(tex, v_uv);",
	// frag: "gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);",
	// frag: "gl_FragColor = vec4(v_uv, 0.0, 1.0);",
});

shader.needsCompilation();

/** @type {SpriteBatcher} */
let shared = null;

/**
 * Helper for drawing sprites (textured quads) in an efficient manner.
 * 
 * Each `SpriteBatcher` contains growing buffers for geometry data, so it's best to re-use instances where possible.
 * See {@link SpriteBatcher.getShared()}.
 * 
 * `SpriteBatcher` should be destroyed explicitly using {@link free()}.
 * @example
 * let batch = SpriteBatcher.getShared();
 * 
 * batch.begin(myTex);
 * 
 * for (let i = 0; i < 99; i++) {
 *   batch.draw(10 + i, 10 + i * 2);
 * }
 * 
 * batch.end();
 */
export class SpriteBatcher {
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
		this._array = new ArrayBuffer(this._capacity * 24);
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
		/**
		 * @type {Uint16Array|null}
		 * @protected
		 */
		this._indices = null;
		/**
		 * @protected
		 */
		this._indexBuffer = gl.createBuffer();
	}

	/**
	 * A shared `SpriteBatcher` to assist in reuse, which improves program memory/speed.
	 * @returns {SpriteBatcher}
	 */
	static getShared() {
		return shared ?? (shared = new SpriteBatcher());
	}

	/**
	 * Begin a batch.
	 * 
	 * Each batch can only use one texture, and you can only provide it here.
	 * 
	 * Use {@link end()} to end a batch.
	 * @param {Texture} texture
	 */
	begin(texture) {
		if (this._vertexCount >= 0) throw Error("already called begin()");

		/**
		 * @protected
		 */
		this._texture = texture;
		this._vertexCount = 0;
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number|null} [w] Defaults to texture width.
	 * @param {number|null} [h] Defautls to texture height.
	 * @param {number|null} [z]
	 */
	draw(x, y, w, h, z) {
		if (w == null) w = this._texture.width;
		if (h == null) h = this._texture.height;
		let x2 = x + w;
		let y2 = y + h;
		if (z == null) z = 0;

		this.checkResize(4);
		this.addVertex(x, y,   z, 0xffffffff, 0, 0);
		this.addVertex(x, y2,  z, 0xffffffff, 0, 1);
		this.addVertex(x2, y,  z, 0xffffffff, 1, 0);
		this.addVertex(x2, y2, z, 0xffffffff, 1, 1);
	}

	/**
	 * Add a single vertex.
	 * Should be preceded by a call to {@link checkResize()}.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @param {Color|number} color
	 * @param {number} u
	 * @param {number} v
	 * @protected
	 */
	addVertex(x, y, z, color, u, v) {
		let i4 = this._vertexCount * 6;

		this._floats[i4    ] = x;
		this._floats[i4 + 1] = y;
		this._floats[i4 + 2] = z;

		if (typeof color === "number") {
			this._ints[i4 + 3] = color;
		} else {
			let ib = this._vertexCount * 24 + 12;

			this._bytes[ib    ] = color.r * 255.999;
			this._bytes[ib + 1] = color.g * 255.999;
			this._bytes[ib + 2] = color.b * 255.999;
			this._bytes[ib + 3] = color.a * 255.999;
		}

		this._floats[i4 + 4] = u;
		this._floats[i4 + 5] = v;

		this._vertexCount++;
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
			this._array = new ArrayBuffer(this._capacity * 24);

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
	 * Ends a batch.
	 * Has no effect if no sprites have been queued up.
	 */
	end() {
		if (this._vertexCount < 0) throw Error("have not called begin()");

		if (this._vertexCount > 0) {
			// Draw!
			shader.use();
	
			// Put vertex data.
			gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);

			if (this._vertexCount > this._vertexBufferCapacity) {
				// Re-allocate vertex data.
				this._vertexBufferCapacity = this._capacity;
				gl.bufferData(gl.ARRAY_BUFFER, this._array, gl.DYNAMIC_DRAW);
			} else {
				// Put in sub-data.
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._ints.subarray(0, this._vertexCount * 6));
			}
			
			// Configure/enable attributes.
			let vertLocation = shader.attributes.vertex;
			let colorlocation = shader.attributes.color;
			let uvLocation = shader.attributes.uv;

			gl.vertexAttribPointer(
				vertLocation,
				3,
				gl.FLOAT,
				false,
				24,
				0,
			);
			gl.enableVertexAttribArray(vertLocation);
			
			gl.vertexAttribPointer(
				colorlocation,
				4,
				gl.UNSIGNED_BYTE,
				true,
				24,
				12,
			);
			gl.enableVertexAttribArray(colorlocation);

			gl.vertexAttribPointer(
				uvLocation,
				2,
				gl.FLOAT,
				false,
				24,
				16,
			);
			gl.enableVertexAttribArray(uvLocation);

			// Set shader texture.
			shader.setUniformTexture("tex", this._texture.texture, 0);

			// Set shader matrix.
			shader.setUniformMatrix3("mat", getCameraMatrix());
		
			// Setup index buffer.
			// Since we're always drawing quads, we only need to populate it whenever it needs resizing.
			let indexCount = this._vertexCount * 1.5;
			
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
			
			// Grow index array.
			if (this._indices == null || indexCount > this._indices.length) {
				// Create new indices array.
				let newIndices = new Uint16Array(this._capacity * 6);
				let i = 0;
				
				// Copy across old indices.
				if (this._indices != null) {
					newIndices.set(this._indices);
					i = this._indices.length;
				}
				
				// Set new indices.
				let vi = i / 1.5;

				for ( ; i < newIndices.length; i += 6) {
					newIndices[i    ] = vi;
					newIndices[i + 1] = vi + 1;
					newIndices[i + 2] = vi + 2;
					newIndices[i + 3] = vi + 1;
					newIndices[i + 4] = vi + 3;
					newIndices[i + 5] = vi + 2;
					vi += 4;
				}

				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, newIndices, gl.DYNAMIC_DRAW);

				this._indices = newIndices;
			}

			// Draw!
			gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

			// Clean up.
			gl.disableVertexAttribArray(vertLocation);
			gl.disableVertexAttribArray(colorlocation);
			gl.disableVertexAttribArray(uvLocation);
		}

		// Reset state.
		this._vertexCount = -1;
	}

	/**
	 * Free all WebGL buffers and internal buffers.
	 */
	free() {
		gl.deleteBuffer(this._vertexBuffer);
		gl.deleteBuffer(this._indexBuffer);
		this._array = this._bytes = this._floats = this._ints = null;
	}
}

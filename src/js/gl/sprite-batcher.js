import { getCameraMatrix } from "../api/camera.js";
import { gl } from "./gl.js";
import { bindQuadIndexBuffer } from "./quad-index-buffer.js";
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
	frag: "gl_FragColor = texture2D(tex, v_uv) * v_color;",
});

shader.needsCompilation();


/**
 * Helper for drawing sprites (textured quads) in an efficient manner.
 * 
 * Each `SpriteBatcher` contains growing buffers for geometry data, so it's best to re-use instances where possible.
 * 
 * `SpriteBatcher` should be destroyed explicitly using {@link free()}.
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

		return this;
	}

	// /**
	//  * @param {number} x1
	//  * @param {number} y1
	//  * @param {number} x2
	//  * @param {number} y2
	//  * @param {number} z
	//  * @param {number} c
	//  */
	// draw(x1, y1, x2, y2, z, c) {
	// 	this.draw2(x1, y1, x2, y2, z, 0, 0, 1, 1, c, tf, tfo);
	// }
	
	/**
	 * @param {number} x1
	 * @param {number} y1
	 * @param {number} x2
	 * @param {number} y2
	 * @param {number} z
	 * @param {number} u1
	 * @param {number} v1
	 * @param {number} u2
	 * @param {number} v2
	 * @param {number} c
	 * @param {number[]|null} [tf] A 2x3 transform matrix
	 * @param {number[]|null} [tfo] A 2d transform origin
	 */
	drawQuad(x1, y1, x2, y2, z, u1, v1, u2, v2, c, tf, tfo) {
		this.checkResize(4);
		
		if (tf) {
			let tx1 = x1 * tf[0] + y1 * tf[2] + tf[4];
			let ty1 = x1 * tf[1] + y1 * tf[3] + tf[5];
			let tx2 = x1 * tf[0] + y2 * tf[2] + tf[4];
			let ty2 = x1 * tf[1] + y2 * tf[3] + tf[5];
			let tx3 = x2 * tf[0] + y1 * tf[2] + tf[4];
			let ty3 = x2 * tf[1] + y1 * tf[3] + tf[5];
			let tx4 = x2 * tf[0] + y2 * tf[2] + tf[4];
			let ty4 = x2 * tf[1] + y2 * tf[3] + tf[5];

			let tfox = tfo ? (x1 + tfo[0]) : ((x1 + x2) / 2);
			let tfoy = tfo ? (y1 + tfo[1]) : ((y1 + y2) / 2);
			let dx = tfox - tf[0] * tfox - tf[2] * tfoy;
			let dy = tfoy - tf[1] * tfox - tf[3] * tfoy;

			this.addVertex(tx1 + dx, ty1 + dy, z, c, u1, v1);
			this.addVertex(tx2 + dx, ty2 + dy, z, c, u1, v2);
			this.addVertex(tx3 + dx, ty3 + dy, z, c, u2, v1);
			this.addVertex(tx4 + dx, ty4 + dy, z, c, u2, v2);
		} else {
			this.addVertex(x1, y1, z, c, u1, v1);
			this.addVertex(x1, y2, z, c, u1, v2);
			this.addVertex(x2, y1, z, c, u2, v1);
			this.addVertex(x2, y2, z, c, u2, v2);
		}
		
	}

	/**
	 * Add a single vertex.
	 * Should be preceded by a call to {@link checkResize()}.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @param {number} color
	 * @param {number} u
	 * @param {number} v
	 * @protected
	 */
	addVertex(x, y, z, color, u, v) {
		let i4 = this._vertexCount * 6;

		this._floats[i4    ] = x;
		this._floats[i4 + 1] = y;
		this._floats[i4 + 2] = z;

		this._ints[i4 + 3] = color;

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
			let indexCount = this._vertexCount * 1.5;
			
			bindQuadIndexBuffer(indexCount);

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
		this._array = this._bytes = this._floats = this._ints = null;
	}
}

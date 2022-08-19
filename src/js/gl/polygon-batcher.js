import { gl } from "./gl.js";
import { PrimitiveBatcher } from "./primitive-batcher.js";
import { Shader } from "./shader.js";

const MAX_UINT16_VALUE = 0xffff;

const shader = new Shader({
	attributes: {
		vertex: "vec3",
		color: "vec4",
	},
	varyings: {
		"v_color": "lowp vec4",
	},
	vert: [
		"gl_Position = vec4(vertex, 1.0);",
		"v_color = color;",
	],
	frag: "gl_FragColor = v_color;",
});

shader.needsCompilation();

/**
 * Helper for drawing colored triangles, quads, etc, in an efficient manner.
 * 
 * Each `PolygonBatcher` contains growing buffers for geometry data, so it's best to re-use instances where possible.
 * See {@link PolygonBatcher.getShared()}.
 * 
 * PolygonBatchers should be destroyed explicitly using {@link free()}.
 * @example
 * let batch = PolygonBatcher.getShared();
 * 
 * batch.begin();
 * 
 * for (let i = 0; i < 99; i++) {
 *   batch.drawRectangle(10 + i, 10 + i * 2, 4, 8, 0xffffffff);
 * }
 * 
 * batch.end();
 */
export class PolygonBatcher extends PrimitiveBatcher {
	constructor() {
		super();

		/**
		 * @protected
		 */
		this._indexCount = 0;
		/**
		 * @type {Uint16Array}
		 * @protected
		 */
		this._indices = new Uint16Array(256);
		/**
		 * @protected
		 */
		this._indexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._indices.byteLength, gl.DYNAMIC_DRAW);

		/**
		 * The shader used to render polygons. Defaults to {@link PolygonBatcher.defaultShader}.
		 * 
		 * Must have these attributes:
		 * - `vec3 vertex`
		 * - `lowp vec4 color`
		 * @type {Shader}
		 */
		this.shader = shader;
	}

	/**
	 * @override
	 */
	free() {
		super.free();

		gl.deleteBuffer(this._indexBuffer);
		this._indices = null;
	}

	begin() {
		super.begin();

		this._indexCount = 0;
	}

	/**
	 * @override
	 * @protected
	 */
	drawBatch() {
		let attrVertex = this.shader.attributes.vertex;
		let attrColor = this.shader.attributes.color;

		this.shader.use();

		// Put vertex data.
		gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._ints.subarray(0, this._vertexCount * 4));

		// Enable/configure attributes.
		gl.vertexAttribPointer(
			attrVertex,
			3,
			gl.FLOAT,
			false,
			16,
			0,
		);
		gl.enableVertexAttribArray(attrVertex);
	
		gl.vertexAttribPointer(
			attrColor,
			4,
			gl.UNSIGNED_BYTE,
			true,
			16,
			12,
		);
		gl.enableVertexAttribArray(attrColor);

		// Put index data
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
		gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this._indices.subarray(0, this._indexCount));

		// Draw!
		gl.drawElements(gl.TRIANGLES, this._indexCount, gl.UNSIGNED_SHORT, 0);

		gl.disableVertexAttribArray(attrVertex);
		gl.disableVertexAttribArray(attrColor);
	}

	/**
	 * @param {number} indexCount
	 * @protected
	 */
	checkIndexResize(indexCount) {
		if (this._indexCount + indexCount > this._indices.length) {
			// Grow capacity.
			let length = this._indices.length * 2;

			if (length >= 0xfffff) throw Error(`exceeded max batch capacity of ${0xfffff}, did you forget to call end()?`);

			// Create new buffer and copy old indices.
			let newIndices = new Uint16Array(length);
			newIndices.set(this._indices);
			this._indices = newIndices;
		}
	}

	/**
	 * @param {number} cx
	 * @param {number} cy
	 * @param {number} w
	 * @param {number} h
	 * @param {number} color
	 * @param {number} [z]
	 * @param {number|null} [rotationAngle] Counter-clockwise Tau
	 */
	drawRectangle(cx, cy, w, h, color, z, rotationAngle) {
		this.checkResize(4);
		this.checkIndexResize(6);

		// Add indices.
		let vi = this._vertexCount;
		if (vi + 3 >= MAX_UINT16_VALUE) throw Error(`exceeded max vertex count ${MAX_UINT16_VALUE}`);

		let i = this._indexCount;
		this._indices[i    ] = vi;
		this._indices[i + 1] = vi + 1;
		this._indices[i + 2] = vi + 2;
		this._indices[i + 3] = vi + 1;
		this._indices[i + 4] = vi + 3;
		this._indices[i + 5] = vi + 2;
		this._indexCount = i + 6;

		// Add vertices.
		if (z == null) z = 0;
		w /= 2;
		h /= 2;

		let x1 = cx - w;
		let x2 = cx + w;
		let y1 = cy - h;
		let y2 = cy + h;

		this.addVertex(x1, y1, z, color);
		this.addVertex(x1, y2, z, color);
		this.addVertex(x2, y1, z, color);
		this.addVertex(x2, y2, z, color);
	}

	/**
	 * @param {number} cx
	 * @param {number} cy
	 * @param {number} w
	 * @param {number} h
	 * @param {number} color
	 * @param {number} [z]
	 */
	drawTriangle(cx, cy, w, h, color, z) {
		this.checkResize(3);
		this.checkIndexResize(3);

		// Add indices.
		let vi = this._vertexCount;
		if (vi + 2 >= MAX_UINT16_VALUE) throw Error(`exceeded max vertex count ${MAX_UINT16_VALUE}`);

		let i = this._indexCount;
		this._indices[i    ] = vi;
		this._indices[i + 1] = vi + 1;
		this._indices[i + 2] = vi + 2;
		this._indexCount = i + 3;

		// Add vertices.
		if (z == null) z = 0;
		w /= 2;
		h /= 2;

		let x1 = cx - w;
		let x2 = cx + w;
		let y1 = cy - h;
		let y2 = cy + h;

		this.addVertex(x1, y2, z, color);
		this.addVertex(cx, y1, z, color);
		this.addVertex(x2, y2, z, color);
	}
}

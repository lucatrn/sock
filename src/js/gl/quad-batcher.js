import { getCameraMatrix } from "../api/camera.js";
import { sockJsGlobal } from "../globals.js";
import { gl } from "./gl.js";
import { PrimitiveBatcher } from "./primitive-batcher.js";
import { bindQuadIndexBuffer } from "./quad-index-buffer.js";
import { Shader } from "./shader.js";

let shader = new Shader({
	attributes: {
		"vertex": "vec3",
		"color": "vec4",
	},
	varyings: {
		"v_color": "lowp vec4",
	},
	vertUniforms: {
		"mat": "mat3",
	},
	vert: [
		"v_color = color;",
		"vec3 tv = mat * vec3(vertex.x, vertex.y, 1.0);",
		"gl_Position = vec4(tv.x, tv.y, vertex.z, 1.0);",
	],
	frag: "gl_FragColor = v_color;",
});

shader.needsCompilation();

/**
 * Helper for quads in an efficient manner.
 */
export class QuadBatcher extends PrimitiveBatcher {
	/**
	 * @param {number} x1
	 * @param {number} y1
	 * @param {number} x2
	 * @param {number} y2
	 * @param {number} z
	 * @param {number} c
	 * @param {number[]|null} [tf] A 2x3 transform matrix
	 * @param {number[]|null} [tfo] A 2d transform origin
	 */
	drawRect(x1, y1, x2, y2, z, c, tf, tfo) {
		this.drawQuad(
			x1, y1,
			x1, y2,
			x2, y1,
			x2, y2,
			z,
			c,
			tf, tfo
		);
	}

	/**
	 * @param {number} x1
	 * @param {number} y1
	 * @param {number} x2
	 * @param {number} y2
	 * @param {number} x3
	 * @param {number} y3
	 * @param {number} x4
	 * @param {number} y4
	 * @param {number} z
	 * @param {number} c
	 * @param {number[]|null} [tf] A 2x3 transform matrix
	 * @param {number[]|null} [tfo] A 2d transform origin
	 */
	drawQuad(x1, y1, x2, y2, x3, y3, x4, y4, z, c, tf, tfo) {
		this.checkResize(4);
		
		if (tf) {
			let tx1 = x1 * tf[0] + y1 * tf[2] + tf[4];
			let ty1 = x1 * tf[1] + y1 * tf[3] + tf[5];
			let tx2 = x2 * tf[0] + y2 * tf[2] + tf[4];
			let ty2 = x2 * tf[1] + y2 * tf[3] + tf[5];
			let tx3 = x3 * tf[0] + y3 * tf[2] + tf[4];
			let ty3 = x3 * tf[1] + y3 * tf[3] + tf[5];
			let tx4 = x4 * tf[0] + y4 * tf[2] + tf[4];
			let ty4 = x4 * tf[1] + y4 * tf[3] + tf[5];

			let tfox = tfo ? (x1 + tfo[0]) : ((x1 + x2) / 2);
			let tfoy = tfo ? (y1 + tfo[1]) : ((y1 + y2) / 2);
			let dx = tfox - tf[0] * tfox - tf[2] * tfoy;
			let dy = tfoy - tf[1] * tfox - tf[3] * tfoy;

			this.addVertex(tx1 + dx, ty1 + dy, z, c);
			this.addVertex(tx2 + dx, ty2 + dy, z, c);
			this.addVertex(tx3 + dx, ty3 + dy, z, c);
			this.addVertex(tx4 + dx, ty4 + dy, z, c);
		} else {
			this.addVertex(x1, y1, z, c);
			this.addVertex(x2, y2, z, c);
			this.addVertex(x3, y3, z, c);
			this.addVertex(x4, y4, z, c);
		}
	}
	
	/**
	 * @protected
	 */
	drawBatch() {
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

			gl.vertexAttribPointer(
				vertLocation,
				3,
				gl.FLOAT,
				false,
				16,
				0,
			);
			gl.enableVertexAttribArray(vertLocation);
			
			gl.vertexAttribPointer(
				colorlocation,
				4,
				gl.UNSIGNED_BYTE,
				true,
				16,
				12,
			);
			gl.enableVertexAttribArray(colorlocation);

			// Set shader matrix.
			shader.setUniformMatrix3("mat", getCameraMatrix());
		
			// Setup index buffer.
			let indexCount = this._vertexCount * 1.5;
			
			bindQuadIndexBuffer(indexCount);

			sockJsGlobal.quadInfo = `vertexCount=${this._vertexCount} indexCount=${indexCount}`

			// Draw!
			gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

			// Clean up.
			gl.disableVertexAttribArray(vertLocation);
			gl.disableVertexAttribArray(colorlocation);
		}

		// Reset state.
		this._vertexCount = -1;
	}
}

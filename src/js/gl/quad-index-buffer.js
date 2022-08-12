import { sockJsGlobal } from "../globals.js";
import { gl } from "./gl.js";

/**
 * @type {Uint16Array|null}
 */
let indices = null;

let populatedIndices = 0;

/**
 * The underlying WebGL buffer for quad indices.
 */
export let quadIndexBuffer = gl.createBuffer();

/**
 * Binds the quad index buffer, and also ensures it is big for the given number of indices.
 * @param {number} indexCount The number of indices needed. Should be a multiple of 6 (each quad used 2 triangles = 6 indices). e.g. `vertexCount * 1.5`
 */
export function bindQuadIndexBuffer(indexCount) {
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndexBuffer);

	if (indices == null || indices.length < indexCount) {
		let capacity = indices ? indices.length : 256;

		while (capacity < indexCount) {
			capacity *= 2;
		}

		let newIndices = new Uint16Array(capacity);
		
		// Copy across old indices.
		if (indices != null) {
			newIndices.set(indices);
		}
		
		// Set new indices.
		let vi = populatedIndices / 1.5;

		for ( ; populatedIndices + 5 < capacity; populatedIndices += 6) {
			newIndices[populatedIndices    ] = vi;
			newIndices[populatedIndices + 1] = vi + 1;
			newIndices[populatedIndices + 2] = vi + 2;
			newIndices[populatedIndices + 3] = vi + 1;
			newIndices[populatedIndices + 4] = vi + 3;
			newIndices[populatedIndices + 5] = vi + 2;
			vi += 4;
		}

		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, newIndices, gl.DYNAMIC_DRAW);

		indices = newIndices;

		sockJsGlobal.quadSize = capacity;
	}
}


class Distortion extends AudioWorkletProcessor {
	/**
	 * @param {Float32Array[][]} inputs
	 * @param {Float32Array[][]} outputs
	 * @param {Record<string, Float32Array>} params
	 * @returns {boolean}
	 */
	process(inputs, outputs, params) {
		return true;
	}
}

registerProcessor("sock-distortion", Distortion);

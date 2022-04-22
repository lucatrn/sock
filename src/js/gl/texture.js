import { Vec2 } from "../math.js";
import { gl } from "./gl.js";

/**
 * A 2D WebGL texture.
 */
export class Texture {
	/**
	 * @param {number} filter
	 * @param {number} wrap
	 */
	constructor(filter, wrap) {
		this.width = 0;
		this.height = 0;
		// this.mipmaps = false;
		this.filter = filter;
		this.wrap = wrap;
		this.size = 1;
		/**
		 * The WebGL texture.
		 * @type {WebGLTexture}
		 */
		this.texture = null;
	}

	get name() {
		return this.texture ? String(this.texture) : "?";
	}

	/**
	 * @param {number} n
	 */
	setFilter(n) {
		if (this.filter !== n) {
			this.filter = n;
			
			if (this.texture) {
				gl.bindTexture(gl.TEXTURE_2D, this.texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
			}
		}
	}
	
	/**
	 * @param {number} n
	 */
	setWrap(n) {
		if (this.wrap !== n) {
			this.wrap = n;

			if (this.texture) {
				gl.bindTexture(gl.TEXTURE_2D, this.texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrap);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrap);
			}
		}
	}
	
	/**
	 * @param {TexImageSource} source 
	 */
	load(source) {
		let res = getResolution(source);
		this.width = res.x;
		this.height = res.y;
		this.size = imageSize(source, res);
		this.texture = gl.createTexture();

		gl.bindTexture(gl.TEXTURE_2D, this.texture);

		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			source
		);

		// if (this.mipmaps) {
		// 	gl.generateMipmap(gl.TEXTURE_2D);
		// }

		// Handle issues with non-power-of-two textures.
		let texIsPowerOf2 = isPowerOf2(this.width) && isPowerOf2(this.height);

		if (!texIsPowerOf2) {
			// Non-power-of-two textures in WebGL 1.0 will be read as a black texture unless we set:
			// * Minification filter to NEAREST or LINEAR (i.e. not one of the mip-map options).
			// * Wrap mode to CLAMP_TO_EDGE.
			// https://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences#Non-Power_of_Two_Texture_Support
			let warn = [];

			// if (isMipMapFilter(this.filter)) {
			// 	this.filter = gl.LINEAR;
			// 	warn.push("minification filter to LINEAR");
			// }

			if (this.wrap !== gl.CLAMP_TO_EDGE) {
				this.wrap = gl.CLAMP_TO_EDGE;
				warn.push("wrap mode to CLAMP_TO_EDGE");
			}

			if (warn.length > 0) {
				console.warn(`Forced settings on non power-of-two texture "${this.name}": ${warn.join(", ")}.\nThe texture would not function properly otherwise, see https://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences#Non-Power_of_Two_Texture_Support`);
			}
		}
		
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
		
		if (this.wrap != null && this.wrap !== gl.REPEAT) {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrap);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrap);
		}
	}

	free() {
		gl.deleteTexture(this.texture);
		this.texture = null;
	}
}

/**
 * @param {TexImageSource} source
 * @returns {Vec2}
 */
function getResolution(source) {
	if (source instanceof HTMLImageElement) {
		return new Vec2(source.naturalWidth, source.naturalHeight);
	} else if (source instanceof HTMLVideoElement) {
		return new Vec2(source.videoWidth, source.videoHeight);
	} else {
		return new Vec2(source.width, source.height);
	}
}

/**
 * @param {TexImageSource} img
 * @param {Vec2} resolution
 * @returns {number}
 */
function imageSize(img, resolution) {
	if (img instanceof HTMLImageElement) {
		let entry = performance.getEntriesByName(img.src)[0];
	
		if (entry instanceof PerformanceResourceTiming) {
			return entry.decodedBodySize || entry.transferSize;
		}
	} else if (img instanceof ImageData) {
		return img.data.byteLength;
	}
	
	// Just guess based on dimensions.
	return 1 + Math.floor(resolution.x * resolution.y * 0.25);
}

/**
 * @param {number} n
 * @returns {boolean}
 */
function isPowerOf2(n) {
	return (n & (n - 1)) === 0;
}

/**
 * @param {number | null | undefined} n
 */
function isMipMapFilter(n) {
	return n == null || (n >= 0x2700 && n <= 0x2703);
}

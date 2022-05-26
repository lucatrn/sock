import { internalResolutionHeight, internalResolutionWidth, viewportHeight, viewportOffsetX, viewportOffsetY, viewportWidth } from "../layout.js";
import { gl } from "./gl.js";
import { Shader } from "./shader.js";

let shader = new Shader({
	attributes: {
		"vertex": "vec2",
	},
	varyings: {
		"v_uv": "highp vec2",
	},
	vert: [
		"v_uv = 0.5 + vertex.xy * 0.5;",
		"gl_Position = vec4(vertex, 0.0, 1.0);",
	],
	fragUniforms: {
		"tex": "sampler2D",
	},
	frag: "gl_FragColor = texture2D(tex, v_uv);",
});

shader.needsCompilation();

export class Framebuffer {
	/**
	 * @param {number} [filter]
	 */
	constructor(filter) {
		this.filter = filter ?? gl.LINEAR;

		this.texture = gl.createTexture();
		this.depthBuffer = gl.createRenderbuffer();
		this.framebuffer = gl.createFramebuffer();
		this.quadBuffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([
				-1, -1,
				+1, -1,
				-1, +1,
				-1, +1,
				+1, -1,
				+1, +1,
			]),
			gl.STATIC_DRAW
		);

		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			8,
			8,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);
	}

	updateResolution() {
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			internalResolutionWidth,
			internalResolutionHeight,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
		
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, internalResolutionWidth, internalResolutionHeight);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.texture,
			0,
		);

		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer);
	}

	/**
	 * @param {number} filter
	 */
	setFilter(filter) {
		this.filter = filter;

		gl.bindTexture(gl.TEXTURE_2D, this.texture);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
	}

	/**
	 * Binds the framebuffer as the target for subsequent draw calls.
	 */
	bind() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

		gl.viewport(0, 0, internalResolutionWidth, internalResolutionHeight);
	}

	unbind() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		let scale = devicePixelRatio;

		gl.viewport(
			viewportOffsetX * scale,
			viewportOffsetY * scale,
			viewportWidth * scale,
			viewportHeight * scale,
		);
	}

	/**
	 * Draws the framebuffer to the canvas.
	 */
	draw() {
		this.unbind();

		shader.use();

		shader.setUniformTexture("tex", this.texture, 0);

		let vertAttr = shader.attributes.vertex;

		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
		gl.vertexAttribPointer(
			vertAttr,
			2,
			gl.FLOAT,
			false,
			0,
			0,
		);
		gl.enableVertexAttribArray(vertAttr);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		gl.disableVertexAttribArray(vertAttr);
	}

	free() {
		gl.deleteFramebuffer(this.framebuffer);
		gl.deleteBuffer(this.quadBuffer);
		gl.deleteTexture(this.texture);
		gl.deleteRenderbuffer(this.depthBuffer);
	}
}

export let mainFramebuffer = new Framebuffer(gl.NEAREST);

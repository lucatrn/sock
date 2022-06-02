import { gl } from "./gl.js";

/** @type {Shader[]} */
let shadersAwaitingCompilation = [];

/**
 * A complete WebGL shader (vertex + fragment + program).
 */
export class Shader {
	/**
	 * @param {ShaderOptions} opt
	 */
	constructor(opt) {
		/**
		 * Attribute locations.
		 * @type {Record<string, number>}
		 */
		this.attributes = {};

		/**
		 * Uniform locations.
		 * @type {Record<string, WebGLUniformLocation | null>}
		 */
		this.uniforms = {};

		let attributesSource = initShaderVariables("attribute", opt.attributes, this.attributes, -1);
		let varyingsSource = initShaderVariables("varying", opt.varyings, null, null);
		let vertUniforms = initShaderVariables("uniform", opt.vertUniforms, this.uniforms, null);
		let fragUniforms = initShaderVariables("uniform", opt.fragUniforms, this.uniforms, null);

		// Create shader source code.
		/**
		 * WebGL Vertex Shader source code.
		 * @type {string}
		 */
		this.vertSource = attributesSource + varyingsSource + vertUniforms + createShaderSourceMain(opt.vert ?? "");

		/**
		 * WebGL Fragment Shader source code.
		 * @type {string}
		 */
		this.fragSource = varyingsSource + fragUniforms + createShaderSourceMain(opt.frag ?? "gl_FragColor=vec4(1.0,0.0,1.0,1.0);");

		// Create shaders + program.
		/**
		 * WebGL Vertex Shader.
		 * @type {WebGLShader}
		 * @private
		 */
		this._vert = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(this._vert, this.vertSource);

		/**
		 * WebGL Vertex Shader.
		 * @type {WebGLShader}
		 * @private
		 */
		this._frag = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(this._frag, this.fragSource);

		/**
		 * WebGL Shader Program.
		 * @type {WebGLProgram}
		 */
		this.prog = gl.createProgram();

		gl.attachShader(this.prog, this._vert);
		gl.attachShader(this.prog, this._frag);

		/**
		 * If this the shader has been compiled yet.
		 * @type {boolean}
		 */
		this.compiled = false;
	}

	/**
	 * When compiling multiple shaders at once, use {@link Shader.compile()} for better performance.
	 * @see {@link needsCompilation()}.
	 */
	compile() {
		Shader.compile(this);
	}

	/**
	 * Compiles the shader during game load.
	 * 
	 * This method is preferred over {@link compile()} since multiple shaders can be compiled in parallel.
	 * 
	 * See also {@link Shader.compile()}.
	 */
	needsCompilation() {
		shadersAwaitingCompilation.push(this);
	}

	free() {
		gl.deleteProgram(this.prog);
		gl.deleteShader(this._frag);
		gl.deleteShader(this._vert);
		this.prog = -1;
		this.compiled = false;
	}

	use() {
		if (!this.compiled) throw Error("shader not compiled");
		gl.useProgram(this.prog);
	}

	/**
	 * @param {string} name
	 * @returns {WebGLUniformLocation}
	 * @throws If name is not one of the program's uniform names.
	 * @protected
	 */
	getUniformLocation(name) {
		let location = this.uniforms[name];
		if (location == null) throw Error(`Shader does not contain a uniform named "${name}"`);
		return location;
	}

	/**
	 * Sets a uniform texture in the shader.
	 * @param {string} name The name of the uniform variable.
	 * @param {WebGLTexture} tex The texture to set.
	 * @param {number} unit The texture unit. Either [0..31] or [`gl.TEXTURE0`..`gl.TEXTURE31`]
	 */
	setUniformTexture(name, tex, unit) {
		let location = this.getUniformLocation(name);
		
		// Convert from `gl.TEXTURE##` constants.
		if (unit >= gl.TEXTURE0) {
			unit -= gl.TEXTURE0;
		}
		
		// Set the uniform!
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.uniform1i(location, unit);
	}

	/**
	 * @param {string} name
	 * @param {number[]|Float32Array} matrix 
	 */
	setUniformMatrix3(name, matrix) {
		let location = this.getUniformLocation(name);

		gl.uniformMatrix3fv(location, false, matrix);
	}
	
	/**
	 * @param {string} name
	 * @param {number[]} matrix 
	 */
	setUniformMatrix4(name, matrix) {
		let location = this.getUniformLocation(name);

		gl.uniformMatrix4fv(location, false, matrix);
	}

	/**
	 * Compiles all shaders that are yet to be compiled.
	 */
	static compileAll() {
		this.compile(shadersAwaitingCompilation);

		shadersAwaitingCompilation.length = 0;
	}

	/**
	 * Compile a set of shaders in parallel.
	 * @param {Shader|Shader[]} shaders
	 */
	static compile(shaders) {
		if (shaders instanceof Shader) shaders = [ shaders ];

		// Frag/Vert
		for (let sh of shaders) {
			gl.compileShader(sh._vert);
			gl.compileShader(sh._frag);
		}

		// Link
		for (let sh of shaders) {
			gl.linkProgram(sh.prog);
		}

		// Check status
		let errors = [];
		for (let sh of shaders) {
			if (gl.getProgramParameter(sh.prog, gl.LINK_STATUS)) {
				sh.compiled = true;
			} else {
				let sProg = gl.getProgramInfoLog(sh.prog);
				let sVert = gl.getShaderInfoLog(sh._vert);
				let sFrag = gl.getShaderInfoLog(sh._frag);

				let error = "Shader Compilation Error:";

				if (sProg) error += "\n\n===   PROGRAM   ===\n" + sProg;
				if (sVert) error += "\n\n=== VERT SHADER ===\n" + sVert;
				if (sFrag) error += "\n\n=== FRAG SHADER ===\n" + sFrag;

				errors.push(error);
			}
		}

		if (errors.length > 0) {
			throw Error(errors.join("\n\n"));
		}

		// Get locations.
		for (let sh of shaders) {
			for (let name in sh.attributes) {
				sh.attributes[name] = gl.getAttribLocation(sh.prog, name);
			}
			for (let name in sh.uniforms) {
				let location = gl.getUniformLocation(sh.prog, name);
				if (location == null) throw Error(`Failed to find uniform "${name}" in Shader.`);
				sh.uniforms[name] = location;
			}
		}
	}
}

/**
 * @param {string} keyword
 * @param {Record<string, string>} src
 * @param {Record<string, T>|null} dst
 * @param {T} init
 * @returns {string}
 * @template T
 */
function initShaderVariables(keyword, src, dst, init) {
	let s = "";
	if (src) {
		for (let name in src) {
			if (dst) dst[name] = init;
			s += keyword +  " " + src[name] + " " + name + ";\n";
		}
	}
	return s;
}

/**
 * @param {string|string[]} a
 * @returns {string}
 */
function createShaderSourceMain(a) {
	if (Array.isArray(a)) {
		a = a.join("");
	}

	return "void main(){" + a + "}";
}

/**
 * @typedef {object} ShaderOptions
 * @property {Record<string, string> | null} [attributes] Vertex shader attributes, as name-type pairs.
 * @property {Record<string, string> | null} [varyings] Vertex/fragment shader varyings, as name-type pairs.
 * @property {Record<string, string> | null} [vertUniforms] Vertex shader uniforms, as name-type pairs.
 * @property {Record<string, string> | null} [fragUniforms] Fragment shader uniforms, as name-type pairs.
 * @property {string|string[]|null} [vert] Vertex shader code, just the contents of the `main()` function.
 * @property {string|string[]|null} [frag] Fragment shader code, just the contents of the `main()` function.
 */

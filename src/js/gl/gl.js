import { canvas } from "../canvas.js";
import { sockJsGlobal } from "../globals.js";

/**
 * The main WebGL 1.0 context.
 */
export let gl = canvas.getContext("webgl", {
	antialias: false,
});

export let glExtMinMax = gl.getExtension("EXT_blend_minmax");

export function resetGlBlending() {
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

export function resetGlScissor() {
	gl.disable(gl.SCISSOR_TEST);
}

gl.enable(gl.BLEND);
resetGlBlending();

sockJsGlobal.gl = gl;

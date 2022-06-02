import { canvas } from "../canvas.js";
import { sockJsGlobal } from "../globals.js";

/**
 * The main WebGL 1.0 context.
 */
export let gl = canvas.getContext("webgl", {
	antialias: false,
});

gl.enable(gl.BLEND);
gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

sockJsGlobal.gl = gl;

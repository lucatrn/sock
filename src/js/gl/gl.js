import { canvas } from "../canvas.js";
import { debugGlobals } from "../debug/globals.js";

export let gl = canvas.getContext("webgl", {
	antialias: false,
});

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

debugGlobals.gl = gl;

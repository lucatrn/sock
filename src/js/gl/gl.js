import { canvas } from "../canvas.js";

export let gl = canvas.getContext("webgl", {
	antialias: false,
});

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

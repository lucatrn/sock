import { container } from "./container.js";

/**
 * The position of the container/canvas. `s` is the scale factor.
 * `sw` `sh` are screen width/height.
 */
export let layout = { x: 0, y: 0, w: 1, h: 1, s: 1, sw: 0, sh: 0, };

export let layoutOptions = {
	pixelScaling: false,
	resolution: [ 300, 400 ],
};

export function redoLayout() {
	let [ resx, resy ] = layoutOptions.resolution;
	let sw = layout.sw = innerWidth;
	let sh = layout.sh = innerHeight;
	let sx = sw / resx;
	let sy = sh / resy;
	let s = Math.min(sx, sy);
	if (layoutOptions.pixelScaling && s > 1) s = Math.floor(s);
	let w = Math.floor(s * resx);
	let h = Math.floor(s * resy);
	let x = Math.floor((sw - w) / 2);
	let y = Math.floor((sh - h) / 2);
	layout.x = x;
	layout.y = y;
	layout.w = w;
	layout.h = h;
	layout.s = s;
	container.style.left = x + "px";
	container.style.top = y + "px";
	container.style.width = w + "px";
	container.style.height = h + "px";
}

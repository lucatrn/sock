import { canvas } from "./canvas.js";

/**
 * The position of the container/canvas. `s` is the scale factor.
 * - `sw` `sh`: screen width/height.
 * - `rw` `rh`: Internal resolution width/height.
 * - `x` `y`: top/left offsets of viewport due to fixed resolution
 * - `w` `h`: width/height of viewport. May be smaller than screen width/height due to fixed resolution.
 * - `s`: Scale factor of viewport (0, Infinite)
 */
export let computedLayout = {
	rw: 0,
	rh: 0,
	sw: 0,
	sh: 0,
	x: 0,
	y: 0,
	w: 1,
	h: 1,
	s: 1,
};

/**
 * Used by client to configure internal resolution and computed layout.
 */
export let layoutOptions = {
	pixelScaling: false,
	resolution: null,
	maxScale: Infinity,
};


let isLayoutQueued = false;

export function queueLayout() {
	isLayoutQueued = true;
}

export function finalizeLayout() {
	if (isLayoutQueued) {
		isLayoutQueued = false;
		redoLayout();
		return true;
	}
}

export function redoLayout() {
	let screenWidth = computedLayout.sw = canvas.width = innerWidth;
	let screenHeight = computedLayout.sh = canvas.height = innerHeight;

	let resx, resy, scale;
	let res = layoutOptions.resolution;
	if (res) {
		resx = res[0];
		resy = res[1];

		// Determine scale factor.
		let scaleX = screenWidth / resx;
		let scaleY = screenHeight / resy;

		scale = Math.min(scaleX, scaleY, layoutOptions.maxScale);

		if (layoutOptions.pixelScaling && scale > 1) {
			scale = Math.floor(scale);
		}
	} else {
		resx = screenWidth;
		resy = screenHeight;
		scale = 1;
	}

	computedLayout.rw = resx;
	computedLayout.rh = resy;
	computedLayout.s = scale;
	
	let w = computedLayout.w = Math.floor(scale * resx);
	let h = computedLayout.h = Math.floor(scale * resy);
	computedLayout.x = Math.floor((screenWidth - w) / 2);
	computedLayout.y = Math.floor((screenHeight - h) / 2);
}

addEventListener("resize", () => {
	queueLayout();
});

computedLayout.rw = computedLayout.sw = computedLayout.w = canvas.width = innerWidth;
computedLayout.rh = computedLayout.sh = computedLayout.h = canvas.height = innerHeight;

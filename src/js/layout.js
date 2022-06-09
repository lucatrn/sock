import { canvas } from "./canvas.js";
import { createElement } from "./html.js";

/**
 * Total window/screen width.
 */
export let screenWidth = 0;

/**
 * Total window/screen height.
 */
export let screenHeight = 0;

/**
 * The game's internal resolution width, may be smaller than screen width.
 */
export let internalResolutionWidth = 0;

/**
 * The game's internal resolution height, may be smaller than screen height.
 */
export let internalResolutionHeight = 0;

/**
 * Left offset of viewport, in logical pixels.  
 * May be non-zero due to fixed resolution.
 */
export let viewportOffsetX = 0;

/**
 * Top offset of viewport, in logical pixels.  
 * May be non-zero due to fixed resolution.
 */
export let viewportOffsetY = 0;

/**
 * Width of viewport in screen pixels, in logical pixels.  
 * May be smaller than screen size due to fixed resolution.  
 * May be larger than internal resolution to fixed resolution scaling.
 */
export let viewportWidth = 1;

/**
 * Height of viewport in screen pixels, in logical pixels.  
 * May be smaller than screen size due to fixed resolution.  
 * May be larger than internal resolution to fixed resolution scaling.
 */
export let viewportHeight = 1;

/**
 * Scale factor of viewport (0, Infinite), using logical pixels.
 */
export let viewportScale = 1;

/**
 * Used by client to configure internal resolution and computed layout.
 */
export let layoutOptions = {
	pixelScaling: false,
	/**
	 * @type {null|[number, number]}
	 */
	resolution: null,
	maxScale: Infinity,
};

let layoutContainer = createElement("div", { style: "position: fixed; pointer-events: none;" });
let layoutContainerRefCount = 0;

export function useLayoutContainer() {
	if (layoutContainerRefCount === 0) {
		document.body.append(layoutContainer);
	}

	layoutContainerRefCount++

	return layoutContainer;
}

export function releaseLayoutContainer() {
	layoutContainerRefCount--;

	if (layoutContainerRefCount === 0) {
		layoutContainer.remove();
	}
}


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
	screenWidth = innerWidth;
	screenHeight = innerHeight;

	let pixeRatio = devicePixelRatio;
	canvas.width = screenWidth * pixeRatio;
	canvas.height = screenHeight * pixeRatio;

	canvas.style.width = screenWidth + "px";
	canvas.style.height = screenHeight + "px";
	
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

	internalResolutionWidth = resx;
	internalResolutionHeight = resy;
	viewportScale = scale;
	
	viewportWidth = Math.floor(scale * resx);
	viewportHeight = Math.floor(scale * resy);
	viewportOffsetX = Math.floor((screenWidth - viewportWidth) / 2);
	viewportOffsetY = Math.floor((screenHeight - viewportHeight) / 2);

	let style = layoutContainer.style;
	style.left = viewportOffsetX + "px"
	style.top = viewportOffsetY + "px";
	style.width = viewportWidth + "px";
	style.height = viewportHeight + "px";
}

addEventListener("resize", () => {
	queueLayout();
});

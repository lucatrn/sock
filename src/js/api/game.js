import { canvas } from "../canvas.js";
import { packFloatColor } from "../color.js";
import { deviceIsMobile } from "../device.js";
import { addClassForeignStaticMethods } from "../foreign.js";
import { wrenGlBlendConstantStringToNumber, wrenGlBlendEquationStringToNumber, wrenGlFilterStringToNumber } from "../gl/api.js";
import { mainFramebuffer } from "../gl/framebuffer.js";
import { gl, resetGlBlending } from "../gl/gl.js";
import { createElement } from "../html.js";
import { layoutOptions, queueLayout, screenHeight, screenWidth } from "../layout.js";
import { systemFontDraw } from "../system-font.js";
import { callHandle_init_2, callHandle_update_0, callHandle_update_2 } from "../vm-call-handles.js";
import { getSlotBytes, wrenAbort, wrenCall, wrenEnsureSlots, wrenGetSlotBool, wrenGetSlotDouble, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenSetMapValue, wrenSetSlotBool, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNewMap, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";

// Wren -> JS

let title = document.title;

export let fps = 60;
export let quitFromAPI = false;
export let gameIsReady = false;
/** @type {Promise<any>} */
export let updatePromise = null;
/** @type {(value: any) => void} */
let updatePromiseFunction = null;
let cursor = "default";
let printColor = 0xffffffff;
let wantFullscreen = false;
let gettingDOMFullscreen = false;
/** @type {number} */
let argumentsMapHandle = null;

export function prepareUpdatePromise() {
	return updatePromise = new Promise((resolve) => {
		updatePromiseFunction = resolve;
	});
}

export function gameBusyWithDOMFallback() {
	return gettingDOMFullscreen;
}

addClassForeignStaticMethods("sock", "Game", {
	"title"() {
		wrenSetSlotString(0, title);
	},
	"title=(_)"() {
		if (wrenGetSlotType(1) !== 6) {
			wrenAbort("title must be a String");
			return;
		}

		document.title = title = wrenGetSlotString(1);
	},
	"layoutChanged_(_,_,_,_,_)"() {
		if (
			wrenGetSlotType(1) !== 1
			||
			wrenGetSlotType(2) !== 1
			||
			wrenGetSlotType(3) !== 0
			||
			wrenGetSlotType(4) !== 0
			||
			wrenGetSlotType(5) !== 1
		) {
			wrenAbort("invalid args");
			return;
		}

		let width = wrenGetSlotDouble(1);
		let height = wrenGetSlotDouble(2);
		let isFixed = wrenGetSlotBool(3);
		let isPixelPerfect = wrenGetSlotBool(4);
		let maxScale = wrenGetSlotDouble(5);

		if (width < 1 || height < 1 || maxScale < 1) {
			wrenAbort("resolution/scale must be positive");
			return;
		}

		layoutOptions.pixelScaling = isPixelPerfect;
		layoutOptions.resolution = isFixed ? [ Math.trunc(width), Math.trunc(height) ] : null;
		layoutOptions.maxScale = Math.trunc(maxScale);

		queueLayout();
	},
	"scaleFilter"() {
		return mainFramebuffer.filter ? "nearest" : "linear";
	},
	"scaleFilter=(_)"() {
		let filter = wrenGlFilterStringToNumber(1);

		if (filter != null) {
			mainFramebuffer.setFilter(filter);
		}
	},
	"fullscreenAllowed"() {
		wrenSetSlotBool(0, document.fullscreenEnabled);
	},
	"fullscreen"() {
		wrenSetSlotBool(0, wantFullscreen || document.fullscreenElement != null);
	},
	"setFullscreen_(_)"() {
		if (wrenGetSlotType(1) !== 0) {
			wrenAbort("fullscreen must be a Bool");
			return;
		}

		let fullscreen = wrenGetSlotBool(1);

		if (fullscreen) {
			if (!wantFullscreen && !document.fullscreenElement) {
				// Check if the browser will even let us use fullscreen at all.
				if (!document.fullscreenEnabled) {
					console.warn("fullscreen is blocked by the browser, see Game.fullscreenAllowed");
					return;
				}

				// Since fullscreen request may be async, track that we're going to trigger request.
				wantFullscreen = true;
				
				// Request fullscreen.
				// Note that this may fail if the browser doesn't think this was triggered by a user interaction.
				// (e.g. Safari almost always thinks this, since we don't handle inputs directly within input callbacks)
				document.body.requestFullscreen().then(() => {
					wantFullscreen = false;
				}, () => {
					gettingDOMFullscreen = true;

					// TODO this message needs to be localised.
					let input = deviceIsMobile ? "tap" : "press any mouse or keyboard button";
					let message = `Please ${input} to enter fullscreen.`;

					let dialog = createElement("div", { class: "overlay" }, [
						createElement("img", { style: "width: 185px; margin-bottom: 14px;", class: "pixel", alt: "icons of a mouse, keyboard, and fullscreen warning", src: "data:image/gif;base64,R0lGODdhJQAJAJAAAAAAAP///yH5BAkKAAAALAAAAAAlAAkAAAIzjB+ge2zrEFIJVHgxpJvW311Z6H2g1Wkph5rSuMFqY43ySrZenKOsGrP1gJGXMfQoIY0FADs=" }),
						message,
					]);

					
					let triggerFullscreen = () => {
						document.body.requestFullscreen().catch((error) => {
							console.warn("DOM fullscreen fallback failed", error);
						}).then(() => {
							wantFullscreen = false;
							gettingDOMFullscreen = false;

							dialog.remove();

							removeEventListener("keydown", triggerFullscreen);
						});
					};

					dialog.onclick = triggerFullscreen;
					addEventListener("keydown", triggerFullscreen);

					document.body.append(dialog);
				});
			}
		} else {
			wantFullscreen = false;
			if (document.fullscreenElement) {
				document.exitFullscreen();
			}
		}
	},
	"fps"() {
		if (fps < 0) {
			wrenSetSlotNull(0);
		} else {
			wrenSetSlotDouble(0, fps);
		}
	},
	"fps=(_)"() {
		let type = wrenGetSlotType(1);
		if (type === 5) {
			fps = -1;
		} else if (type === 1) {
			let value = wrenGetSlotDouble(1);
			if (fps <= 0) {
				wrenAbort("fps must be positive");
			} else {
				fps = value;
			}
		} else {
			wrenAbort("fps must be Num or null");
		}
	},
	"cursor"() {
		wrenSetSlotString(0, cursor);
	},
	"cursor=(_)"() {
		let type = wrenGetSlotType(1);
		if (type === 5) {
			cursor = "default";
		} else if (type === 6) {
			let name = wrenGetSlotString(1);
			
			if (!cursorSockToCSS.hasOwnProperty(name)) {
				wrenAbort(`invalid cursor type "${name}"`);
				return;
			}

			cursor = name;
		} else {
			wrenAbort("cursor must be null or a string");
			return;
		}

		canvas.style.cursor = cursorSockToCSS[cursor] || cursor;
	},
	"quit()"() {
		quitFromAPI = true;
	},
	"ready_()"() {
		gameIsReady = true;

		if (updatePromiseFunction) {
			updatePromiseFunction();
			updatePromiseFunction = null;
			updatePromise = null;
		}
	},
	"print_(_,_,_)"() {
		if (wrenGetSlotType(1) !== 6 || wrenGetSlotType(2) !== 1 || wrenGetSlotType(3) !== 1) {
			wrenAbort("invalid args");
			return;
		}

		let bytes = getSlotBytes(1);
		let x = Math.trunc(wrenGetSlotDouble(2));
		let y = Math.trunc(wrenGetSlotDouble(3));

		let resultY = systemFontDraw(bytes, x, y, printColor);

		wrenSetSlotDouble(0, resultY);
	},
	"setPrintColor_(_)"() {
		if (wrenGetSlotType(1) !== 1) {
			wrenAbort("color must be a Num");
			return;
		}

		printColor = wrenGetSlotDouble(1);
	},
	"clear_(_,_,_)"() {
		for (let i = 1; i <= 3; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("colors must be numbers");
				return;
			}
		}

		let r = wrenGetSlotDouble(1);
		let g = wrenGetSlotDouble(2);
		let b = wrenGetSlotDouble(3);

		gl.clearColor(r, g, b, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
	},
	"blendColor"() {
		let color = gl.getParameter(gl.BLEND_COLOR);

		wrenSetSlotDouble(0, packFloatColor(color[0], color[1], color[2], color[3]));
	},
	"setBlendingColor(_,_,_,_)"() {
		for (let i = 1; i <= 4; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("colors must be numbers");
				return;
			}
		}

		let r = wrenGetSlotDouble(1);
		let g = wrenGetSlotDouble(2);
		let b = wrenGetSlotDouble(3);
		let a = wrenGetSlotDouble(4);

		gl.blendColor(r, g, b, a);
	},
	"setBlendMode(_,_,_,_,_,_)"() {
		// Convert Sock strings to GL constants.
		let eqRGB = wrenGlBlendEquationStringToNumber(1);
		if (eqRGB == null) return;
		
		let eqAlpha = wrenGlBlendEquationStringToNumber(2);
		if (eqAlpha == null) return;

		let srcRGB = wrenGlBlendConstantStringToNumber(3);
		if (srcRGB == null) return;
		
		let srcAlpha = wrenGlBlendConstantStringToNumber(4);
		if (srcAlpha == null) return;
		
		let dstRGB = wrenGlBlendConstantStringToNumber(5);
		if (dstRGB == null) return;
		
		let dstAlpha = wrenGlBlendConstantStringToNumber(6);
		if (dstAlpha == null) return;

		// Set GL state.
		if (eqRGB === eqAlpha) {
			gl.blendEquation(eqRGB);
		} else {
			gl.blendEquationSeparate(eqRGB, eqAlpha);
		}

		if (srcRGB === srcAlpha && dstRGB === dstAlpha) {
			gl.blendFunc(srcRGB, dstRGB);
		} else {
			gl.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha);
		}
	},
	"resetBlendMode()"() {
		resetGlBlending();
	},
	"openURL(_)"() {
		if (wrenGetSlotType(1) !== 6) {
			wrenAbort("url must be a string");
			return;
		}

		let url = wrenGetSlotString(1);

		open(url, "_blank", "noreferrer");
	},
	"arguments"() {
		if (argumentsMapHandle) {
			wrenSetSlotHandle(0, argumentsMapHandle);
		} else {
			wrenEnsureSlots(3);
			wrenSetSlotNewMap(0);

			let search = new URL(location.href).searchParams;
			search.forEach((value, key) => {
				wrenSetSlotString(1, key);
				wrenSetSlotString(2, value);
				wrenSetMapValue(0, 1, 2);
			});

			argumentsMapHandle = wrenGetSlotHandle(0);
		}
	},
});

/**
 * Mapping from Sock cursor name to CSS cursor name.
 * `""` indicates a 1:1 mapping.
 * @type {Record<string, string>}
 */
let cursorSockToCSS = {
	"default": "",
	"pointer": "",
	"wait": "progress",
	"hidden": "none",
};


// JS -> Wren

let handle_Game = 0;

export function initGameModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Game", 0);
	handle_Game = wrenGetSlotHandle(0);

	updateGameModuleResolution(callHandle_init_2);
}

/**
 * @param {number} callHandle
 */
function updateGameModuleResolution(callHandle) {
	wrenEnsureSlots(3);
	wrenSetSlotHandle(0, handle_Game);
	wrenSetSlotDouble(1, screenWidth);
	wrenSetSlotDouble(2, screenHeight);
	wrenCall(callHandle || callHandle_update_2);
}

export function gameUpdate() {
	gameIsReady = false;
	
	wrenEnsureSlots(1);
	wrenSetSlotHandle(0, handle_Game);
	return wrenCall(callHandle_update_0);
}

import { canvas } from "../canvas.js";
import { Color } from "../color.js";
import { addClassForeignStaticMethods } from "../foreign.js";
import { glFilterStringToNumber } from "../gl/api.js";
import { mainFramebuffer } from "../gl/framebuffer.js";
import { computedLayout, layoutOptions, queueLayout } from "../layout.js";
import { systemFontDraw, SYSTEM_FONT } from "../system-font.js";
import { callHandle_init_2, callHandle_update_0, callHandle_update_2 } from "../vm-call-handles.js";
import { abortFiber, getSlotBytes, wrenCall, wrenEnsureSlots, wrenGetSlotBool, wrenGetSlotDouble, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotString } from "../vm.js";

// Wren -> JS

let title = document.title;

export let fps = 60;
export let quitFromAPI = false;
export let gameIsReady = false;
let cursor = "default";
let printColor = 0xffffffff;

addClassForeignStaticMethods("sock", "Game", {
	"title"() {
		wrenSetSlotString(0, title);
	},
	"title=(_)"() {
		document.title = title = wrenGetSlotString(1);
	},
	"layoutChanged_(_,_,_,_,_)"() {
		let sx = wrenGetSlotDouble(1);
		let sy = wrenGetSlotDouble(2);
		let isFixed = wrenGetSlotBool(3);
		let isPixelPerfect = wrenGetSlotBool(4);
		let maxScale = wrenGetSlotDouble(5);

		layoutOptions.pixelScaling = isPixelPerfect;
		layoutOptions.resolution = isFixed ? [ sx, sy ] : null;
		layoutOptions.maxScale = maxScale;

		queueLayout();
	},
	"scaleFilter"() {
		return mainFramebuffer.filter ? "nearest" : "linear";
	},
	"scaleFilter=(_)"() {
		let name = wrenGetSlotString(1);

		let filter = glFilterStringToNumber(name);

		mainFramebuffer.setFilter(filter);
	},
	"fps"() {
		wrenSetSlotDouble(0, fps);
	},
	"fps=(_)"() {
		fps = wrenGetSlotDouble(1);
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
				abortFiber(`invalid cursor type "${name}"`);
				return;
			}

			cursor = name;
		} else {
			abortFiber("cursor must be null or a string");
			return;
		}

		canvas.style.cursor = cursorSockToCSS[cursor] || cursor;
	},
	"quit_()"() {
		quitFromAPI = true;
	},
	"ready_()"() {
		gameIsReady = true;
	},
	"print_(_,_,_)"() {
		if (wrenGetSlotType(1) !== 6 || wrenGetSlotType(2) !== 1 || wrenGetSlotType(3) !== 1) {
			abortFiber("invalid Game.print arguments");
			return;
		}

		let bytes = getSlotBytes(1);
		let x = wrenGetSlotDouble(2);
		let y = wrenGetSlotDouble(3);

		let resultY = systemFontDraw(bytes, x, y, printColor);

		wrenSetSlotDouble(0, resultY);
	},
	"setPrintColor_(_)"() {
		printColor = wrenGetSlotDouble(1);
	},
});

/**
 * Mapping from Sock cursor name to CSS cursor name.
 * `""` indicates a 1:1 mapping.
 * @type {Record<string, string>}
 */
let cursorSockToCSS = {
	"none": "",
	"default": "",
	"pointer": "",
	"wait": "progress",
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
	wrenSetSlotDouble(1, computedLayout.sw);
	wrenSetSlotDouble(2, computedLayout.sh);
	wrenCall(callHandle || callHandle_update_2);
}

export function gameUpdate() {
	gameIsReady = false;
	
	wrenEnsureSlots(1);
	wrenSetSlotHandle(0, handle_Game);
	return wrenCall(callHandle_update_0);
}

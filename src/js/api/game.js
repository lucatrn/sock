import { addClassForeignStaticMethods } from "../foreign.js";
import { glFilterStringToNumber } from "../gl/api.js";
import { mainFramebuffer } from "../gl/framebuffer.js";
import { gl } from "../gl/gl.js";
import { computedLayout, layoutOptions, queueLayout } from "../layout.js";
import { callHandle_init_2, callHandle_update_2, vm } from "../vm.js";

// Wren -> JS

let title = document.title;

export let fps = 60;

addClassForeignStaticMethods("sock", "Game", {
	"title"() {
		vm.setSlotString(0, title);
	},
	"title=(_)"() {
		document.title = title = vm.getSlotString(1);
	},
	"layoutChanged_(_,_,_,_,_)"() {
		let sx = vm.getSlotDouble(1);
		let sy = vm.getSlotDouble(2);
		let isFixed = vm.getSlotBool(3);
		let isPixelPerfect = vm.getSlotBool(4);
		let maxScale = vm.getSlotDouble(5);

		layoutOptions.pixelScaling = isPixelPerfect;
		layoutOptions.resolution = isFixed ? [ sx, sy ] : null;
		layoutOptions.maxScale = maxScale;

		queueLayout();
	},
	"scaleFilter"() {
		return mainFramebuffer.filter ? "nearest" : "linear";
	},
	"scaleFilter=(_)"() {
		let name = vm.getSlotString(1);

		let filter = glFilterStringToNumber(name);

		mainFramebuffer.setFilter(filter);
	},
	"fps"() {
		vm.setSlotDouble(0, fps);
	},
	"fps=(_)"() {
		fps = vm.getSlotDouble(1);
	},
});


// JS -> Wren

let handle_Game = 0;

export function initGameModule() {
	vm.ensureSlots(1);
	vm.getVariable("sock", "Game", 0);
	handle_Game = vm.getSlotHandle(0);

	updateGameModuleResolution(callHandle_init_2);
}

export function updateGameModuleResolution(callHandle) {
	vm.ensureSlots(3);
	vm.setSlotHandle(0, handle_Game);
	vm.setSlotDouble(1, computedLayout.sw);
	vm.setSlotDouble(2, computedLayout.sh);
	vm.call(callHandle || callHandle_update_2);
}

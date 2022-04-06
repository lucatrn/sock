import { addForeignMethod } from "../foreign.js";
import { canvas } from "../canvas.js";
import { callHandle_init_0, vm } from "../vm.js";

let cursorIsHidden = false;

function updateCursor() {
	canvas.style.cursor = cursorIsHidden ? "none" : "";
}


// Wren -> JS

addForeignMethod("", "Cursor", true, "setHidden_(_)", () => {
	cursorIsHidden = vm.getSlotBool(1);

	updateCursor();
});


// JS -> Wren

let handle_Cursor = 0;

export function initCursorModule() {
	vm.ensureSlots(1);
	vm.getVariable("sock", "Cursor", 0);
	handle_Cursor = vm.getSlotHandle(0);

	// vm.ensureSlots(1);
	vm.setSlotHandle(0, handle_Cursor);
	vm.call(callHandle_init_0);
}

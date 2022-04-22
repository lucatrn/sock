import { addForeignMethod } from "../foreign.js";
import { canvas } from "../canvas.js";
import { wrenEnsureSlots, wrenGetSlotBool, wrenGetSlotHandle, wrenGetVariable } from "../vm.js";

let cursorIsHidden = false;

function updateCursor() {
	canvas.style.cursor = cursorIsHidden ? "none" : "";
}


// Wren -> JS

addForeignMethod("", "Cursor", true, "setHidden_(_)", () => {
	cursorIsHidden = wrenGetSlotBool(1);

	updateCursor();
});


// JS -> Wren

let handle_Cursor = 0;

export function initCursorModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Cursor", 0);
	handle_Cursor = wrenGetSlotHandle(0);
}

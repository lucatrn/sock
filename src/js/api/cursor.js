import { addForeignMethod } from "../foreign.js";
import { canvas } from "../gl/canvas.js";
import { callHandle_update_1, vm } from "../vm.js";

let cursorIsHidden = false;

function updateCursor() {
	canvas.style.cursor = cursorIsHidden ? "none" : "";
}


// Wren -> JS

addForeignMethod("~", "Cursor", true, "setHidden_(_)", () => {
	cursorIsHidden = vm.getSlotBool(1);

	updateCursor();
});


// JS -> Wren

vm.ensureSlots(1);
vm.getVariable("~", "Cursor", 0);
let handle_Time = vm.getSlotHandle(0);

/**
 * @param {number} frame
 */
export function timeUpdate(frame) {
	vm.ensureSlots(2);
	vm.setSlotHandle(0, handle_Time);
	vm.setSlotDouble(1, frame);
	vm.call(callHandle_update_1);
}

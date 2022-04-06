import { callHandle_update_1, vm } from "../vm.js";

let handle_Time = 0;

export function initTimeModule() {
	vm.ensureSlots(1);
	vm.getVariable("sock", "Time", 0);
	handle_Time = vm.getSlotHandle(0);
}

/**
 * @param {number} frame
 */
export function timeUpdate(frame) {
	vm.ensureSlots(2);
	vm.setSlotHandle(0, handle_Time);
	vm.setSlotDouble(1, frame);
	vm.call(callHandle_update_1);
}

import { callHandle_update_2, vm } from "../vm.js";

let handle_Time = 0;

export function initTimeModule() {
	vm.ensureSlots(1);
	vm.getVariable("sock", "Time", 0);
	handle_Time = vm.getSlotHandle(0);

	updateTimeModule(0, 0);
}

/**
 * @param {number} frame
 * @param {number} time
 */
export function updateTimeModule(frame, time) {
	vm.ensureSlots(2);
	vm.setSlotHandle(0, handle_Time);
	vm.setSlotDouble(1, frame);
	vm.setSlotDouble(2, time);
	vm.call(callHandle_update_2);
}

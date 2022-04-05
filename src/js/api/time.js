import { callHandle_update_1, vm } from "../vm.js";

vm.ensureSlots(1);
vm.getVariable("~", "Time", 0);
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

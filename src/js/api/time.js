import { vm, wrenCall, wrenEnsureSlots, wrenGetSlotHandle, wrenGetVariable, wrenSetSlotDouble, wrenSetSlotHandle } from "../vm.js";
import { callHandle_update_2 } from "../vm-call-handles.js";

let handle_Time = 0;

export function initTimeModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Time", 0);
	handle_Time = wrenGetSlotHandle(0);
}

/**
 * @param {number} frame
 * @param {number} time
 */
export function updateTimeModule(frame, time) {
	wrenEnsureSlots(3);
	wrenSetSlotHandle(0, handle_Time);
	wrenSetSlotDouble(1, frame);
	wrenSetSlotDouble(2, time);
	wrenCall(callHandle_update_2);
}

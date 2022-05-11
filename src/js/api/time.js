import { wrenCall, wrenEnsureSlots, wrenGetSlotHandle, wrenGetVariable, wrenSetSlotDouble, wrenSetSlotHandle } from "../vm.js";
import { callHandle_update_3 } from "../vm-call-handles.js";

let handle_Time = 0;

export function initTimeModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Time", 0);
	handle_Time = wrenGetSlotHandle(0);
}

/**
 * @param {number} frame
 * @param {number} time
 * @param {number} tick
 */
export function updateTimeModule(frame, tick, time) {
	wrenEnsureSlots(4);
	wrenSetSlotHandle(0, handle_Time);
	wrenSetSlotDouble(1, frame);
	wrenSetSlotDouble(2, tick);
	wrenSetSlotDouble(3, time);
	wrenCall(callHandle_update_3);
}

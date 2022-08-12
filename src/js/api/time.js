import { wrenCall, wrenEnsureSlots, wrenGetSlotHandle, wrenGetVariable, wrenSetSlotDouble, wrenSetSlotHandle } from "../vm.js";
import { callHandle_update_2 } from "../vm-call-handles.js";
import { addClassForeignStaticMethods } from "../foreign.js";

let handle_Time = 0;

export function initTimeModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Time", 0);
	handle_Time = wrenGetSlotHandle(0);
}

addClassForeignStaticMethods("sock", "Time", {
	"epoch"() {
		wrenSetSlotDouble(0, Date.now() / 1000);
	},
});

/**
 * @param {number} time
 * @param {number} deltaTime
 */
export function updateTimeModule(time, deltaTime) {
	wrenEnsureSlots(3);
	wrenSetSlotHandle(0, handle_Time);
	wrenSetSlotDouble(1, time);
	wrenSetSlotDouble(2, deltaTime);
	wrenCall(callHandle_update_2);
}

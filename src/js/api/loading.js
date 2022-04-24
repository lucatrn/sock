import { wrenCall, wrenEnsureSlots, wrenGetSlotHandle, wrenGetVariable, wrenSetSlotHandle } from "../vm.js";
import { callHandle_update_0 } from "../vm-call-handles.js";

let handle_Loading = 0;

export function initLoadingModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Loading", 0);
	handle_Loading = wrenGetSlotHandle(0);
}

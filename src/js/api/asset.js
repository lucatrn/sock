import { wrenCall, wrenEnsureSlots, wrenGetSlotHandle, wrenGetVariable, wrenSetSlotHandle } from "../vm.js";
import { callHandle_update_0 } from "../vm-call-handles.js";

let handle_Asset = 0;

export function initAssetModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Asset", 0);
	handle_Asset = wrenGetSlotHandle(0);
}

export function updateAssetModule() {
	wrenEnsureSlots(1);
	wrenSetSlotHandle(0, handle_Asset);
	wrenCall(callHandle_update_0);
}

import { callHandle_init_0, callHandle_update_0, callHandle_update_2, vm } from "../vm.js";

let handle_Asset = 0;

export function initAssetModule() {
	vm.ensureSlots(1);
	vm.getVariable("sock", "Asset", 0);
	handle_Asset = vm.getSlotHandle(0);

	vm.ensureSlots(1);
	vm.setSlotHandle(0, handle_Asset);
	vm.call(callHandle_init_0);
}

export function updateAssetModule() {
	vm.ensureSlots(1);
	vm.setSlotHandle(0, handle_Asset);
	vm.call(callHandle_update_0);
}

/**
 * @param {string} path
 * @returns {string}
 */
export function resolveAssetPath(path) {
	if (path[0] !== "/") {
		path = "/" + path;
	}

	return "assets" + path;
}

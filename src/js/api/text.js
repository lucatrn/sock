import { addForeignMethod } from "../foreign.js";
import { callHandle_load_1, callHandle_path_get, vm } from "../vm.js";

addForeignMethod("~", "Text", false, "load_()", async () => {
	let obj = vm.getSlotHandle(0);
	
	vm.call(callHandle_path_get);
	let path = vm.getSlotString(0);
	
	let text = await getText(path);

	vm.ensureSlots(2);
	vm.setSlotHandle(0, obj);
	vm.setSlotString(1, text);
	vm.call(callHandle_load_1);

	// TODO update asset of progress

	vm.releaseHandle(obj);
});

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
async function getText(path) {
	let response = await fetch(path);
	if (!response.ok) throw `Could not get "${path}": HTTP ${response.status} ${response.statusText}`;
	return response.text();
}

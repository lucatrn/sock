import { resolveForeignMethod, resolveForeignClass } from "./foreign.js";
import { VM } from "./wren.js";

/** @type {VM} */
export let vm;

/** @type {Uint8Array} */
export let HEAPU8;

/** @type {Float64Array} */
export let HEAPF64;

export let callHandle_call_0 = 0;
export let callHandle_transfer_1 = 0;
export let callHandle_path_get = 0;
export let callHandle_init_0 = 0;
export let callHandle_init_2 = 0;
export let callHandle_load_0 = 0;
export let callHandle_load_1 = 0;
export let callHandle_loaded_3 = 0;
export let callHandle_update_0 = 0;
export let callHandle_update_1 = 0;
export let callHandle_update_2 = 0;

export function createWrenVM() {
	vm = new VM({
		bindForeignMethodFn: resolveForeignMethod,
		bindForeignClassFn: resolveForeignClass,
		resolveModuleFn(importer, name) {
			if (name === "sock") return name;

			if (name[0] === "/") {
				return name;
			} else {
				let i = importer.lastIndexOf("/");
				
				return importer.slice(0, i + 1) + name;
			}
		},
	});

	HEAPU8 = new Uint8Array(vm.heap);
	HEAPF64 = new Float64Array(vm.heap);

	callHandle_call_0 = vm.makeCallHandle("call()");
	callHandle_transfer_1 = vm.makeCallHandle("transfer(_)");
	callHandle_path_get = vm.makeCallHandle("path");
	callHandle_init_0 = vm.makeCallHandle("init_()");
	callHandle_init_2 = vm.makeCallHandle("init_(_,_)");
	callHandle_load_0 = vm.makeCallHandle("load_()");
	callHandle_load_1 = vm.makeCallHandle("load_(_)");
	callHandle_loaded_3 = vm.makeCallHandle("loaded_(_,_,_)");
	callHandle_update_0 = vm.makeCallHandle("update_()");
	callHandle_update_1 = vm.makeCallHandle("update_(_)");
	callHandle_update_2 = vm.makeCallHandle("update_(_,_)");
}

/**
 * @param {string} message
 */
export function abortFiber(message) {
	vm.ensureSlots(1);
	vm.setSlotString(0, message);
	vm.abortFiber(0);
}

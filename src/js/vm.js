import { resolveForeignMethod } from "./foreign.js";
import { VM } from "./wren.js";

/** @type {VM} */
export let vm;

export let callHandle_call_0 = 0;
export let callHandle_transfer_1 = 0;
export let callHandle_path_get = 0;
export let callHandle_init_0 = 0;
export let callHandle_load_0 = 0;
export let callHandle_load_1 = 0;
export let callHandle_update_1 = 0;
export let callHandle_update_2 = 0;

export function createWrenVM() {
	vm = new VM({
		bindForeignMethodFn: resolveForeignMethod,
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

	callHandle_call_0 = vm.makeCallHandle("call()");
	callHandle_transfer_1 = vm.makeCallHandle("transfer(_)");
	callHandle_path_get = vm.makeCallHandle("path");
	callHandle_init_0 = vm.makeCallHandle("init_()");
	callHandle_load_0 = vm.makeCallHandle("load_()");
	callHandle_load_1 = vm.makeCallHandle("load_(_)");
	callHandle_update_1 = vm.makeCallHandle("update_(_)");
	callHandle_update_2 = vm.makeCallHandle("update_(_,_)");
}

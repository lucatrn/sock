import Wren from "./wren.js";
import { resolveForeignMethod } from "./foreign.js";

export let vm = new Wren.VM({
	bindForeignMethodFn: resolveForeignMethod,
	resolveModuleFn(importer, name) {
		if (name === "~") return "sock";

		return name;
	},
});

export let callHandle_transfer_1 = vm.makeCallHandle("transfer(_)");
export let callHandle_path_get = vm.makeCallHandle("path");
export let callHandle_load_0 = vm.makeCallHandle("load_()");
export let callHandle_load_1 = vm.makeCallHandle("load_(_)");
export let callHandle_update_1 = vm.makeCallHandle("update_(_)");
export let callHandle_update_2 = vm.makeCallHandle("update_(_,_)");

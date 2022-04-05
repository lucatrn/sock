import { addForeignMethod } from "../foreign.js";
import { vm } from "../vm.js";
import { returnAsAsync } from "./async.js";

export let assetsAreLoading = false;

addForeignMethod("~", "Assets", true, "load_(_,_,_)", () => {
	assetsAreLoading = true;

	let obj_fn = vm.getSlotHandle(2);
	let obj_fiber = vm.getSlotHandle(3);

	returnAsAsync()
});

import { Module, vm } from "./vm.js";

// Single repository for Wren call-handles.
// Help's us re-use common call-handles.

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
export let callHandle_update_3 = 0;
export let callHandle_resolve_2 = 0;
export let callHandle_toString = 0;
export let callHandle_updateMouse_3 = 0;
export let callHandle_updateTouch_5 = 0;


export function makeCallHandles() {
	callHandle_call_0 = wrenMakeCallHandle("call()");
	callHandle_transfer_1 = wrenMakeCallHandle("transfer(_)");
	callHandle_path_get = wrenMakeCallHandle("path");
	callHandle_init_0 = wrenMakeCallHandle("init_()");
	callHandle_init_2 = wrenMakeCallHandle("init_(_,_)");
	callHandle_load_0 = wrenMakeCallHandle("load_()");
	callHandle_load_1 = wrenMakeCallHandle("load_(_)");
	callHandle_loaded_3 = wrenMakeCallHandle("loaded_(_,_,_)");
	callHandle_update_0 = wrenMakeCallHandle("update_()");
	callHandle_update_1 = wrenMakeCallHandle("update_(_)");
	callHandle_update_2 = wrenMakeCallHandle("update_(_,_)");
	callHandle_update_3 = wrenMakeCallHandle("update_(_,_,_)");
	callHandle_resolve_2 = wrenMakeCallHandle("resolve_(_,_)");
	callHandle_toString = wrenMakeCallHandle("toString");
	callHandle_updateMouse_3 = wrenMakeCallHandle("updateMouse_(_,_,_)")
	callHandle_updateTouch_5 = wrenMakeCallHandle("updateTouch_(_,_,_,_,_)")
}

/**
 * @param {string} signature
 * @returns {number}
 */
function wrenMakeCallHandle(signature) {
	return Module.ccall("wrenMakeCallHandle",
		"number",
		["number", "string"],
		[vm, signature]
	);
}

import { callHandle_resolve_2 } from "../vm-call-handles.js";
import { wrenCall, wrenEnsureSlots, wrenGetSlotHandle, wrenGetSlotType, wrenGetVariable, wrenReleaseHandle, wrenSetSlotBool, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";

export let handle_Promise = 0;

export function initPromiseModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Promise", 0);
	handle_Promise = wrenGetSlotHandle(0);
}

/**
 * @param {number} promiseHandle
 * @param {Promise<WrenPromiseResult>} pvalue
 */
export function resolveWrenPromise(promiseHandle, pvalue) {
	pvalue.then(result => {
		resolve(promiseHandle, true, result);
	}, error => {
		resolve(promiseHandle, false, String(error));
	});
}

/**
 * 
 * @param {number} promiseHandle 
 * @param {boolean} success 
 * @param {WrenPromiseResult} result 
 */
function resolve(promiseHandle, success, result) {
	wrenEnsureSlots(3);
	wrenSetSlotHandle(0, promiseHandle);
	wrenSetSlotBool(1, success);

	if (result instanceof ArrayBuffer || typeof result === "string") {
		wrenSetSlotString(2, result);
	} else if (result instanceof WrenHandle) {
		wrenSetSlotHandle(2, result.handle);
		wrenReleaseHandle(result.handle);
	} else if (typeof result === "number") {
		wrenSetSlotDouble(2, result);
	} else if (typeof result === "boolean") {
		wrenSetSlotBool(2, result);
	} else {
		wrenSetSlotNull(2);
	}

	while (true) {
		if (wrenCall(callHandle_resolve_2) !== 0) {
			break;
		}
		
		wrenEnsureSlots(3);
		
		if (wrenGetSlotType(0) === 0) {
			break;
		}

		wrenSetSlotHandle(0, promiseHandle);
		wrenSetSlotNull(1);
		wrenSetSlotNull(2);
	}

	wrenReleaseHandle(promiseHandle);
}

export class WrenHandle {
	/**
	 * @param {number} handle 
	 */
	constructor(handle) {
		this.handle = handle;
	}
}

/**
 * To provide a value that is already in VM slot 2, pass the `IN_SLOT_2` object.
 * @typedef {string | number | boolean | ArrayBuffer | WrenHandle} WrenPromiseResult
 */

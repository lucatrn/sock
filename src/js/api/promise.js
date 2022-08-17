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
 * @param {WrenPromiseResult|Promise<WrenPromiseResult>} pvalue
 */
export function resolveWrenPromise(promiseHandle, pvalue) {
	if (pvalue instanceof Promise) {
		Promise.resolve(pvalue).then(result => {
			resolve(promiseHandle, true, result);
		}, error => {
			resolve(promiseHandle, false, String(error));
		});
	} else {
		resolveSync(promiseHandle, pvalue);
	}
}

/**
 * @param {number} promiseHandle 
 * @param {boolean} success 
 * @param {WrenPromiseResult} result 
 */
function resolve(promiseHandle, success, result) {
	wrenEnsureSlots(3);
	wrenSetSlotHandle(0, promiseHandle);
	wrenSetSlotBool(1, success);

	putResultInSlot(result, 2);

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

/**
 * @param {number} promiseHandle
 * @param {WrenPromiseResult} result
 */
function resolveSync(promiseHandle, result) {
	wrenReleaseHandle(promiseHandle);
	putResultInSlot(result, 0);
}

/**
 * @param {WrenPromiseResult} result
 * @param {number} slot
 */
function putResultInSlot(result, slot) {
	if (result instanceof ArrayBuffer || typeof result === "string") {
		wrenSetSlotString(slot, result);
	} else if (result instanceof WrenHandle) {
		wrenSetSlotHandle(slot, result.handle);
		wrenReleaseHandle(result.handle);
	} else if (typeof result === "number") {
		wrenSetSlotDouble(slot, result);
	} else if (typeof result === "boolean") {
		wrenSetSlotBool(slot, result);
	} else {
		wrenSetSlotNull(slot);
	}
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
 * @typedef {string | number | boolean | ArrayBuffer | WrenHandle | void} WrenPromiseResult
 */

import { callHandle_transfer_1, vm } from "../vm.js";

/**
 * @param {number} fiberHandle
 * @param {PromiseLike<any>} promise
 */
export function returnAsAsync(fiberHandle, promise) {

	promise.then((result) => {
		vm.ensureSlots(2);
		vm.setSlotHandle(0, fiberHandle);

		if (result == null) {
			vm.setSlotNull(1);
		} else if (typeof result === "string") {
			vm.setSlotString(1, result);
		} else if (typeof result === "number") {
			vm.setSlotDouble(1, result);
		} else if (typeof result === "boolean") {
			vm.setSlotBool(1, result);
		} else if (result instanceof Uint8Array || result instanceof Uint8ClampedArray) {
			vm.setSlotBytes(1, result, result.byteLength);
		} else {
			throw TypeError("async result");
		}
		
		vm.call(callHandle_transfer_1);
		vm.releaseHandle(fiberHandle);
	});

	vm.setSlotDouble(0, 5073173151553911);
}

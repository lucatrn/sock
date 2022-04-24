import { addClassForeignMethods } from "../foreign.js";
import { httpGET } from "../network/http.js";
import { abortFiber, HEAP, Module, vm, wrenGetSlotForeign, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenReleaseHandle } from "../vm.js";
import { getAsset, initLoadingProgressList } from "./asset.js";

addClassForeignMethods("sock", "Array", {
	"load_(_)"() {
		if (wrenGetSlotType(1) !== 6) {
			abortFiber("path must be a string");
			return;
		}

		let arrayHandle = wrenGetSlotHandle(0);

		let path = wrenGetSlotString(1);

		let progressListHandle = initLoadingProgressList();

		loadArray(arrayHandle, path, progressListHandle);
	},
});

/**
 * @param {number} arrayHandle
 * @param {string} path
 * @param {number} progressListHandle
 */
async function loadArray(arrayHandle, path, progressListHandle) {
	try {
		// Get ArrayBuffer and update progress in list.
		await getAsset(progressListHandle, (onprogress) => httpGET("assets" + path, "arraybuffer", onprogress), /** @param {ArrayBuffer} result */(result) => {
			// Copy ArrayBuffer to C.
			let u8 = new Uint8Array(result);

			// Use helper function to resize array + get array pointer.
			let dataPtr = Module.ccall("sock_array_setter_helper", "number", [ "number", "number", "number" ], [ vm, arrayHandle, u8.length ]);
			
			// Copy directly to Wasm memory.
			let data = new Uint8Array(HEAP(), dataPtr);
			
			data.set(u8);

			console.log("set array at " + dataPtr + " of length " + u8.length, u8);
		});
	} finally {
		wrenReleaseHandle(arrayHandle);
	}
}

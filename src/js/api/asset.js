import { addClassForeignStaticMethods } from "../foreign.js";
import { httpGET } from "../network/http.js";
import { abortFiber, wrenEnsureSlots, wrenGetListCount, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenInsertInList, wrenReleaseHandle, wrenSetListElement, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNewList, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";

let handle_Asset = 0;

export function initAssetModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Asset", 0);
	handle_Asset = wrenGetSlotHandle(0);
}

addClassForeignStaticMethods("sock", "Asset", {
	"loadString_(_,_)"() {
		getAssetWithPath((url, onprogress) =>
			httpGET(url, "arraybuffer", onprogress)
		);
	},
});

/**
 * Used to implement async asset load Wren function.
 * The function must take 1 arg:
 * - 0: list of length 2. item 0 is progress, item 1 is result/error
 * @param {number} listHandle
 * @param {(onprogress: (progress: number) => void) => Promise<T>} getter
 * @param {(result: T) => void} [resultHandler]
 * @template T
 */
export async function getAsset(listHandle, getter, resultHandler) {
	try {
		let result = await getter((progress) => {
			wrenEnsureSlots(2);
			wrenSetSlotHandle(0, listHandle);

			// Only set progress if list has atleast one slot.
			// This should only fail if the user is being evil with the API...
			if (wrenGetListCount(0) > 0) {
				wrenSetSlotDouble(1, progress);
				wrenSetListElement(0, 0, 1);
			}
		});

		// Got result! Let's update the progress and result in the list.
		wrenEnsureSlots(2);
		wrenSetSlotHandle(0, listHandle);

		// Set result.
		if (resultHandler) {
			// Use custom handler.
			// Put slots as they were afterwards.
			resultHandler(result);
			
			wrenSetSlotHandle(0, listHandle);
		} else {
			if (result instanceof ArrayBuffer || typeof result === "string") {
				wrenSetSlotString(1, result);
			} else if (typeof result === "number") {
				wrenSetSlotDouble(1, result);
			} else {
				wrenSetSlotNull(1);
			}
			wrenSetListElement(0, 1, 1);
		}

		// Set progress to 1.
		wrenSetSlotDouble(1, 1);
		wrenSetListElement(0, 0, 1);
	} catch (error) {
		wrenEnsureSlots(2);
		wrenSetSlotHandle(0, listHandle);

		// Ensure list has two slots.
		while (wrenGetListCount(0) < 2) {
			wrenSetSlotNull(1);
			wrenInsertInList(0, -1, 1);
		}
		
		// Save progress -1 to index 0.
		wrenSetSlotDouble(1, -1);
		wrenSetListElement(0, 0, 1);
		
		// Save error index 1.
		wrenSetSlotString(1, String(error));
		wrenSetListElement(0, 1, 1);
	} finally {
		wrenReleaseHandle(listHandle);
	}
}

/**
 * Used to implement async asset load Wren function.
 * The function must take 2 args:
 * - 0: absolute path
 * - 1: list of length 2. item 0 is progress, item 1 is result/error
 * @param {(url: string, onprogress: (progress: number) => void) => Promise<string|number|ArrayBuffer>} getter 
 */
export function getAssetWithPath(getter) {
	if (wrenGetSlotType(1) !== 3 || wrenGetSlotType(2) !== 6) {
		abortFiber("args must be (list, string)");
		return;
	}
	
	if (wrenGetListCount(1) < 2) {
		abortFiber("list length must be 2 or more");
		return;
	}

	let list = wrenGetSlotHandle(1);

	let path = wrenGetSlotString(2);
	let url = "assets" + path;

	getAsset(list, (onprogress) => getter(url, onprogress));
}

/**
 * Create the list `[ 0, null ]` in slot 0.
 * Get a handle to it and return it.
 */
export function initLoadingProgressList() {
	wrenSetSlotNewList(0);

	wrenSetSlotDouble(1, 0);
	wrenInsertInList(0, -1, 1);

	wrenSetSlotNull(1);
	wrenInsertInList(0, -1, 1);
	
	return wrenGetSlotHandle(0);
}

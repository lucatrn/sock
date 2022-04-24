import { addClassForeignStaticMethods } from "../foreign.js";
import { httpGET } from "../network/http.js";
import { abortFiber, wrenEnsureSlots, wrenGetListCount, wrenGetSlotDouble, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenReleaseHandle, wrenSetListElement, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";

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
 * @param {(onprogress: (progress: number) => void) => Promise<string|number|ArrayBuffer>} getter 
 */
export function getAsset(getter) {
	if (wrenGetSlotType(1) !== 3) {
		abortFiber("invalid args");
		return;
	}

	if (wrenGetListCount(1) !== 2) {
		abortFiber("list must be length 2");
		return;
	}

	let list = wrenGetSlotHandle(1);

	getter((progress) => {
		wrenEnsureSlots(2);

		wrenSetSlotHandle(0, list);
		wrenSetSlotDouble(1, progress);
		wrenSetListElement(0, 0, 1);
	}).then(result => {
		wrenEnsureSlots(2);

		wrenSetSlotHandle(0, list);

		// Set progress to 1.
		wrenSetSlotDouble(1, 1);
		wrenSetListElement(0, 0, 1);

		// Set result.
		if (result instanceof ArrayBuffer || typeof result === "string") {
			wrenSetSlotString(1, result);
		} else if (typeof result === "number") {
			wrenSetSlotDouble(1, result);
		} else {
			wrenSetSlotNull(1);
		}
		wrenSetListElement(0, 1, 1);
	}, (error) => {
		wrenEnsureSlots(2);

		wrenSetSlotHandle(0, list);
		wrenSetSlotDouble(1, -1);
		wrenSetListElement(0, 0, 1);

		wrenSetSlotHandle(0, list);
		wrenSetSlotString(1, String(error));
		wrenSetListElement(0, 1, 1);
	}).finally(() => {
		wrenReleaseHandle(list);
	});
}

/**
 * Used to implement async asset load Wren function.
 * The function must take 2 args:
 * - 0: absolute path
 * - 1: list of length 2. item 0 is progress, item 1 is result/error
 * @param {(url: string, onprogress: (progress: number) => void) => Promise<string|number|ArrayBuffer>} getter 
 */
export function getAssetWithPath(getter) {
	if (wrenGetSlotType(2) !== 6) {
		abortFiber("invalid args");
		return;
	}

	let path = wrenGetSlotString(2);
	let url = "assets" + path;

	getAsset((onprogress) => getter(url, onprogress));
}

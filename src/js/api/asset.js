import { addClassForeignStaticMethods } from "../foreign.js";
import { httpGET } from "../network/http.js";
import { resolveAbsoluteAssetPath } from "../path.js";
import { wrenAbort, wrenEnsureSlots, wrenGetSlotHandle, wrenGetSlotIsInstanceOf, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenSetSlotHandle } from "../vm.js";
import { handle_Promise, resolveWrenPromise } from "./promise.js";

let handle_Asset = 0;

export function initAssetModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Asset", 0);
	handle_Asset = wrenGetSlotHandle(0);
}

addClassForeignStaticMethods("sock", "Asset", {
	"loadString_(_,_)"() {
		loadAsset(url => httpGET(url, "arraybuffer"));
	},
});

/**
 * Loads asset from (path, promise) call.
 * @param {(url: string, path: string) => Promise<import("./promise.js").WrenPromiseResult>} loader
 */
export function loadAsset(loader) {
	wrenEnsureSlots(4);
	wrenSetSlotHandle(3, handle_Promise);

	if (wrenGetSlotType(1) !== 6 || !wrenGetSlotIsInstanceOf(2, 3)) {
		wrenAbort("args must be (string, Promise)");
		return;
	}

	let path = wrenGetSlotString(1);
	let url = resolveAbsoluteAssetPath(path);
	let promise = wrenGetSlotHandle(2);

	wrenSetSlotHandle(0, promise);

	resolveWrenPromise(promise, loader(url, path));
}

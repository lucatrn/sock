import { addClassForeignStaticMethods } from "../foreign.js";
import { wrenAbort, wrenEnsureSlots, wrenGetSlotString, wrenGetSlotType, wrenInsertInList, wrenSetSlotBool, wrenSetSlotNewList, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";

/**
 * @param {number} slot
 */
function validateKey(slot) {
	if (wrenGetSlotType(slot) !== 6) {
		wrenAbort("key must be a string");
		return null;
	}
	return wrenGetSlotString(slot);
}

let keyPrefix = "sock_";

addClassForeignStaticMethods("sock", "Storage", {
	"contains(_)"() {
		let key = validateKey(1);
		if (key != null) {
			wrenSetSlotBool(0, localStorage.getItem(keyPrefix + key) !== null);
		}
	},
	"load_(_)"() {
		let key = validateKey(1);
		if (key != null) {
			let item = localStorage.getItem(keyPrefix + key);
	
			if (item == null) {
				wrenSetSlotNull(0);
			} else {
				wrenSetSlotString(0, item);
			}
		}
	},
	"save_(_,_)"() {
		let key = validateKey(1);
		if (key != null) {
			if (wrenGetSlotType(2) !== 6) {
				wrenAbort("value must be a string");
				return;
			}

			let value = wrenGetSlotString(2);
	
			localStorage.setItem(keyPrefix + key, value);
		}
	},
	"delete(_)"() {
		let key = validateKey(1);
		if (key != null) {
			localStorage.removeItem(keyPrefix + key);
		}
	},
// 	"keys"() {
// 		wrenEnsureSlots(2);
// 		wrenSetSlotNewList(0);
// 
// 		for (let i = 0; i < localStorage.length; i++) {
// 			let key = localStorage.key(i);
// 			if (key.startsWith(keyPrefix)) {
// 				wrenSetSlotString(1, key.slice(keyPrefix.length));
// 				wrenInsertInList(0, -1, 1);
// 			}
// 		}
// 	}
});

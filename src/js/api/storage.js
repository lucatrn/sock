import { addClassForeignStaticMethods } from "../foreign.js";
import { wrenAbort, wrenEnsureSlots, wrenGetSlotString, wrenGetSlotType, wrenInsertInList, wrenSetSlotBool, wrenSetSlotNewList, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";

/**
 * @type {string}
 */
let storageID = null;

/**
 * @param {number} slot
 */
function validateKey(slot) {
	if (storageID == null) {
		wrenAbort("id must be set before using other Storage methods");
		return null;
	}

	if (wrenGetSlotType(slot) !== 6) {
		wrenAbort("key must be a string");
		return null;
	}

	let key = wrenGetSlotString(slot);
	if (!validateKeyIdentifier(key)) {
		wrenAbort("key may only contain letters, numbers, underscores and dashes");
		return;
	}

	return storageID + "/" + key;
}

/**
 * @param {string} s
 */
function validateKeyIdentifier(s) {
	return /^[a-zA-Z0-9_\-]+$/.test(s);
}


addClassForeignStaticMethods("sock", "Storage", {
	"id"() {
		if (storageID) {
			wrenSetSlotString(0, storageID);
		} else {
			wrenSetSlotNull(0);
		}
	},
	"id=(_)"() {
		if (wrenGetSlotType(1) !== 6) {
			wrenAbort("id must be a String");
			return;
		}

		let s = wrenGetSlotString(1);

		if (validateKeyIdentifier(s)) {
			storageID = s;
		} else {
			wrenAbort("id may only contain letters, numbers, underscores and dashes");
		}
	},
	"contains(_)"() {
		let key = validateKey(1);
		if (key) {
			wrenSetSlotBool(0, localStorage.getItem(key) !== null);
		}
	},
	"load_(_)"() {
		let key = validateKey(1);
		if (key) {
			let item = localStorage.getItem(key);
	
			if (item == null) {
				wrenSetSlotNull(0);
			} else {
				wrenSetSlotString(0, item);
			}
		}
	},
	"save_(_,_)"() {
		if (wrenGetSlotType(2) !== 6) {
			wrenAbort("value must be a String");
			return;
		}
		
		let key = validateKey(1);
		if (key) {
			let value = wrenGetSlotString(2);
	
			localStorage.setItem(key, value);
		}
	},
	"delete(_)"() {
		let key = validateKey(1);
		if (key) {
			localStorage.removeItem(key);
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

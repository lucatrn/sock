import { addClassForeignStaticMethods } from "../foreign.js";
import { jsToWrenJSON, wrenJSONToJS } from "../json.js";
import { wrenAbort, wrenGetSlotHandle, wrenGetSlotIsInstanceOf, wrenGetSlotString, wrenGetSlotType, wrenSetSlotHandle, wrenSetSlotString } from "../vm.js";
import { handle_Promise, resolveWrenPromise } from "./promise.js";

addClassForeignStaticMethods("sock", "JavaScript", {
	// eval_(promise, argValuesJSON, argNamesJSON, jsScript)
	"eval_(_,_,_,_)"() {
		// Get JavaScript source.
		if (wrenGetSlotType(4) !== 6) {
			wrenAbort("script must be a string");
			return;
		}

		let source = wrenGetSlotString(4);

		// Get arg names and values.
		let argValues = getJSONFromSlot(2);
		if (!argValues) return;

		let argNames = getJSONFromSlot(3);
		if (!argNames) return;

		if (!isStringArray(argNames) || !Array.isArray(argValues)) {
			wrenAbort("arg values and names must be Lists, arg names must be a String List");
			return;
		}

		if (argNames.length !== argValues.length) {
			wrenAbort("arg names and values must have same length");
			return;
		}

		// Get promise.
		let arg1Type = wrenGetSlotType(1);
		let promise;
		if (arg1Type === 5) {
			promise = null;
		} else {
			wrenSetSlotHandle(2, handle_Promise);

			if (!wrenGetSlotIsInstanceOf(1, 2)) {
				wrenAbort("first arg must be null or Promise");
				return;
			}

			promise = wrenGetSlotHandle(1);
		}

		let isSync = promise == null;

		// Compile and execute function.
		let fnArgs = argNames.concat(source);

		let result;
		try {
			let fn = isSync ? new Function(...fnArgs) : new AsyncFunction(...fnArgs);

			result = fn.apply(null, argValues);
		} catch (error) {
			wrenAbort("JavaScript error: " + error);
			return;
		}

		// Return result.
		if (isSync) {
			wrenSetSlotString(0, jsToWrenJSON(result));
		} else {
			resolveWrenPromise(promise, result.then(value => jsToWrenJSON(value)));

			wrenSetSlotHandle(0, promise);
		}
	}
});

/**
 * @param {number} slot
 */
function getJSONFromSlot(slot) {
	let type = wrenGetSlotType(slot);
	if (type === 5) {
		return [];
	} else if (type === 6) {
		return wrenJSONToJS(wrenGetSlotString(slot));
	} else {
		wrenAbort("expected string or null for JS args");
		return false;
	}
}

/**
 * @param {any} xs
 * @returns {xs is string[]}
 */
function isStringArray(xs) {
	return Array.isArray(xs) && xs.every(x => typeof x === "string");
}

let AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

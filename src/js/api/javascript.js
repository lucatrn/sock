import { addClassForeignStaticMethods } from "../foreign.js";
import { jsToWrenJSON, wrenJSONToJS } from "../json.js";
import { callHandle_update_3 } from "../vm-call-handles.js";
import { abortFiber, wrenCall, wrenEnsureSlots, wrenGetSlotBool, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenSetSlotBool, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";

let handle_JavaScript = 0;

export function initJavaScriptModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "JavaScript", 0);
	handle_JavaScript = wrenGetSlotHandle(0);
}

addClassForeignStaticMethods("sock", "JavaScript", {
	"eval_(_,_,_,_)"() {
		if (wrenGetSlotType(1) !== 0 || wrenGetSlotType(4) !== 6) {
			abortFiber("invalid args");
			return;
		}

		let isSync = wrenGetSlotBool(1);
		let source = wrenGetSlotString(4);
		
		let argValues = getJSONFromSlot(2);
		let argNames = getJSONFromSlot(3);

		if (!argValues || !argNames) {
			return;
		}

		if (!Array.isArray(argValues) || !isStringArray(argNames)) {
			abortFiber("arg values and names must be Lists, arg names must be a String[]");
			return;
		}

		if (argValues.length !== argNames.length) {
			abortFiber("arg values and names must have same length");
			return;
		}

		let fnArgs = argNames.concat(source);

		let result;
		try {
			let fn = isSync ? new Function(...fnArgs) : new AsyncFunction(...fnArgs);

			result = fn.apply(null, argValues);
		} catch (error) {
			abortFiber("JavaScript error: " + error);
			return;
		}

		if (isSync) {
			wrenSetSlotString(0, jsToWrenJSON(result));
		} else {
			let id = asyncCallCount++;
			
			// Handle async result.
			/** @type {Promise<any>} */(result).then((value) => {
				sendAsyncResult(id, value, false);
			}, (error) => {
				sendAsyncResult(id, error, true);
			});

			wrenSetSlotDouble(0, id);
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
		return wrenJSONToJS(wrenGetSlotString(2));
	} else {
		abortFiber("expected string or null for JS args");
		return false;
	}
}

/**
 * @param {number} id
 * @param {any} result 
 * @param {boolean} isError 
 */
function sendAsyncResult(id, result, isError) {
	wrenEnsureSlots(4);
	wrenSetSlotHandle(0, handle_JavaScript);
	wrenSetSlotDouble(1, id);
	wrenSetSlotString(2, jsToWrenJSON(result));
	wrenSetSlotBool(3, isError);
	wrenCall(callHandle_update_3);
}

/**
 * @param {any} xs
 * @returns {xs is string[]}
 */
function isStringArray(xs) {
	return Array.isArray(xs) && xs.every(x => typeof x === "string");
}

let AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

let asyncCallCount = 0;

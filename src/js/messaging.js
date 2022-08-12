import { sockJsGlobal } from "./globals.js";

/**
 * If messaging was flagged via HTML page.
 */
export let messagingEnabled = !!sockJsGlobal.messaging;

/** @type {(((arg: any) => void) & { type: string })[]} */
let waitingMessages  = [];

/**
 * @param {string} type
 * @returns {Promise<any>}
 */
export function waitForMessage(type) {
	return new Promise(/** @param {((arg: any) => void) & { type: string }} resolve */(resolve) => {
		resolve.type = type;
		waitingMessages.push(resolve);
	});
}

/**
 * @param {string} type
 * @param {string} [data]
 */
export function sendMessage(type, data) {
	if (parent !== window) parent.postMessage({ type: type, data: data });
}

if (messagingEnabled) {
	addEventListener("message", (event) => {
		let data = event.data;
		if (data && typeof data === "object") {
			let msgType = data.type;
			if (msgType) {
				let arg = data.data;

				// Pull out functions with the corresponding type.
				let stillWaiting = [];
				let callNow = [];
				for (let f of waitingMessages) {
					if (f.type === msgType) {
						callNow.push(f);
					} else {
						stillWaiting.push(f);
					}
				}
				waitingMessages = stillWaiting;

				// Call matching functions.
				for (let f of callNow) {
					f(arg);
				}
			}
		}
	});
}

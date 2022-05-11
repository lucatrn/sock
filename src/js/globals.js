import { canvas } from "./canvas.js";

/**
 * A global JavaScript object "sock", provides utils for the JavaScript class.
 * @type {any}
 */
export let sockJsGlobal = self["sock"] = {

	canvas: canvas,
	
	async toggleFullscreen() {
		if (document.fullscreenEnabled) {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
				return true;
			} else {
				try {
					await document.body.requestFullscreen();
					return true;
				} catch (error) {
					console.warn(error);
				}
			}
		} else {
			console.warn("fullscreen is blocked by the browser");
		}
		return false;
	},

	togglePointerLock() {
		if (document.pointerLockElement) {
			document.exitPointerLock();
		} else {
			canvas.requestPointerLock();
		}
	},

};

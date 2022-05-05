import { addForeignMethod } from "../foreign.js";
import { computedLayout } from "../layout.js";
import { wrenCall, wrenEnsureSlots, wrenGetSlotDouble, wrenGetSlotHandle, wrenGetVariable, wrenSetSlotHandle } from "../vm.js";
import { callHandle_init_0 } from "../vm-call-handles.js";

export let cameraCenterX = 0;
export let cameraCenterY = 0;
export let cameraScale = 1;
let cameraMatrix = new Float32Array(9);
let cameraMatrixDirty = true;

export function getCameraMatrix() {
	if (cameraMatrixDirty) {
		cameraMatrixDirty = false;

		let sx =  2 / computedLayout.rw;
		let sy = -2 / computedLayout.rh;

		cameraMatrix[0] = sx;
		cameraMatrix[1] = 0;
		cameraMatrix[2] = 0;
		
		cameraMatrix[3] = 0;
		cameraMatrix[4] = sy;
		cameraMatrix[5] = 0;

		cameraMatrix[6] = -cameraCenterX * sx;
		cameraMatrix[7] = -cameraCenterY * sy;
		cameraMatrix[8] = 1;
	}

	return cameraMatrix;
}

export function saveCameraMatrix() {
	return [ cameraCenterX, cameraCenterY, cameraScale ];
}

/**
 * @param {number[]} saved 
 */
export function loadCameraMatrix(saved) {
	[ cameraCenterX, cameraCenterY, cameraScale ] = saved;
	cameraMatrixDirty = true;
}

/**
 * @param {number} x
 * @param {number} y
 */
export function setCameraMatrixTopLeft(x, y) {
	cameraCenterX = x + computedLayout.rw/2;
	cameraCenterY = y + computedLayout.rh/2;
	cameraScale = 1;
	cameraMatrixDirty = true;
}


// Wren -> JS

addForeignMethod("", "Camera", true, "update_(_,_,_)", () => {
	cameraCenterX = wrenGetSlotDouble(1);
	cameraCenterY = wrenGetSlotDouble(2);
	cameraScale = wrenGetSlotDouble(3);
	cameraMatrixDirty = true;
});

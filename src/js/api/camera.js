import { addForeignMethod } from "../foreign.js";
import { computedLayout } from "../layout.js";
import { callHandle_init_0, vm } from "../vm.js";

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


// Wren -> JS

addForeignMethod("", "Camera", true, "update_(_,_,_)", () => {
	cameraCenterX = vm.getSlotDouble(1);
	cameraCenterY = vm.getSlotDouble(2);
	cameraScale = vm.getSlotDouble(3);
	cameraMatrixDirty = true;
});


// JS -> Wren

let handle_Camera = 0;

export function initCameraModule() {
	vm.ensureSlots(1);
	vm.getVariable("sock", "Camera", 0);
	handle_Camera = vm.getSlotHandle(0);

	// vm.ensureSlots(1);
	vm.setSlotHandle(0, handle_Camera);
	vm.call(callHandle_init_0);
}

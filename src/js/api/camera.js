import { addClassForeignStaticMethods, addForeignMethod } from "../foreign.js";
import { internalResolutionHeight, internalResolutionWidth } from "../layout.js";
import { HEAP, wrenAbort, wrenGetSlotDouble, wrenGetSlotType, wren_sock_get_transform } from "../vm.js";

/**
 * @type {Float32Array|null}
 */
let cameraMatrix = null;

/**
 * Returns the 3x3 camera matrix.
 */
export function getCameraMatrix() {
	if (!cameraMatrix) {
		setCameraOrigin(0, 0);
	}
	return cameraMatrix;
}

/**
 * @returns {Float32Array}
 */
export function saveCameraMatrix() {
	return getCameraMatrix().slice();
}

/**
 * @param {Float32Array} camera 
 */
export function loadCameraMatrix(camera) {
	getCameraMatrix().set(camera);
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Float32Array|null} [tf] a 3x2 transform, will not be modified
 */
export function setCameraOrigin(x, y, tf) {
	if (!cameraMatrix) {
		cameraMatrix = new Float32Array(9);
	}

	let sx =  2 / internalResolutionWidth;
	let sy = -2 / internalResolutionHeight;

	if (tf) {
		cameraMatrix[0] = sx * tf[0];
		cameraMatrix[1] = sy * tf[1];
		cameraMatrix[2] = 0;
		
		cameraMatrix[3] = sx * tf[2];
		cameraMatrix[4] = sy * tf[3];
		cameraMatrix[5] = 0;
	
		cameraMatrix[6] = x * sx - 1 + sx * tf[4];
		cameraMatrix[7] = y * sy + 1 + sy * tf[5];
		cameraMatrix[8] = 1;
	} else {
		cameraMatrix[0] = sx;
		cameraMatrix[1] = 0;
		cameraMatrix[2] = 0;
		
		cameraMatrix[3] = 0;
		cameraMatrix[4] = sy;
		cameraMatrix[5] = 0;
	
		cameraMatrix[6] = x * sx - 1;
		cameraMatrix[7] = y * sy + 1;
		cameraMatrix[8] = 1;
	}
}


/**
 * @param {number} x
 * @param {number} y
 * @param {Float32Array|null} [tf] a 3x2 transform, will not be modified
 */
export function cameraLookAt(x, y, tf) {
	if (!cameraMatrix) {
		cameraMatrix = new Float32Array(9);
	}

	let sx =  2 / internalResolutionWidth;
	let sy = -2 / internalResolutionHeight;

	// If dimensions are not even, need shift origin by half a pixel.
	let dx = internalResolutionWidth  % 2 == 0 ? 0 : 0.5;
	let dy = internalResolutionHeight % 2 == 0 ? 0 : 0.5;

	if (tf) {
		cameraMatrix[0] = sx * tf[0];
		cameraMatrix[1] = sy * tf[1];
		cameraMatrix[2] = 0;
		
		cameraMatrix[3] = sx * tf[2];
		cameraMatrix[4] = sy * tf[3];
		cameraMatrix[5] = 0;

		cameraMatrix[6] = sx * (tf[4] - tf[0] * x - tf[2] * y + dx);
		cameraMatrix[7] = sy * (tf[5] - tf[1] * x - tf[3] * y + dy);
		cameraMatrix[8] = 1;
	} else {
		cameraMatrix[0] = sx;
		cameraMatrix[1] = 0;
		cameraMatrix[2] = 0;
		
		cameraMatrix[3] = 0;
		cameraMatrix[4] = sy;
		cameraMatrix[5] = 0;

		cameraMatrix[6] = (dx - x) * sx;
		cameraMatrix[7] = (dy - y) * sy;
		cameraMatrix[8] = 1;
	}
}


// Wren -> JS

addClassForeignStaticMethods("sock", "Camera", {
	"setOrigin(_,_,_)"() {
		wrenSetCamera(setCameraOrigin);
	},
	"lookAt(_,_,_)"() {
		wrenSetCamera(cameraLookAt);
	},
	"reset()"() {
		setCameraOrigin(0, 0);
	},
// 	"project(_,_)"() {
// 		for (let i = 1; i <= 2; i++) {
// 			if (wrenGetSlotType(i) !== 1) {
// 				wrenAbort("x/y must be Num");
// 				return;
// 			}
// 		}
// 	
// 		let x = wrenGetSlotDouble(1);
// 		let y = wrenGetSlotDouble(2);
// 		let m = getCameraMatrix();
// 
// 		let px = m[0] * x + m[3] * y + m[6];
// 		let py = m[1] * x + m[4] * y + m[7];
// 		// let pw = m[2] * x + m[5] * y + m[8];
// 	}
});

/**
 * @param {(x: number, y: number, t: Float32Array | null) => void} setter 
 */
function wrenSetCamera(setter) {
	for (let i = 1; i <= 2; i++) {
		if (wrenGetSlotType(i) !== 1) {
			wrenAbort("x/y must be Num");
			return;
		}
	}

	let x = wrenGetSlotDouble(1);
	let y = wrenGetSlotDouble(2);
	let tf = null;
	if (wrenGetSlotType(3) !== 5) {
		let tp = wren_sock_get_transform(3);
		if (!tp) return;
		tf = new Float32Array(HEAP(), tp, 6);
	}

	if (!tf) {
		x = Math.floor(x);
		y = Math.floor(y);
	}

	setter(x, y, tf);
}

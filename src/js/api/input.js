import { canvas } from "../canvas.js";
import { debugGlobals } from "../debug/globals.js";
import { computedLayout } from "../layout.js";
import { callHandle_updateMouse_3, callHandle_update_2 } from "../vm-call-handles.js";
import { wrenCall, wrenEnsureSlots, wrenGetSlotBool, wrenGetSlotDouble, wrenGetSlotHandle, wrenGetSlotString, wrenGetVariable, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotString } from "../vm.js";

let handle_Input = 0;

/**
 * @type {Set<string>}
 */
let queuedInputs = new Set();

/**
 * Record the current and previous value for each input: `[curr, prev, frame]`.
 * @type {Record<string, number>}
 */
let inputTable = Object.create(null);

let mouseData = { x: 0, y: 0, exactX: 0, exactY: 0, wheel: 0 };

debugGlobals.input = { mouse: mouseData, queued: queuedInputs, inputs: inputTable };

export function initInputModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Input", 0);
	handle_Input = wrenGetSlotHandle(0);
;
}

export function updateInputModule() {
	// Read gamepads.
	for (let gp of navigator.getGamepads()) {
		if (gp != null) {
			let buttons = gp.buttons;
			let axes = gp.axes;

			updateInputValue("GamepadFaceDown", buttons[0].value);
			updateInputValue("GamepadFaceRight", buttons[1].value);
			updateInputValue("GamepadFaceLeft", buttons[2].value);
			updateInputValue("GamepadFaceUp", buttons[3].value);
			updateInputValue("GamepadLeftBumper", buttons[4].value);
			updateInputValue("GamepadRightBumper", buttons[5].value);
			updateInputValue("GamepadLeftTrigger", buttons[6].value);
			updateInputValue("GamepadRightTrigger", buttons[7].value);
			updateInputValue("GamepadSelect", buttons[8].value);
			updateInputValue("GamepadStart", buttons[9].value);
			updateInputValue("GamepadLeftStick", buttons[10].value);
			updateInputValue("GamepadRightStick", buttons[11].value);
			updateInputValue("GamepadDPadUp", buttons[12].value);
			updateInputValue("GamepadDPadDown", buttons[13].value);
			updateInputValue("GamepadDPadLeft", buttons[14].value);
			updateInputValue("GamepadDPadRight", buttons[15].value);
			updateInputValue("GamepadHome", buttons[16].value);

			updateInputValue1D("GamepadLeftStickLeft", "GamepadLeftStickRight", axes[0]);
			updateInputValue1D("GamepadLeftStickUp", "GamepadLeftStickDown", axes[1]);
			updateInputValue1D("GamepadRightStickLeft", "GamepadRightStickRight", axes[2]);
			updateInputValue1D("GamepadRightStickUp", "GamepadRightStickDown", axes[3]);
		}
	}

	// Pass state changes to Wren.
	// Mouse
	wrenEnsureSlots(4);
	wrenSetSlotHandle(0, handle_Input);
	wrenSetSlotDouble(1, mouseData.x);
	wrenSetSlotDouble(2, mouseData.y);
	wrenSetSlotDouble(3, mouseData.wheel);
	wrenCall(callHandle_updateMouse_3);

	// Inputs
	for (let inputID of queuedInputs) {
		wrenEnsureSlots(3);
		wrenSetSlotHandle(0, handle_Input);
		wrenSetSlotString(1, inputID);
		wrenSetSlotDouble(2, inputTable[inputID]);
		wrenCall(callHandle_update_2);
	}

	queuedInputs.clear();
	mouseData.wheel = 0;
}

/**
 * @param {string} name
 * @param {number} value 0..1
 */
function updateInputValue(name, value) {
	if (value !== inputTable[name]) {
		inputTable[name] = value;
		queuedInputs.add(name);
	}
}

/**
 * @param {string} nameNegative
 * @param {string} namePositive
 * @param {number} value -1..1
 */
function updateInputValue1D(nameNegative, namePositive, value) {
	updateInputValue(nameNegative, value < 0 ? -value : 0);
	updateInputValue(namePositive, value > 0 ?  value : 0);
}

/**
 * @param {string} name
 * @param {number} value 0..1
 */
function updateInputValueWithNativeName(name, value) {
	updateInputValue(INPUT_NAME_MAP[name] || name, value);
}


/**
 * One-to-one mapping from InputID to native input name.
 * @type {Record<string, string>}
 */
const INPUT_NAME_MAP = Object.create(null);

for (let i = 0; i <= 25; i++) {
	let letter = String.fromCharCode(65 + i);
	INPUT_NAME_MAP["Key" + letter] = letter;
}

for (let i = 0; i <= 9; i++) {
	INPUT_NAME_MAP["Digit" + i] = String(i);
}


// === GLOBAL EVENT LISTENERS ===

addEventListener("keydown", (event) => {
	if (event.repeat) return;
	updateInputValueWithNativeName(event.code, 1);
}, { passive: true });

addEventListener("keyup", (event) => {
	updateInputValueWithNativeName(event.code, 0);
}, { passive: true });

addEventListener("mousemove", (event) => {
	updateMousePosition(event.x, event.y);
});

addEventListener("wheel", (event) => {
	mouseData.wheel += event.deltaY;
}, { passive: true });

addEventListener("mousedown", (event) => {
	updateMouseButton(event.button, 1);
});

addEventListener("mouseup", (event) => {
	updateMouseButton(event.button, 0);
});

canvas.addEventListener("contextmenu", (event) => {
	event.preventDefault();
});

addEventListener("touchstart", (event) => {
	event.preventDefault();
	if (event.changedTouches.length === event.touches.length) {
		let touch = event.changedTouches[0];
		updateInputValue("Tap", 1);
		updateInputValue("MouseLeft", 1);
		updateMousePosition(touch.clientX, touch.clientY);
	}
}, { passive: false });

addEventListener("touchmove", (event) => {
	event.preventDefault();
	let touch = event.changedTouches[0];
	updateMousePosition(touch.clientX, touch.clientY);
}, { passive: false });

addEventListener("touchend", (event) => {
	event.preventDefault();
	if (event.touches.length === 0) {
		updateInputValue("Tap", 0);
		updateInputValue("MouseLeft", 0);
	}
}, { passive: false });

/**
 * @param {number} x
 * @param {number} y
 */
function updateMousePosition(x, y) {
	mouseData.exactX = x = (x - computedLayout.x) / computedLayout.s
	mouseData.exactY = y = (y - computedLayout.y) / computedLayout.s
	mouseData.x = Math.floor(x);
	mouseData.y = Math.floor(y);
}

/**
 * @param {number} button
 * @param {number} value
 */
function updateMouseButton(button, value) {
	let name;
	if (button === 0) { name = "Left"; }
	else if (button === 1) { name = "Middle"; }
	else if (button === 2) { name = "Right"; }
	updateInputValue("Mouse" + (name || button), value);
}

addEventListener("gamepadconnected", (event) => {
	// Need to add this event listener for `navigator.getGamepads()` to work.
	console.info("Gamepad: " + event.gamepad.id);
});


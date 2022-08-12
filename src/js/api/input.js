import { canvas } from "../canvas.js";
import { deviceIsMobile } from "../device.js";
import { addClassForeignStaticMethods } from "../foreign.js";
import { createElement } from "../html.js";
import { keyboardLayout } from "../keyboard-layout.js";
import { releaseLayoutContainer, useLayoutContainer, viewportOffsetX, viewportOffsetY, viewportScale } from "../layout.js";
import { callHandle_updateMouse_3, callHandle_updateTouch_5, callHandle_update_2 } from "../vm-call-handles.js";
import { wrenAbort, wrenCall, wrenEnsureSlots, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenSetSlotBool, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNull, wrenSetSlotRange, wrenSetSlotString } from "../vm.js";

let textInput = createElement("input");
let textForm = createElement("form", {}, [
	textInput,
	// createElement("button", { type: "button" }, "Submit"),
]);
textInput.placeholder = "Text";

function removeTextInput() {
	if (textForm.parentNode) {
		textForm.remove();
		releaseLayoutContainer();
	}
}

// Stop text input when user presses "enter".
// The form submission method is preffered over listening for "enter" key,
// as IMEs may fire "enter" when composition ends.
/**
 * @param {Event} event 
 */
textForm.onsubmit = (event) => {
	event.preventDefault();
	
	removeTextInput();
};

// Stop text input when unfocussed.
textInput.onblur = () => {
	// Need to use setTimeout() to prevent weird timing issues
	// related to removing elements during onblur.
	setTimeout(() => {
		if (document.activeElement !== textInput) {
			removeTextInput();
		}
	}, 1);
};

// Stop text input when user presses escape.
/**
 * @param {KeyboardEvent} event 
 */
textInput.onkeydown = (event) => {
	if (event.code === "Escape") {
		removeTextInput();
	}
};

addClassForeignStaticMethods("sock", "Input", {
	"localize(_)"() {
		let idType = wrenGetSlotType(1);
		if (idType === 5) {
			wrenSetSlotNull(0);
			return;
		}

		if (idType !== 6) {
			wrenAbort("input ID must be a String");
			return;
		}

		let id = wrenGetSlotString(1);

		if (keyboardLayout === "AZERTY") {
			if (id === "Q") {
				id = "A";
			} else if (id === "A") {
				id = "Q";
			} else if (id === "Z") {
				id = "W";
			} else if (id === "W") {
				id = "Z";
			} else if (id === "M") {
				id = ",";
			} else if (id === ",") {
				id = ";";
			} else if (id === ";") {
				id = "M";
			}
		} else if (keyboardLayout === "QWERTZ") {
			if (id === "Z") {
				id = "Y";
			} else if (id === "Y") {
				id = "Z";
			}
		}

		wrenSetSlotString(0, id);
	},
	"textBegin(_)"() {
		let argType = wrenGetSlotType(1);
		if (argType === 5) {
			textInput.type = "text";
		} else if (argType === 6) {
			let type = wrenGetSlotString(1);

			if (type === "text" || type === "number" || type === "password") {
				textInput.type = type;
			} else {
				wrenAbort(`invalid text type '${type}'`);
				return;
			}
		} else {
			wrenAbort("type must be a String");
			return;
		}

		textForm.className = "text-form invisible";

		textInput.className = "text";
		textInput.value = "";

		if (!textForm.parentNode) {
			useLayoutContainer().append(textForm);
		}

		if (!deviceIsMobile) {
			textInput.focus();

			if (document.activeElement === textInput) {
				return;
			}
		}

		// Visible text input fallback. Used for:
		// * Mobile
		// * if browser blocks .focus() (due to being outside event handler)
		textForm.className = "text-form";
		textForm.onclick = (event) => {
			if (event.target === textForm) {
				removeTextInput();
			}
		};

		textInput.className = "text";
	},
	"textDescription"() {
		wrenSetSlotString(0, textInput.placeholder);
	},
	"textDescription=(_)"() {
		if (wrenGetSlotType(1) !== 6) {
			wrenAbort("description must be String");
			return;
		}

		textInput.placeholder = wrenGetSlotString(1);
	},
	"textIsActive"() {
		wrenSetSlotBool(0, document.activeElement === textInput);
	},
	"textSelection"() {
		if (document.activeElement === textInput) {
			let start = textInput.selectionStart;
			let end = textInput.selectionEnd;

			if (textInput.selectionDirection === "backward") {
				let tmp = start;
				start = end;
				end = tmp;
			}

			wrenSetSlotRange(0, start, end, 1, true);
		} else {
			wrenSetSlotRange(0, 0, 0, 1, true);
		}
	},
	"textString"() {
		wrenSetSlotString(0, textInput.value);
	},
})

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

let mouseX = 0, mouseY = 0, mouseExactX = 0, mouseExactY = 0, mouseRawX = 0, mouseRawY = 0, mouseWheel = 0;

export function initInputModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Input", 0);
	handle_Input = wrenGetSlotHandle(0);

	// Pass in initial mouse state.
	recalculateAndUpdateMousePosition();
}

export function recalculateAndUpdateMousePosition() {
	recalculateMousePosition();
	transferCurrentMousePosition();
}

function transferCurrentMousePosition() {
	wrenEnsureSlots(4);
	wrenSetSlotHandle(0, handle_Input);
	wrenSetSlotDouble(1, mouseX);
	wrenSetSlotDouble(2, mouseY);
	wrenSetSlotDouble(3, mouseWheel);
	wrenCall(callHandle_updateMouse_3);
}

export function updateInputModule() {
	// Read gamepads.
	// May not be available, requires HTTPS.
	if (navigator.getGamepads) {
		for (let gp of navigator.getGamepads()) {
			if (gp != null) {
				let buttons = gp.buttons;
				let axes = gp.axes;
	
				updateInputValue("FaceDown", buttons[0].value);
				updateInputValue("FaceRight", buttons[1].value);
				updateInputValue("FaceLeft", buttons[2].value);
				updateInputValue("FaceUp", buttons[3].value);
				updateInputValue("LeftBumper", buttons[4].value);
				updateInputValue("RightBumper", buttons[5].value);
				updateInputValue("LeftTrigger", buttons[6].value);
				updateInputValue("RightTrigger", buttons[7].value);
				updateInputValue("Select", buttons[8].value);
				updateInputValue("Start", buttons[9].value);
				updateInputValue("LeftStick", buttons[10].value);
				updateInputValue("RightStick", buttons[11].value);
				updateInputValue("DPadUp", buttons[12].value);
				updateInputValue("DPadDown", buttons[13].value);
				updateInputValue("DPadLeft", buttons[14].value);
				updateInputValue("DPadRight", buttons[15].value);
				updateInputValue("Guide", buttons[16].value);
	
				updateInputValue1D("LeftStickLeft", "LeftStickRight", axes[0]);
				updateInputValue1D("LeftStickUp", "LeftStickDown", axes[1]);
				updateInputValue1D("RightStickLeft", "RightStickRight", axes[2]);
				updateInputValue1D("RightStickUp", "RightStickDown", axes[3]);
			}
		}
	}

	// Pass state changes to Wren.
	// Mouse
	transferCurrentMousePosition();

	// Inputs
	for (let inputID of queuedInputs) {
		wrenEnsureSlots(3);
		wrenSetSlotHandle(0, handle_Input);
		wrenSetSlotString(1, inputID);
		wrenSetSlotDouble(2, inputTable[inputID]);
		wrenCall(callHandle_update_2);
	}

	queuedInputs.clear();
	mouseWheel = 0;
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
const INPUT_NAME_MAP = Object.assign(Object.create(null), {
	"Backquote": "`",
	"Minus": "-",
	"Equal": "=",
	"Comma": ",",
	"Period": ".",
	"Slash": "/",
	"Semicolon": ";",
	"Quote": "'",
	"BracketLeft": "[",
	"BracketRight": "]",
	"Backslash": "\\",
});

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
	event.preventDefault();
	event.stopPropagation();
	mouseWheel += event.deltaY;
	updateInputValue1D("MouseWheelUp", "MouseWheelDown", Math.sign(event.deltaY));
}, { passive: false });

addEventListener("mousedown", (event) => {
	updateMouseButton(event.button, 1);
});

addEventListener("mouseup", (event) => {
	updateMouseButton(event.button, 0);
});

canvas.addEventListener("contextmenu", (event) => {
	event.preventDefault();
});

canvas.addEventListener("touchstart", (event) => {
	event.preventDefault();

	updateTouches(event.changedTouches, true);

	// Emulate mouse with touch.
	if (event.changedTouches.length === event.touches.length) {
		let touch = event.changedTouches[0];
		updateInputValue("MouseLeft", 1);
		updateMousePosition(touch.clientX, touch.clientY);
	}
}, { passive: false });

canvas.addEventListener("touchmove", (event) => {
	event.preventDefault();

	updateTouches(event.changedTouches, true);

	// Emulate mouse with touch.
	let touch = event.changedTouches[0];
	updateMousePosition(touch.clientX, touch.clientY);
}, { passive: false });

canvas.addEventListener("touchend", (event) => {
	event.preventDefault();

	updateTouches(event.changedTouches, false);

	// Emulate mouse with touch.
	if (event.touches.length === 0) {
		updateInputValue("MouseLeft", 0);
	}
}, { passive: false });

/**
 * 
 * @param {TouchList} touches
 * @param {boolean} isDown
 */
function updateTouches(touches, isDown) {
	for (let i = 0; i < touches.length; i++) {
		let touch = touches[i];

		let id = touch.identifier;
		let x = (touch.clientX - viewportOffsetX) / viewportScale;
		let y = (touch.clientY - viewportOffsetY) / viewportScale;
		let force = touch.force;
		if (force === 0) force = (isDown ? 1 : 0);

		wrenEnsureSlots(6);
		wrenSetSlotHandle(0, handle_Input);
		wrenSetSlotDouble(1, id);
		wrenSetSlotBool(2, isDown);
		wrenSetSlotDouble(3, force);
		wrenSetSlotDouble(4, x);
		wrenSetSlotDouble(5, y);
		wrenCall(callHandle_updateTouch_5);
	}
}

/**
 * @param {number} x
 * @param {number} y
 */
function updateMousePosition(x, y) {
	mouseRawX = x;
	mouseRawY = y;
	recalculateMousePosition();
}

function recalculateMousePosition() {
	mouseExactX = (mouseRawX - viewportOffsetX) / viewportScale;
	mouseExactY = (mouseRawY - viewportOffsetY) / viewportScale;
	mouseX = Math.floor(mouseExactX);
	mouseY = Math.floor(mouseExactY);
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



// The actual solution would be to use the KeyBoard API.
// But this will never be supported by Firefox, and is not currently by Safari.
//  https://mozilla.github.io/standards-positions/#keyboard-map

// Out solution is to make guesses of common layouts based on
// keyboard event code vs key differences.

const QWERTY = "QWERTY";
const QWERTZ = "QWERTZ";
const AZERTY = "AZERTY";

/**
 * @type {"QWERTY" | "QWERTZ" | "AZERTY"}
 */
export let keyboardLayout = QWERTY;

// Make a first guess on the layout based on language.
let lang = navigator.language || "en-US";
if (lang.includes("fr")) {
	keyboardLayout = AZERTY;
}

// Update layout as we get more information from key presses.
let layoutChecks = 0;
/**
 * @param {KeyboardEvent} event
 */
let onKeydown = (event) => {
	let code = event.code;
	let key = event.key.toLowerCase();

	if (code === "KeyQ") {
		layoutChecks++;

		if (key === "a") {
			keyboardLayout = AZERTY;
			console.log("layout is " + keyboardLayout + "?");
		}
	} else if (code === "KeyA") {
		layoutChecks++;

		if (key === "q") {
			keyboardLayout = AZERTY;
			console.log("layout is " + keyboardLayout + "?");
		}
	} else if (code === "KeyW") {
		layoutChecks++;

		if (key === "z") {
			keyboardLayout = AZERTY;
			console.log("layout is " + keyboardLayout + "?");
		}
	} else if (code === "KeyZ") {
		layoutChecks++;

		if (key === "w") {
			keyboardLayout = AZERTY;
			console.log("layout is " + keyboardLayout + "?");
		}
	} else if (code === "KeyY") {
		layoutChecks++;

		if (key === "z") {
			keyboardLayout = QWERTZ;
			console.log("layout is " + keyboardLayout + "?");
		}
	} else if (code === "KeyZ") {
		layoutChecks++;

		if (key === "y") {
			keyboardLayout = QWERTZ;
			console.log("layout is " + keyboardLayout + "?");
		}
	}

	if (layoutChecks >= 3) {
		removeEventListener("keydown", onKeydown);
	}
};

addEventListener("keydown", onKeydown, { passive: true });

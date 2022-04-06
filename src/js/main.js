import Wren from "./wren.js";
import "./api/add-all-api.js";
import { callHandle_call_0, createWrenVM, vm } from "./vm.js";
import { initCursorModule } from "./api/cursor.js";
import { initTimeModule, timeUpdate } from "./api/time.js";
import { initContainer } from "./container.js";
import { httpGET } from "./network/http.js";

async function init() {
	// Get scripts in parallel.
	let promSockScript = httpGET("sock.wren", "arraybuffer");
	let promGameMainScript = httpGET("assets/main.wren", "arraybuffer");

	// Load Wren VM.
	await Wren.load();

	// Create the VM.
	createWrenVM();

	// Load in the "sock" script.
	let sockScript = await promSockScript;
	
	let result = vm.interpret("sock", sockScript);
	
	if (result !== 0) {
		console.warn("sock.wren failed");
		return;
	}

	// Init sock modules.
	initTimeModule();
	initCursorModule();

	// Load main game module
	let gameMainScript = await promGameMainScript;

	result = vm.interpret("/main", gameMainScript);
	if (result !== 0) {
		console.warn("game main.wren failed");
		return;
	}

	// Start loop.
	initContainer();

	timeUpdate(0);

	// TEMP
	vm.ensureSlots(1);
	vm.getVariable("/main", "update", 0);
	vm.call(callHandle_call_0);
}

init();

import Wren from "./wren.js";
import "./api/add-all-api.js";
import { callHandle_call_0, createWrenVM, vm, wrenErrorString, wrenTypeToName } from "./vm.js";
import { initCursorModule } from "./api/cursor.js";
import { initTimeModule, updateTimeModule } from "./api/time.js";
import { httpGET } from "./network/http.js";
import { fps, gameIsReady, gameUpdate, initGameModule, quitFromAPI } from "./api/game.js";
import { finalizeLayout } from "./layout.js";
import { Shader } from "./gl/shader.js";
import { mainFramebuffer } from "./gl/framebuffer.js";
import { initAssetModule, updateAssetModule } from "./api/asset.js";
import { canvas } from "./canvas.js";
import { showError, showWrenError } from "./error.js";
import { waitUntil } from "./async.js";
import { initCameraModule } from "./api/camera.js";
import { terminalInterpret } from "./debug/terminal.js";

/** @type {number} */
let prevTime = null;
let time = 0;
let frame = 0;
let remainingTime = 0;
let quit = false;

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
		finalize();
		return;
	}

	// Init sock modules.
	initTimeModule();
	initAssetModule();
	initCursorModule();
	initCameraModule();
	initGameModule();

	// Init WebGL.
	mainFramebuffer.updateResolution();

	Shader.compileAll();

	// Load main game module
	let gameMainScript = await promGameMainScript;

	result = vm.interpret("/main", gameMainScript);
	if (result !== 0) {
		finalize();
		return;
	}

	// Now we wait for Game.ready_() to be called!
	if (!await waitUntil(100, 1000, () => gameIsReady)) {
		finalize("took to long for Game.begin() to be called...");
		return;
	}

	// Begin!
	requestAnimationFrame(update);
}


function update() {
	let now = performance.now() / 1000;
	let delta = Math.min(4 / 60, prevTime == null ? 0 : now - prevTime);
	prevTime = now;
	
	if (gameIsReady) {
		remainingTime -= delta;
	
		if (remainingTime <= 0) {
			// Increment frame timer.
			remainingTime += 1 / fps;
	
			// Update module state.
			updateTimeModule(frame, time);
			updateAssetModule();

			frame++;
			time += 1 / fps;

			// Prepare WebGL.
			let layoutChanged = finalizeLayout();
			
			if (layoutChanged) {
				mainFramebuffer.updateResolution();
			}
	
			mainFramebuffer.bind();
	
			// Do game update.
			let result = gameUpdate();
				
			// Check result of call.
			if (result !== 0) {
				quit = true;
			}

			// Finalize WebGL.
			mainFramebuffer.draw();
		}
	}

	if (quit || quitFromAPI) {
		// End the loop.
		canvas.classList.add("quit");
		finalize();
	} else {
		requestAnimationFrame(update);
	}
}

/**
 * @param {string|null} [error]
 */
function finalize(error) {
	if (error) {
		showError(error);
	} else if (wrenErrorString) {
		showWrenError();
	}
}

addEventListener("keydown", (event) => {
	if (event.code === "F4") quit = true;
}, { passive: true });

init();

self["wren"] = terminalInterpret;

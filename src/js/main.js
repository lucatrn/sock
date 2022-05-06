import "./api/add-all-api.js";
import { initTimeModule, updateTimeModule } from "./api/time.js";
import { fps, gameIsReady, gameUpdate, initGameModule, quitFromAPI } from "./api/game.js";
import { initAssetModule } from "./api/asset.js";
import { initInputModule, updateInputModule } from "./api/input.js";
import { httpGET } from "./network/http.js";
import { finalizeLayout } from "./layout.js";
import { Shader } from "./gl/shader.js";
import { mainFramebuffer } from "./gl/framebuffer.js";
import { canvas } from "./canvas.js";
import { showError, showWrenError } from "./error.js";
import { until } from "./async.js";
import { terminalInterpret } from "./debug/terminal.js";
import { loadEmscripten, wrenAddImplicitImportModule, wrenCall, wrenErrorString, wrenHasError, wrenInterpret } from "./vm.js";
import { makeCallHandles } from "./vm-call-handles.js";
import { initSystemFont } from "./system-font.js";
import { initJavaScriptModule } from "./api/javascript.js";

/** @type {number} */
let prevTime = null;
let time = 0;
let frame = 0;
let remainingTime = 0;
let quit = false;

async function init() {
	// Get scripts in parallel.
	let promSockScript = httpGET("sock-web.wren", "arraybuffer");
	let promGameMainScript = httpGET("assets/main.wren", "arraybuffer");

	// Load Wren VM.
	await loadEmscripten();

	let promSystemFont = initSystemFont();
	makeCallHandles();

	// wrenCall(0);

	// Load in the "sock" script.
	await promSystemFont;
	let sockScript = await promSockScript;
	
	let result = wrenInterpret("sock", sockScript);
	
	if (result !== 0) {
		finalize();
		return;
	}

	// Make the "sock" module part of the implicit import API.
	wrenAddImplicitImportModule("sock");

	// Init sock modules.
	initTimeModule();
	initAssetModule();
	initGameModule();
	initInputModule();
	initJavaScriptModule();

	// Init WebGL.
	mainFramebuffer.updateResolution();

	Shader.compileAll();

	// Load main game module
	let gameMainScript = await promGameMainScript;

	result = wrenInterpret("/main", gameMainScript);
	if (result !== 0) {
		finalize();
		return;
	}

	// Now we wait for Game.ready_() to be called! Or for an error to occurr.
	if (!await until(100, 60000, () => gameIsReady || wrenHasError)) {
		finalize("took to long for Game.begin() to be called...");
		return;
	}

	if (wrenHasError) {
		finalize();
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
			updateInputModule();

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
	} else if (wrenHasError) {
		showWrenError();
	}
}

init();

self["wren"] = terminalInterpret;

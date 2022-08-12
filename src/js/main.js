import "./polyfill.js";
import "./api/add-all-api.js";
import { initTimeModule, updateTimeModule } from "./api/time.js";
import { fps, gameBusyWithDOMFallback, gameIsReady, gameUpdate, initGameModule, prepareUpdatePromise, quitFromAPI } from "./api/game.js";
import { initAssetModule } from "./api/asset.js";
import { initInputModule, recalculateAndUpdateMousePosition, updateInputModule } from "./api/input.js";
import { httpGET } from "./network/http.js";
import { finalizeLayout, redoLayout } from "./layout.js";
import { Shader } from "./gl/shader.js";
import { mainFramebuffer } from "./gl/framebuffer.js";
import { canvas } from "./canvas.js";
import { showError, showWrenError } from "./error.js";
import { until } from "./async.js";
import { terminalInterpret } from "./debug/terminal.js";
import { loadEmscripten, wrenAddImplicitImportModule, wrenHasError, wrenInterpret } from "./vm.js";
import { makeCallHandles } from "./vm-call-handles.js";
import { initSystemFont } from "./system-font.js";
import { createAudioContext, initAudioModule, loadAudioModule, stopAllAudio } from "./api/audio.js";
import { initPromiseModule } from "./api/promise.js";
import { initSpriteModule } from "./api/sprite.js";
import { sockJsGlobal } from "./globals.js";
import { updateRefreshRate } from "./api/screen.js";
import { messagingEnabled, sendMessage, waitForMessage } from "./messaging.js";

/** @type {number} */
let prevTime = null;
/** @type {number} */
let startTime = null;
let time = 0;
let refreshrateCounter = 0;
let refreshrateInterval = 0;
let remainingTime = 0;
let quit = false;
/** @type {Promise<string|ArrayBuffer>} */
let promGameMainScript;

let playButton = document.getElementById("play-button");
playButton.tabIndex = 0;



if (messagingEnabled) {
	playButton.remove();
	
	promGameMainScript = waitForMessage("script");

	sendMessage("ready");
} else {
	promGameMainScript = httpGET("assets/main.wren", "arraybuffer");
}

async function init() {
	// Get scripts in parallel.
	let promSockScript = httpGET("sock_web.wren", "arraybuffer");
	
	// Load Wren VM.
	await loadEmscripten();
	
	let promSystemFont = initSystemFont();
	makeCallHandles();

	// Prepare preview / core init.
	redoLayout();

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
	initPromiseModule();
	initAssetModule();
	initGameModule();
	initInputModule();
	initSpriteModule();
	initAudioModule();

	// Wait for user click.
	await playClicked();

	playButton.remove();

	// Init WebGL.
	mainFramebuffer.updateResolution();

	Shader.compileAll();

	// Load modules.
	loadAudioModule();

	// Load main game module
	let gameMainScript = await promGameMainScript;

// 	wrenEnsureSlots(1);
// 	wrenGetVariable("sock", "Game", 0);
// 	wrenCall(callHandle_call_0);
// 
// 	console.log("TODO early exit")
// 	return;

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

/**
 * @returns {Promise<void>}
 */
function playClicked() {
	// Wait for user input (button click).
	if (messagingEnabled) {
		initModules();

		return Promise.resolve();
	} else {
		return new Promise((resolve) => {
			playButton.onclick = oninput;
			
			function oninput() {
				initModules();
				resolve();
			}
		});
	}

	// We also initialize some systems here that require a user event.
	function initModules() {
		createAudioContext()
	}
}

function update() {
	let now = performance.now() / 1000;
	if (startTime == null) startTime = now;
	now -= startTime;

	let tickDelta = prevTime == null ? 0 : Math.min(4 / 60, now - prevTime);
	prevTime = now;

	refreshrateInterval += tickDelta;
	refreshrateCounter++;
	if (refreshrateCounter === 60) {
		updateRefreshRate(Math.round(refreshrateCounter / refreshrateInterval));
		refreshrateCounter = refreshrateInterval = 0;
	}

	let isBusy = gameBusyWithDOMFallback();
	
	if (gameIsReady && !isBusy) {
		if (fps) {
			remainingTime -= tickDelta;
		} else {
			remainingTime = 0;
		}
	
		if (!fps || remainingTime <= 0) {
			// Increment frame timer.
			if (fps) {
				remainingTime += 1 / fps;
			}
			
			// Update module state.
			updateTimeModule(now, now - time);
			time = now;
			
			updateInputModule();

			// Prepare WebGL.
			let layoutChanged = finalizeLayout();
			
			if (layoutChanged) {
				recalculateAndUpdateMousePosition();
				mainFramebuffer.updateResolution();
			}
	
			mainFramebuffer.bind();
	
			// Do game update.
			let result = gameUpdate();
				
			// Check result of call.
			if (result !== 0) {
				quit = true;
			}

			// Await update promise.
			if (!gameIsReady && !quit && !quitFromAPI) {
				console.log("awaiting update completion...")
				prepareUpdatePromise().then(() => {
					finalizeUpdateInner();
					finalizeUpdateOuter();
				});
				return;
			}

			// ...otherwise finalize synchronusly.
			finalizeUpdateInner();
		}
	}

	finalizeUpdateOuter();
}

function finalizeUpdateInner() {
	// Finalize WebGL.
	mainFramebuffer.draw();
}

function finalizeUpdateOuter() {
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
	stopAllAudio();
	
	if (error) {
		showError(error);
	} else if (wrenHasError) {
		showWrenError();
	}
}

init();

self["wren"] = terminalInterpret;

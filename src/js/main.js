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
import { initAudioModule, stopAllAudio } from "./api/audio.js";
import { initPromiseModule } from "./api/promise.js";
import { initSpriteModule } from "./api/sprite.js";
import { sockJsGlobal } from "./globals.js";
import { updateRefreshRate } from "./api/screen.js";
import { messagingEnabled, sendMessage, waitForMessage } from "./messaging.js";
import { getAssetAsArrayBuffer, loadOptionalBundle } from "./asset-database.js";
import { resetGlBlending } from "./gl/gl.js";

/** @type {number} */
let prevTime = null;
/** @type {number} */
let startTime = null;
let time = 0;
let refreshrateCounter = 0;
let refreshrateInterval = 0;
let remainingTime = 0;
let quit = false;
/** @type {string|ArrayBuffer|Promise<string|ArrayBuffer>} */
let promGameMainScript;
let loadingBarProgress = document.getElementById("loading-bar-progress");


/**
 * We want track loading progress accumulated from multiple sources, each with different 'weights'.
 * 
 * These weights are purely aesthetic and arbitary, they were chosen based on feel/timing.
 * 
 * Represent this with progress slots. Each slot is `[progress, weight]`.
 * @type {number[][]}
 */
let loadingBarProgressSlots = [];

function addProgressSlot(weight = 1, progress = 0) {
	let slot = [ progress, weight ];
	loadingBarProgressSlots.push(slot);
	return slot;
}

/**
 * @param {number[]} slot
 * @param {number} progress 0..1
 */
function setLoadingBarSlotProgress(slot, progress) {
	slot[0] = progress;

	// Get total progress and render to progress bar.
	let total = 0;
	let sum = 0;
	for (let slot of loadingBarProgressSlots) {
		total += slot[1];
		sum += slot[0] * slot[1];
	}
	let totalProgress = sum / total;

	// Using clipping to move the progress bar has severable advantages:
	// * does not trigger layout
	// * works well with textured progress bars (e.g. someone may want to put an image as the loading bar)
	// * simple to implement in CSS
	//
	// Note we use "-1px" on the edges to ensure those edges don't get clipped unnecessarily.
	loadingBarProgress.style.clipPath = `inset(-1px ${((1 - totalProgress) * 100).toFixed(1)}% -1px -1px)`;
	loadingBarProgress.hidden = false;
}

// Handle setup when messaing is enabled.
if (messagingEnabled) {
	promGameMainScript = waitForMessage("script");

	promGameMainScript.then(() => {
		play();
	});

	sendMessage("ready");
}

/**
 * Loads all resources and performs setup.
 * 
 * Called automatically as soon as possible.
 */
async function play() {
	// Setup loading bar slots.
	let progressSlotEmscripten = addProgressSlot(0.75);
	let progressSlotSystemFont = addProgressSlot(0.05);
	let progressSlotMainScript = addProgressSlot(0.15);
	let progressSlotMainBundle;

	// Load the following resources in parallel.
	let promSockScript = httpGET("sock_web.wren", "arraybuffer");

	// Load the main asset bundle (if it exists).
	let promMainBundle = loadOptionalBundle("assets.zip", progress => {
		if (!progressSlotMainBundle) progressSlotMainBundle = addProgressSlot();

		setLoadingBarSlotProgress(progressSlotMainBundle, progress);
	});
	
	// As soon as the main bundle loads (or we know it doesn't exist) start loading the main script.
	if (!promGameMainScript) {
		promMainBundle.then(() => {
			promGameMainScript = getAssetAsArrayBuffer("main.wren", (progress) => {
				setLoadingBarSlotProgress(progressSlotMainScript, progress);
			});
		});
	}
	
	// Load Wren VM.
	await loadEmscripten();

	setLoadingBarSlotProgress(progressSlotEmscripten, 1);
	
	// Load system font from WASM code.
	let promSystemFont = initSystemFont();

	// Create the shared Wren call handles.
	makeCallHandles();

	// Prepare preview / core init.
	redoLayout();
	canvas.hidden = false;

	// Load in the "sock" script.
	await promSystemFont;
	setLoadingBarSlotProgress(progressSlotSystemFont, 1);

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

	// Init WebGL.
	mainFramebuffer.updateResolution();

	Shader.compileAll();

	// Load main game module
	await promMainBundle;
	let gameMainScript = await promGameMainScript;

	// Setup is mostly done! Hide loading UI.
	document.getElementById("setup").remove();

	// Load the main game script.
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
				console.info("[SOCK] awaiting update completion")
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
	resetGlBlending();
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

// Add some useful globals.
self["wren"] = terminalInterpret;

sockJsGlobal.quit = () => {
	quit = true;
};

// When to start playing?
if (sockJsGlobal.play) {
	// Play already clicked (`sock.play = true` handled by JS in main HTML).

	// This slot represents the time taken to load the JavaScript code.
	addProgressSlot(0.2, 1);

	play();
} else {
	// Play not clicked yet. Set our own callback, which the other JS will call.
	sockJsGlobal.play = () => {
		sockJsGlobal.play = null;
		play();
	};
}

import Wren from "./wren.js";
import "./api/add-all-api.js";
import { callHandle_call_0, createWrenVM, vm } from "./vm.js";
import { initCursorModule } from "./api/cursor.js";
import { initTimeModule, updateTimeModule } from "./api/time.js";
import { httpGET } from "./network/http.js";
import { fps, initGameModule } from "./api/game.js";
import { finalizeLayout } from "./layout.js";
import { Shader } from "./gl/shader.js";
import { Framebuffer, mainFramebuffer } from "./gl/framebuffer.js";
import { initAssetModule, updateAssetModule } from "./api/asset.js";
import { canvas } from "./canvas.js";

/** @type {number} */
let prevTime = null;
let time = 0;
let frame = 0;
let remainingTime = 0;
let quit = false;
let handle_updateFn = 0;

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
	initAssetModule();
	initCursorModule();
	initGameModule();

	// Init WebGL.
	mainFramebuffer.updateResolution();

	Shader.compileAll();

	// Load main game module
	let gameMainScript = await promGameMainScript;

	result = vm.interpret("/main", gameMainScript);
	if (result !== 0) {
		console.warn("game main.wren failed");
		return;
	}

	// Setup game loop.
	vm.ensureSlots(1);
	vm.getVariable("/main", "update", 0);
	handle_updateFn = vm.getSlotHandle(0);


	requestAnimationFrame(update);
}

function update() {
	let now = performance.now() / 1000;
	let delta = Math.min(4 / 60, prevTime == null ? 0 : now - prevTime);
	prevTime = now;
	remainingTime -= delta;

	if (remainingTime <= 0) {
		// Increment frame timer.
		remainingTime += 1 / fps;

		// Update module state.
		updateTimeModule(frame, time);
		updateAssetModule();

		// Prepare WebGL.
		let layoutChanged = finalizeLayout();
		
		if (layoutChanged) {
			mainFramebuffer.updateResolution();
		}

		mainFramebuffer.bind();

		// Do game update.
		vm.ensureSlots(1);
		vm.setSlotHandle(0, handle_updateFn);
		let result = vm.call(callHandle_call_0);
		if (result !== 0) {
			console.warn("call to game update() failed");
			quit = true;
		}
		
		// Finalize WebGL.
		mainFramebuffer.draw();

		// Final state updates.
		frame++;
	}

	time += delta;

	if (quit) {
		// End the loop.
		console.log("[Quit]");
		canvas.style.cursor = "not-allowed";
		canvas.style.opacity = "0.5";
	} else {
		requestAnimationFrame(update);
	}
}

addEventListener("keydown", (event) => {
	if (event.code === "F4") quit = true;
}, { passive: true });

init();

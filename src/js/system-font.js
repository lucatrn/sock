import { gl } from "./gl/gl.js";
import { Texture } from "./gl/texture.js";
import { HEAPU8, Module } from "./vm.js";
import { SpriteBatcher } from "./gl/sprite-batcher.js";
import { httpGETImage } from "./network/http.js";
import { loadCameraMatrix, saveCameraMatrix, setCameraMatrixTopLeft } from "./api/camera.js";
import { Color } from "./color.js";
import { computedLayout } from "./layout.js";

// TODO: most of this file will end up in C eventually.

let FONT_BYTE_SIZE = 750;
let BITMAP_WIDTH = 96;
let BITMAP_HEIGHT = 72;

/**
 * @type {Texture}
 */
export let SYSTEM_FONT;

/**
 * @type {SpriteBatcher}
 */
let systemFontSpriteBatcher;

export async function initSystemFont() {
	let ptr = Module.ccall("sock_font", "number");
	let url = URL.createObjectURL(new Blob([ HEAPU8().subarray(ptr, ptr + FONT_BYTE_SIZE) ], { type: "image/gif" }));

	try {
		let img = await httpGETImage(url);

		SYSTEM_FONT = new Texture(gl.NEAREST, gl.CLAMP_TO_EDGE);
		SYSTEM_FONT.load(img);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * @param {Uint8Array|string} s
 * @param {number} cornerX
 * @param {number} cornerY
 * @param {Color|number} [color]
 */
export function systemFontDraw(s, cornerX, cornerY, color) {
	if (typeof s === "string") {
		s = new TextEncoder().encode(s);
	}

	let colorInt = color == null ? 0xffffffff : (typeof color === "number" ? color : color.int);

	let oldCamera = saveCameraMatrix();
	setCameraMatrixTopLeft(0, 0);

	if (!systemFontSpriteBatcher) systemFontSpriteBatcher = new SpriteBatcher();

	systemFontSpriteBatcher.begin(SYSTEM_FONT);

	let dx = cornerX;
	let dy = cornerY;
	let screenWidth = computedLayout.rw - 8;

	for (let i = 0; i < s.length; i++) {
		let c = s[i];

		if (c == 9) {
			// Tab
			dx += 24;
		} else if (c === 10) {
			// Newline
			dx = cornerX;
			dy += 14;
		} else if (c == 13) {
			// Carriage return
		} else if (c == 32) {
			// Space
			dx += 6;
		} else {
			// Convert out of range characters to heart glyph
			if (c < 32 || c > 127) c = 127;

			// Draw the character!
			let idx = c - 32;
			let spx = (idx % 16) * 6;
			let spy = Math.trunc(idx / 16) * 12;
	
			systemFontSpriteBatcher.drawQuad(
				dx,     dy,
				dx + 6, dy + 12,
				0,
				spx / BITMAP_WIDTH, spy / BITMAP_HEIGHT,
				(spx + 6) / BITMAP_WIDTH, (spy + 12) / BITMAP_HEIGHT,
				colorInt
			);
	
			dx += 6;
		}

		if (dx >= screenWidth) {
			dx = cornerX;
			dy += 14;
		}
	}

	systemFontSpriteBatcher.end();

	loadCameraMatrix(oldCamera);

	return dy;
}

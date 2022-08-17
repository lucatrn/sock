import { getAssetAsIMG } from "../asset-database.js";
import { addForeignClass } from "../foreign.js";
import { glFilterNumberToString, glFilterStringToNumber, glWrapModeNumberToString, glWrapModeStringToNumber, GL_FILTER_MAP, GL_WRAP_MAP, wrenGlFilterStringToNumber, wrenGlWrapModeStringToNumber } from "../gl/api.js";
import { gl } from "../gl/gl.js";
import { SpriteBatcher } from "../gl/sprite-batcher.js";
import { Texture } from "../gl/texture.js";
import { wrenAbort, vm, wrenEnsureSlots, wrenGetSlotDouble, wrenGetSlotForeign, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenInsertInList, wrenReleaseHandle, wrenSetListElement, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNewForeign, wrenSetSlotNewList, wrenSetSlotNull, wrenSetSlotString, wrenGetVariable, Module, HEAP, wren_sock_get_transform } from "../vm.js";
import { loadAsset } from "./asset.js";
import { WrenHandle } from "./promise.js";


let handle_Sprite = 0;

export function initSpriteModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Sprite", 0);
	handle_Sprite = wrenGetSlotHandle(0);
}

let defaultFilter = gl.NEAREST;
let defaultWrap = gl.CLAMP_TO_EDGE;

class Sprite extends Texture {
	/**
	 * @param {number} ptr
	 */
	constructor(ptr) {
		super(defaultFilter, defaultWrap);

		/**
		 * Foreign slot pointer.
		 */
		this.ptr = ptr;

		/** @type {string} */
		this.path = null;

		/** @type {SpriteBatcher|null} */
		this.batcher = null;

		this.color = 0xffffffff;

		/**
		 * Transform origin.
		 * @type {number[]|null}
		 */
		this.tfo = null;

		/**
		 * Transform matrix.
		 * @type {number[]}
		 */
		this.tf = null;
	}

	name() {
		return this.path || "Sprite#" + this.ptr;
	}

	beginBatch() {
		this.batcher = getBatcher();
		this.batcher.begin(this);
	}

	endBatch() {
		this.batcher.end();
		freeSpriteBatchers.push(this.batcher);
		this.batcher = null;
	}
}


/** @type {SpriteBatcher[]} */
let freeSpriteBatchers = [];

function getBatcher() {
	if (freeSpriteBatchers.length > 0) {
		return freeSpriteBatchers.pop();
	} else {
		return new SpriteBatcher();
	}
}

function getTempBatcher() {
	if (freeSpriteBatchers.length > 0) {
		return freeSpriteBatchers[0];
	} else {
		let bat = new SpriteBatcher();
		freeSpriteBatchers.push(bat);
		return bat;
	}
}


/**
 * Maps foreign C pointer to Sprite object.
 * @type {Map<number, Sprite>}
 */
let sprites = new Map();

/**
 * Gets the current Sprite in slot 0.
 * @returns {Sprite}
 */
function getSprite() {
	return sprites.get(wrenGetSlotForeign(0));
}


addForeignClass("sock", "Sprite", [
	() => {
		let ptr = wrenSetSlotNewForeign(0, 0, 0);

		let spr = new Sprite(ptr);

		sprites.set(ptr, spr);
	},
	(ptr) => {
		let tex = sprites.get(ptr);
		tex.free();
		sprites.delete(ptr);
	},
], {
	"width"() {
		wrenSetSlotDouble(0, getSprite().width);
	},
	"height"() {
		wrenSetSlotDouble(0, getSprite().height);
	},
	"scaleFilter"() {
		wrenSetSlotString(0, glFilterNumberToString(getSprite().filter));
	},
	"scaleFilter=(_)"() {
		let filter = wrenGlFilterStringToNumber(1);

		if (filter != null) {
			getSprite().setFilter(filter);
		}
	},
	"wrapMode"() {
		wrenSetSlotString(0, glWrapModeNumberToString(getSprite().wrap));
	},
	"wrapMode=(_)"() {
		let wrapMode = wrenGlWrapModeStringToNumber(1);

		if (wrapMode != null) {
			getSprite().setWrap(wrapMode);
		}
	},
	"color"() {
		wrenSetSlotDouble(0, getSprite().color);
	},
	"color=(_)"() {
		if (wrenGetSlotType(1) === 1) {
			getSprite().color = wrenGetSlotDouble(1);
		} else {
			wrenAbort("color must be Num");
		}
	},
	"beginBatch()"() {
		let spr = getSprite();
		if (spr.batcher) {
			wrenAbort("batch already started");
		} else {
			spr.beginBatch();
		}
	},
	"endBatch()"() {
		let spr = getSprite();
		if (spr.batcher) {
			spr.endBatch();
		} else {
			wrenAbort("batch no yet started");
		}
	},
	"transform"() {
		let spr = getSprite();

		if (spr.tf == null) {
			wrenSetSlotNull(0);
		} else {
			Module.ccall("sock_new_transform", null, [ "number", "number", "number", "number", "number", "number" ], spr.tf);
		}
	},
	"transform=(_)"() {
		let spr = getSprite();
		let ptr = /** @type {number} */( Module.ccall("sock_get_transform", "number", [ "number" ], [ 1 ]) );
		if (ptr) {
			spr.tfo = null;
			spr.tf = Array.from(new Float32Array(HEAP(), ptr, 6));
		}
	},
	"setTransform(_,_,_)"() {
		let spr = getSprite();

		if (wrenGetSlotType(1) !== 1 || wrenGetSlotType(2) !== 1) {
			wrenAbort("x/y must be Nums");
			return;
		}

		let x = wrenGetSlotDouble(1);
		let y = wrenGetSlotDouble(2);
		let ptr = wren_sock_get_transform(3);

		if (ptr) {
			spr.tfo = [ x, y ];
			spr.tf = Array.from(new Float32Array(HEAP(), ptr, 6));
		}
	},
	"draw(_,_,_,_)"() {
		let spr = getSprite();
		let x1 = wrenGetSlotDouble(1);
		let y1 = wrenGetSlotDouble(2);
		let x2 = x1 + wrenGetSlotDouble(3);
		let y2 = y1 + wrenGetSlotDouble(4);

		let bat = spr.batcher || getTempBatcher().begin(spr);

		bat.drawQuad(x1, y1, x2, y2, 0, 0, 0, 1, 1, spr.color, spr.tf, spr.tfo);

		if (!spr.batcher) bat.end();
	},
	"draw(_,_,_,_,_,_,_,_)"() {
		let spr = getSprite();
		let x1 = wrenGetSlotDouble(1);
		let y1 = wrenGetSlotDouble(2);
		let x2 = x1 + wrenGetSlotDouble(3);
		let y2 = y1 + wrenGetSlotDouble(4);
		let u1 = wrenGetSlotDouble(5) / spr.width;
		let v1 = wrenGetSlotDouble(6) / spr.height;
		let u2 = u1 + wrenGetSlotDouble(7) / spr.width;
		let v2 = v1 + wrenGetSlotDouble(8) / spr.height;

		let bat = spr.batcher || getTempBatcher().begin(spr);

		bat.drawQuad(x1, y1, x2, y2, 0, u1, v1, u2, v2, spr.color, spr.tf, spr.tfo);

		if (!spr.batcher) bat.end();
	},
	"toString"() {
		wrenSetSlotString(0, getSprite().name());
	}
}, {
	"load_(_,_)"() {
		loadAsset(async (path) => {
			let img = await getAssetAsIMG(path);

			wrenEnsureSlots(2);
			wrenSetSlotHandle(0, handle_Sprite);
			let ptr = wrenSetSlotNewForeign(0, 0, 0);

			let spr = new Sprite(ptr);
			spr.path = path;

			sprites.set(ptr, spr);

			spr.load(img);

			return new WrenHandle(wrenGetSlotHandle(0));
		});
	},
	"defaultScaleFilter"() {
		wrenSetSlotString(0, glFilterNumberToString(defaultFilter));
	},
	"defaultScaleFilter=(_)"() {
		let filter = wrenGlFilterStringToNumber(1);

		if (filter != null) {
			defaultFilter = filter;
		}
	},
	"defaultWrapMode"() {
		wrenSetSlotString(0, glWrapModeNumberToString(defaultWrap));
	},
	"defaultWrapMode=(_)"() {
		let wrapMode = wrenGlWrapModeStringToNumber(1);

		if (wrapMode != null) {
			defaultWrap = wrapMode;
		}
	},
});

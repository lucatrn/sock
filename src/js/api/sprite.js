import { addForeignClass } from "../foreign.js";
import { glFilterNumberToString, glFilterStringToNumber, glWrapModeNumberToString, glWrapModeStringToNumber, GL_FILTER_MAP, GL_WRAP_MAP, wrenGlFilterStringToNumber, wrenGlWrapModeStringToNumber } from "../gl/api.js";
import { gl } from "../gl/gl.js";
import { SpriteBatcher } from "../gl/sprite-batcher.js";
import { Texture } from "../gl/texture.js";
import { httpGETImage } from "../network/http.js";
import { wrenAbort, vm, wrenEnsureSlots, wrenGetSlotDouble, wrenGetSlotForeign, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenInsertInList, wrenReleaseHandle, wrenSetListElement, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNewForeign, wrenSetSlotNewList, wrenSetSlotNull, wrenSetSlotString } from "../vm.js";
import { initLoadingProgressList } from "./asset.js";

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

	/**
	 * @param {number} progressListHandle
	 */
	async loadFromPath(progressListHandle) {
		try {
			let progress = -1;
			let error;
			
			let source = await httpGETImage("assets" + this.path);
			
			if (source == null) {
				error = `failed to load sprite ${this.path}`;
			} else {
				this.load(source);
				progress = 1;
			}

			wrenEnsureSlots(2);
			wrenSetSlotHandle(0, progressListHandle);

			wrenSetSlotDouble(1, progress);
			wrenSetListElement(0, 0, 1);

			if (error) {
				wrenSetSlotString(1, error);
				wrenSetListElement(0, 1, 1);
			}
		} finally {
			wrenReleaseHandle(progressListHandle);
		}
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
		console.log("allocate new sprite batcher");
		return new SpriteBatcher();
	}
}

function getTempBatcher() {
	if (freeSpriteBatchers.length > 0) {
		return freeSpriteBatchers[0];
	} else {
		console.log("allocate new sprite batcher");
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

		let tex = new Sprite(ptr);

		sprites.set(ptr, tex);
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
	"load_(_)"() {
		if (wrenGetSlotType(1) !== 6) {
			wrenAbort("path must be a string");
			return;
		}

		let spr = getSprite();

		spr.path = wrenGetSlotString(1);

		let progressListHandle = initLoadingProgressList();

		spr.loadFromPath(progressListHandle);
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
	"transform_"() {
		let spr = getSprite();

		if (spr.tf == null) {
			wrenSetSlotNull(0);
		} else {
			wrenEnsureSlots(2);
			wrenSetSlotNewList(0);
	
			for (let i = 0; i < 6; i++) {
				wrenSetSlotDouble(1, spr.tf[i]);
				wrenInsertInList(0, -1, 1);
			}
		}
	},
	"setTransform_(_,_,_,_,_,_)"() {
		for (let i = 1; i <= 6; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let spr = getSprite();
		let n0 = wrenGetSlotDouble(1);

		if (isNaN(n0)) {
			spr.tf = null;
		} else {
			spr.tf = [
				n0,
				wrenGetSlotDouble(2),
				wrenGetSlotDouble(3),
				wrenGetSlotDouble(4),
				wrenGetSlotDouble(5),
				wrenGetSlotDouble(6),
			];
		}
	},
	"transformOrigin_"() {
		let spr = getSprite();

		if (spr.tfo == null) {
			wrenSetSlotNull(0);
		} else {
			wrenEnsureSlots(2);
			wrenSetSlotNewList(0);
	
			for (let i = 0; i < 2; i++) {
				wrenSetSlotDouble(1, spr.tfo[i]);
				wrenInsertInList(0, -1, 1);
			}
		}
	},
	"setTransformOrigin(_,_)"() {
		for (let i = 1; i <= 2; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let spr = getSprite();
		let n0 = wrenGetSlotDouble(1);

		if (isNaN(n0)) {
			spr.tfo = null;
		} else {
			spr.tfo = [
				n0,
				wrenGetSlotDouble(2),
			];
		}
	},
	"draw_(_,_,_,_,_)"() {
		let spr = getSprite();
		let x1 = wrenGetSlotDouble(1);
		let y1 = wrenGetSlotDouble(2);
		let x2 = x1 + wrenGetSlotDouble(3);
		let y2 = y1 + wrenGetSlotDouble(4);
		let c = wrenGetSlotDouble(5);

		let bat = spr.batcher || getTempBatcher().begin(spr);

		bat.drawQuad(x1, y1, x2, y2, 0, 0, 0, 1, 1, c, spr.tf, spr.tfo);

		if (!spr.batcher) bat.end();
	},
	"draw_(_,_,_,_,_,_,_,_,_)"() {
		let spr = getSprite();
		let x1 = wrenGetSlotDouble(1);
		let y1 = wrenGetSlotDouble(2);
		let x2 = x1 + wrenGetSlotDouble(3);
		let y2 = y1 + wrenGetSlotDouble(4);
		let u1 = wrenGetSlotDouble(5) / spr.width;
		let v1 = wrenGetSlotDouble(6) / spr.height;
		let u2 = u1 + wrenGetSlotDouble(7) / spr.width;
		let v2 = v1 + wrenGetSlotDouble(8) / spr.height;
		let c = wrenGetSlotDouble(9);

		let bat = spr.batcher || getTempBatcher().begin(spr);

		bat.drawQuad(x1, y1, x2, y2, 0, u1, v1, u2, v2, c, spr.tf, spr.tfo);

		if (!spr.batcher) bat.end();
	},
	"toString"() {
		wrenSetSlotString(0, getSprite().name());
	}
}, {
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

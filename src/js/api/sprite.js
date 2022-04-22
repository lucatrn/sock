import { addForeignClass } from "../foreign.js";
import { glFilterNumberToString, glFilterStringToNumber, glWrapModeNumberToString, glWrapModeStringToNumber, GL_FILTER_MAP, GL_WRAP_MAP } from "../gl/api.js";
import { gl } from "../gl/gl.js";
import { SpriteBatcher } from "../gl/sprite-batcher.js";
import { Texture } from "../gl/texture.js";
import { httpGETImage } from "../network/http.js";
import { abortFiber, vm } from "../vm.js";

let defaultFilter = gl.NEAREST;
let defaultWrap = gl.CLAMP_TO_EDGE;

class Sprite extends Texture {
	/**
	 * @param {string} path
	 */
	constructor(path) {
		super(defaultFilter, defaultWrap);

		this.path = path;
		this.progress = null;
		/** @type {SpriteBatcher|null} */
		this.batcher = null;
		/**
		 * Transform origin
		 * @type {number[]|null}
		 */
		this.tfo = null;
		/**
		 * Transform
		 * @type {number[]}
		 */
		this.tf = null;
	}

	get name() {
		return this.path;
	}

	async loadFromPath() {
		if (this.progress == null) {
			this.progress = 0;

			let source = await httpGETImage(resolveAssetPath(this.path));
			if (source == null) {
				console.error("failed to load sprite " + this.path);
			} else {
				this.load(source);
	
				this.progress = this.size;
			}
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


/** @type {Map<number, Sprite>} */
let sprites = new Map();

function getSprite() {
	return sprites.get(vm.getSlotForeign(0));
}


addForeignClass("sock", "Sprite", {
	allocate() {
		let path = vm.getSlotString(1);
		let ptr = vm.setSlotNewForeign(0, 0, 0);

		let tex = new Sprite(path);

		sprites.set(ptr, tex);
	},
	finalize(ptr) {
		let tex = sprites.get(ptr);
		tex.free();
		sprites.delete(ptr);
	},
}, {
	"path"() {
		vm.setSlotString(0, getSprite().path);
	},
	"width"() {
		vm.setSlotDouble(0, getSprite().width);
	},
	"height"() {
		vm.setSlotDouble(0, getSprite().height);
	},
	"bytesLoaded"() {
		vm.setSlotDouble(0, getSprite().progress || 0);
	},
	"byteSize"() {
		vm.setSlotDouble(0, getSprite().size);
	},
	async "load_()"() {
		getSprite().loadFromPath();
	},
	"scaleFilter"() {
		vm.setSlotString(0, glFilterNumberToString(getSprite().filter));
	},
	"scaleFilter=(_)"() {
		getSprite().setFilter(glFilterStringToNumber(vm.getSlotString(1)));
	},
	"wrapMode"() {
		vm.setSlotString(0, glWrapModeNumberToString(getSprite().wrap));
	},
	"wrapMode=(_)"() {
		getSprite().setWrap(glWrapModeStringToNumber(vm.getSlotString(1)));
	},
	"beginBatch()"() {
		let spr = getSprite();
		if (spr.batcher) {
			abortFiber("batch already started");
		} else {
			spr.beginBatch();
		}
	},
	"endBatch()"() {
		let spr = getSprite();
		if (spr.batcher) {
			spr.endBatch();
		} else {
			abortFiber("batch no yet started");
		}
	},
	"transform_"() {
		let spr = getSprite();

		if (spr.tf == null) {
			vm.setSlotNull(0);
		} else {
			vm.ensureSlots(2);
			vm.setSlotNewList(0);
	
			for (let i = 0; i < 6; i++) {
				vm.setSlotDouble(1, spr.tf[i]);
				vm.insertInList(0, -1, 1);
			}
		}
	},
	"setTransform_(_,_,_,_,_,_)"() {
		let spr = getSprite();
		let n0 = vm.getSlotDouble(1);

		if (isNaN(n0)) {
			spr.tf = null;
		} else {
			spr.tf = [
				n0,
				vm.getSlotDouble(2),
				vm.getSlotDouble(3),
				vm.getSlotDouble(4),
				vm.getSlotDouble(5),
				vm.getSlotDouble(6),
			];
		}
	},
	"transformOrigin_"() {
		let spr = getSprite();

		if (spr.tfo == null) {
			vm.setSlotNull(0);
		} else {
			vm.ensureSlots(2);
			vm.setSlotNewList(0);
	
			for (let i = 0; i < 2; i++) {
				vm.setSlotDouble(1, spr.tfo[i]);
				vm.insertInList(0, -1, 1);
			}
		}
	},
	"setTransformOrigin(_,_)"() {
		let spr = getSprite();
		let n0 = vm.getSlotDouble(1);

		if (isNaN(n0)) {
			spr.tfo = null;
		} else {
			spr.tfo = [
				n0,
				vm.getSlotDouble(2),
			];
		}
	},
	"draw_(_,_,_,_,_)"() {
		let spr = getSprite();
		let x1 = vm.getSlotDouble(1);
		let y1 = vm.getSlotDouble(2);
		let x2 = x1 + vm.getSlotDouble(3);
		let y2 = y1 + vm.getSlotDouble(4);
		let c = vm.getSlotDouble(5);

		let bat = spr.batcher || getTempBatcher().begin(spr);

		bat.drawQuad(x1, y1, x2, y2, 0, 0, 0, 1, 1, c, spr.tf, spr.tfo);

		if (!spr.batcher) bat.end();
	},
	"draw_(_,_,_,_,_,_,_,_,_)"() {
		let spr = getSprite();
		let x1 = vm.getSlotDouble(1);
		let y1 = vm.getSlotDouble(2);
		let x2 = x1 + vm.getSlotDouble(3);
		let y2 = y1 + vm.getSlotDouble(4);
		let u1 = vm.getSlotDouble(5) / spr.width;
		let v1 = vm.getSlotDouble(6) / spr.height;
		let u2 = u1 + vm.getSlotDouble(7) / spr.width;
		let v2 = v1 + vm.getSlotDouble(8) / spr.height;
		let c = vm.getSlotDouble(9);

		let bat = spr.batcher || getTempBatcher().begin(spr);

		bat.drawQuad(x1, y1, x2, y2, 0, u1, v1, u2, v2, c, spr.tf, spr.tfo);

		if (!spr.batcher) bat.end();
	},
}, {
	"defaultScaleFilter"() {
		vm.setSlotString(0, glFilterNumberToString(defaultFilter));
	},
	"defaultScaleFilter=(_)"() {
		let name = vm.getSlotString(1);
		
		defaultFilter = glFilterStringToNumber(name);
	},
	"defaultWrapMode"() {
		vm.setSlotString(0, glWrapModeNumberToString(defaultWrap));
	},
	"defaultWrapMode=(_)"() {
		let name = vm.getSlotString(1);

		defaultWrap = glWrapModeStringToNumber(name);
	},
});

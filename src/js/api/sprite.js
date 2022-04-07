import { addForeignClass } from "../foreign.js";
import { glFilterNumberToString, glFilterStringToNumber, glWrapModeNumberToString, glWrapModeStringToNumber, GL_FILTER_MAP, GL_WRAP_MAP } from "../gl/api.js";
import { gl } from "../gl/gl.js";
import { SpriteBatcher } from "../gl/sprite-batcher.js";
import { Texture } from "../gl/texture.js";
import { httpGETImage } from "../network/http.js";
import { abortFiber, vm } from "../vm.js";
import { resolveAssetPath } from "./asset.js";

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
	"loadProgress"() {
		vm.setSlotDouble(0, getSprite().progress || 0);
	},
	"size"() {
		vm.setSlotDouble(0, getSprite().size);
	},
	async "load_()"() {
		getSprite().loadFromPath();
	},
	"beginBatch()"() {
		let spr = getSprite();
		if (spr.batcher) {
			abortFiber("Batch already started");
		} else {
			spr.beginBatch();
		}
	},
	"endBatch()"() {
		let spr = getSprite();
		if (spr.batcher) {
			spr.endBatch();
		} else {
			abortFiber("Batch no yet started");
		}
	},
	"draw(_,_,_,_)"() {
		let x = vm.getSlotDouble(1);
		let y = vm.getSlotDouble(2);
		let w = vm.getSlotDouble(3);
		let h = vm.getSlotDouble(4);
		let spr = getSprite();

		if (spr.batcher) {
			spr.batcher.draw(x, y, w, h);
		} else {
			let bat = getTempBatcher();

			bat.begin(spr);
			bat.draw(x, y, w, h);
			bat.end();
		}
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

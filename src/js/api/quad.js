import { addClassForeignStaticMethods } from "../foreign.js";
import { QuadBatcher } from "../gl/quad-batcher.js";
import { wrenAbort, wrenGetSlotDouble, wrenGetSlotType } from "../vm.js";

/**
 * @type {QuadBatcher}
 */
let batcher = null;

addClassForeignStaticMethods("sock", "Quad", {
	"beginBatch()"() {
		if (!batcher) batcher = new QuadBatcher();
		batcher.begin();
	},
	"endBatch()"() {
		if (!batcher) batcher = new QuadBatcher();
		batcher.end();
	},
	"draw(_,_,_,_,_)"() {
		for (let i = 1; i <= 5; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let x = wrenGetSlotDouble(1);
		let y = wrenGetSlotDouble(2);
		let w = wrenGetSlotDouble(3);
		let h = wrenGetSlotDouble(4);
		let color = wrenGetSlotDouble(5);

		if (!batcher) batcher = new QuadBatcher();

		let singleBatch = !batcher.inBatch();

		if (singleBatch) batcher.begin();

		batcher.drawRect(x, y, x + w, y + h, 0, color);

		if (singleBatch) batcher.end();
	},
	"draw(_,_,_,_,_,_,_,_,_)"() {
		for (let i = 1; i <= 9; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let x1 = wrenGetSlotDouble(1);
		let y1 = wrenGetSlotDouble(2);
		let x2 = wrenGetSlotDouble(3);
		let y2 = wrenGetSlotDouble(4);
		let x3 = wrenGetSlotDouble(5);
		let y3 = wrenGetSlotDouble(6);
		let x4 = wrenGetSlotDouble(7);
		let y4 = wrenGetSlotDouble(8);
		let color = wrenGetSlotDouble(9);

		if (!batcher) batcher = new QuadBatcher();

		let singleBatch = !batcher.inBatch();

		if (singleBatch) batcher.begin();

		batcher.drawQuad(x1, y1, x2, y2, x3, y3, x4, y4, 0, color);

		if (singleBatch) batcher.end();
	},
});

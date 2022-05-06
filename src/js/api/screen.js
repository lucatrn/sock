import { addClassForeignStaticMethods } from "../foreign.js";
import { wrenEnsureSlots, wrenInsertInList, wrenSetSlotDouble, wrenSetSlotNewList } from "../vm.js";

/**
 * @param {number[]} xs
 */
function returnWrenNumList(xs) {
	wrenEnsureSlots(2);
	wrenSetSlotNewList(0);

	for (let x of xs) {
		wrenSetSlotDouble(1, x);
		wrenInsertInList(0, -1, 1);
	}
}

addClassForeignStaticMethods("sock", "Screen", {
	"sz_"() {
		returnWrenNumList([ screen.width, screen.height ]);
	},
	"sza_"() {
		returnWrenNumList([ screen.availWidth, screen.availHeight ]);
	},
});

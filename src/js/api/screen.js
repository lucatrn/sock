import { addClassForeignStaticMethods } from "../foreign.js";
import { wrenSetSlotDouble } from "../vm.js";


let refreshRate = 60;

/**
 * @param {number} rate
 */
export function updateRefreshRate(rate) {
	refreshRate = rate;
}

addClassForeignStaticMethods("sock", "Screen", {
	"width"() {
		wrenSetSlotDouble(0, screen.width);
	},
	"height"() {
		wrenSetSlotDouble(0, screen.height);
	},
	"availableWidth"() {
		wrenSetSlotDouble(0, screen.availWidth);
	},
	"availableHeight"() {
		wrenSetSlotDouble(0, screen.availHeight);
	},
	"refreshRate"() {
		wrenSetSlotDouble(0, refreshRate);
	},
});

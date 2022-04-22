import { addForeignMethod } from "../foreign.js";
import { gl } from "../gl/gl.js";
import { wrenGetSlotDouble } from "../vm.js";

addForeignMethod("", "Graphics", true, "clear(_,_,_)", () => {
	let r = wrenGetSlotDouble(1);
	let g = wrenGetSlotDouble(2);
	let b = wrenGetSlotDouble(3);

	gl.clearColor(r, g, b, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
});

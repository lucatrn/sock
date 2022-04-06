import { addForeignMethod } from "../foreign.js";
import { gl } from "../gl/gl.js";
import { vm } from "../vm.js";

addForeignMethod("", "Graphics", true, "clear(_,_,_)", () => {
	let r = vm.getSlotDouble(1);
	let g = vm.getSlotDouble(2);
	let b = vm.getSlotDouble(3);

	gl.clearColor(r, g, b, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
});

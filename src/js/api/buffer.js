import { addClassForeignStaticMethods } from "../foreign.js";
import { httpGET } from "../network/http.js";
import { Module, wrenGetSlotHandle } from "../vm.js";
import { loadAsset } from "./asset.js";
import { WrenHandle } from "./promise.js";

addClassForeignStaticMethods("sock", "Buffer", {
	"load_(_,_)"() {
		loadAsset(async (url) => {
			let buffer = await httpGET(url, "arraybuffer");

			// Copy ArrayBuffer to C.
			let len = buffer.byteLength;

			let ptr = 0;
			if (len > 0) {
				ptr = Module._malloc(len);
				if (!ptr) throw `could not allocate ${len} bytes`;

				Module.HEAPU8.set(new Uint8Array(buffer), ptr);
			}
	
			// Load bytes in C memory into new Buffer.
			Module.ccall("sock_new_buffer", null, [ "number", "number" ], [ ptr, len ]);

			return new WrenHandle(wrenGetSlotHandle(0));
		});
	}
});

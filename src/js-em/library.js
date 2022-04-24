
mergeInto(LibraryManager.library, {
	js_write: function (vm, text) {
		Module.sock.write(UTF8ToString(text));
	},
	js_error: function (vm, type, module, line, message) {
		Module.sock.error(type, UTF8ToString(module), line, UTF8ToString(message));
	},
	js_loadModule: function (vm, name) {
		return mallocString(Module.sock.loadModule(UTF8ToString(name)));
	},
	js_bindMethod: function (vm, module, className, isStatic, signature) {
		let fn = Module.sock.bindMethod(UTF8ToString(module), UTF8ToString(className), !!isStatic, UTF8ToString(signature));
		return fn ? Module.addFunction(fn, "vi") : 0;
	},
	js_bindClass: function (vm, module, className, methods) {
		let fns = Module.sock.bindClass(UTF8ToString(module), UTF8ToString(className));
		if (fns) {
			let [allocate, finalize] = fns;

			if (allocate) {
				let u32 = new Uint32Array(Module.HEAP8.buffer, methods);

				u32[0] = Module.addFunction(allocate, "vi");

				if (finalize) {
					u32[1] = Module.addFunction(finalize, "vi");
				}
			}
		}
	},
});

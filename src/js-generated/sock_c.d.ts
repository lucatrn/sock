
/**
 * Call to load Emscripten and get the Module.
 */
declare const sockEmscriptenFactory: () => Promise<SockEmscriptenModule>;

export default sockEmscriptenFactory;

export interface SockEmscriptenModule {
	HEAP8: Int8Array;
	HEAP16: Int16Array;
	HEAP32: Int32Array;
	HEAPU8: Uint8Array;
	HEAPU16: Uint16Array;
	HEAPU32: Uint32Array;
	HEAPF32: Float32Array;
	HEAPF64: Float64Array;

	/**
	 * Allocates `size` bytes of memory.
	 * 
	 * Returns pointer to allocated memory, which should be later released with {@link _free()}.
	 */
	_malloc(size: number): number;

	/**
	 * Reallocates the memory at `ptr` to `size` bytes of memory.
	 * 
	 * Returns pointer to newly allocated memory, which should be later released with {@link _free()}.
	 */
	_realloc(ptr: number, size: number): number;

	/**
	 * Releases memory previously allocated using {@link _malloc()} or {@link _realloc()}.
	 */
	_free(ptr: number): void;

	/**
	 * Used for creating allocated memory.
	 * 
	 * Must be called before using {@link stackAlloc()}.
	 * 
	 * Once used, release the stack with {@link stackRestore stackRestore(stack)}, passing the value returned from `stackSave`.
	 */
	stackSave(): number;

	/**
	 * Used for creating allocated memory.
	 * 
	 * Pass the value returned from {@link stackSave()} to release stack allocated memory.
	 */
	stackRestore(stack: number): void;

	/**
	 * Allocates `size` bytes of memory to the stack.
	 * @example
	 * let stack = Module.stackSave();
	 * 
	 * let ptr = Module.stackAlloc(1);
	 * 
	 * Module.ccall("myFunction", "void", ["number"], [ptr]);
	 * 
	 * console.log(Module.HEAPU8[ptr]);
	 * 
	 * Module.stackRestore(stack)
	 */
	stackAlloc(size: number): number;

	/**
	 * Add a function pointer to C.
	 * 
	 * https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#calling-javascript-functions-as-function-pointers-from-c
	 * @param func The javascript function.
	 * @param signature C function signature, e.g. `"vi"` for `void f(int x)`.
	 * @returns The function pointer
	 */
	addFunction(func: any, signature: string): number;

	/**
	 * Call an exported C function.
	 * 
	 * https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#interacting-with-code-ccall-cwrap
	 */
	ccall(funcName: string, returnType?: string, argTypes?: string[], args?: any[]): any;

	/**
	 * Enables communication from C to modularised JS src.
	 */
	sock: Record<string, any>;
}


/**
 * Asynchronously loads the Wren WASM code, if not loaded alreadly.
 * 
 * Must be called before the {@link VM} is used.
 */
export function load(): Promise<void>

/**
 * Get the current wren version number as an integer (e.g. 4000 for version 0.4.0).
 */
export function getVersionNumber(): number;

/**
 * A single virtual machine for executing Wren code.
 * 
 * Wren has no global state, so all state stored by a running interpreter lives here.
 */
export class VM {
	readonly config: VMConfiguration

	/**
	 * The Emscripten module.
	 * 
	 * Used to read/write directly to C memory.
	 */
	readonly Module: WrenEmscriptenModule;

	/**
	 * The Emscripten heap.
	 * 
	 * Can use to read/write with C pointers.
	 */
	readonly heap: ArrayBuffer;
	
	/**
	 * Creates a new Wren VM, separate from any others.
	 */
	constructor(config?: Partial<VMConfiguration>)

	/**
	 * Disposes of all resources in use by the VM.
	 */
	free(): void;

	/**
	 * Immediately run the garbage collector to free unused memory.
	 */
	collectGarbage(): void;

	/**
	 * Runs `source`, a string of Wren source code in a new fiber in the
	 * context of resolved `moduleName`.
	 */
	interpret(moduleName: string, source: CStringSource): InterpretResult;

	/**
	 * Creates a handle that can be used to invoke a method with [signature] on
	 * using a receiver and arguments that are set up on the stack.
	 * 
	 * This handle can be used repeatedly to directly invoke that method from C
	 * code using {@link call()}.
	 * 
	 * When you are done with this handle, it must be released using {@link releaseHandle()}.
	 */
	makeCallHandle(signature: string): Handle;

	/**
	 * Calls `method`, using the receiver and arguments previously set up on the
	 * stack.
	 *
	 * [method] must have been created by a call to [wrenMakeCallHandle]. The
	 * arguments to the method must be already on the stack. The receiver should be
	 * in slot 0 with the remaining arguments following it, in order. It is an
	 * error if the number of arguments provided does not match the method's
	 * signature.
	 *
	 * After this returns, you can access the return value from slot 0 on the stack.
	 */
	call(method: Handle): InterpretResult.SUCCESS | InterpretResult.RUNTIME_ERROR;

	/**
	 * Releases the reference stored in `handle`. After calling this,
	 * `handle` can no longer be used.
	 */
	releaseHandle(handle: Handle): void;

	/**
	 * Returns the number of slots available to the current foreign method.
	 */
	getSlotCount(): number;

	/**
	 * Ensures that the foreign method stack has at least `numSlots` available
	 * for use, growing the stack if needed.
	 * 
	 * Does not shrink the stack if it has more than enough slots.
	 * 
	 * It is an error to call this from a finalizer.
	 */
	ensureSlots(numSlots: number): void;

	/**
	 * Gets the type of the object in `slot`.
	 */
	getSlotType(slot: number): Type;

	/**
	 * Reads a boolean value from `slot`.
	 */
	getSlotBool(slot: number): boolean;
	
	/**
	 * Reads a byte array from `slot` (that contains a Wren string).
	 * 
	 * The memory for the returned string is owned by Wren. You can inspect it
	 * while in your foreign method, but cannot keep a pointer to it after the
	 * function returns, since the garbage collector may reclaim it.
	 */
	getSlotBytes(slot: number): Uint8Array;

	/**
	 * Reads a number value from `slot`.
	 */
	getSlotDouble(slot: number): number;

	/**
	 * Reads a foreign object from `slot` and returns a pointer to the foreign
	 * data stored with it.
	 */
	getSlotForeign(slot: number): number;
	
	/**
	 * Reads a string value from `slot`.
	 */
	getSlotString(slot: number): string;

	/**
	 * Creates a handle for the value stored in `slot`.
	 * 
	 * This will prevent the object that is referred to from being garbage collected
	 * until the handle is released by calling {@link releaseHandle()}.
	 */
	getSlotHandle(slot: number): Handle;

	/**
	 * Stores the boolean `value` in `slot`.
	 */
	setSlotBool(slot: number, value: boolean): void;
	
	/**
	 * Stores the array `bytes` in `slot`.
	 * 
	 * If `length` is provided only that many bytes are stored.
	 * 
	 * The bytes are copied to a new string within Wren's heap, so you can free
	 * memory used by them after this is called.
	 */
	setSlotBytes(slot: number, bytes: ArrayBuffer | Uint8Array | Uint8ClampedArray | Int8Array, length?: number): void;
	
	/**
	 * Stores `length` bytes from array at `pointer` in `slot`.
	 * 
	 * The bytes are copied to a new string within Wren's heap, so you can free
	 * memory used by them after this is called.
	 */
	setSlotBytes(slot: number, pointer: number, length: number): void;
	
	/**
	 * Stores the numeric `value` in `slot`.
	 */
	setSlotDouble(slot: number, value: number): void;
	
	/**
	 * Stores the numeric `value` in `slot`.
	 */
	setSlotDouble(slot: number, value: number): void;
	
	/**
	 * Creates a new instance of the foreign class stored in `classSlot with `size`
	 * bytes of raw storage and places the resulting object in `slot`.
	 * 
	 * This does not invoke the foreign class's constructor on the new instance. If
	 * you need that to happen, call the constructor from Wren, which will then
	 * call the allocator foreign method. In there, call this to create the object
	 * and then the constructor will be invoked when the allocator returns.
	 * 
	 * @returns A pointer to the foreign object's data.
	 */
	setSlotNewForeign(slot: number, classSlot: number, size: number): number;

	/**
	 * Stores a new empty list in `slot`.
	 */
	setSlotNewList(slot: number): void;
	
	/**
	 * Stores a new empty map in `slot`.
	 */
	setSlotNewMap(slot: number): void;
	
	/**
	 * Stores a null in `slot`.
	 */
	setSlotNull(slot: number): void;

	/**
	 * Stores the string `value` in `slot`.
	 * 
	 * `value` can be provided as a UTF-8 array, which is copied directly into
	 * Wasm memory.
	 */
	setSlotString(slot: number, value: CStringSource): void;

	/**
	 * Stores the value captured in `handle` in `slot`.
	 * 
	 * This does not release the handle for the value.
	 */
	setSlotHandle(slot: number, handle: Handle): void;

	/**
	 * Returns the number of elements in the list stored in `slot`.
	 */
	getListCount(slot: number): number

	/**
	 * Reads element `index` from the list in `listSlot` and stores it in `elementSlot`.
	 */
	getListElement(listSlot: number, index: number, elementSlot: number): void;
	
	/**
	 * Sets the value stored at `index` in the list at `listSlot` to the value from `elementSlot`.
	 */
	setListElement(listSlot: number, index: number, elementSlot: number): void;
	
	/**
	 * Takes the value stored at `elementSlot` and inserts it into the list stored
	 * at `listSlot` at `index`.
	 *
	 * As in Wren, negative indexes can be used to insert from the end. To append
	 * an element, use `-1` for the index.
	 */
	insertInList(listSlot: number, index: number, elementSlot: number): void;
	
	/**
	 * Returns the number of entries in the map stored in `slot`.
	 */
	getMapCount(slot: number): number;
	
	/**
	 * Returns true if the key in `keySlot` is found in the map placed in `mapSlot`.
	 */
	getMapContainsKey(mapSlot: number, keySlot: number): boolean;

	/**
	 * Retrieves a value with the key in `keySlot` from the map in `mapSlot` and
	 * stores it in `valueSlot`.
	 */
	getMapValue(mapSlot: number, keySlot: number, valueSlot: number): void;
	
	/**
	 * Takes the value stored at `valueSlot` and inserts it into the map stored
	 * at `mapSlot` with key `keySlot`.
	 */
	setMapValue(mapSlot: number, keySlot: number, valueSlot: number): void;
	
	/**
	 * Removes a value from the map in `mapSlot`, with the key from `keySlot`,
	 * and place it in `removedValueSlot`. If not found, [removedValueSlot] is
	 * set to null, the same behaviour as the Wren Map API.
	 */
	removeMapValue(mapSlot: number, keySlot: number, removedValueSlot: number): void;

	/**
	 * Looks up the top level variable with `variableName` in resolved
	 * `moduleName` and stores it in `slot`.
	 */
	getVariable(moduleName: string, variableName: string, slot: number): void;

	/**
	 * Looks up the top level variable with `variableName` in resolved `moduleName`,
	 * returns false if not found. The module must be imported at the time,
	 * use {@link hasModule()} to ensure that before calling.
	 */
	hasVariable(moduleName: string, variableName: string): boolean;

	/**
	 * Returns true if `moduleName` has been imported/resolved before.
	 */
	hasModule(moduleName: string): boolean;

	/**
	 * Sets the current fiber to be aborted, and uses the value in `slot` as the
	 * runtime error object.
	 */
	abortFiber(slot: number): void;
}

/**
 * Confuration for the Wren VM.
 */
export interface VMConfiguration {
	/**
	 * The callback Wren uses to resolve a module name.
	 * 
	 * Some host applications may wish to support "relative" imports, where the
	 * meaning of an import string depends on the module that contains it. To
	 * support that without baking any policy into Wren itself, the VM gives the
	 * host a chance to resolve an import string.
	 * 
	 * Before an import is loaded, it calls this, passing in the name of the
	 * module that contains the import and the import string. The host app can
	 * look at both of those and produce a new "canonical" string that uniquely
	 * identifies the module. This string is then used as the name of the module
	 * going forward. It is what is passed to {@link loadModuleFn}, how duplicate
	 * imports of the same module are detected, and how the module is reported in
	 * stack traces.
	 * 
	 * If an import cannot be resolved by the embedder, it should return `null` and
	 * Wren will report that as a runtime error.
	 * 
	 * By default {@link VM} just returns the `name` as is.
	 */
	resolveModuleFn: (importer: string, name: string) => (CStringSource | null | undefined);
	
	/**
	 * The callback Wren uses to load a module's source code.
	 * 
	 * Since Wren does not talk directly to the file system, it relies on the
	 * embedder to physically locate and read the source code for a module. The
	 * first time an import appears, Wren will call this and pass in the name of
	 * the module being imported. The method will return a result, which contains
	 * the source code for that module. Memory for the source is owned by the 
	 * host application, and can be freed using the onComplete callback.
	 * 
	 * This will only be called once for any given module name. Wren caches the
	 * result internally so subsequent imports of the same module will use the
	 * previous source and not call this.
	 * 
	 * If a module with the given name could not be found by the embedder, it
	 * should return `null` and Wren will report that as a runtime error.
	 * 
	 * By default {@link VM} does not handle importing modules.
	 */
	loadModuleFn: (name: string) => (CStringSource | null | undefined | Promise<CStringSource | null | undefined | void>);

	/**
	 * The callback Wren uses to find a foreign method and bind it to a class.
	 * 
	 * When a foreign method is declared in a class, this will be called with the
	 * foreign method's module, class, and signature when the class body is
	 * executed. It should return a pointer to the foreign function that will be
	 * bound to that method.
	 * 
	 * If the foreign function could not be found, this should return NULL and
	 * Wren will report it as runtime error.
	 */
	bindForeignMethodFn: (moduleName: string, className: string, isStatic: boolean, signature: string) => (((vm: VM) => void) | null | undefined | void);

	/**
	 * The callback Wren uses to find a foreign class and get its foreign methods.
	 * 
	 * When a foreign class is declared, this will be called with the class's
	 * module and name when the class body is executed. It should return the
	 * foreign functions uses to allocate and (optionally) finalize the bytes
	 * stored in the foreign object when an instance is created.
	 */
	bindForeignClassFn: (moduleName: string, className: string) => (ForeignClassMethods | null | undefined | void);

	/**
	 * Used to display text via `System.print()` and `System.write()` methods.
	 * 
	 * This function is called for each line in the output:
	 * - `System.print()` = 1 line ("")
	 * - `System.print("hello")` = 1 line ("hello")
	 * - `System.print("hello\nworld")` = 2 lines ("hello", "world")
	 * 
	 * By default {@link VM} just prints the line via `console.log()`.
	 */
	writeFn: (line: string) => void;

	/**
	 * The callback Wren uses to report errors.
	 * 
	 * An error detected during compile time is reported by calling this once with
	 * `type` {@link ErrorType.COMPILE}, the resolved name of the `module` and `line`
	 * where the error occurs, and the compiler's error `message`.
	 *
	 * A runtime error is reported by calling this once with `type`
	 * {@link ErrorType.RUNTIME}, no `module` or `line`, and the runtime error's
	 * `message`. After that, a series of `type` {@link ErrorType.STACK_TRACE} calls are
	 * made for each line in the stack trace. Each of those has the resolved
	 * `module` and `line` where the method or function is defined and `message` is
	 * the name of the method or function.
	 * 
	 * By default {@link VM} just prints the information via `console.error()`.
	 */
	errorFn: (errorType: ErrorType, moduleName: string, line: number, message: string) => void;
}

/**
 * The default config used when constructing new {@link VM}s.
 */
export let defaultConfig: VMConfiguration;

/**
 * A pair of functions to the foreign methods used to allocate and
 * finalize the data for instances of a foreign class.
 */
export interface ForeignClassMethods {
	/**
	 * Called when an object of the passed class is constructed, before the constructor is run.
	 * 
	 * You must call {@link VM.setSlotNewForeign} exactly once in this callback.
	 */
	allocate?: null | ((vm: VM) => void);

	/**
	 * Called when an instance of the passed class is garbage-collected.
	 * 
	 * The callback should NOT access the VM during this call.
	 * @param pointer Pointer to data allocated in the {@link allocate} function.
	 */
	finalize?: null | ((pointer: number) => void);
}

/**
 * The type of error returned by the {@link VM}.
 */
export enum ErrorType {
	/** A syntax or resolution error detected at compile time. */
	COMPILE = 0,
	/** The error message for a runtime error. */
	RUNTIME = 1,
	/** One entry of a runtime error's stack trace. */
	STACK_TRACE = 2,
}

/**
 * The result of a VM interpreting wren source.
 */
export enum InterpretResult {
	/** The VM interpreted the source without error. */
	SUCCESS = 0,
	/** The VM experienced a compile error. */
	COMPILE_ERROR = 1,
	/** The VM experienced a runtime error. */
	RUNTIME_ERROR = 2,
}

/**
 * The type of an object stored in a slot.
 * 
 * This is not necessarily the object's *class*, but instead its low level representation type.
 */
export enum Type {
	BOOL = 0,
	NUM = 1,
	FOREIGN = 2,
	LIST = 3,
	MAP = 4,
	NULL = 5,
	STRING = 6,
	/** The object is of a type that isn't accessible by the C API. */
	UNKNOWN = 7,
}

/**
 * A handle/pointer to a Wren object.
 * 
 * This lets code outside of the VM hold a persistent reference to an object
 * After a handle is acquired, and until it is released, this ensures the
 * garbage collector will not reclaim the object it references.
 */
export type Handle = number;

/**
 * A string that is passed to C/Wasm.
 * 
 * If provided as an array, it is interpreted as a UTF-8 byte array, which is copied directly into Wasm memory.
 * This avoids the overhead of converting a JavaScript string to UTF-8.
 */
export type CStringSource = string | ArrayBuffer | Uint8Array | Uint8ClampedArray;

export interface WrenEmscriptenModule {
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
}

/**
 * Default export that has all exported JavaScript APIs.
 */
declare const Wren: {
	load: typeof load;
	getVersionNumber: typeof getVersionNumber;

	/**
	 * The type of error returned by the {@link VM}.
	 */
	ErrorType: typeof ErrorType;

	/**
	 * The result of a VM interpreting wren source.
	 */
	InterpretResult: typeof InterpretResult;

	/**
	 * The type of an object stored in a slot.
	 * 
	 * This is not necessarily the object's *class*, but instead its low level representation type.
	 */
	Type: typeof Type;

	/**
	 * A single virtual machine for executing Wren code.
	 * 
	 * Wren has no global state, so all state stored by a running interpreter lives here.
	 */
	VM: typeof VM,

	/**
	 * The default config used when constructing new {@link VM}s.
	 */
	defaultConfig: VMConfiguration,
};
export default Wren;

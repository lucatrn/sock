
// This file provides utilities to the inline EM_ASM JavaScript found in [shim.c]. 

/**
 * @param {string|ArrayBuffer|Uint8Array|undefined|null} src
 * @returns {number} The string's pointer
 */
function mallocString(src) {
	if (!src) return 0;
	if (typeof src === "string") {
		var len = lengthBytesUTF8(src) + 1;
		var heapString = _malloc(len);
		stringToUTF8(src, heapString, len);
		return heapString;
	} else {
		if (src instanceof ArrayBuffer) {
			src = new Uint8Array(src);
		}
	
		var nullTerminated = src[src.length - 1] === 0;
		var len = nullTerminated ? src.length : src.length + 1;
		var heapString = _malloc(len);
	
		HEAPU8.set(src, heapString);
	
		if (!nullTerminated) {
			HEAPU8[ptr + len - 1] = 0;
		}

		return heapString;
	}
}

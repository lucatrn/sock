#include <string.h>
#include <errno.h>
#include <stdio.h>
#include <math.h>
#include <stdint.h>
#include "emscripten.h"
#include "wren.h"

int strLastIndex(const char* str, char c) {
	int i = -1;
	for (int j = 0; str[j] != '\0'; j++) {
		if (str[j] == c) i = j;
	}
	return i;
}

static const char* ERR_INVALID_ARGS = "invalid args";

// Aborts the current Wren fiber, using the given string as the error.
void wrenAbort(WrenVM* vm, const char* msg) {
	wrenEnsureSlots(vm, 1);
	wrenSetSlotString(vm, 0, msg);
	wrenAbortFiber(vm, 0);
}

char nibbleAsHuamnChar(unsigned char b) {
	if (b < 10) return 48 + b;
	if (b < 16) return 87 + b;
	return '?';
}

// Insert charcters at buffer[0] and buffer[1] that display the given byte
// as a human readable hex value.
void bufferPutHumanHex(char* buffer, unsigned char b) {
	buffer[0] = nibbleAsHuamnChar(b >> 4);
	buffer[1] = nibbleAsHuamnChar(b & 15);
}

// Validates an integer index at the given slot. Supports negative indices.
uint32_t wren_validateIndex(WrenVM* vm, uint32_t count, int slot) {
	if (wrenGetSlotType(vm, slot) != WREN_TYPE_NUM) {
		wrenAbort(vm, "index must be a number");
		return UINT32_MAX;
	}

	double value = wrenGetSlotDouble(vm, slot);
	if (value != trunc(value)) {
		wrenAbort(vm, "index must be an integer");
		return UINT32_MAX;
	}

	// Negative indices count from the end.
	if (value < 0) value = count + value;
	
	// Check bounds.
	if (value >= 0 && value < count) return (uint32_t)value;
	
	wrenAbort(vm, "index out of bounds");
	return UINT32_MAX;
}

#define RELATIVE_PART_BUFFER_SIZE 16

// Do relative path resolution.
// - [path] is a absolute or relative path, optionally containing ".." sequences.
// - [curr] is an absolute path of the current file, e.g. "/sprites/creatures/yoshi.png"
//
// Returns a malloc-ed null terminated string containing the resulting absolute path.
// Returns NULL if [path] is invalid.
char* resolveRelativeFilePath(const char* curr, const char* path) {
	// "" or ".". Return the importer.
	if (path[0] == '\0' || (path[0] == '.' && path[0] == '\0')) {
		return strdup(curr);
	}

	// The parts of the path.
	const char* parts[RELATIVE_PART_BUFFER_SIZE];
	int partLengths[RELATIVE_PART_BUFFER_SIZE];
	int partCount = 0;

	if (path[0] == '/') {
		// Absolute path. Skip past '/'. Part buffer should be empty.
		path++;
	} else {
		// Setup relative path.

		// Skip past "./" at start of path name.
		if (path[0] == '.' && path[1] == '/')
		{
			path += 2;
		}

		// Fill parts buffer with [curr].
		int i = 1;
		int j = 1;
		for ( ; curr[j] != '\0'; j++) {
			if (curr[j] == '/') {
				if (partCount >= RELATIVE_PART_BUFFER_SIZE) return NULL;

				parts[partCount] = curr + i;
				partLengths[partCount] = j - i;
				i = j + 1;
				partCount++;
			}
		}
	}

	// Add in relative parts.
	int start = 0;
	int k = 0;
	while (true) {
		char c = path[k];
		if (c == '.' && path[k + 1] == '.') {
			// ".." Go up one.
			// Note we allow going too far up.
			if (partCount > 0) {
				partCount--;
			}

			k += 2;
			start = k;
		} else if (c == '/' || c == '\0') {
			// End of part.
			if (start < k) {
				// Add in part up to separator.
				if (partCount >= RELATIVE_PART_BUFFER_SIZE) return NULL;

				parts[partCount] = path + start;
				partLengths[partCount] = k - start;
				partCount++;
			}

			if (c == '\0') break;

			k++;
			start = k;
		} else {
			k++;
		}
	}

	// Build resulting string from parts buffer.

	// Handle empty buffer.
	if (partCount == 0) {
		return NULL;
	}

	// Get total length.
	int resultLen = 0;

	for (int i = 0; i < partCount; i++) {
		// Extra byte is for '/'.
		resultLen += partLengths[i] + 1;
	}

	// Add in parts.
	char* result = malloc(resultLen + 1);
	int resultOffset = 0;

	for (int i = 0; i < partCount; i++) {
		result[resultOffset] = '/';
		resultOffset++;
		memcpy(result + resultOffset, parts[i], partLengths[i]);
		resultOffset += partLengths[i];
	}

	result[resultLen] = '\0';

	return result;
}

void wren_Asset_resolvePath(WrenVM* vm) {
	if (wrenGetSlotType(vm, 1) != 6 || wrenGetSlotType(vm, 2) != 6) {
		wrenAbort(vm, ERR_INVALID_ARGS);
		return;
	}

	const char* curr = wrenGetSlotString(vm, 1);
	const char* next = wrenGetSlotString(vm, 2);

	char* result = resolveRelativeFilePath(curr, next);

	if (result) {
		wrenSetSlotString(vm, 0, result);
		free(result);
	} else {
		wrenAbort(vm, "invalid path");
	}
}


// Array


typedef struct
{
	uint32_t length;
	void* data;
} Array;

uint32_t wren_array_validateLength(WrenVM* vm, int slot) {
	if (wrenGetSlotType(vm, slot) != WREN_TYPE_NUM) {
		wrenAbort(vm, "Array size must be a number");
		return UINT32_MAX;
	}

	double lenf = wrenGetSlotDouble(vm, slot);
	if (lenf < 0 || lenf != trunc(lenf)) {
		wrenAbort(vm, "Array size must be a non-negative integer");
		return UINT32_MAX;
	}

	return (uint32_t)lenf;
}

void wren_arrayAllocate(WrenVM* vm) {
	uint32_t len = wren_array_validateLength(vm, 1);
	if (len == UINT32_MAX) return;

	Array* array = (Array*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(Array));
	
	array->length = len;
	
	if (len == 0) {
		array->data = NULL;
	} else {
		array->data = malloc(len);
	}
}

void wren_arrayFinalize(void* data) {
	Array* array = (Array*)data;
	if (array->data) free(array->data);
}

void wren_array_count(WrenVM* vm) {
	wrenSetSlotDouble(vm, 0, ((Array*)wrenGetSlotForeign(vm, 0))->length);
}

void array_resize(Array* array, uint8_t len) {
	array->data = realloc(array->data, len);
	array->length = len;
}

void wren_array_resize(WrenVM* vm) {
	uint32_t len = wren_array_validateLength(vm, 1);
	if (len == UINT32_MAX) return;

	Array* array = (Array*)wrenGetSlotForeign(vm, 0);

	array_resize(array, len);
}

// Returns true if not a number.
bool wren_array_validateValue(WrenVM* vm, int slot) {
	if (wrenGetSlotType(vm, 2) != WREN_TYPE_NUM) {
		wrenAbort(vm, "value must be a number");
		return true;
	}

	return false;
}

void wren_array_uint8_get(WrenVM* vm) {
	Array* array = (Array*)wrenGetSlotForeign(vm, 0);

	uint32_t index = wren_validateIndex(vm, array->length, 1);
	if (index == UINT32_MAX) return;

	wrenSetSlotDouble(vm, 0, ((uint8_t*)array->data)[index]);
}

void wren_array_uint8_set(WrenVM* vm) {
	Array* array = (Array*)wrenGetSlotForeign(vm, 0);

	uint32_t index = wren_validateIndex(vm, array->length, 1);
	if (index == UINT32_MAX) return;

	if (wren_array_validateValue(vm, 2)) return;

	((uint8_t*)array->data)[index] = (uint8_t)wrenGetSlotDouble(vm, 2);
}

void wren_array_uint8_fill(WrenVM* vm) {
	Array* array = (Array*)wrenGetSlotForeign(vm, 0);

	if (wren_array_validateValue(vm, 1)) return;

	memset(array->data, (int)wrenGetSlotDouble(vm, 1), array->length);
}

void wren_array_toString(WrenVM* vm) {
	Array* array = (Array*)wrenGetSlotForeign(vm, 0);

	uint32_t len = array->length * 2;
	char* result = malloc(len);
	uint32_t resultIndex = 0;

	for (uint32_t i = 0; i < array->length; i++) {
		uint8_t byte = ((uint8_t*)array->data)[i];

		bufferPutHumanHex(result + resultIndex, byte);

		resultIndex += 2;
	}

	wrenSetSlotBytes(vm, 0, (const char*)result, len);

	free(result);
}

void wren_array_asString(WrenVM* vm) {
	Array* array = (Array*)wrenGetSlotForeign(vm, 0);

	wrenSetSlotBytes(vm, 0, (const char*)array->data, array->length);
}

void wren_array_copyFromString(WrenVM* vm) {
	Array* array = (Array*)wrenGetSlotForeign(vm, 0);

	if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING) {
		wrenAbort(vm, "arg must be a string");
		return;
	}

	int byteLen;
	const char* bytes = wrenGetSlotBytes(vm, 1, &byteLen);

	if (byteLen > array->length) {
		wrenAbort(vm, "string is too big");
	} else {
		memcpy(array->data, bytes, byteLen);
	}
}

static const char BASE64_CHARS[64] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static const unsigned char BASE64_CHAR_TO_BYTE[128] = { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 62, 0, 0, 0, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 0, 0, 0, 0, 0, 0, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 0, 0, 0, 0, 0 };

void wren_array_fromBase64(WrenVM* vm) {
	if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING) {
		wrenAbort(vm, "args must be a string");
		return;
	}

	int n;
	const uint8_t* base64 = (const uint8_t*)wrenGetSlotBytes(vm, 1, &n);

	int byteLen = (n * 3) / 4;

	if (n >= 1) {
		if (base64[n - 1] == '=') {
			if (n >= 2 && base64[n - 2] == '=') {
				byteLen -= 2;
			} else {
				byteLen -= 1;
			}
		}
	}

	char* bytes = malloc(byteLen);
	int byteIndex = 0;

	for (int i = 3; i < n; i += 4) {
		unsigned char n1 = BASE64_CHAR_TO_BYTE[base64[i - 3] & 0b1111111];
		unsigned char n2 = BASE64_CHAR_TO_BYTE[base64[i - 2] & 0b1111111];
		unsigned char n3 = BASE64_CHAR_TO_BYTE[base64[i - 1] & 0b1111111];
		unsigned char n4 = BASE64_CHAR_TO_BYTE[base64[i]     & 0b1111111];

		bytes[byteIndex    ] = (n1 << 2) + ((n2 & 0b110000) >> 4);
		bytes[byteIndex + 1] = ((n2 & 0b1111) << 4) + ((n3 & 0b111100) >> 2);
		bytes[byteIndex + 2] = ((n3 & 0b11) << 6) + (n4 & 0b111111);

		byteIndex += 3;
	}

	Array* array = (Array*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(Array));
	array->data = bytes;
	array->length = byteLen;
}

void wren_array_toBase64(WrenVM* vm) {
	Array* array = (Array*)wrenGetSlotForeign(vm, 0);
	uint8_t* bytes = (uint8_t*)array->data;

	uint32_t n = array->length;
	uint32_t rem = n % 3;
	n -= rem;

	uint32_t b64n = (n / 3) * 4;
	if (rem != 0) b64n += 4;

	uint32_t b64i = 0;
	uint8_t* b64 = (uint8_t*)malloc(b64n);
	uint32_t i = 0;
	
	for ( ; i < n; i += 3) {
		uint8_t a = bytes[i];
		uint8_t b = bytes[i + 1];
		uint8_t c = bytes[i + 2];

		int n1 =  (a & 0b11111100) >> 2;
		int n2 = ((a &       0b11) << 4) | ((b & 0b11110000) >> 4);
		int n3 = ((b & 0b00001111) << 2) | ((c & 0b11000000) >> 6);
		int n4 =  (c & 0b00111111);

		b64[b64i++] = BASE64_CHARS[n1];
		b64[b64i++] = BASE64_CHARS[n2];
		b64[b64i++] = BASE64_CHARS[n3];
		b64[b64i++] = BASE64_CHARS[n4];
	}

	if (rem == 1) {
		uint8_t a = bytes[i];

		int n1 = (a & 0b11111100) >> 2;
		int n2 = (a &       0b11) << 4;

		b64[b64i++] = BASE64_CHARS[n1];
		b64[b64i++] = BASE64_CHARS[n2];
		b64[b64i++] = (uint8_t)'=';
		b64[b64i  ] = (uint8_t)'=';
	} else if (rem == 2) {
		uint8_t a = bytes[i];
		uint8_t b = bytes[i + 1];

		int n1 =  (a & 0b11111100) >> 2;
		int n2 = ((a &       0b11) << 4) | ((b & 0b11110000) >> 4);
		int n3 =  (b & 0b00001111) << 2;

		b64[b64i++] = BASE64_CHARS[n1];
		b64[b64i++] = BASE64_CHARS[n2];
		b64[b64i++] = BASE64_CHARS[n3];
		b64[b64i  ] = (uint8_t)'=';
	}

	// Copy result to Wren string.
	wrenSetSlotBytes(vm, 0, (const char*)b64, b64n);

	free(b64);
}


// StringBuilder

typedef struct
{
	unsigned capacity;
	unsigned size;
	char* data;
} StringBuilder;

void sbEnsureCapacity(StringBuilder* sb, unsigned newSize) {
	if (newSize > sb->capacity) {
		do {
			sb->capacity = sb->capacity * 2;
		} while (newSize > sb->capacity);

		sb->data = realloc(sb->data, sb->capacity);
	}
}

void sbInit(StringBuilder* sb) {
	sb->capacity = 16;
	sb->size = 0;
	sb->data = malloc(16);
}

void sbFree(StringBuilder* sb) {
	free(sb->data);
}

void wren_sbAllocate(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(StringBuilder));
	sbInit(sb);
}

void wren_sbFinalize(void* data) {
	StringBuilder* sb = (StringBuilder*)data;
	sbFree(sb);
}

void sbAddByte(StringBuilder* sb, char value) {
	unsigned newSize = sb->size + 1;

	sbEnsureCapacity(sb, newSize);

	sb->data[sb->size] = value;
	sb->size = newSize;
}

void sbAdd(StringBuilder* sb, const char* data, int dataLen) {
	unsigned newSize = sb->size + dataLen;

	sbEnsureCapacity(sb, newSize);
	
	for (int i = 0; i < dataLen; i++) {
		sb->data[sb->size + i] = data[i];
	}

	sb->size = newSize;
}

void wren_sb_add(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenGetSlotForeign(vm, 0);

	int dataLen;
	const char* data = wrenGetSlotBytes(vm, 1, &dataLen);

	sbAdd(sb, data, dataLen);
}

void wren_sb_addByte(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenGetSlotForeign(vm, 0);

	char value = (char)wrenGetSlotDouble(vm, 1);

	sbAddByte(sb, value);
}

void wren_sb_clear(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenGetSlotForeign(vm, 0);

	sb->size = 0;
}

void wren_sb_toString(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenGetSlotForeign(vm, 0);

	wrenSetSlotBytes(vm, 0, sb->data, sb->size);
}


// Color

typedef struct
{
	unsigned char r;
	unsigned char g;
	unsigned char b;
	unsigned char a;
} ColorParts;

typedef union {
	unsigned packed;
	ColorParts parts;
} Color;

void wren_colorAllocate(WrenVM* vm) {
	Color* color = (Color*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(Color));

	color->packed = 0xff000000U;
}

void wren_color_getR(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.r / 255.0); }
void wren_color_getG(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.g / 255.0); }
void wren_color_getB(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.b / 255.0); }
void wren_color_getA(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.a / 255.0); }
void wren_color_getPacked(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->packed); }

void wren_color_setR(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.r = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void wren_color_setG(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.g = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void wren_color_setB(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.b = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void wren_color_setA(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.a = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void wren_color_setPacked(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->packed = wrenGetSlotDouble(vm, 1); }

void wren_color_toString(WrenVM* vm) {
	Color* color = (Color*)wrenGetSlotForeign(vm, 0);

	char buffer[9];

	buffer[0] = '#';
	bufferPutHumanHex(buffer + 1, color->parts.r);
	bufferPutHumanHex(buffer + 3, color->parts.g);
	bufferPutHumanHex(buffer + 5, color->parts.b);
	
	int len;
	if (color->parts.a == 255) {
		len = 7;
	} else {
		bufferPutHumanHex(buffer + 7, color->parts.a);
		len = 9;
	}

	wrenSetSlotBytes(vm, 0, buffer, len);
}


// Debug font: Cozette - MIT License - Copyright (c) 2020, Slavfox
// https://github.com/slavfox/Cozette/blob/master/LICENSE
// In GIF format.
#define COZETTE_LENGTH 750
static const unsigned char COZETTE[COZETTE_LENGTH] = { 71, 73, 70, 56, 55, 97, 96, 0, 72, 0, 119, 0, 0, 33, 249, 4, 9, 10, 0, 0, 0, 44, 0, 0, 0, 0, 96, 0, 72, 0, 128, 0, 0, 0, 255, 255, 255, 2, 255, 132, 143, 23, 176, 137, 109, 160, 74, 50, 78, 135, 179, 198, 245, 121, 184, 128, 65, 19, 126, 222, 121, 109, 234, 106, 101, 82, 105, 145, 204, 76, 203, 47, 133, 179, 186, 187, 117, 202, 56, 154, 117, 110, 26, 31, 136, 214, 218, 113, 122, 76, 17, 49, 2, 115, 24, 81, 73, 37, 117, 89, 68, 10, 171, 50, 158, 20, 10, 100, 0, 141, 227, 44, 211, 85, 142, 213, 90, 190, 106, 74, 11, 183, 182, 119, 176, 210, 177, 110, 206, 109, 223, 193, 226, 51, 191, 228, 164, 23, 52, 87, 49, 199, 113, 216, 23, 103, 229, 197, 248, 182, 120, 198, 114, 232, 72, 137, 5, 9, 88, 153, 169, 185, 201, 217, 233, 249, 73, 167, 168, 21, 6, 246, 53, 38, 2, 214, 71, 42, 54, 153, 73, 122, 36, 150, 18, 245, 18, 245, 56, 113, 103, 171, 50, 133, 50, 187, 167, 151, 100, 247, 123, 130, 203, 70, 251, 213, 136, 19, 236, 54, 10, 27, 242, 186, 10, 172, 122, 33, 42, 138, 116, 106, 107, 99, 45, 172, 230, 214, 11, 60, 13, 29, 41, 14, 171, 157, 43, 116, 125, 43, 171, 126, 21, 137, 14, 71, 14, 63, 152, 156, 206, 198, 203, 107, 188, 109, 254, 67, 82, 134, 30, 94, 163, 104, 149, 161, 128, 248, 160, 88, 98, 119, 9, 148, 66, 125, 11, 27, 186, 114, 8, 49, 162, 196, 137, 20, 209, 8, 98, 117, 81, 96, 191, 52, 255, 175, 192, 209, 234, 101, 136, 30, 192, 46, 190, 64, 210, 35, 217, 77, 36, 57, 19, 107, 30, 56, 139, 85, 82, 27, 49, 95, 223, 66, 94, 137, 103, 170, 92, 186, 151, 49, 157, 129, 236, 104, 143, 35, 208, 125, 1, 3, 21, 53, 17, 204, 164, 157, 126, 34, 107, 10, 227, 167, 115, 74, 23, 155, 91, 148, 85, 37, 164, 242, 93, 83, 173, 220, 162, 158, 76, 201, 13, 107, 87, 167, 93, 241, 112, 85, 135, 83, 230, 86, 98, 98, 71, 254, 36, 200, 207, 73, 219, 125, 223, 88, 209, 149, 201, 180, 108, 169, 138, 124, 251, 250, 253, 11, 56, 176, 96, 37, 67, 239, 46, 35, 122, 55, 141, 93, 140, 38, 245, 206, 244, 41, 205, 220, 76, 121, 143, 189, 146, 237, 153, 117, 93, 46, 146, 187, 48, 143, 213, 220, 120, 13, 103, 62, 249, 90, 93, 134, 108, 216, 50, 30, 111, 99, 255, 44, 51, 141, 145, 236, 16, 208, 97, 99, 82, 161, 138, 77, 7, 85, 214, 117, 203, 205, 42, 250, 7, 247, 35, 216, 54, 71, 167, 77, 187, 231, 248, 177, 167, 186, 165, 88, 141, 123, 155, 26, 203, 227, 28, 145, 193, 22, 55, 56, 223, 40, 139, 213, 178, 135, 42, 212, 221, 187, 248, 229, 7, 117, 249, 233, 220, 156, 194, 117, 100, 218, 203, 51, 68, 95, 143, 60, 168, 235, 109, 18, 201, 113, 239, 42, 140, 98, 141, 170, 250, 195, 197, 69, 109, 144, 75, 189, 161, 18, 215, 69, 203, 133, 134, 32, 23, 153, 197, 49, 85, 80, 158, 45, 82, 217, 110, 140, 41, 168, 215, 107, 159, 225, 146, 224, 129, 106, 57, 248, 75, 101, 22, 46, 134, 214, 131, 187, 180, 149, 96, 51, 28, 234, 52, 13, 133, 85, 109, 8, 9, 86, 251, 253, 183, 215, 59, 250, 241, 65, 4, 60, 217, 120, 243, 143, 95, 196, 37, 52, 222, 125, 233, 245, 152, 223, 122, 64, 138, 119, 20, 76, 21, 9, 201, 137, 112, 72, 62, 212, 151, 146, 223, 201, 21, 91, 42, 81, 70, 152, 213, 29, 251, 49, 135, 70, 44, 84, 126, 182, 157, 99, 41, 142, 70, 218, 77, 195, 76, 184, 165, 75, 43, 153, 120, 35, 109, 209, 200, 167, 229, 85, 51, 122, 233, 197, 19, 217, 172, 56, 224, 135, 195, 165, 184, 87, 153, 199, 200, 73, 26, 91, 91, 129, 197, 144, 53, 252, 213, 18, 101, 158, 2, 77, 231, 17, 100, 43, 157, 181, 66, 33, 131, 57, 42, 230, 143, 108, 54, 217, 131, 141, 132, 249, 241, 87, 142, 11, 21, 0, 0, 59 };

const unsigned char* sock_font() {
	return COZETTE;
}


// class/method binding.

WrenForeignClassMethods wren_bindForeignClass(WrenVM* vm, const char* module, const char* className) {
	WrenForeignClassMethods result;

	result.allocate = NULL;
	result.finalize = NULL;

	if (strcmp(module, "sock") == 0) {
		if (strcmp(className, "StringBuilder") == 0) {
			result.allocate = wren_sbAllocate;
			result.finalize = wren_sbFinalize;
		} else if (strcmp(className, "Array") == 0) {
			result.allocate = wren_arrayAllocate;
			result.finalize = wren_arrayFinalize;
		} else if (strcmp(className, "Color") == 0) {
			result.allocate = wren_colorAllocate;
		}
	}

	return result;
}

WrenForeignMethodFn wren_BindForeignMethod(WrenVM* vm, const char* module, const char* className, bool isStatic, const char* signature) {
	if (strcmp(module, "sock") == 0) {
		if (strcmp(className, "StringBuilder") == 0) {
			if (!isStatic) {
				if (strcmp(signature, "addString(_)") == 0) return wren_sb_add;
				if (strcmp(signature, "addByte(_)") == 0) return wren_sb_addByte;
				if (strcmp(signature, "clear()") == 0) return wren_sb_clear;
				if (strcmp(signature, "toString") == 0) return wren_sb_toString;
			}
		} else if (strcmp(className, "Array") == 0) {
			if (isStatic) {
				if (strcmp(signature, "fromBase64(_)") == 0) return wren_array_fromBase64;
			} else {
				if (strcmp(signature, "count") == 0) return wren_array_count;
				if (strcmp(signature, "resize(_)") == 0) return wren_array_resize;
				if (strcmp(signature, "toBase64") == 0) return wren_array_toBase64;
				if (strcmp(signature, "toString") == 0) return wren_array_toString;
				if (strcmp(signature, "asString") == 0) return wren_array_asString;
				if (strcmp(signature, "getByte(_)") == 0) return wren_array_uint8_get;
				if (strcmp(signature, "setByte(_,_)") == 0) return wren_array_uint8_set;
				if (strcmp(signature, "fillBytes(_)") == 0) return wren_array_uint8_fill;
				if (strcmp(signature, "setFromString(_)") == 0) return wren_array_copyFromString;
			}
		} else if (strcmp(className, "Color") == 0) {
			if (!isStatic) {
				if (strcmp(signature, "r") == 0) return wren_color_getR;
				if (strcmp(signature, "g") == 0) return wren_color_getG;
				if (strcmp(signature, "b") == 0) return wren_color_getB;
				if (strcmp(signature, "a") == 0) return wren_color_getA;
				if (strcmp(signature, "r=(_)") == 0) return wren_color_setR;
				if (strcmp(signature, "g=(_)") == 0) return wren_color_setG;
				if (strcmp(signature, "b=(_)") == 0) return wren_color_setB;
				if (strcmp(signature, "a=(_)") == 0) return wren_color_setA;
				if (strcmp(signature, "uint32") == 0) return wren_color_getPacked;
				if (strcmp(signature, "uint32=(_)") == 0) return wren_color_setPacked;
				if (strcmp(signature, "toString") == 0) return wren_color_toString;
			}
		} else if (strcmp(className, "Asset") == 0) {
			if (isStatic) {
				if (strcmp(signature, "path(_,_)") == 0) return wren_Asset_resolvePath;
			}
		}
	}

	return NULL;
}


const char* wren_resolveModule(WrenVM* vm, const char* importer, const char* name) {
	// Don't change "sock" or "sock-..." imports.
	// Don't change standard Wren imports.
	if (
		strcmp("meta", name) == 0
		||
		strcmp("random", name) == 0
		||
		(strncmp("sock", name, 4) == 0 && (name[4] == '\0' || name[4] == '-'))
	) return strdup(name);

	return resolveRelativeFilePath(importer, name);
}


// Web init

#ifdef __EMSCRIPTEN__

	extern void js_write(WrenVM* vm, const char* text);
	extern void js_error(WrenVM* vm, WrenErrorType type, const char* module, int line, const char* message);
	extern char* js_loadModule(WrenVM* vm, const char* name);
	extern WrenForeignMethodFn js_bindMethod(WrenVM* vm, const char* module, const char* className, bool isStatic, const char* signature);
	extern void js_bindClass(WrenVM* vm, const char* module, const char* className, WrenForeignClassMethods* methods);

	void wren_loadModuleComplete(WrenVM* vm, const char* module, WrenLoadModuleResult result) {
		if (result.source) {
			free((void*) result.source);
		}
	}

	WrenLoadModuleResult wren_loadModuleShim(WrenVM* vm, const char* name) {
		WrenLoadModuleResult result = {0};

		if (strcmp("meta", name) == 0 || strcmp("random", name) == 0) {
			// Ignore standard Wren module.
		} else {
			char* source = js_loadModule(vm, name);

			if (source) {
				result.source = source;
				result.onComplete = wren_loadModuleComplete;
			}
		}

		return result;
	}

	WrenForeignMethodFn wren_BindForeignMethodShim(WrenVM* vm, const char* module, const char* className, bool isStatic, const char* signature) {
		// Default to C implementation.
		WrenForeignMethodFn fn = wren_BindForeignMethod(vm, module, className, isStatic, signature);
		if (fn) return fn;

		// Try to get JavaScript implementation otherwise.
		return js_bindMethod(vm, module, className, isStatic, signature);
	}

	WrenForeignClassMethods wren_bindForeignClassShim(WrenVM* vm, const char* module, const char* className) {
		// Default to C implementation.
		WrenForeignClassMethods methods = wren_bindForeignClass(vm, module, className);

		if (methods.allocate) return methods;
	
		// Try to get JavaScript implementation otherwise.
		js_bindClass(vm, module, className, &methods);

		return methods;
	}

	WrenVM* sock_init() {
		WrenConfiguration config;
		wrenInitConfiguration(&config);
		config.writeFn = js_write;
		config.errorFn = js_error;
		config.bindForeignMethodFn = wren_BindForeignMethodShim;
		config.bindForeignClassFn = wren_bindForeignClassShim;
		config.loadModuleFn = wren_loadModuleShim;
		config.resolveModuleFn = wren_resolveModule;

		WrenVM* vm = wrenNewVM(&config);

		return vm;
	}

// 	WrenVM* sock_reset(WrenVM* vm) {
// 		if (vm) {
// 			wrenFreeVM(vm);
// 		}
// 
// 		return sock_init();
// 	}

	void* sock_array_setter_helper(WrenVM* vm, WrenHandle* handle, uint32_t length) {
		wrenEnsureSlots(vm, 1);

		wrenSetSlotHandle(vm, 0, handle);
		Array* array = (Array*)wrenGetSlotForeign(vm, 0);

		array_resize(array, length);

		return array->data;
	}

#endif

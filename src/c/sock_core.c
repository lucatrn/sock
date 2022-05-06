#include <string.h>
#include <errno.h>
#include <stdio.h>
#include <math.h>
#include <stdint.h>
#include "wren.h"

#if defined _WIN32_ || defined _WIN32 || defined WIN32

	#define SOCK_DESKTOP
	#define SOCK_WIN
	#define SOCK_PLATFORM "Windows"

	#include "SDL2/SDL.h"
	#include "glad/gl.h"
	#define STBI_NO_STDIO
	#define STBI_NO_PSD
	#define STBI_NO_TGA
	#define STBI_NO_HDR
	#define STBI_NO_PIC
	#define STBI_NO_PNM
	#define STB_IMAGE_IMPLEMENTATION
	#define STBI_FAILURE_USERMSG
   	#include "stb_image.h"
	#include <windows.h>

#elif defined __EMSCRIPTEN__

	#define SOCK_WEB
	#define SOCK_PLATFORM "Web"

	#include "emscripten.h"

	#define _strdup strdup

#endif

#define PRINT_BUFFER_SIZE 128
static char printBuffer[PRINT_BUFFER_SIZE];

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

bool wrenEnsureArgString(WrenVM* vm, int slot, const char* arg) {
	if (wrenGetSlotType(vm, slot) != WREN_TYPE_STRING) {
		snprintf(printBuffer, PRINT_BUFFER_SIZE, "%s must be a String", arg);
		wrenAbort(vm, printBuffer);
		return true;
	}
	return false;
}

bool wrenEnsureArgNum(WrenVM* vm, int slot, const char* arg) {
	if (wrenGetSlotType(vm, slot) != WREN_TYPE_NUM) {
		snprintf(printBuffer, PRINT_BUFFER_SIZE, "%s must be a Num", arg);
		wrenAbort(vm, printBuffer);
		return true;
	}
	return false;
}

void wrenReturnNumList2(WrenVM* vm, double d1, double d2) {
	wrenEnsureSlots(vm, 2);
	wrenSetSlotNewList(vm, 0);

	wrenSetSlotDouble(vm, 1, d1);
	wrenInsertInList(vm, 0, -1, 1);

	wrenSetSlotDouble(vm, 1, d2);
	wrenInsertInList(vm, 0, -1, 1);
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
	if (path[0] == '\0' || (path[0] == '.' && path[1] == '\0')) {
		return _strdup(curr);
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

	uint32_t len = 2 + array->length * 2;
	char* result = malloc(len);
	result[0] = '0';
	result[1] = 'x';
	uint32_t resultIndex = 2;

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

	if ((uint32_t)byteLen > array->length) {
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

void sbAddStr(StringBuilder* sb, const char* str) {
	sbAdd(sb, str, (int)strlen(str));
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
	uint8_t r;
	uint8_t g;
	uint8_t b;
	uint8_t a;
} ColorParts;

typedef union {
	uint32_t packed;
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
void wren_color_setPacked(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->packed = (uint32_t)wrenGetSlotDouble(vm, 1); }

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


// Game

void wren_Game_platform(WrenVM* vm) {
	wrenSetSlotString(vm, 0, SOCK_PLATFORM);
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

WrenForeignClassMethods wren_coreBindForeignClass(WrenVM* vm, const char* moduleName, const char* className) {
	WrenForeignClassMethods result;

	result.allocate = NULL;
	result.finalize = NULL;

	if (strcmp(moduleName, "sock") == 0) {
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

WrenForeignMethodFn wren_coreBindForeignMethod(WrenVM* vm, const char* moduleName, const char* className, bool isStatic, const char* signature) {
	if (strcmp(moduleName, "sock") == 0) {
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
		} else if (strcmp(className, "Game") == 0) {
			if (isStatic) {
				if (strcmp(signature, "platform") == 0) return wren_Game_platform;
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
	) return _strdup(name);

	return resolveRelativeFilePath(importer, name);
}


// === Desktop/SDL Main ===

#ifdef SOCK_DESKTOP

	static const char* quitError = NULL;

	static char* basePath = NULL;
	static int basePathLen = 0;
	static SDL_Window* window = NULL;

	static GLint defaultSpriteFilter = GL_NEAREST;
	static GLint defaultSpriteWrap = GL_CLAMP_TO_EDGE;

	static int game_screenWidth = 400;
	static int game_screenHeight = 300;
	static int game_resolutionWidth = 400;
	static int game_resolutionHeight = 300;
	static double game_fps = 60.0;
	static bool game_ready = false;
	static bool game_quit = false;
	static SDL_SystemCursor game_cursor = SDL_SYSTEM_CURSOR_ARROW;
	static SDL_Cursor* game_sdl_cursor = NULL;

	static WrenVM* vm = NULL;

	static WrenHandle* handle_Time = NULL;
	static WrenHandle* handle_Input = NULL;
	static WrenHandle* handle_Game = NULL;

	static WrenHandle* callHandle_init_2 = NULL;
	static WrenHandle* callHandle_update_0 = NULL;
	static WrenHandle* callHandle_update_2 = NULL;


	// === IO UTILS ==

	// Read the entire file into memory as a null terminated string.
	//
	// If read successfully, [fileSize] is set to file size.
	// If [fileSize] is NULL it is ignored.
	//
	// Returns NULL on error, setting quitError to the error.
	//
	// Adapted from example at https://wiki.libsdl.org/SDL_RWread
	// Creative Commons Attribution 4.0 International (CC BY 4.0)
	char* fileRead(const char* fileName, int64_t* fileSize) {
		// Open file.
		SDL_RWops *file = SDL_RWFromFile(fileName, "rb");
		if (file == NULL) {
			quitError = printBuffer;
			snprintf(printBuffer, PRINT_BUFFER_SIZE, "open file %s", fileName);
			return NULL;
		}

		char* res = NULL;

		// Check file size.
		Sint64 size = SDL_RWsize(file);
		if (size < 0) {
			quitError = printBuffer;
			snprintf(printBuffer, PRINT_BUFFER_SIZE, "read file size %s", fileName);
		} else {
			// Allocated memory for entire file.
			res = (char*)malloc(size + 1);

			if (res == NULL) {
				quitError = printBuffer;
				snprintf(printBuffer, PRINT_BUFFER_SIZE, "alloc file memory %Id bytes %s", size, fileName);
			} else {
				// Read into buffer bit by bit.
				Sint64 nb_read_total = 0;
				Sint64 nb_read = 1;
				char* buf = res;

				while (nb_read_total < size && nb_read != 0) {
					nb_read = SDL_RWread(file, buf, 1, (size - nb_read_total));
					nb_read_total += nb_read;
					buf += nb_read;
				}

				// Ensure we actually read the whole file.
				if (nb_read_total != size) {
					free(res);
					res = NULL;
					quitError = printBuffer;
					snprintf(printBuffer, PRINT_BUFFER_SIZE, "only read %Id of %Id bytes from %s", nb_read_total, size, fileName);
				} else {
					// Null terminate.
					res[nb_read_total] = '\0';

					// Return file size.
					if (fileSize) {
						*fileSize = size;
					}
				}
			}
		}

		// Close the file.
		SDL_RWclose(file);

		return res;
	}

	char* fileReadRelative(const char* path) {
		int pathLen = (int)strlen(path);
		int len = basePathLen + pathLen;

		char* absPath = malloc(len + 1);
		if (absPath == NULL) {
			quitError = printBuffer;
			snprintf(printBuffer, PRINT_BUFFER_SIZE, "alloc memory %s", path);
			return NULL;
		} else {
			memcpy(absPath, basePath, basePathLen);
			memcpy(absPath + basePathLen, path, pathLen);
			absPath[len] = '\0';

			char* result = fileRead(absPath, NULL);

			free(absPath);

			return result;
		}
	}

	char* readAsset(const char* path, int64_t* size) {
		if (path[0] != '/') {
			quitError = printBuffer;
			snprintf(printBuffer, PRINT_BUFFER_SIZE, "path must start with /: %s", path);
			return NULL;
		}

		int pathLen = (int)strlen(path);
		int len = basePathLen + 6 + pathLen;

		char* absPath = malloc(len + 1);
		if (absPath == NULL) {
			quitError = printBuffer;
			snprintf(printBuffer, PRINT_BUFFER_SIZE, "alloc memory %s", path);
			return NULL;
		} else {
			memcpy(absPath, basePath, basePathLen);
			memcpy(absPath + basePathLen, "assets", 6);
			memcpy(absPath + basePathLen + 6, path, pathLen);
			absPath[len] = '\0';

			char* result = fileRead(absPath, size);

			free(absPath);

			return result;
		}
	}


	// === WREN UTILS ===

	WrenHandle* wren_getHandle(const char* moduleName, const char* varName) {
		wrenEnsureSlots(vm, 1);
		wrenGetVariable(vm, moduleName, varName, 0);
		return wrenGetSlotHandle(vm, 0);
	}


	// === GAME / LAYOUT ===

	// void updateLayout() {
	// }

	void initGameModule() {
		wrenEnsureSlots(vm, 3);
		wrenSetSlotHandle(vm, 0, handle_Game);
		wrenSetSlotDouble(vm, 1, game_screenWidth);
		wrenSetSlotDouble(vm, 2, game_screenHeight);
		wrenCall(vm, callHandle_init_2);
	}


	// === OpenGL ===

	#if DEBUG

		void GLAPIENTRY myGlDebugCallback( GLenum source, GLenum type, GLuint id, GLenum severity, GLsizei length, const GLchar* message, const void* userParam) {
			const char* sErrorType = "?";
			const char* sSeverity = "?";
			
			switch (type) {
				case GL_DEBUG_TYPE_ERROR:
					sErrorType = "ERROR";
					break;
				case GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR:
					sErrorType = "DEPRECATED_BEHAVIOR";
					break;
				case GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR:
					sErrorType = "UNDEFINED_BEHAVIOR";
					break;
				case GL_DEBUG_TYPE_PORTABILITY:
					sErrorType = "PORTABILITY";
					break;
				case GL_DEBUG_TYPE_PERFORMANCE:
					sErrorType = "PERFORMANCE";
					break;
				case GL_DEBUG_TYPE_OTHER:
					sErrorType = "OTHER";
					break;
			}
			
			switch (severity){
				case GL_DEBUG_SEVERITY_LOW:
					sSeverity = "LOW";
					break;
				case GL_DEBUG_SEVERITY_MEDIUM:
					sSeverity = "MEDM";
					break;
				case GL_DEBUG_SEVERITY_HIGH:
					sSeverity = "HIGH";
					break;
				case GL_DEBUG_SEVERITY_NOTIFICATION:
					sSeverity = "INFO";
					break;
			}
			
			printf("[GL] type=%s id=%d severity=%s: %s\n", sErrorType, id, sSeverity, message);
		}

		bool debug_checkGlError(const char* where) {
			GLenum error;
			while ((error = glGetError()) != 0) {
				const char* msg = "?";
				if (error == GL_INVALID_ENUM) msg = "invalid enum";
				else if (error == GL_INVALID_VALUE) msg = "invalid value";
				else if (error == GL_INVALID_OPERATION) msg = "invalid operation";
				else if (error == GL_INVALID_FRAMEBUFFER_OPERATION) msg = "invalid framebuffer operation";
				else if (error == GL_OUT_OF_MEMORY) msg = "out of memory";
				// missing constants from glad...
				else if (error == 0x504) msg = "stack underflow";
				else if (error == 0x503) msg = "stack overflow";

				printf("[GL] error at '%s': %s\n", where, msg);

				return true;
			}

			return false;
		}

	#else

		#define debug_checkGlError(x) (false)

	#endif

	typedef struct {
		int attributeCount;
		const char* attributes[4];
		int vertexUnifomCount;
		const char* vertexUniforms[4];
		int fragmentUnifomCount;
		const char* fragmentUniforms[4];
		int varyingCount;
		const char* varyings[4];
		const char* vertexShader;
		const char* fragmentShader;
	} ShaderData;

	typedef struct {
		// The OpenGL program. 0 if failed to compile.
		GLuint program;
		// Location of uniforms in vertex->fragment and top->bottom order.
		GLint uniforms[7];
	} Shader;

	static Shader shaderSpriteBatcher;
	static Shader shaderPolygonBatcher;

	typedef struct {
		uint32_t width;
		uint32_t height;
		int filter;
		int wrap;
		// The OpenGL texture ID.
		GLuint id;
	} Texture;

	typedef struct {
		float matrix[6];
		float originX;
		float originY;
	} Transform;
	
	typedef struct {
		float centerX;
		float centerY;
		float scale;
	} Camera;

	static Camera camera = { 0.0f, 0.0f, 1.0f };
	static float cameraMatrix[9];
	static bool cameraMatrixDirty = true;

	#define SPRITE_BUFFER_INITIAL_CAPACITY 128
	#define SPRITE_BUFFER_CACHE_SIZE 32

	typedef struct {
		// Number of vertices we can fit.
		uint32_t capacity;
		// The number of buffered vertices in [vertexData].
		uint32_t vertexCount;
		// The size of the [indexData] array.
		uint32_t indexCount;
		// Vertex data array.
		//  x     y     z     rgba  u     v
		// [----][----][----][----][----][----]
		void* vertexData;
		void* indexData;
		GLuint vertexBuffer;
		GLuint indexBuffer;
		GLuint vertexArray;
	} SpriteBatcher;

	static SpriteBatcher* spriteBufferCache[SPRITE_BUFFER_CACHE_SIZE];
	static int spriteBufferCacheCount = 0;

	typedef struct {
		Texture texture;
		Transform transform;
		char* path;
		SpriteBatcher* batcher;
	} Sprite;

	float* getCameraMatrix() {
		if (cameraMatrixDirty) {
			cameraMatrixDirty = false;

			float sx =  2.0f / game_resolutionWidth;
			float sy = -2.0f / game_resolutionHeight;

			cameraMatrix[0] = sx;
			cameraMatrix[1] = 0.0f;
			cameraMatrix[2] = 0.0f;
			
			cameraMatrix[3] = 0.0f;
			cameraMatrix[4] = sy;
			cameraMatrix[5] = 0.0f;

			cameraMatrix[6] = -camera.centerX * sx;
			cameraMatrix[7] = -camera.centerY * sy;
			cameraMatrix[8] = 1.0f;
		}

		return cameraMatrix;
	}

	SpriteBatcher* spriteBatcherNew() {
		void* vertexData = malloc(SPRITE_BUFFER_INITIAL_CAPACITY * 24);
		if (!vertexData) {
			return NULL;
		}

		SpriteBatcher* sb = malloc(sizeof(SpriteBatcher));

		if (sb) {
			sb->capacity = SPRITE_BUFFER_INITIAL_CAPACITY;
			sb->vertexCount = 0;
			sb->indexCount = 0;
			sb->vertexData = vertexData;
			sb->indexData = NULL;
			glGenBuffers(1, &sb->vertexBuffer);
			glGenBuffers(1, &sb->indexBuffer);
			glGenVertexArrays(1, &sb->vertexArray);

			#if DEBUG

				printf("new sprite batcher: vertexBuffer=%d indexBuffer=%d vertexArray=%d\n", sb->vertexBuffer, sb->indexBuffer, sb->vertexArray);

			#endif
		}

		return sb;
	}

	void spriteBatcherFree(SpriteBatcher* sb) {
		if (sb) {
			if (sb->vertexData) free(sb->vertexData);
			if (sb->indexData) free(sb->indexData);
			glDeleteBuffers(1, &sb->vertexBuffer);
			glDeleteBuffers(1, &sb->indexBuffer);
			glDeleteVertexArrays(1, &sb->vertexArray);
			free(sb);
		}
	}

	// Get a SpriteBatcher which will be help indefinetely (e.g. by a Wren script).
	// If possible, it re-uses an existing SpriteBatcher.
	SpriteBatcher* spriteBatcherGet() {
		if (spriteBufferCacheCount == 0) {
			return spriteBatcherNew();
		} else {
			return spriteBufferCache[--spriteBufferCacheCount];
		}
	}
	
	// Put a SpriteBatcher into the cache if there is space.
	// Otherwise the SpriteBatcher's resources are freed.
	void spriteBatcherPut(SpriteBatcher* sb) {
		if (spriteBufferCacheCount < SPRITE_BUFFER_CACHE_SIZE) {
			spriteBufferCache[spriteBufferCacheCount++] = sb;
		} else {
			spriteBatcherFree(sb);
		}
	}

	// Get a SpriteBatcher instance that will be help temorary (i.e. not indefinetely by a Wren script).
	// If possible, it re-uses an existing SpriteBatcher.
	SpriteBatcher* spriteBatcherTemp() {
		if (spriteBufferCacheCount == 0) {
			SpriteBatcher* sb = spriteBatcherNew();
			if (sb) {
				spriteBufferCache[0] = sb;
				spriteBufferCacheCount++;
			}
			return sb;
		} else {
			return spriteBufferCache[0];
		}
	}

	void spriteBatcherBegin(SpriteBatcher* sb) {
		sb->vertexCount = 0;
	}
	
	void spriteBatcherEnd(SpriteBatcher* sb, Sprite* spr) {
		if (sb && sb->vertexCount != 0) {
			glUseProgram(shaderSpriteBatcher.program);

			glBindVertexArray(sb->vertexArray);

			// Put vertex data.
			glBindBuffer(GL_ARRAY_BUFFER, sb->vertexBuffer);

			GLint bufferSize;
			glGetBufferParameteriv(GL_ARRAY_BUFFER, GL_BUFFER_SIZE, &bufferSize);

			if (sb->vertexCount * 24 > (uint32_t)bufferSize) {
				// Re-allocate vertex data.
				glBufferData(GL_ARRAY_BUFFER, sb->vertexCount * 24, sb->vertexData, GL_DYNAMIC_DRAW);
			} else {
				// Put in sub-data.
				glBufferSubData(GL_ARRAY_BUFFER, 0, sb->vertexCount * 24, sb->vertexData);
			}
			
			// Configure/enable attributes.
			glVertexAttribPointer(
				0,
				3,
				GL_FLOAT,
				GL_FALSE,
				24,
				(void*)0
			);
			glEnableVertexAttribArray(0);
			
			glVertexAttribPointer(
				1,
				4,
				GL_UNSIGNED_BYTE,
				GL_TRUE,
				24,
				(void*)12
			);
			glEnableVertexAttribArray(1);

			glVertexAttribPointer(
				2,
				2,
				GL_FLOAT,
				GL_FALSE,
				24,
				(void*)16
			);
			glEnableVertexAttribArray(2);

			// Set shader camera matrix.
			// float matrix[9] = {
			// 	1.0f, 0.0f, 0.0f,
			// 	0.0f, 1.0f, 0.0f,
			// 	0.0f, 0.0f, 1.0f,
			// };
			glUniformMatrix3fv(shaderSpriteBatcher.uniforms[0], 1, GL_FALSE, getCameraMatrix());

			// Set shader texture.
			glActiveTexture(GL_TEXTURE0);
			glBindTexture(GL_TEXTURE_2D, spr->texture.id);
			glUniform1i(shaderSpriteBatcher.uniforms[1], 0);
		
			// Setup index buffer.
			// Since we're always drawing quads, we only need to populate it whenever it needs resizing.
			glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, sb->indexBuffer);
			
			// 6 indices for every 4 vertices.
			// 6:4 -> 3:2
			uint32_t indexCount = (sb->vertexCount * 3) / 2;
			
			// Grow index array.
			if (indexCount > sb->indexCount) {
				// Create new indices array.
				uint32_t newIndexCount = (sb->capacity * 3) / 2;

				uint16_t* newIndices = (uint16_t*)realloc(sb->indexData, newIndexCount * 2);
				if (!newIndices) return;
				
				// Set new indices.
				uint32_t vi = (sb->indexCount * 2) / 3;

				for (uint32_t i = sb->indexCount; i < newIndexCount; i += 6) {
					newIndices[i    ] = vi;
					newIndices[i + 1] = vi + 1;
					newIndices[i + 2] = vi + 2;
					newIndices[i + 3] = vi + 1;
					newIndices[i + 4] = vi + 3;
					newIndices[i + 5] = vi + 2;
					vi += 4;
				}

				glBufferData(GL_ELEMENT_ARRAY_BUFFER, newIndexCount * 2, newIndices, GL_DYNAMIC_DRAW);

				sb->indexCount = newIndexCount;
				sb->indexData = newIndices;
			}

			// Draw!
			glBindVertexArray(sb->vertexArray);

			glDrawElements(GL_TRIANGLES, indexCount, GL_UNSIGNED_SHORT, 0);

			// Clean up.
			glBindVertexArray(0);
			glDisableVertexAttribArray(0);
			glDisableVertexAttribArray(1);
			glDisableVertexAttribArray(2);
		}
	}
	
	bool spriteBatcherCheckResize(SpriteBatcher* sb, uint32_t vertexCount) {
		if (sb->vertexCount + vertexCount > sb->capacity) {
			// Grow capacity.
			if (sb->capacity * 2 >= 0xfffff) {
				return false;
			}

			sb->capacity *= 2;
			
			// Resize vertex data.
			void* newVertexData = realloc(sb->vertexData, sb->capacity * 24);
			if (!newVertexData) {
				return false;
			}

			sb->vertexData = newVertexData;
		}

		return true;
	}

	void spriteBatcherAddVertex(SpriteBatcher* sb, float x, float y, float z, uint32_t color, float u, float v) {
		float* floatPtr = ((float*)sb->vertexData) + (sb->vertexCount * 6);
		uint32_t* int32ptr = (uint32_t*)floatPtr;

		floatPtr[0] = x;
		floatPtr[1] = y;
		floatPtr[2] = z;
		int32ptr[3] = color;
		floatPtr[4] = u;
		floatPtr[5] = v;

		sb->vertexCount++;
	}
	
	void spriteBatcherDrawQuad(SpriteBatcher* sb, float x1, float y1, float x2, float y2, float z, float u1, float v1, float u2, float v2, uint32_t color, Transform* tf) {
		if (spriteBatcherCheckResize(sb, 4)) {
			if (tf) {
				// TODO handle transform.
			} else {
				spriteBatcherAddVertex(sb, x1, y1, z, color, u1, v1);
				spriteBatcherAddVertex(sb, x1, y2, z, color, u1, v2);
				spriteBatcherAddVertex(sb, x2, y1, z, color, u2, v1);
				spriteBatcherAddVertex(sb, x2, y2, z, color, u2, v2);
			}
		}
	}

	bool compilerShaderUniformLocations(Shader* shader, int count, const char** names, int index) {
		for (int i = 0; i < count; i++) {
			const char* name = names[i];

			int space = strLastIndex(name, ' ');
			if (space >= 0) {
				name = name + space + 1;
			}

			GLint location = glGetUniformLocation(shader->program, name);
			if (location == -1) {
				quitError = printBuffer;
				snprintf(printBuffer, PRINT_BUFFER_SIZE, "invalid uniform name %s", name);
				return false;
			}
			shader->uniforms[index++] = location;
		}

		return true;
	}

	Shader compileShader(ShaderData* data) {
		StringBuilder sb;
		int success;

		Shader result;
		result.program = 0;

		sbInit(&sb);

		// Compile vertex shader.
		sbAddStr(&sb, "#version 330 core\n");

		for (int i = 0; i < data->attributeCount; i++) {
			const char* attr = data->attributes[i];

			sbAddStr(&sb, "layout(location = ");
			sbAddByte(&sb, '0' + i);
			sbAddStr(&sb, ") in ");
			sbAddStr(&sb, attr);
			sbAddStr(&sb, ";\n");
		}
		
		for (int i = 0; i < data->vertexUnifomCount; i++) {
			const char* unif = data->vertexUniforms[i];

			sbAddStr(&sb, "uniform ");
			sbAddStr(&sb, unif);
			sbAddStr(&sb, ";\n");
		}
		
		for (int i = 0; i < data->varyingCount; i++) {
			const char* vary = data->varyings[i];

			sbAddStr(&sb, "out ");
			sbAddStr(&sb, vary);
			sbAddStr(&sb, ";\n");
		}

		sbAddStr(&sb, "void main() {\n");
		sbAddStr(&sb, data->vertexShader);
		sbAddByte(&sb, '}');

		GLuint vs = glCreateShader(GL_VERTEX_SHADER);
		glShaderSource(vs, 1, &sb.data, &sb.size);
		glCompileShader(vs);

		glGetShaderiv(vs, GL_COMPILE_STATUS, &success);
		if (!success) {
			char buffer[512];
			glGetShaderInfoLog(vs, 512, NULL, buffer);
			printf("vertex shader error: %s", buffer);
			quitError = "compile vertex shader";
		} else {
			// Compiler fragment shader.
			sb.size = 0;

			sbAddStr(&sb, "#version 330 core\nout vec4 FragColor;\n");
			
			for (int i = 0; i < data->fragmentUnifomCount; i++) {
				const char* unif = data->fragmentUniforms[i];

				sbAddStr(&sb, "uniform ");
				sbAddStr(&sb, unif);
				sbAddStr(&sb, ";\n");
			}
			
			for (int i = 0; i < data->varyingCount; i++) {
				const char* vary = data->varyings[i];

				sbAddStr(&sb, "in ");
				sbAddStr(&sb, vary);
				sbAddStr(&sb, ";\n");
			}

			sbAddStr(&sb, "void main() {\n");
			sbAddStr(&sb, data->fragmentShader);
			sbAddByte(&sb, '}');

			GLuint fs = glCreateShader(GL_FRAGMENT_SHADER);
			glShaderSource(fs, 1, &sb.data, &sb.size);
			glCompileShader(fs);

			glGetShaderiv(fs, GL_COMPILE_STATUS, &success);
			if (!success) {
				char buffer[512];
				glGetShaderInfoLog(fs, 512, NULL, buffer);
				printf("fragment shader error: %s", buffer);
				quitError = "compile fragment shader";
			} else {
				// Link program.
				GLuint prog = glCreateProgram();
				glAttachShader(prog, vs);
				glAttachShader(prog, fs);
				glLinkProgram(prog);

				glGetProgramiv(prog, GL_LINK_STATUS, &success);
				if(!success) {
					char buffer[512];
					glGetProgramInfoLog(fs, 512, NULL, buffer);
					printf("program error: %s", buffer);
					quitError = "link program";
				} else {
					result.program = prog;

					// Get uniform locations.
					glUseProgram(prog);
					
					bool vuOK = compilerShaderUniformLocations(&result, data->vertexUnifomCount, data->vertexUniforms, 0);
					bool fuOK = compilerShaderUniformLocations(&result, data->fragmentUnifomCount, data->fragmentUniforms, data->vertexUnifomCount);

					if (!vuOK || !fuOK) {
						glDeleteProgram(result.program);
						result.program = 0;
					}
				}
			}
			
			glDeleteShader(fs);
		}
		
		glDeleteShader(vs);

		// Free string builder.
		sbFree(&sb);

		// Done!
		return result;
	}


	// = SHADERS =

	static ShaderData shaderDataSpriteBatcher = {
		// Attributes
		3, {
			"vec3 vertex",
			"vec4 color",
			"vec2 uv",
		},
		// Vertex Uniforms
		1, {
			"mat3 m",
		},
		// Fragment Uniforms
		1, {
			"sampler2D tex",
		},
		// Varyings
		2, {
			"vec4 v_color",
			"vec2 v_uv",
		},
		// Vertex Shader
		"v_color = color;\n"
		"v_uv = uv;\n"
		// "gl_Position = vec4(vertex, 1.0);\n"
		"vec3 a = m * vec3(vertex.xy, 1.0);\n"
		"gl_Position = vec4(a.xy, vertex.z, 1.0);\n"
		,
		// Fragment Shader
		"FragColor = texture(tex, v_uv) * v_color;\n"
	};
	
	static ShaderData shaderDataPolygonBatcher = {
		// Attributes
		2, {
			"vec3 vertex",
			"vec4 color",
		},
		// Vertex Uniforms
		0, { 0 },
		// 1, {
		// 	"mat3 mat",
		// },
		// Fragment Uniforms
		0, { 0 },
		// Varyings
		1, {
			"vec4 v_color",
		},
		// Vertex Shader
		"v_color = color;\n"
		"gl_Position = vec4(vertex, 1.0);\n"
		// "vec3 a = mat * vec3(vertex.x, vertex.y, 1.0);\n"
		// "gl_Position = vec4(a.x, a.y, vertex.z, 1.0);\n"
		,
		// Fragment Shader
		"FragColor = v_color;\n"
	};

	static const char* SOCK_FILTER_LINEAR = "linear";
	static const char* SOCK_FILTER_NEAREST = "nearest";

	static const char* SOCK_WRAP_CLAMP = "clamp";
	static const char* SOCK_WRAP_REPEAT = "repeat";
	static const char* SOCK_WRAP_MIRROR = "mirror";

	GLuint filterStringToGlEnum(const char* filter) {
		if (strcmp(SOCK_FILTER_LINEAR, filter) == 0) return GL_LINEAR;
		if (strcmp(SOCK_FILTER_NEAREST, filter) == 0) return GL_NEAREST;
		return 0;
	}
	
	GLuint wrapStringToGlEnum(const char* wrap) {
		if (strcmp(SOCK_WRAP_CLAMP, wrap) == 0) return GL_CLAMP_TO_EDGE;
		if (strcmp(SOCK_WRAP_REPEAT, wrap) == 0) return GL_REPEAT;
		if (strcmp(SOCK_WRAP_MIRROR, wrap) == 0) return GL_MIRRORED_REPEAT;
		return 0;
	}

	GLuint wren_filterStringToGlEnum(WrenVM* vm, int slot) {
		if (wrenGetSlotType(vm, slot) != WREN_TYPE_STRING) {
			wrenAbort(vm, "filter type must be a string");
			return 0;
		}
		
		GLuint filter = filterStringToGlEnum(wrenGetSlotString(vm, slot));
		if (filter == 0) {
			wrenAbort(vm, "invalid filter type");
		}
		
		return filter;
	}
	
	GLuint wren_wrapStringToGlEnum(WrenVM* vm, int slot) {
		if (wrenGetSlotType(vm, slot) != WREN_TYPE_STRING) {
			wrenAbort(vm, "wrap type must be a string");
			return 0;
		}
		
		GLuint filter = wrapStringToGlEnum(wrenGetSlotString(vm, slot));
		if (filter == 0) {
			wrenAbort(vm, "invalid wrap type");
		}

		return filter;
	}

	const char* glFilterEnumToString(GLuint filter) {
		if (filter == GL_LINEAR) return SOCK_FILTER_LINEAR;
		if (filter == GL_NEAREST) return SOCK_FILTER_NEAREST;
		return NULL;
	}
	
	const char* glWrapEnumToString(GLuint wrap) {
		if (wrap == GL_CLAMP_TO_EDGE) return SOCK_WRAP_CLAMP;
		if (wrap == GL_REPEAT) return SOCK_WRAP_REPEAT;
		if (wrap == GL_MIRRORED_REPEAT) return SOCK_WRAP_MIRROR;
		return NULL;
	}


	// === SOCK WREN API ===

	void wren_methodTODO(WrenVM* vm) {
		wrenAbort(vm, "TODO Method");
	}

	// TIME

	void updateTimeModule(uint64_t frame, double time) {
		wrenEnsureSlots(vm, 3);
		wrenSetSlotHandle(vm, 0, handle_Time);
		wrenSetSlotDouble(vm, 1, (double)frame);
		wrenSetSlotDouble(vm, 2, time);
		wrenCall(vm, callHandle_update_2);
	}

	// GRAPHICS

	void wren_Graphics_clear3(WrenVM* vm) {
		float r = (float)wrenGetSlotDouble(vm, 1);
		float g = (float)wrenGetSlotDouble(vm, 2);
		float b = (float)wrenGetSlotDouble(vm, 3);

		glClearColor(r, g, b, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);
	}

	// CAMERA

	void wren_CameraUpdate_3(WrenVM* vm) {
		for (int i = 1; i <= 3; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be numbers");
				return;
			}
		}

		camera.centerX = (float)wrenGetSlotDouble(vm, 1);
		camera.centerY = (float)wrenGetSlotDouble(vm, 2);
		camera.scale = (float)wrenGetSlotDouble(vm, 3);
		cameraMatrixDirty = true;
	}

	// SPRITE

	void wren_spriteAllocate(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(Sprite));
		
		spr->texture.width = 0;
		spr->texture.height = 0;
		spr->texture.filter = defaultSpriteFilter;
		spr->texture.wrap = defaultSpriteWrap;
		spr->texture.id = 0;
		spr->transform.matrix[0] = 0.0f;
		spr->transform.matrix[1] = 0.0f;
		spr->transform.matrix[2] = 0.0f;
		spr->transform.matrix[3] = 0.0f;
		spr->transform.matrix[4] = 0.0f;
		spr->transform.matrix[5] = 0.0f;
		spr->transform.originX = 0.0f;
		spr->transform.originY = 0.0f;
		spr->path = NULL;

		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	}

	void wren_spriteFinalize(void* data) {
		Sprite* spr = (Sprite*)data;
		
		// glDeleteTextures silently ignores 0's.
		glDeleteTextures(1, &spr->texture.id);

		if (spr->path) {
			free(spr->path);
		}
	}

	void wren_sprite_width(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		wrenSetSlotDouble(vm, 0, spr->texture.width);
	}
	
	void wren_sprite_height(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		wrenSetSlotDouble(vm, 0, spr->texture.height);
	}

	void wren_sprite_load_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING) {
			wrenAbort(vm, "path must be a string");
			return;
		}

		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);

		const char* path = wrenGetSlotString(vm, 1);

		// Load from file.
		int64_t imgSize;
		char* img = readAsset(path, &imgSize);
		if (!img) {
			wrenAbort(vm, quitError);
			quitError = NULL;
			return;
		}

		int width, height, channelCount;
		stbi_uc* data = stbi_load_from_memory(img, (int)imgSize, &width, &height, &channelCount, 4);
		
		free(img);

		if (!data) {
			wrenAbort(vm, stbi_failure_reason());
			return;
		}

		// Load into WebGL texture.
		GLuint id;
		glGenTextures(1, &id);
		glBindTexture(GL_TEXTURE_2D, id);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, spr->texture.wrap);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, spr->texture.wrap);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, spr->texture.filter);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, spr->texture.filter);
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);

		stbi_image_free(data);

		// Save texture info.
		spr->texture.width = width;
		spr->texture.height = height;
		spr->texture.id = id;
		spr->path = _strdup(path);

		// Return loaded.
		wrenSetSlotNull(vm, 0);
	}

	void wren_sprite_scaleFilter(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		wrenSetSlotString(vm, 0, glFilterEnumToString(spr->texture.filter));
	}
	
	void wren_sprite_scaleFilter_set(WrenVM* vm) {
		GLuint filter = wren_filterStringToGlEnum(vm, 1);

		if (filter != 0) {
			Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
			spr->texture.filter = filter;

			if (spr->texture.id != 0) {
				glBindTexture(GL_TEXTURE_2D, spr->texture.id);
				glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
				glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
			}
		}
	}
	
	void wren_sprite_wrapMode(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		wrenSetSlotString(vm, 0, glWrapEnumToString(spr->texture.wrap));
	}
	
	void wren_sprite_wrapMode_set(WrenVM* vm) {
		GLuint wrap = wren_wrapStringToGlEnum(vm, 1);
		
		if (wrap != 0) {
			Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
			spr->texture.wrap = wrap;

			if (spr->texture.id != 0) {
				glBindTexture(GL_TEXTURE_2D, spr->texture.id);
				glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap);
				glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, wrap);
			}
		}
	}
	
	void wren_sprite_beginBatch(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		
		if (spr->batcher) {
			wrenAbort(vm, "batch already started");
		} else {
			spr->batcher = spriteBatcherGet();
			spriteBatcherBegin(spr->batcher);
		}
	}
	
	void wren_sprite_endBatch(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		
		if (spr->batcher) {
			spriteBatcherEnd(spr->batcher, spr);
			spriteBatcherPut(spr->batcher);
			spr->batcher = NULL;
		} else {
			wrenAbort(vm, "batch not yet started");
		}
	}

	void wren_sprite_draw5(WrenVM* vm) {
		for (int i = 1; i <= 5; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be numbers");
				return;
			}
		}

		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		float x1 = (float)wrenGetSlotDouble(vm, 1);
		float y1 = (float)wrenGetSlotDouble(vm, 2);
		float x2 = x1 + (float)wrenGetSlotDouble(vm, 3);
		float y2 = y1 + (float)wrenGetSlotDouble(vm, 4);
		uint32_t color = (uint32_t)wrenGetSlotDouble(vm, 5);

		SpriteBatcher* sb = spr->batcher;
		if (!sb) {
			sb = spriteBatcherTemp();
			spriteBatcherBegin(sb);
		}

		spriteBatcherDrawQuad(sb, x1, y1, x2, y2, 0, 0, 0, 1, 1, color, NULL);

		if (!spr->batcher) spriteBatcherEnd(sb, spr);
	}

	void wren_sprite_toString(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);

		if (spr->path) {
			wrenSetSlotString(vm, 0, spr->path);
		} else {
			char buffer[32];
			snprintf(buffer, 32, "Sprite#%p", &spr);
			wrenSetSlotString(vm, 0, buffer);
		}
	}

	// SCREEN

	void wren_Screen_size_(WrenVM* vm) {
		// Get screen size using SDL API.
		int displayIndex = SDL_GetWindowDisplayIndex(window);
		if (displayIndex >= 0) {
			SDL_DisplayMode mode;
			if (SDL_GetCurrentDisplayMode(displayIndex, &mode) == 0) {
				wrenReturnNumList2(vm, mode.w, mode.h);
				return;
			}
		}

		wrenAbort(vm, SDL_GetError());
	}

	void wren_Screen_sizeAvail_(WrenVM* vm) {
		#ifdef SOCK_WIN

			// Use win32 api to get [MONITORINFO.rcWork];
			// NOTE do we need to get the exact monitor, or is the primary good enough?

			POINT pt = { 0, 0 };
			HMONITOR monitor = MonitorFromPoint(pt, MONITOR_DEFAULTTOPRIMARY);
			if (monitor) {
				MONITORINFO minfo;
				minfo.cbSize = sizeof(MONITORINFO);

				if (GetMonitorInfoA(monitor, &minfo)) {
					wrenReturnNumList2(vm,
						minfo.rcWork.right - minfo.rcWork.left,
						minfo.rcWork.bottom - minfo.rcWork.top
					);

					return;
				}
			}

			#if DEBUG

				printf("unable to get MONITORINFO.rcWork\n");

			#endif

		#endif

		// Default to SDL's screen size.
		wren_Screen_size_(vm);
	}

	// GAME

	void wren_Game_ready_(WrenVM* vm) {
		game_ready = true;
	}

	void wren_Game_title(WrenVM* vm) {
		wrenSetSlotString(vm, 0, SDL_GetWindowTitle(window));
	}
	
	void wren_Game_title_set(WrenVM* vm) {
		if (wrenEnsureArgString(vm, 1, "title")) return;

		SDL_SetWindowTitle(window, wrenGetSlotString(vm, 1));
	}
	
	void wren_Game_fps(WrenVM* vm) {
		if (game_fps < 0) {
			wrenSetSlotNull(vm, 0);
		} else {
			wrenSetSlotDouble(vm, 0, game_fps);
		}
	}
	
	void wren_Game_fps_set(WrenVM* vm) {
		WrenType argType = wrenGetSlotType(vm, 1);

		if (argType == WREN_TYPE_NULL) {
			game_fps = -1.0;
		} else if (argType == WREN_TYPE_NUM) {
			double fps = wrenGetSlotDouble(vm, 1);
			if (fps <= 0) {
				wrenAbort(vm, "fps must be positive");
			} else {
				game_fps = fps;
			}
		} else {
			wrenAbort(vm, "fps must be Num or null");
		}
	}

	static const char* CURSOR_DEFAULT = "default";
	static const char* CURSOR_POINTER = "pointer";
	static const char* CURSOR_WAIT = "wait";
	static const char* CURSOR_HIDDEN = "hidden";
	
	void wren_Game_cursor(WrenVM* vm) {
		const char* cursor = CURSOR_DEFAULT;

		if (game_cursor == SDL_SYSTEM_CURSOR_ARROW) { cursor = CURSOR_DEFAULT; }
		else if (game_cursor == SDL_SYSTEM_CURSOR_HAND) { cursor = CURSOR_POINTER; }
		else if (game_cursor == SDL_SYSTEM_CURSOR_WAIT) { cursor = CURSOR_WAIT; }
		else if (game_cursor == SDL_NUM_SYSTEM_CURSORS) { cursor = CURSOR_HIDDEN; }

		wrenSetSlotString(vm, 0, cursor);
	}
	
	void wren_Game_cursor_set(WrenVM* vm) {
		SDL_SystemCursor cursor = game_cursor;

		WrenType argType = wrenGetSlotType(vm, 1);

		if (argType == WREN_TYPE_NULL) {
			cursor = SDL_SYSTEM_CURSOR_ARROW;
		} else if (argType == WREN_TYPE_STRING) {
			const char* name = wrenGetSlotString(vm, 1);

			if (strcmp(CURSOR_DEFAULT, name) == 0) { cursor = SDL_SYSTEM_CURSOR_ARROW; }
			else if (strcmp(CURSOR_POINTER, name) == 0) { cursor = SDL_SYSTEM_CURSOR_HAND; }
			else if (strcmp(CURSOR_WAIT, name) == 0) { cursor = SDL_SYSTEM_CURSOR_WAIT; }
			else if (strcmp(CURSOR_HIDDEN, name) == 0) { cursor = SDL_NUM_SYSTEM_CURSORS; }
			else {
				wrenAbort(vm, "invalid cursor type");
				return;
			}
		} else {
			wrenAbort(vm, "cursor must be null or a String");
			return;
		}

		if (cursor != game_cursor) {
			if (cursor == SDL_NUM_SYSTEM_CURSORS) {
				SDL_ShowCursor(SDL_DISABLE);
			} else {
				if (game_sdl_cursor) {
					SDL_FreeCursor(game_sdl_cursor);
				}

				game_sdl_cursor = SDL_CreateSystemCursor(cursor);
				SDL_SetCursor(game_sdl_cursor);
				SDL_ShowCursor(SDL_ENABLE);
			}

			game_cursor = cursor;
		}
	}

	void wren_Game_quit_(WrenVM* vm) {
		game_quit = true;
	}

	// API Binding

	WrenForeignMethodFn wren_bindForeignMethod(WrenVM* vm, const char* moduleName, const char* className, bool isStatic, const char* signature) {
		if (strcmp(moduleName, "sock") == 0) {
			if (strcmp(className, "Array") == 0) {
				if (!isStatic) {
					if (strcmp(signature, "load_(_)") == 0) return wren_methodTODO;
				}
			} else if (strcmp(className, "Asset") == 0) {
				if (isStatic) {
					if (strcmp(signature, "loadString_(_,_)") == 0) return wren_methodTODO;
				}
			} else if (strcmp(className, "Graphics") == 0) {
				if (isStatic) {
					if (strcmp(signature, "clear(_,_,_)") == 0) return wren_Graphics_clear3;
				}
			} else if (strcmp(className, "Camera") == 0) {
				if (isStatic) {
					if (strcmp(signature, "update_(_,_,_)") == 0) return wren_CameraUpdate_3;
				}
			} else if (strcmp(className, "Storage") == 0) {
				if (isStatic) {
					if (strcmp(signature, "load_(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "save_(_,_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "contains(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "remove(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "keys") == 0) return wren_methodTODO;
				}
			} else if (strcmp(className, "Sprite") == 0) {
				if (isStatic) {
					// TODO
					if (strcmp(signature, "defaultScaleFilter") == 0) return wren_methodTODO;
					if (strcmp(signature, "defaultScaleFilter=(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "defaultWrapMode") == 0) return wren_methodTODO;
					if (strcmp(signature, "defaultWrapMode=(_)") == 0) return wren_methodTODO;
				} else {
					if (strcmp(signature, "width") == 0) return wren_sprite_width;
					if (strcmp(signature, "height") == 0) return wren_sprite_height;
					if (strcmp(signature, "load_(_)") == 0) return wren_sprite_load_;
					if (strcmp(signature, "scaleFilter") == 0) return wren_sprite_scaleFilter;
					if (strcmp(signature, "scaleFilter=(_)") == 0) return wren_sprite_scaleFilter_set;
					if (strcmp(signature, "wrapMode") == 0) return wren_sprite_wrapMode;
					if (strcmp(signature, "wrapMode=(_)") == 0) return wren_sprite_wrapMode_set;
					if (strcmp(signature, "beginBatch()") == 0) return wren_sprite_beginBatch;
					if (strcmp(signature, "endBatch()") == 0) return wren_sprite_endBatch;
					if (strcmp(signature, "draw_(_,_,_,_,_)") == 0) return wren_sprite_draw5;
					if (strcmp(signature, "toString") == 0) return wren_sprite_toString;

					// TODO
					if (strcmp(signature, "transform_") == 0) return wren_methodTODO;
					if (strcmp(signature, "setTransform_(_,_,_,_,_,_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "transformOrigin_") == 0) return wren_methodTODO;
					if (strcmp(signature, "setTransformOrigin(_,_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "draw_(_,_,_,_,_,_,_,_,_)") == 0) return wren_methodTODO;
				}
			} else if (strcmp(className, "Screen") == 0) {
				if (isStatic) {
					if (strcmp(signature, "sz_") == 0) return wren_Screen_size_;
					if (strcmp(signature, "sza_") == 0) return wren_Screen_sizeAvail_;
				}
			} else if (strcmp(className, "Game") == 0) {
				if (isStatic) {
					if (strcmp(signature, "title") == 0) return wren_Game_title;
					if (strcmp(signature, "title=(_)") == 0) return wren_Game_title_set;
					if (strcmp(signature, "scaleFilter") == 0) return wren_methodTODO;
					if (strcmp(signature, "scaleFilter=(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "fps") == 0) return wren_Game_fps;
					if (strcmp(signature, "fps=(_)") == 0) return wren_Game_fps_set;
					if (strcmp(signature, "layoutChanged_(_,_,_,_,_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "cursor") == 0) return wren_Game_cursor;
					if (strcmp(signature, "cursor=(_)") == 0) return wren_Game_cursor_set;
					if (strcmp(signature, "print_(_,_,_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "setPrintColor_(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "ready_()") == 0) return wren_Game_ready_;
					if (strcmp(signature, "quit_()") == 0) return wren_Game_quit_;
				}
			}
		}

		return wren_coreBindForeignMethod(vm, moduleName, className, isStatic, signature);
	}


	// === WREN CONFIG CALLBACKS ===

	WrenForeignClassMethods wren_bindForeignClass(WrenVM* vm, const char* moduleName, const char* className) {
		// Default to core.
		WrenForeignClassMethods methods = wren_coreBindForeignClass(vm, moduleName, className);

		if (!methods.allocate) {
			// Desktop classes.
			methods.allocate = NULL;
			methods.finalize = NULL;

			if (strcmp(moduleName, "sock") == 0) {
				if (strcmp(className, "Sprite") == 0) {
					methods.allocate = wren_spriteAllocate;
					methods.finalize = wren_spriteFinalize;
				}
			}
		}

		return methods;
	}

	void wren_write(WrenVM* vm, const char* text) {
		printf("%s", text);
	}

	void wren_error(WrenVM* vm, WrenErrorType type, const char* moduleName, int line, const char* message) {
		if (type == WREN_ERROR_COMPILE) {
			printf("[WREN] Compile Error at %s:%d %s\n", moduleName, line, message);
		}
		else if (type == WREN_ERROR_RUNTIME) {
			printf("[WREN] Runtime Error %s\n", message);
		}
		else if (type == WREN_ERROR_STACK_TRACE) {
			printf("  at %s:%d %s\n", moduleName, line, message);
		}
	}

	void wren_loadModuleComplete(WrenVM* vm, const char* moduleName, WrenLoadModuleResult result) {
		if (result.source) {
			free((void*)result.source);
		}
	}

	WrenLoadModuleResult wren_loadModule(WrenVM* vm, const char* name) {
		WrenLoadModuleResult result = { 0 };

		if (strcmp("meta", name) == 0 || strcmp("random", name) == 0) {
			// Ignore standard Wren module.
		}
		else {
			/*result.source = NULL;
			result.onComplete = wren_loadModuleComplete;*/
		}

		return result;
	}



	// === MAIN ===

	int mainWithSDL(int argc, char** argv) {
		// Get runtime info.
		basePath = SDL_GetBasePath();
		if (basePath == NULL) {
			quitError = "SDL_GetBasePath";
			return -1;
		}
		basePathLen = (int)strlen(basePath);

		// Set wanted OpenGL attributes.
		SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, SDL_GL_CONTEXT_FORWARD_COMPATIBLE_FLAG);
		SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
		SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
		SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
		SDL_GL_SetAttribute(SDL_GL_RED_SIZE, 8);
		SDL_GL_SetAttribute(SDL_GL_GREEN_SIZE, 8);
		SDL_GL_SetAttribute(SDL_GL_BLUE_SIZE, 8);
		SDL_GL_SetAttribute(SDL_GL_ALPHA_SIZE, 8);

		// Create window.
		window = SDL_CreateWindow("sock", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, game_screenWidth, game_screenHeight, SDL_WINDOW_OPENGL | SDL_WINDOW_HIDDEN | SDL_WINDOW_RESIZABLE);
		if (!window) {
			quitError = "SDL_CreateWindow";
			return -1;
		}

		// Create OpenGL context.
		SDL_GLContext* glContext = SDL_GL_CreateContext(window);
		if (!glContext) {
			quitError = "SDL_GL_CreateContext";
			return -1;
		}

		int gladVersion = gladLoadGL((GLADloadfunc)SDL_GL_GetProcAddress);
		if (!gladVersion) {
			quitError = "gladLoadGLLoader";
			return -1;
		}

		#ifdef DEBUG

			printf("Loaded Glad %d.%d\n", GLAD_VERSION_MAJOR(gladVersion), GLAD_VERSION_MINOR(gladVersion));

			int glv;
			SDL_GL_GetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, &glv); printf("CONTEXT_MAJOR_VERSION=%d\n", glv);
			SDL_GL_GetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, &glv); printf("CONTEXT_MINOR_VERSION=%d\n", glv);
			SDL_GL_GetAttribute(SDL_GL_RED_SIZE, &glv); printf("RED_SIZE=%d\n", glv);
			SDL_GL_GetAttribute(SDL_GL_GREEN_SIZE, &glv); printf("GREEN_SIZE=%d\n", glv);
			SDL_GL_GetAttribute(SDL_GL_BLUE_SIZE, &glv); printf("BLUE_SIZE=%d\n", glv);
			SDL_GL_GetAttribute(SDL_GL_ALPHA_SIZE, &glv); printf("ALPHA_SIZE=%d\n", glv);
			SDL_GL_GetAttribute(SDL_GL_DOUBLEBUFFER, &glv); printf("DOUBLEBUFFER=%d\n", glv);

			// Setup debugging.

			glEnable(GL_DEBUG_OUTPUT);
			glDebugMessageCallback(myGlDebugCallback, NULL);

		#endif

		// Load shaders.
		shaderSpriteBatcher = compileShader(&shaderDataSpriteBatcher);
		if (shaderSpriteBatcher.program == 0) {
			return -1;
		}

		shaderPolygonBatcher = compileShader(&shaderDataPolygonBatcher);
		if (shaderPolygonBatcher.program == 0) {
			return -1;
		}

		// Final GL setup.
		glViewport(0, 0, game_screenWidth, game_screenHeight);

		// Create Wren VM.
		WrenConfiguration config;
		wrenInitConfiguration(&config);
		config.writeFn = wren_write;
		config.errorFn = wren_error;
		config.bindForeignMethodFn = wren_bindForeignMethod;
		config.bindForeignClassFn = wren_bindForeignClass;
		config.loadModuleFn = wren_loadModule;
		config.resolveModuleFn = wren_resolveModule;

		vm = wrenNewVM(&config);

		// Make call handles.
		callHandle_init_2 = wrenMakeCallHandle(vm, "init_(_,_)");
		callHandle_update_0 = wrenMakeCallHandle(vm, "update_()");
		callHandle_update_2 = wrenMakeCallHandle(vm, "update_(_,_)");
		
		// Load sock Wren code.
		char* sockSource = fileReadRelative("sock.wren");
		if (sockSource == NULL) return -1;

		WrenInterpretResult sockResult = wrenInterpret(vm, "sock", sockSource);
		free(sockSource);

		if (sockResult != WREN_RESULT_SUCCESS) {
			return -1;
		}

		wrenAddImplicitImportModule(vm, "sock");

		// Get handles.
		handle_Time = wren_getHandle("sock", "Time");
		handle_Input = wren_getHandle("sock", "Input");
		handle_Game = wren_getHandle("sock", "Game");

		// Init modules.
		initGameModule();

		// Intepret user main Wren.
		char* mainSource = readAsset("/main.wren", NULL);
		if (mainSource == NULL) return -1;

		WrenInterpretResult mainResult = wrenInterpret(vm, "sock", mainSource);
		free(mainSource);

		if (mainResult != WREN_RESULT_SUCCESS) {
			return -1;
		}

		// We can show the window now!
		SDL_ShowWindow(window);

		// Setup
		int inLoop = 1;
		uint64_t frame = 0;
		uint64_t prevTime = SDL_GetTicks64();
		double remainingTime = 0;
		double totalTime = 60;

		while (inLoop) {
			// Get SDL events.
			SDL_Event event;
			while ( SDL_PollEvent(&event) ) {
               if ( event.type == SDL_QUIT ) {
                   inLoop = 0;
               } else if ( event.type == SDL_KEYDOWN ) {
                   // TODO
               }
			}

			// Update time stuff..
			uint64_t now = SDL_GetTicks64();
			uint64_t delta = min(66, now - prevTime);
			prevTime = now;

			remainingTime -= (double)delta;

			if (remainingTime <= 0) {
				remainingTime += 1.0 / game_fps;

				// Do update.
				if (game_ready) {
					// Update modules.
					updateTimeModule(frame, totalTime);

					frame++;
					totalTime += 1.0 / game_fps;

					// Call update fn.
					wrenEnsureSlots(vm, 1);
					wrenSetSlotHandle(vm, 0, handle_Game);
					WrenInterpretResult updateResult = wrenCall(vm, callHandle_update_0);

					if (updateResult != WREN_RESULT_SUCCESS) {
						inLoop = 0;
					}
					if (game_quit) {
						inLoop = 0;
					}
				}

				// Finalize GL.
				SDL_GL_SwapWindow(window);

				// Check for GL errors.
				if (debug_checkGlError("post update")) inLoop = 0;
			}

			// Wait and loop.
			SDL_Delay(2);
		}

		return 0;
	}

	int main(int argc, char** argv) {
		// Init SDL.
		if (SDL_Init(SDL_INIT_VIDEO) < 0) {
			printf("ERR SDL_Init %s", SDL_GetError());
		} else {
			int code = mainWithSDL(argc, argv);

			if (code < 0) {
				printf("ERR %s %s", quitError, SDL_GetError());
			}

			SDL_Quit();
		}

		return 0;
	}

#endif


// === Web Main ===

#ifdef SOCK_WEB

	extern void js_write(WrenVM* vm, const char* text);
	extern void js_error(WrenVM* vm, WrenErrorType type, const char* moduleName, int line, const char* message);
	extern char* js_loadModule(WrenVM* vm, const char* name);
	extern WrenForeignMethodFn js_bindMethod(WrenVM* vm, const char* moduleName, const char* className, bool isStatic, const char* signature);
	extern void js_bindClass(WrenVM* vm, const char* moduleName, const char* className, WrenForeignClassMethods* methods);

	void wren_loadModuleComplete(WrenVM* vm, const char* moduleName, WrenLoadModuleResult result) {
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

	WrenForeignMethodFn wren_bindForeignMethod(WrenVM* vm, const char* moduleName, const char* className, bool isStatic, const char* signature) {
		// Default to C implementation.
		WrenForeignMethodFn fn = wren_coreBindForeignMethod(vm, moduleName, className, isStatic, signature);
		if (fn) return fn;

		// Try to get JavaScript implementation otherwise.
		return js_bindMethod(vm, moduleName, className, isStatic, signature);
	}

	WrenForeignClassMethods wren_bindForeignClass(WrenVM* vm, const char* moduleName, const char* className) {
		// Default to C implementation.
		WrenForeignClassMethods methods = wren_coreBindForeignClass(vm, moduleName, className);

		if (methods.allocate) return methods;
	
		// Try to get JavaScript implementation otherwise.
		js_bindClass(vm, moduleName, className, &methods);

		return methods;
	}

	WrenVM* sock_init() {
		WrenConfiguration config;
		wrenInitConfiguration(&config);
		config.writeFn = js_write;
		config.errorFn = js_error;
		config.bindForeignMethodFn = wren_bindForeignMethod;
		config.bindForeignClassFn = wren_bindForeignClass;
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

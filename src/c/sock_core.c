#include <string.h>
#include <errno.h>
#include <stdio.h>
#include <math.h>
#include <stdint.h>
#include "wren.h"

#if defined _WIN32_ || defined _WIN32 || defined WIN32

	#define SOCK_DESKTOP
	#define SOCK_WIN
	#define SOCK_PLATFORM "desktop"
	#define SOCK_OS "Windows"

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
	#include "sock_audio.h"

#elif defined __EMSCRIPTEN__

	#define SOCK_WEB
	#define SOCK_PLATFORM "web"

	#include "emscripten.h"

	#define _strdup strdup

#endif

typedef struct {
	int x;
	int y;
	int w;
	int h;
} SockIntRect;

typedef struct {
	int x;
	int y;
} SockIntPoint;

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

void wren_color_rgb(WrenVM* vm) {
	for (int i = 1; i <= 4; i++) {
		if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
			wrenAbort(vm, "args must be Nums");
			return;
		}
	}

	uint32_t r = (uint32_t)(wrenGetSlotDouble(vm, 1) * 255.999);
	uint32_t g = (uint32_t)(wrenGetSlotDouble(vm, 2) * 255.999);
	uint32_t b = (uint32_t)(wrenGetSlotDouble(vm, 3) * 255.999);
	uint32_t a = (uint32_t)(wrenGetSlotDouble(vm, 4) * 255.999);
	
	Color color;
	color.parts.r = r > 255 ? 255 : r;
	color.parts.g = g > 255 ? 255 : g;
	color.parts.b = b > 255 ? 255 : b;
	color.parts.a = a > 255 ? 255 : a;

	wrenSetSlotDouble(vm, 0, color.packed);
}

double wren_color_hsl_helper(double p, double q, double t) {
	t = t < 0.0 ? t + 1.0 : (t > 1.0 ? t - 1.0 : t);
	if (t <= 0.166667) return p + (q - p) * 6.0 * t;
	if (t <= 0.5) return q;
	if (t < 0.666667) return p + (q - p) * (0.666666 - t) * 6.0;
	return p;
}

void wren_color_hsl(WrenVM* vm) {
	for (int i = 1; i <= 4; i++) {
		if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
			wrenAbort(vm, "args must be Nums");
			return;
		}
	}

	double h = (double)wrenGetSlotDouble(vm, 1);
	double s = (double)wrenGetSlotDouble(vm, 2);
	double l = (double)wrenGetSlotDouble(vm, 3);
	uint32_t a = (uint32_t)(wrenGetSlotDouble(vm, 4) * 255.999);
	if (a > 255) a = 255;

	Color color;
	color.parts.a = a;

	s = s < 0.0 ? 0.0 : (s > 1.0 ? 1.0 : s);
	l = l < 0.0 ? 0.0 : (l > 1.0 ? 1.0 : l);

	if (s == 0) {
		color.parts.r = color.parts.g = color.parts.b = (uint32_t)(l * 255.999);
	} else {
		h = h - floor(h);

		double q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
		double p = 2.0 * l - q;

		color.parts.r = (uint32_t)(wren_color_hsl_helper(p, q, h + 0.333333) * 255.999);
		color.parts.g = (uint32_t)(wren_color_hsl_helper(p, q, h) * 255.999);
		color.parts.b = (uint32_t)(wren_color_hsl_helper(p, q, h - 0.333333) * 255.999);
	}

	wrenSetSlotDouble(vm, 0, color.packed);
}

void wren_color_toHexString(WrenVM* vm) {
	if (wrenGetSlotType(vm, 1) != WREN_TYPE_NUM) {
		wrenAbort(vm, "color must be Num");
		return;
	}

	Color color;
	color.packed = (uint32_t)wrenGetSlotDouble(vm, 1);

	char buffer[9];

	buffer[0] = '#';
	bufferPutHumanHex(buffer + 1, color.parts.r);
	bufferPutHumanHex(buffer + 3, color.parts.g);
	bufferPutHumanHex(buffer + 5, color.parts.b);
	
	int len;
	if (color.parts.a == 255) {
		len = 7;
	} else {
		bufferPutHumanHex(buffer + 7, color.parts.a);
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
#define COZETTE_WIDTH 96
#define COZETTE_HEIGHT 72
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
			if (isStatic) {
				if (strcmp(signature, "rgb(_,_,_,_)") == 0) return wren_color_rgb;
				if (strcmp(signature, "hsl(_,_,_,_)") == 0) return wren_color_hsl;
				if (strcmp(signature, "toHexString(_)") == 0) return wren_color_toHexString;
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
	static GLuint mainFramebuffer = 0;
	static GLuint mainFramebufferTex;
	static GLuint mainFramebufferVertexArray;
	static GLuint mainFramebufferTriangles;
	static GLint mainFramebufferScaleFilter = GL_NEAREST;

	static int game_windowWidth = 400;
	static int game_windowHeight = 300;
	static int game_resolutionWidth = 400;
	static int game_resolutionHeight = 300;
	static SockIntRect game_renderRect = { 0, 0, 400, 300 };
	static float game_renderScale = 1.0f;
	static bool game_resolutionIsFixed = false;
	static bool game_layoutPixelScaling = false;
	static float game_layoutMaxScale = 1.0f;
	static double game_fps = 60.0;
	static bool game_isFullscreen = false;
	static bool game_ready = false;
	static bool game_quit = false;
	static bool game_layoutQueued = false;
	static uint32_t game_printColor = 0xffffffffU;
	static SDL_SystemCursor game_cursor = SDL_SYSTEM_CURSOR_ARROW;
	static SDL_Cursor* game_sdl_cursor = NULL;

	static WrenVM* vm = NULL;

	static WrenHandle* handle_Time = NULL;
	static WrenHandle* handle_Input = NULL;
	static WrenHandle* handle_Game = NULL;

	static WrenHandle* callHandle_init_2 = NULL;
	static WrenHandle* callHandle_update_0 = NULL;
	static WrenHandle* callHandle_update_2 = NULL;
	static WrenHandle* callHandle_update_3 = NULL;
	static WrenHandle* callHandle_updateMouse_3 = NULL;


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

	void initGameModule() {
		wrenEnsureSlots(vm, 3);
		wrenSetSlotHandle(vm, 0, handle_Game);
		wrenSetSlotDouble(vm, 1, game_windowWidth);
		wrenSetSlotDouble(vm, 2, game_windowHeight);
		wrenCall(vm, callHandle_init_2);
	}


	// === Input ===

	static const char* INPUT_ID_A = "A";
	static const char* INPUT_ID_B = "B";
	static const char* INPUT_ID_C = "C";
	static const char* INPUT_ID_D = "D";
	static const char* INPUT_ID_E = "E";
	static const char* INPUT_ID_F = "F";
	static const char* INPUT_ID_G = "G";
	static const char* INPUT_ID_H = "H";
	static const char* INPUT_ID_I = "I";
	static const char* INPUT_ID_J = "J";
	static const char* INPUT_ID_K = "K";
	static const char* INPUT_ID_L = "L";
	static const char* INPUT_ID_M = "M";
	static const char* INPUT_ID_N = "N";
	static const char* INPUT_ID_O = "O";
	static const char* INPUT_ID_P = "P";
	static const char* INPUT_ID_Q = "Q";
	static const char* INPUT_ID_R = "R";
	static const char* INPUT_ID_S = "S";
	static const char* INPUT_ID_T = "T";
	static const char* INPUT_ID_U = "U";
	static const char* INPUT_ID_V = "V";
	static const char* INPUT_ID_W = "W";
	static const char* INPUT_ID_X = "X";
	static const char* INPUT_ID_Y = "Y";
	static const char* INPUT_ID_Z = "Z";
	static const char* INPUT_ID_1 = "1";
	static const char* INPUT_ID_2 = "2";
	static const char* INPUT_ID_3 = "3";
	static const char* INPUT_ID_4 = "4";
	static const char* INPUT_ID_5 = "5";
	static const char* INPUT_ID_6 = "6";
	static const char* INPUT_ID_7 = "7";
	static const char* INPUT_ID_8 = "8";
	static const char* INPUT_ID_9 = "9";
	static const char* INPUT_ID_0 = "0";
	static const char* INPUT_ID_BACKSPACE = "Backspace";
	static const char* INPUT_ID_ENTER = "Enter";
	static const char* INPUT_ID_TAB = "Tab";
	static const char* INPUT_ID_CAPSLOCK = "CapsLock";
	static const char* INPUT_ID_SHIFT_LEFT  = "ShiftLeft";
	static const char* INPUT_ID_SHIFT_RIGHT = "ShiftRight";
	static const char* INPUT_ID_CONTROL_LEFT  = "ControlLeft";
	static const char* INPUT_ID_CONTROL_RIGHT = "ControlRight";
	static const char* INPUT_ID_ALT_LEFT  = "AltLeft";
	static const char* INPUT_ID_ALT_RIGHT = "AltRight";
	static const char* INPUT_ID_CONTROL_SPACE = "Space";
	static const char* INPUT_ID_ESCAPE = "Escape";
	static const char* INPUT_ID_ARROW_LEFT = "ArrowLeft";
	static const char* INPUT_ID_ARROW_RIGHT = "ArrowRight";
	static const char* INPUT_ID_ARROW_UP = "ArrowUp";
	static const char* INPUT_ID_ARROW_DOWN = "ArrowDown";

	static const char* INPUT_ID_MOUSE_LEFT = "MouseLeft";
	static const char* INPUT_ID_MOUSE_MIDDLE = "MouseMiddle";
	static const char* INPUT_ID_MOUSE_RIGHT = "MouseRight";

	static int mouseWindowPosX = 0;
	static int mouseWindowPosY = 0;
	static int mouseWheel = 0;

	const char* sdlScancodeToInputID(SDL_Scancode code) {
		switch (code) {
			// Alphabet.
			case SDL_SCANCODE_A: return INPUT_ID_A;
			case SDL_SCANCODE_B: return INPUT_ID_B;
			case SDL_SCANCODE_C: return INPUT_ID_C;
			case SDL_SCANCODE_D: return INPUT_ID_D;
			case SDL_SCANCODE_E: return INPUT_ID_E;
			case SDL_SCANCODE_F: return INPUT_ID_F;
			case SDL_SCANCODE_G: return INPUT_ID_G;
			case SDL_SCANCODE_H: return INPUT_ID_H;
			case SDL_SCANCODE_I: return INPUT_ID_I;
			case SDL_SCANCODE_J: return INPUT_ID_J;
			case SDL_SCANCODE_K: return INPUT_ID_K;
			case SDL_SCANCODE_L: return INPUT_ID_L;
			case SDL_SCANCODE_M: return INPUT_ID_M;
			case SDL_SCANCODE_N: return INPUT_ID_N;
			case SDL_SCANCODE_O: return INPUT_ID_O;
			case SDL_SCANCODE_P: return INPUT_ID_P;
			case SDL_SCANCODE_Q: return INPUT_ID_Q;
			case SDL_SCANCODE_R: return INPUT_ID_R;
			case SDL_SCANCODE_S: return INPUT_ID_S;
			case SDL_SCANCODE_T: return INPUT_ID_T;
			case SDL_SCANCODE_U: return INPUT_ID_U;
			case SDL_SCANCODE_V: return INPUT_ID_V;
			case SDL_SCANCODE_W: return INPUT_ID_W;
			case SDL_SCANCODE_X: return INPUT_ID_X;
			case SDL_SCANCODE_Y: return INPUT_ID_Y;
			case SDL_SCANCODE_Z: return INPUT_ID_Z;
			// Number row.
			case SDL_SCANCODE_1: return INPUT_ID_1;
			case SDL_SCANCODE_2: return INPUT_ID_2;
			case SDL_SCANCODE_3: return INPUT_ID_3;
			case SDL_SCANCODE_4: return INPUT_ID_4;
			case SDL_SCANCODE_5: return INPUT_ID_5;
			case SDL_SCANCODE_6: return INPUT_ID_6;
			case SDL_SCANCODE_7: return INPUT_ID_7;
			case SDL_SCANCODE_8: return INPUT_ID_8;
			case SDL_SCANCODE_9: return INPUT_ID_9;
			case SDL_SCANCODE_0: return INPUT_ID_0;
			// Middle stuff.
			case SDL_SCANCODE_BACKSPACE: return INPUT_ID_BACKSPACE;
			case SDL_SCANCODE_RETURN: return INPUT_ID_ENTER;
			case SDL_SCANCODE_RETURN2: return INPUT_ID_ENTER;
			case SDL_SCANCODE_TAB: return INPUT_ID_TAB;
			case SDL_SCANCODE_CAPSLOCK: return INPUT_ID_CAPSLOCK;
			case SDL_SCANCODE_LSHIFT: return INPUT_ID_SHIFT_LEFT;
			case SDL_SCANCODE_RSHIFT: return INPUT_ID_SHIFT_RIGHT;
			// Bottom row.
			case SDL_SCANCODE_LCTRL: return INPUT_ID_CONTROL_LEFT;
			case SDL_SCANCODE_RCTRL: return INPUT_ID_CONTROL_RIGHT;
			case SDL_SCANCODE_LALT: return INPUT_ID_ALT_LEFT;
			case SDL_SCANCODE_RALT: return INPUT_ID_ALT_RIGHT;
			// Top row.
			case SDL_SCANCODE_ESCAPE: return INPUT_ID_ESCAPE;
			// Arrows.
			case SDL_SCANCODE_LEFT: return INPUT_ID_ARROW_LEFT;
			case SDL_SCANCODE_RIGHT: return INPUT_ID_ARROW_RIGHT;
			case SDL_SCANCODE_UP: return INPUT_ID_ARROW_UP;
			case SDL_SCANCODE_DOWN: return INPUT_ID_ARROW_DOWN;
		}

		return NULL;
	}

// 	// Converts a temp string to a const input ID pointer.
// 	const char* resolveInputID(const char* id) {
// 		int len = (int)strlen(id);
// 
// 		if (len == 1) {
// 			char c = id[0];
// 			if (c >= 'A' && c <= 'Z') return sdlScancodeToInputID(SDL_SCANCODE_A + (c - 'A'));
// 			if (c == '0') return INPUT_ID_0;
// 			if (c >= '1' && c <= '9') return sdlScancodeToInputID(SDL_SCANCODE_1 + (c - '1'));
// 		}
// 
// 		return NULL;
// 	}


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
					return;
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
	static Shader shaderPrimitiveBatcher;
	static Shader shaderFramebuffer;

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


	static GLuint quadIndexBuffer = 0;
	static uint16_t* quadIndexBufferData = NULL;
	static uint32_t quadIndexBufferSize = 256;
	static uint32_t quadIndexBufferPopulated = 0;

	// Binds the quad index buffer, and also ensures it is big for the given number of indices.
	// 
	// [indexCount] is the number of indices needed.
	// Should be a multiple of 6 (each quad used 2 triangles = 6 indices). e.g. [vertexCount * 1.5].
	void bindQuadIndexBuffer(uint32_t indexCount) {
		if (quadIndexBufferData == NULL) {
			glGenBuffers(1, &quadIndexBuffer);
		}

		glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, quadIndexBuffer);

		// Grow index array.
		if (quadIndexBufferData == NULL || quadIndexBufferSize < indexCount) {
			while (quadIndexBufferSize < indexCount) {
				quadIndexBufferSize *= 2;
			}

			// Create new indices array.
			uint16_t* newIndices = (uint16_t*)realloc(quadIndexBufferData, quadIndexBufferSize * sizeof(uint16_t));
			if (!newIndices) {
				printf("failed to resize index buffer\n");
				return;
			}
			
			quadIndexBufferData = newIndices;

			// Set new indices.
			uint16_t vi = (quadIndexBufferPopulated * 2) / 3;

			for ( ; quadIndexBufferPopulated + 5 < quadIndexBufferSize; quadIndexBufferPopulated += 6) {
				quadIndexBufferData[quadIndexBufferPopulated    ] = vi;
				quadIndexBufferData[quadIndexBufferPopulated + 1] = vi + 1;
				quadIndexBufferData[quadIndexBufferPopulated + 2] = vi + 2;
				quadIndexBufferData[quadIndexBufferPopulated + 3] = vi + 1;
				quadIndexBufferData[quadIndexBufferPopulated + 4] = vi + 3;
				quadIndexBufferData[quadIndexBufferPopulated + 5] = vi + 2;
				vi += 4;
			}

			glBufferData(GL_ELEMENT_ARRAY_BUFFER, quadIndexBufferSize * sizeof(uint16_t), quadIndexBufferData, GL_DYNAMIC_DRAW);
		}
	}


	#define PRIMITIVE_BUFFER_INITIAL_CAPACITY 128

	typedef struct {
		// Number of vertices we can fit.
		uint32_t capacity;
		// The number of buffered vertices in [vertexData].
		uint32_t vertexCount;
		// Vertex data array.
		//  x     y     z     rgba
		// [----][----][----][----]
		void* vertexData;
		GLuint vertexBuffer;
		GLuint vertexArray;
	} PrimitiveBatcher;

	static PrimitiveBatcher quadBatcher;

	bool primitiveBatcherInit(PrimitiveBatcher* pb) {
		void* vertexData = malloc(PRIMITIVE_BUFFER_INITIAL_CAPACITY * 16);
		if (!vertexData) {
			return false;
		}

		pb->capacity = PRIMITIVE_BUFFER_INITIAL_CAPACITY;
		pb->vertexCount = UINT32_MAX;
		pb->vertexData = vertexData;
		glGenBuffers(1, &pb->vertexBuffer);
		glGenVertexArrays(1, &pb->vertexArray);

		return true;
	}

	bool primitiveBatcherCheckResize(PrimitiveBatcher* pb, uint32_t vertexCount) {
		if (pb->vertexCount + vertexCount > pb->capacity) {
			// Grow capacity.
			if (pb->capacity * 2 >= 0xfffff) {
				return false;
			}

			pb->capacity *= 2;
			
			// Resize vertex data.
			void* newVertexData = realloc(pb->vertexData, pb->capacity * 16);
			if (!newVertexData) {
				return false;
			}

			pb->vertexData = newVertexData;
		}

		return true;
	}

	void primitiveBatcherAddVertex(PrimitiveBatcher* pb, float x, float y, float z, uint32_t color) {
		float* floatPtr = ((float*)pb->vertexData) + (pb->vertexCount * 4);
		uint32_t* int32ptr = (uint32_t*)floatPtr;

		floatPtr[0] = x;
		floatPtr[1] = y;
		floatPtr[2] = z;
		int32ptr[3] = color;

		pb->vertexCount++;
	}

	void primitiveBatcherDrawQuad(PrimitiveBatcher* pb, float x1, float y1, float x2, float y2, float x3, float y3, float x4, float y4, float z, uint32_t color, Transform* transform) {
		if (primitiveBatcherCheckResize(pb, 4)) {
			if (transform) {
				float* tf = transform->matrix;

				float tx1 = x1 * tf[0] + y1 * tf[2] + tf[4];
				float ty1 = x1 * tf[1] + y1 * tf[3] + tf[5];
				float tx2 = x2 * tf[0] + y2 * tf[2] + tf[4];
				float ty2 = x2 * tf[1] + y2 * tf[3] + tf[5];
				float tx3 = x3 * tf[0] + y3 * tf[2] + tf[4];
				float ty3 = x3 * tf[1] + y3 * tf[3] + tf[5];
				float tx4 = x4 * tf[0] + y4 * tf[2] + tf[4];
				float ty4 = x4 * tf[1] + y4 * tf[3] + tf[5];

				float tfox = transform->originX;
				float tfoy = transform->originY;
				bool haveOrigin = !isnan(tfox);

				tfox = haveOrigin ? (x1 + tfox) : ((x1 + x2) / 2);
				tfoy = haveOrigin ? (y1 + tfoy) : ((y1 + y2) / 2);
				float dx = tfox - tf[0] * tfox - tf[2] * tfoy;
				float dy = tfoy - tf[1] * tfox - tf[3] * tfoy;

				primitiveBatcherAddVertex(pb, tx1 + dx, ty1 + dy, z, color);
				primitiveBatcherAddVertex(pb, tx2 + dx, ty2 + dy, z, color);
				primitiveBatcherAddVertex(pb, tx3 + dx, ty3 + dy, z, color);
				primitiveBatcherAddVertex(pb, tx4 + dx, ty4 + dy, z, color);
			} else {
				primitiveBatcherAddVertex(pb, x1, y1, z, color);
				primitiveBatcherAddVertex(pb, x2, y2, z, color);
				primitiveBatcherAddVertex(pb, x3, y3, z, color);
				primitiveBatcherAddVertex(pb, x4, y4, z, color);
			}
		}
	}

	void primitiveBatcherDrawRect(PrimitiveBatcher* pb, float x1, float y1, float x2, float y2, float z, uint32_t color, Transform* transform) {
		primitiveBatcherDrawQuad(
			pb,
			x1, y1,
			x1, y2,
			x2, y1,
			x2, y2,
			z,
			color,
			transform
		);
	}

	void primitiveBatcherBegin(PrimitiveBatcher* pb) {
		pb->vertexCount = 0;
	}

	// End and draw a primitive batch.
	// [elementType] should be GL_TRIANGLES
	void primitiveBatcherEnd(PrimitiveBatcher* pb, int elementType) {
		if (pb) {
			if (pb->vertexCount != 0) {
				glUseProgram(shaderPrimitiveBatcher.program);

				glBindVertexArray(pb->vertexArray);

				// Put vertex data.
				glBindBuffer(GL_ARRAY_BUFFER, pb->vertexBuffer);

				GLint bufferSize;
				glGetBufferParameteriv(GL_ARRAY_BUFFER, GL_BUFFER_SIZE, &bufferSize);

				if (pb->vertexCount * 16 > (uint32_t)bufferSize) {
					// Re-allocate vertex data.
					glBufferData(GL_ARRAY_BUFFER, pb->vertexCount * 16, pb->vertexData, GL_DYNAMIC_DRAW);
				} else {
					// Put in sub-data.
					glBufferSubData(GL_ARRAY_BUFFER, 0, pb->vertexCount * 16, pb->vertexData);
				}
				
				// Configure/enable attributes.
				glVertexAttribPointer(
					0,
					3,
					GL_FLOAT,
					GL_FALSE,
					16,
					(void*)0
				);
				glEnableVertexAttribArray(0);
				
				glVertexAttribPointer(
					1,
					4,
					GL_UNSIGNED_BYTE,
					GL_TRUE,
					16,
					(void*)12
				);
				glEnableVertexAttribArray(1);

				// Set shader camera matrix.
				glUniformMatrix3fv(shaderPrimitiveBatcher.uniforms[0], 1, GL_FALSE, getCameraMatrix());
			
				// Setup index buffer.
				// 6 indices for every 4 vertices. 6:4 -> 3:2
				uint32_t indexCount = (pb->vertexCount * 3) / 2;

				bindQuadIndexBuffer(indexCount);

				// Draw!
				glBindVertexArray(pb->vertexArray);

				glDrawElements(elementType, indexCount, GL_UNSIGNED_SHORT, 0);

				// Clean up.
				glUseProgram(0);
				glBindVertexArray(0);
				glDisableVertexAttribArray(0);
				glDisableVertexAttribArray(1);
			}

			// Mark as out of batch.
			pb->vertexCount = UINT32_MAX;
		}
	}



	#define SPRITE_BUFFER_INITIAL_CAPACITY 128
	#define SPRITE_BUFFER_CACHE_SIZE 32

	typedef struct {
		// Number of vertices we can fit.
		uint32_t capacity;
		// The number of buffered vertices in [vertexData].
		uint32_t vertexCount;
		// Vertex data array.
		//  x     y     z     rgba  u     v
		// [----][----][----][----][----][----]
		void* vertexData;
		GLuint vertexBuffer;
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

	SpriteBatcher* spriteBatcherNew() {
		void* vertexData = malloc(SPRITE_BUFFER_INITIAL_CAPACITY * 24);
		if (!vertexData) {
			return NULL;
		}

		SpriteBatcher* sb = malloc(sizeof(SpriteBatcher));

		if (sb) {
			sb->capacity = SPRITE_BUFFER_INITIAL_CAPACITY;
			sb->vertexCount = 0;
			sb->vertexData = vertexData;
			glGenBuffers(1, &sb->vertexBuffer);
			glGenVertexArrays(1, &sb->vertexArray);

			#if DEBUG

				printf("new sprite batcher\n");

			#endif
		}

		return sb;
	}

	void spriteBatcherFree(SpriteBatcher* sb) {
		if (sb) {
			if (sb->vertexData) free(sb->vertexData);
			glDeleteBuffers(1, &sb->vertexBuffer);
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
	
	void spriteBatcherEnd(SpriteBatcher* sb, GLuint textureID) {
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
			glUniformMatrix3fv(shaderSpriteBatcher.uniforms[0], 1, GL_FALSE, getCameraMatrix());

			// Set shader texture.
			glActiveTexture(GL_TEXTURE0);
			glBindTexture(GL_TEXTURE_2D, textureID);
			glUniform1i(shaderSpriteBatcher.uniforms[1], 0);
		
			// Setup index buffer.
			// 6 indices for every 4 vertices. 6:4 -> 3:2
			uint32_t indexCount = (sb->vertexCount * 3) / 2;

			bindQuadIndexBuffer(indexCount);

			// Draw!
			glBindVertexArray(sb->vertexArray);

			glDrawElements(GL_TRIANGLES, indexCount, GL_UNSIGNED_SHORT, 0);

			// Clean up.
			glUseProgram(0);
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
	
	void spriteBatcherDrawRect(SpriteBatcher* sb, float x1, float y1, float x2, float y2, float z, float u1, float v1, float u2, float v2, uint32_t color, Transform* transform) {
		if (spriteBatcherCheckResize(sb, 4)) {
			if (transform) {
				float* tf = transform->matrix;

				float tx1 = x1 * tf[0] + y1 * tf[2] + tf[4];
				float ty1 = x1 * tf[1] + y1 * tf[3] + tf[5];
				float tx2 = x1 * tf[0] + y2 * tf[2] + tf[4];
				float ty2 = x1 * tf[1] + y2 * tf[3] + tf[5];
				float tx3 = x2 * tf[0] + y1 * tf[2] + tf[4];
				float ty3 = x2 * tf[1] + y1 * tf[3] + tf[5];
				float tx4 = x2 * tf[0] + y2 * tf[2] + tf[4];
				float ty4 = x2 * tf[1] + y2 * tf[3] + tf[5];

				float tfox = transform->originX;
				float tfoy = transform->originY;
				bool haveOrigin = !isnan(tfox);

				tfox = haveOrigin ? (x1 + tfox) : ((x1 + x2) / 2);
				tfoy = haveOrigin ? (y1 + tfoy) : ((y1 + y2) / 2);
				float dx = tfox - tf[0] * tfox - tf[2] * tfoy;
				float dy = tfoy - tf[1] * tfox - tf[3] * tfoy;

				spriteBatcherAddVertex(sb, tx1 + dx, ty1 + dy, z, color, u1, v1);
				spriteBatcherAddVertex(sb, tx2 + dx, ty2 + dy, z, color, u1, v2);
				spriteBatcherAddVertex(sb, tx3 + dx, ty3 + dy, z, color, u2, v1);
				spriteBatcherAddVertex(sb, tx4 + dx, ty4 + dy, z, color, u2, v2);
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

					glUseProgram(0);

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
		"vec3 a = m * vec3(vertex.xy, 1.0);\n"
		"gl_Position = vec4(a.xy, vertex.z, 1.0);\n"
		,
		// Fragment Shader
		"FragColor = texture(tex, v_uv) * v_color;\n"
	};
	
	static ShaderData shaderDataPrimitiveBatcher = {
		// Attributes
		2, {
			"vec3 vertex",
			"vec4 color",
		},
		// Vertex Uniforms
		1, {
			"mat3 m",
		},
		// Fragment Uniforms
		0, { 0 },
		// Varyings
		1, {
			"vec4 v_color",
		},
		// Vertex Shader
		"v_color = color;\n"
		"vec3 a = m * vec3(vertex.xy, 1.0);\n"
		"gl_Position = vec4(a.xy, vertex.z, 1.0);\n"
		,
		// Fragment Shader
		"FragColor = v_color;\n"
	};
	
	static ShaderData shaderDataFramebuffer = {
		// Attributes
		1, {
			"vec2 vertex",
		},
		// Vertex Uniforms
		0, { 0 },
		// Fragment Uniforms
		1, {
			"sampler2D tex",
		},
		// Varyings
		1, {
			"vec2 v_uv",
		},
		// Vertex Shader
		"v_uv = 0.5 + vertex * 0.5;\n"
		"gl_Position = vec4(vertex, 0.0, 1.0);\n"
		,
		// Fragment Shader
		"FragColor = texture(tex, v_uv);\n"
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

	static GLuint systemFontTexture = 0;

	int systemFontDraw(const char* str, int cornerX, int cornerY, uint32_t color) {
		// Load GIF sprite.
		if (systemFontTexture == 0) {
			// Load from constant.
			int width, height, channelCount;
			stbi_uc* data = stbi_load_from_memory(COZETTE, COZETTE_LENGTH, &width, &height, &channelCount, 4);

			if (!data) {
				wrenAbort(vm, stbi_failure_reason());
				return cornerY;
			}

			// Load into WebGL texture.
			glGenTextures(1, &systemFontTexture);
			glBindTexture(GL_TEXTURE_2D, systemFontTexture);
			glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
			glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
			glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
			glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
			glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);

			stbi_image_free(data);
		}

		// Set camera matrix to pixel matrix.
		Camera cameraOld = camera;

		camera.centerX = game_resolutionWidth / 2.0f;
		camera.centerY = game_resolutionHeight / 2.0f;
		camera.scale = 1.0f;
		cameraMatrixDirty = true;

		// Draw sprites.
		SpriteBatcher* sb = spriteBatcherTemp();

		spriteBatcherBegin(sb);

		int dx = cornerX;
		int dy = cornerY;
		int screenWidth = game_resolutionWidth - 8;
		char c;
		int i = 0;

		while ((c = str[i]) != '\0') {
			if (c == '\t') {
				// Tab
				dx += 24;
			} else if (c == '\n') {
				// Newline
				dx = cornerX;
				dy += 14;
			} else if (c == '\r') {
				// Carriage return
			} else if (c == ' ') {
				// Space
				dx += 6;
			} else {
				// Convert out of range characters to heart glyph
				if (!(c >= ' ' && c <= '~')) c = 127;

				// Draw the character!
				int idx = c - 32;
				int spx = (idx % 16) * 6;
				int spy = (idx / 16) * 12;

				spriteBatcherDrawRect(sb,
					(float)(dx),     (float)(dy),
					(float)(dx + 6), (float)(dy + 12),
					0,
					spx / (float)COZETTE_WIDTH, spy / (float)COZETTE_HEIGHT,
					(spx + 6) / (float)COZETTE_WIDTH, (spy + 12) / (float)COZETTE_HEIGHT,
					color,
					NULL
				);
		
				dx += 6;
			}

			if (dx >= screenWidth) {
				dx = cornerX;
				dy += 14;
			}

			i++;
		}

		spriteBatcherEnd(sb, systemFontTexture);

		camera = cameraOld;
		cameraMatrixDirty = true;

		return dy;
	}


	// === SOCK WREN API ===

	void wren_methodTODO(WrenVM* vm) {
		wrenAbort(vm, "TODO Method");
	}

	// TIME

	void updateTimeModule(uint64_t frame, uint64_t tick, double time) {
		wrenEnsureSlots(vm, 4);
		wrenSetSlotHandle(vm, 0, handle_Time);
		wrenSetSlotDouble(vm, 1, (double)frame);
		wrenSetSlotDouble(vm, 2, (double)tick);
		wrenSetSlotDouble(vm, 3, time);
		wrenCall(vm, callHandle_update_3);
	}

	// INPUT

	void updateInputMouse() {
		double x = floor((mouseWindowPosX - game_renderRect.x) / game_renderScale);
		double y = floor((mouseWindowPosY - game_renderRect.y) / game_renderScale);

		wrenEnsureSlots(vm, 4);
		wrenSetSlotHandle(vm, 0, handle_Input);
		wrenSetSlotDouble(vm, 1, x);
		wrenSetSlotDouble(vm, 2, y);
		wrenSetSlotDouble(vm, 3, (double)mouseWheel);
		wrenCall(vm, callHandle_updateMouse_3);

		mouseWheel = 0;
	}

	bool updateInput(const char* id, float value) {
		wrenEnsureSlots(vm, 3);
		wrenSetSlotHandle(vm, 0, handle_Input);
		wrenSetSlotString(vm, 1, id);
		wrenSetSlotDouble(vm, 2, value);
		return wrenCall(vm, callHandle_update_2) == WREN_RESULT_SUCCESS;
	}

	void wren_input_localize(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING) {
			wrenAbort(vm, "id must be String");
			return;
		}

		const char* id = wrenGetSlotString(vm, 1);

		// TODO!

		wrenSetSlotString(vm, 0, id);
	}

	// GRAPHICS

	void wren_Graphics_clear3(WrenVM* vm) {
		for (int i = 1; i <= 3; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		float r = (float)wrenGetSlotDouble(vm, 1);
		float g = (float)wrenGetSlotDouble(vm, 2);
		float b = (float)wrenGetSlotDouble(vm, 3);

		glClearColor(r, g, b, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);
	}

	// AUDIO

	void wren_audio_load_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING) {
			wrenAbort(vm, "path must be a string");
			return;
		}

		const char* path = wrenGetSlotString(vm, 1);

		int64_t len;
		char* data = readAsset(path, &len);
		if (!data) {
			wrenAbort(vm, quitError);
			quitError = NULL;
			return;
		}

		printf("file size = %d\n", (int)len);

		if (wren_audio_loadHandler(vm, data, (unsigned int)len)) {
			wrenSetSlotNull(vm, 0);
		} else {
			free(data);
		}
	}

	// ARRAY

	void wren_Array_load_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING) {
			wrenAbort(vm, "path must be a string");
			return;
		}

		Array* array = (Array*)wrenGetSlotForeign(vm, 0);

		const char* path = wrenGetSlotString(vm, 1);

		// Load from file.
		int64_t arrayLength;
		char* data = readAsset(path, &arrayLength);
		if (!data) {
			wrenAbort(vm, quitError);
			quitError = NULL;
			return;
		}

		// Free old.
		if (array->data) {
			free(array->data);
		}

		array->data = data;
		array->length = (uint32_t)arrayLength;

		// Return loaded.
		wrenSetSlotNull(vm, 0);
	}

	// ASSET

	void wren_Asset_loadString_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_LIST) {
			wrenAbort(vm, "path must be a string");
			return;
		}

		Array* array = (Array*)wrenGetSlotForeign(vm, 0);

		const char* path = wrenGetSlotString(vm, 1);

		// Load from asset.
		int64_t strLength;
		char* str = readAsset(path, &strLength);
		if (!str) {
			wrenAbort(vm, quitError);
			quitError = NULL;
			return;
		}

		wrenSetSlotBytes(vm, 0, str, strLength);
	}

	// CAMERA

	void wren_Camera_update_3(WrenVM* vm) {
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
		spr->transform.matrix[0] = NAN;
		spr->transform.matrix[1] = 0.0f;
		spr->transform.matrix[2] = 0.0f;
		spr->transform.matrix[3] = 0.0f;
		spr->transform.matrix[4] = 0.0f;
		spr->transform.matrix[5] = 0.0f;
		spr->transform.originX = NAN;
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

			if (filter != spr->texture.filter) {
				spr->texture.filter = filter;

				if (spr->texture.id != 0) {
					glBindTexture(GL_TEXTURE_2D, spr->texture.id);
					glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
					glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
				}
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
			spriteBatcherEnd(spr->batcher, spr->texture.id);
			spriteBatcherPut(spr->batcher);
			spr->batcher = NULL;
		} else {
			wrenAbort(vm, "batch not yet started");
		}
	}

	void wren_sprite_transform_(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);

		if (isnan(spr->transform.matrix[0])) {
			wrenSetSlotNull(vm, 0);
		} else {
			wrenEnsureSlots(vm, 2);
			wrenSetSlotNewList(vm, 0);
	
			for (int i = 0; i < 6; i++) {
				wrenSetSlotDouble(vm, 1, spr->transform.matrix[i]);
				wrenInsertInList(vm, 0, -1, 1);
			}
		}
	}
	
	void wren_sprite_setTransform_(WrenVM* vm) {
		for (int i = 1; i <= 6; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		double n0 = wrenGetSlotDouble(vm, 1);

		if (isnan(n0)) {
			spr->transform.matrix[0] = NAN;
		} else {
			spr->transform.matrix[0] = (float)n0;
			spr->transform.matrix[1] = (float)wrenGetSlotDouble(vm, 2);
			spr->transform.matrix[2] = (float)wrenGetSlotDouble(vm, 3);
			spr->transform.matrix[3] = (float)wrenGetSlotDouble(vm, 4);
			spr->transform.matrix[4] = (float)wrenGetSlotDouble(vm, 5);
			spr->transform.matrix[5] = (float)wrenGetSlotDouble(vm, 6);
		}
	}

	void wren_sprite_transformOrigin_(WrenVM* vm) {
		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);

		if (isnan(spr->transform.originX)) {
			wrenSetSlotNull(vm, 0);
		} else {
			wrenEnsureSlots(vm, 2);
			wrenSetSlotNewList(vm, 0);
	
			wrenSetSlotDouble(vm, 1, spr->transform.originX);
			wrenInsertInList(vm, 0, -1, 1);

			wrenSetSlotDouble(vm, 1, spr->transform.originY);
			wrenInsertInList(vm, 0, -1, 1);
		}
	}
	
	void wren_sprite_setTransformOrigin_(WrenVM* vm) {
		for (int i = 1; i <= 2; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		Sprite* spr = (Sprite*)wrenGetSlotForeign(vm, 0);
		double n0 = wrenGetSlotDouble(vm, 1);

		if (isnan(n0)) {
			spr->transform.originX = NAN;
		} else {
			spr->transform.originX = (float)n0;
			spr->transform.originY = (float)wrenGetSlotDouble(vm, 2);
		}
	}

	void wren_sprite_draw_5(WrenVM* vm) {
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

		spriteBatcherDrawRect(sb, x1, y1, x2, y2, 0, 0, 0, 1, 1, color, isnan(spr->transform.matrix[0]) ? NULL : &spr->transform);

		if (!spr->batcher) spriteBatcherEnd(sb, spr->texture.id);
	}
	
	void wren_sprite_draw_9(WrenVM* vm) {
		for (int i = 1; i <= 9; i++) {
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
		float u1 = (float)(wrenGetSlotDouble(vm, 5) / spr->texture.width);
		float v1 = (float)(wrenGetSlotDouble(vm, 6) / spr->texture.height);
		float u2 = u1 + (float)(wrenGetSlotDouble(vm, 7) / spr->texture.width);
		float v2 = v1 + (float)(wrenGetSlotDouble(vm, 8) / spr->texture.height);
		uint32_t color = (uint32_t)wrenGetSlotDouble(vm, 9);

		SpriteBatcher* sb = spr->batcher;
		if (!sb) {
			sb = spriteBatcherTemp();
			spriteBatcherBegin(sb);
		}

		spriteBatcherDrawRect(sb, x1, y1, x2, y2, 0, u1, v1, u2, v2, color, isnan(spr->transform.matrix[0]) ? NULL : &spr->transform);

		if (!spr->batcher) spriteBatcherEnd(sb, spr->texture.id);
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

	void wren_Sprite_defaultScaleFilter(WrenVM* vm) {
		wrenSetSlotString(vm, 0, glFilterEnumToString(defaultSpriteFilter));
	}
	
	void wren_Sprite_defaultScaleFilter_set(WrenVM* vm) {
		GLuint filter = wren_filterStringToGlEnum(vm, 1);

		if (filter != 0) {
			defaultSpriteFilter = filter;
		}
	}
	
	void wren_Sprite_defaultWrapMode(WrenVM* vm) {
		wrenSetSlotString(vm, 0, glWrapEnumToString(defaultSpriteWrap));
	}
	
	void wren_Sprite_defaultWrapMode_set(WrenVM* vm) {
		GLuint wrap = wren_wrapStringToGlEnum(vm, 1);
		
		if (wrap != 0) {
			defaultSpriteWrap = wrap;
		}
	}

	// QUAD

	void wren_Quad_beginBatch(WrenVM* vm) {
		if (quadBatcher.vertexCount == UINT32_MAX) {
			primitiveBatcherBegin(&quadBatcher);
		} else {
			wrenAbort(vm, "batch already started");
		}
	}
	
	void wren_Quad_endBatch(WrenVM* vm) {
		if (quadBatcher.vertexCount == UINT32_MAX) {
			wrenAbort(vm, "batch not yet started");
		} else {
			primitiveBatcherEnd(&quadBatcher, GL_TRIANGLES);
		}
	}

	void wren_Quad_draw5(WrenVM* vm) {
		for (int i = 1; i <= 5; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		float x = (float)wrenGetSlotDouble(vm, 1);
		float y = (float)wrenGetSlotDouble(vm, 2);
		float w = (float)wrenGetSlotDouble(vm, 3);
		float h = (float)wrenGetSlotDouble(vm, 4);
		uint32_t color = (uint32_t)wrenGetSlotDouble(vm, 5);

		bool singleBatch = quadBatcher.vertexCount == UINT32_MAX;

		if (singleBatch) primitiveBatcherBegin(&quadBatcher);
		
		primitiveBatcherDrawRect(
			&quadBatcher,
			x, y,
			x + w, y + h,
			0,
			color,
			NULL
		);

		if (singleBatch) primitiveBatcherEnd(&quadBatcher, GL_TRIANGLES);
	}
	
	void wren_Quad_draw9(WrenVM* vm) {
		for (int i = 1; i <= 9; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		float x1 = (float)wrenGetSlotDouble(vm, 1);
		float y1 = (float)wrenGetSlotDouble(vm, 2);
		float x2 = (float)wrenGetSlotDouble(vm, 3);
		float y2 = (float)wrenGetSlotDouble(vm, 4);
		float x3 = (float)wrenGetSlotDouble(vm, 5);
		float y3 = (float)wrenGetSlotDouble(vm, 6);
		float x4 = (float)wrenGetSlotDouble(vm, 7);
		float y4 = (float)wrenGetSlotDouble(vm, 8);
		uint32_t color = (uint32_t)wrenGetSlotDouble(vm, 9);

		bool singleBatch = quadBatcher.vertexCount == UINT32_MAX;

		if (singleBatch) primitiveBatcherBegin(&quadBatcher);

		primitiveBatcherDrawQuad(
			&quadBatcher,
			x1, y1,
			x2, y2,
			x3, y3,
			x4, y4,
			0,
			color,
			NULL
		);

		if (singleBatch) primitiveBatcherEnd(&quadBatcher, GL_TRIANGLES);
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

	void resizeFramebuffer() {
		glBindTexture(GL_TEXTURE_2D, mainFramebufferTex);
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, game_resolutionWidth, game_resolutionHeight, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
	}

	void doScreenLayout() {
		if (game_resolutionIsFixed) {
			float scaleX = (float)game_windowWidth / (float)game_resolutionWidth;
			float scaleY = (float)game_windowHeight / (float)game_resolutionHeight;

			game_renderScale = min(scaleX, scaleY);
			game_renderScale = min(game_renderScale, game_layoutMaxScale);

			if (game_layoutPixelScaling && game_renderScale > 1.0f) {
				game_renderScale = floorf(game_renderScale);
			}

			game_renderRect.w = (int)(game_renderScale * game_resolutionWidth);
			game_renderRect.h = (int)(game_renderScale * game_resolutionHeight);
			game_renderRect.x = (game_windowWidth - game_renderRect.w) / 2;
			game_renderRect.y = (game_windowHeight - game_renderRect.h) / 2;
		} else {
			game_renderRect.x = 0;
			game_renderRect.y = 0;
			game_renderRect.w = game_windowWidth;
			game_renderRect.h = game_windowHeight;
			game_renderScale = 1.0f;
		}
	}

	void handleWindowResize() {
		if (!game_resolutionIsFixed) {
			game_resolutionWidth = game_windowWidth;
			game_resolutionHeight = game_windowHeight;
			resizeFramebuffer();
		}

		doScreenLayout();
	}

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

	void wren_Game_fullscreen(WrenVM* vm) {
		wrenSetSlotBool(vm, 0, game_isFullscreen);
	}

	void wren_Game_setFullscreen_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_BOOL) {
			wrenAbort(vm, "fullscreen must be a Bool");
			return;
		}

		bool fullscreen = wrenGetSlotBool(vm, 1);

		if (fullscreen != game_isFullscreen) {
			if (SDL_SetWindowFullscreen(window, fullscreen ? SDL_WINDOW_FULLSCREEN_DESKTOP : 0) < 0) {
				wrenAbort(vm, SDL_GetError());
				return;
			}
			game_isFullscreen = fullscreen;

			// Do re-layout.
			SDL_GetWindowSize(window, &game_windowWidth, &game_windowHeight);

			wrenReturnNumList2(vm, (double)game_windowWidth, (double)game_windowHeight);

			handleWindowResize();
		}
	}

	void wren_Game_print_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING || wrenGetSlotType(vm, 2) != WREN_TYPE_NUM || wrenGetSlotType(vm, 3) != WREN_TYPE_NUM) {
			wrenAbort(vm, "invalid args");
			return;
		}

		const char* str = wrenGetSlotString(vm, 1);
		int x = (int)wrenGetSlotDouble(vm, 2);
		int y = (int)wrenGetSlotDouble(vm, 3);

		int resultY = systemFontDraw(str, x, y, game_printColor);

		wrenSetSlotDouble(vm, 0, resultY);
	}

	void wren_Game_printColorSet_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_NUM) {
			wrenAbort(vm, "invalid args");
			return;
		}

		game_printColor = (uint32_t)wrenGetSlotDouble(vm, 1);
	}

	void wren_Game_os(WrenVM* vm) {
		wrenSetSlotString(vm, 0, SOCK_OS);
	}

	void wren_Game_openURL(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_STRING) {
			wrenAbort(vm, "url must be a String");
			return;
		}

		if (SDL_OpenURL(wrenGetSlotString(vm, 1)) == -1) {
			wrenAbort(vm, SDL_GetError());
		}
	}

	void wren_Game_layoutChanged_(WrenVM* vm) {
		if (
			wrenGetSlotType(vm, 1) != WREN_TYPE_NUM
			||
			wrenGetSlotType(vm, 2) != WREN_TYPE_NUM
			||
			wrenGetSlotType(vm, 3) != WREN_TYPE_BOOL
			||
			wrenGetSlotType(vm, 4) != WREN_TYPE_BOOL
			||
			wrenGetSlotType(vm, 5) != WREN_TYPE_NUM
		) {
			wrenAbort(vm, "invalid args");
			return;
		}

		int width = (int)wrenGetSlotDouble(vm, 1);
		int height = (int)wrenGetSlotDouble(vm, 2);
		bool isFixed = wrenGetSlotBool(vm, 3);
		bool isPixelPerfect = wrenGetSlotBool(vm, 4);
		float maxScale = (float)wrenGetSlotDouble(vm, 5);

		if (width < 1 || height < 1 || maxScale < 1) {
			wrenAbort(vm, "resolution/scale must be positive");
			return;
		}

		if (!isFixed) {
			width = game_windowWidth;
			height = game_windowHeight;
		}

		if (width != game_resolutionWidth || height != game_resolutionHeight) {
			// Resize framebuffer.
			game_resolutionWidth = width;
			game_resolutionHeight = height;

			resizeFramebuffer();
		}
		
		game_resolutionIsFixed = isFixed;
		game_layoutPixelScaling = isPixelPerfect;
		game_layoutMaxScale = maxScale;

		doScreenLayout();
	}

	void wren_Game_scaleFilter(WrenVM* vm) {
		wrenSetSlotString(vm, 0, glFilterEnumToString(mainFramebufferScaleFilter));
	}
	
	void wren_Game_scaleFilter_set(WrenVM* vm) {
		GLuint filter = wren_filterStringToGlEnum(vm, 1);

		if (filter != 0 && filter != mainFramebufferScaleFilter) {
			mainFramebufferScaleFilter = filter;

			glBindTexture(GL_TEXTURE_2D, mainFramebufferTex);
			glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
			glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
		}
	}

	void wren_Game_quit_(WrenVM* vm) {
		game_quit = true;
	}

	// WINDOW
	
	void wren_Window_left(WrenVM* vm) {
		int x;
		SDL_GetWindowPosition(window, &x, NULL);
		wrenSetSlotDouble(vm, 0, x);
	}
	
	void wren_Window_top(WrenVM* vm) {
		int y;
		SDL_GetWindowPosition(window, NULL, &y);
		wrenSetSlotDouble(vm, 0, y);
	}

	void wren_Window_setPos_(WrenVM* vm) {
		for (int i = 1; i <= 2; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		int x = (int)wrenGetSlotDouble(vm, 1);
		int y = (int)wrenGetSlotDouble(vm, 1);

		SDL_SetWindowPosition(window, x, y);
	}
	
	void wren_Window_center(WrenVM* vm) {
		SDL_SetWindowPosition(window, SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED);
	}

	void wren_Window_width(WrenVM* vm) {
		wrenSetSlotDouble(vm, 0, game_windowWidth);
	}

	void wren_Window_height(WrenVM* vm) {
		wrenSetSlotDouble(vm, 0, game_windowHeight);
	}
	
	void wren_Window_setSize_(WrenVM* vm) {
		for (int i = 1; i <= 2; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		int width = (int)wrenGetSlotDouble(vm, 1);
		int height = (int)wrenGetSlotDouble(vm, 2);

		if (width <= 0 || height <= 0) {
			wrenAbort(vm, "size must be positive");
			return;
		}

		SDL_SetWindowSize(window, width, height);
		game_windowWidth = width;
		game_windowHeight = height;

		doScreenLayout();
	}

	void wren_Window_resizable(WrenVM* vm) {
		wrenSetSlotBool(vm, 0, (SDL_GetWindowFlags(window) & SDL_WINDOW_RESIZABLE) != 0);
	}
	
	void wren_Window_resizableSet(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_BOOL) {
			wrenAbort(vm, "resizeable must be a Bool");
			return;
		}

		bool resizeable = wrenGetSlotBool(vm, 1);

		SDL_SetWindowResizable(window, resizeable);
	}

	// API Binding

	WrenForeignMethodFn wren_bindForeignMethod(WrenVM* vm, const char* moduleName, const char* className, bool isStatic, const char* signature) {
		if (strcmp(moduleName, "sock") == 0) {
			if (strcmp(className, "Array") == 0) {
				if (!isStatic) {
					if (strcmp(signature, "load_(_)") == 0) return wren_Array_load_;
				}
			} else if (strcmp(className, "Asset") == 0) {
				if (isStatic) {
					if (strcmp(signature, "loadString_(_)") == 0) return wren_Asset_loadString_;
				}
			} else if (strcmp(className, "Input") == 0) {
				if (isStatic) {
					if (strcmp(signature, "localize(_)") == 0) return wren_input_localize;
				}
			} else if (strcmp(className, "Graphics") == 0) {
				if (isStatic) {
					if (strcmp(signature, "clear(_,_,_)") == 0) return wren_Graphics_clear3;
				}
			} else if (strcmp(className, "AudioBus") == 0) {
				if (!isStatic) {
					if (strcmp(signature, "volume") == 0) return wren_audioBus_volume;
					if (strcmp(signature, "fadeVolume(_,_)") == 0) return wren_audioBus_fadeVolume;
					if (strcmp(signature, "setEffect_(_,_,_,_,_,_)") == 0) return wren_audioBus_setEffect_;
					if (strcmp(signature, "getEffect_(_)") == 0) return wren_audioBus_getEffect_;
					if (strcmp(signature, "getParam_(_,_,_)") == 0) return wren_audioBus_getParam_;
					if (strcmp(signature, "setParam_(_,_,_,_,_)") == 0) return wren_audioBus_setParam_;
				}
			} else if (strcmp(className, "Audio") == 0) {
				if (isStatic) {
					if (strcmp(signature, "volume") == 0) return wren_Audio_volume;
					if (strcmp(signature, "fadeVolume(_,_)") == 0) return wren_Audio_fadeVolume;
				} else {
					if (strcmp(signature, "load_(_)") == 0) return wren_audio_load_;
					if (strcmp(signature, "duration") == 0) return wren_audio_duration;
					if (strcmp(signature, "voice()") == 0) return wren_audio_voice;
					if (strcmp(signature, "voice(_)") == 0) return wren_audio_voiceBus;
				}
			} else if (strcmp(className, "Voice") == 0) {
				if (!isStatic) {
					if (strcmp(signature, "play()") == 0) return wren_voice_play;
					if (strcmp(signature, "pause()") == 0) return wren_voice_pause;
					if (strcmp(signature, "isPaused") == 0) return wren_voice_isPaused;
					if (strcmp(signature, "stop()") == 0) return wren_voice_stop;
					if (strcmp(signature, "volume") == 0) return wren_voice_volume;
					if (strcmp(signature, "fadeVolume(_,_)") == 0) return wren_voice_fadeVolume;
					if (strcmp(signature, "rate") == 0) return wren_voice_rate;
					if (strcmp(signature, "fadeRate(_,_)") == 0) return wren_voice_fadeRate;
					if (strcmp(signature, "loop") == 0) return wren_voice_loop;
					if (strcmp(signature, "loop=(_)") == 0) return wren_voice_loopSet;
					if (strcmp(signature, "loopStart") == 0) return wren_voice_loopStart;
					if (strcmp(signature, "loopStart=(_)") == 0) return wren_voice_loopStartSet;
					if (strcmp(signature, "setEffect_(_,_,_,_,_,_)") == 0) return wren_voice_setEffect_;
					if (strcmp(signature, "getEffect_(_)") == 0) return wren_voice_getEffect_;
					if (strcmp(signature, "getParam_(_,_,_)") == 0) return wren_voice_getParam_;
					if (strcmp(signature, "setParam_(_,_,_,_,_)") == 0) return wren_voice_setParam_;
				}
			} else if (strcmp(className, "Camera") == 0) {
				if (isStatic) {
					if (strcmp(signature, "update_(_,_,_)") == 0) return wren_Camera_update_3;
				}
			} else if (strcmp(className, "Storage") == 0) {
				if (isStatic) {
					if (strcmp(signature, "load_(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "save_(_,_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "contains(_)") == 0) return wren_methodTODO;
					if (strcmp(signature, "delete(_)") == 0) return wren_methodTODO;
				}
			} else if (strcmp(className, "Sprite") == 0) {
				if (isStatic) {
					if (strcmp(signature, "defaultScaleFilter") == 0) return wren_Sprite_defaultScaleFilter;
					if (strcmp(signature, "defaultScaleFilter=(_)") == 0) return wren_Sprite_defaultScaleFilter_set;
					if (strcmp(signature, "defaultWrapMode") == 0) return wren_Sprite_defaultWrapMode;
					if (strcmp(signature, "defaultWrapMode=(_)") == 0) return wren_Sprite_defaultWrapMode_set;
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
					if (strcmp(signature, "draw(_,_,_,_,_)") == 0) return wren_sprite_draw_5;
					if (strcmp(signature, "draw(_,_,_,_,_,_,_,_,_)") == 0) return wren_sprite_draw_9;
					if (strcmp(signature, "transform_") == 0) return wren_sprite_transform_;
					if (strcmp(signature, "setTransform_(_,_,_,_,_,_)") == 0) return wren_sprite_setTransform_;
					if (strcmp(signature, "transformOrigin_") == 0) return wren_sprite_transformOrigin_;
					if (strcmp(signature, "setTransformOrigin(_,_)") == 0) return wren_sprite_setTransformOrigin_;
					if (strcmp(signature, "toString") == 0) return wren_sprite_toString;
				}
			} else if (strcmp(className, "Quad") == 0) {
				if (isStatic) {
					if (strcmp(signature, "beginBatch()") == 0) return wren_Quad_beginBatch;
					if (strcmp(signature, "endBatch()") == 0) return wren_Quad_endBatch;
					if (strcmp(signature, "draw(_,_,_,_,_)") == 0) return wren_Quad_draw5;
					if (strcmp(signature, "draw(_,_,_,_,_,_,_,_,_)") == 0) return wren_Quad_draw9;
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
					if (strcmp(signature, "scaleFilter") == 0) return wren_Game_scaleFilter;
					if (strcmp(signature, "scaleFilter=(_)") == 0) return wren_Game_scaleFilter_set;
					if (strcmp(signature, "fps") == 0) return wren_Game_fps;
					if (strcmp(signature, "fps=(_)") == 0) return wren_Game_fps_set;
					if (strcmp(signature, "layoutChanged_(_,_,_,_,_)") == 0) return wren_Game_layoutChanged_;
					if (strcmp(signature, "cursor") == 0) return wren_Game_cursor;
					if (strcmp(signature, "cursor=(_)") == 0) return wren_Game_cursor_set;
					if (strcmp(signature, "fullscreen") == 0) return wren_Game_fullscreen;
					if (strcmp(signature, "setFullscreen_(_)") == 0) return wren_Game_setFullscreen_;
					if (strcmp(signature, "print_(_,_,_)") == 0) return wren_Game_print_;
					if (strcmp(signature, "setPrintColor_(_)") == 0) return wren_Game_printColorSet_;
					if (strcmp(signature, "os") == 0) return wren_Game_os;
					if (strcmp(signature, "openURL(_)") == 0) return wren_Game_openURL;
					if (strcmp(signature, "ready_()") == 0) return wren_Game_ready_;
					if (strcmp(signature, "quit_()") == 0) return wren_Game_quit_;
				}
			} else if (strcmp(className, "Window") == 0) {
				if (isStatic) {
					if (strcmp(signature, "left") == 0) return wren_Window_left;
					if (strcmp(signature, "top") == 0) return wren_Window_top;
					if (strcmp(signature, "setPos_(_,_)") == 0) return wren_Window_setPos_;
					if (strcmp(signature, "center()") == 0) return wren_Window_center;
					if (strcmp(signature, "width") == 0) return wren_Window_width;
					if (strcmp(signature, "height") == 0) return wren_Window_height;
					if (strcmp(signature, "setSize_(_,_)") == 0) return wren_Window_setSize_;
					if (strcmp(signature, "resizable") == 0) return wren_Window_resizable;
					if (strcmp(signature, "resizable=(_)") == 0) return wren_Window_resizableSet;
				}
			}
		}

		return wren_coreBindForeignMethod(vm, moduleName, className, isStatic, signature);
	}

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
				} else if (strcmp(className, "AudioBus") == 0) {
					methods.allocate = wren_audioBusAllocate;
					methods.finalize = wren_audioBusFinalize;
				} else if (strcmp(className, "Audio") == 0) {
					methods.allocate = wren_audioAllocate;
					methods.finalize = wren_audioFinalize;
				} else if (strcmp(className, "Voice") == 0) {
					methods.allocate = wren_voiceAllocate;
					methods.finalize = wren_voiceFinalize;
				}
			}
		}

		return methods;
	}

	void wren_write(WrenVM* vm, const char* text) {
		printf("[WREN] %s", text);
	}

	void wren_error(WrenVM* vm, WrenErrorType type, const char* moduleName, int line, const char* message) {
		if (type == WREN_ERROR_COMPILE) {
			printf("[WREN Compile Error] at %s:%d %s\n", moduleName, line, message);
		}
		else if (type == WREN_ERROR_RUNTIME) {
			printf("[WREN Runtime Error] %s\n", message);
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

		// Setup audio.
		if (!sockAudioInit()) {
			return -1;
		}

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
		window = SDL_CreateWindow("sock", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, game_windowWidth, game_windowHeight, SDL_WINDOW_OPENGL | SDL_WINDOW_HIDDEN | SDL_WINDOW_RESIZABLE);
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

		// Setup OpenGL.
		glEnable(GL_BLEND);
		glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

		// The above blendFunc is only valid if result in not transparent.
		// Use this one if it is:
		// glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA);

		// Load shaders.
		shaderSpriteBatcher = compileShader(&shaderDataSpriteBatcher);
		if (shaderSpriteBatcher.program == 0) {
			return -1;
		}

		shaderPrimitiveBatcher = compileShader(&shaderDataPrimitiveBatcher);
		if (shaderPrimitiveBatcher.program == 0) {
			return -1;
		}
		
		shaderFramebuffer = compileShader(&shaderDataFramebuffer);
		if (shaderFramebuffer.program == 0) {
			return -1;
		}

		// Create main framebuffer.
		glGenVertexArrays(1, &mainFramebufferVertexArray);

		float triangles[12] = {
			-1, -1,
			+1, -1,
			-1, +1,
			-1, +1,
			+1, -1,
			+1, +1,
		};
		glGenBuffers(1, &mainFramebufferTriangles);
		glBindBuffer(GL_ARRAY_BUFFER, mainFramebufferTriangles);
		glBufferData(GL_ARRAY_BUFFER, sizeof(triangles), triangles, GL_STATIC_DRAW);

		glGenFramebuffers(1, &mainFramebuffer);
		glBindFramebuffer(GL_FRAMEBUFFER, mainFramebuffer);

		glGenTextures(1, &mainFramebufferTex);
		glBindTexture(GL_TEXTURE_2D, mainFramebufferTex);
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, game_windowWidth, game_windowHeight, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);

		glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, mainFramebufferTex, 0);

		if (debug_checkGlError("create framebuffer")) {
			return -1;
		}

		if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
			quitError = "main framebuffer not complete";
			return -1;
		}

		// Init custom draw buffers.
		if (!primitiveBatcherInit(&quadBatcher)) {
			quitError = "allocate quad batcher";
			return -1;
		}

		// Final GL setup.
		glViewport(0, 0, game_windowWidth, game_windowHeight);

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
		callHandle_update_3 = wrenMakeCallHandle(vm, "update_(_,_,_)");
		callHandle_updateMouse_3 = wrenMakeCallHandle(vm, "updateMouse_(_,_,_)");
		
		// Load sock Wren code.
		char* sockSource = fileReadRelative("sock_desktop.wren");
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

		WrenInterpretResult mainResult = wrenInterpret(vm, "/main", mainSource);
		free(mainSource);

		if (mainResult != WREN_RESULT_SUCCESS) {
			return -1;
		}

		// We can show the window now!
		SDL_ShowWindow(window);

		// Setup
		int inLoop = 1;
		uint64_t frame = 0;
		uint64_t tick = 0;
		uint64_t prevTime = SDL_GetTicks64();
		double remainingTime = 0;
		double totalTime = 60;
		bool windowResized = false;

		while (inLoop) {
			// Update Sock time state.
			updateTimeModule(frame, tick, totalTime);

			// Get SDL events.
			bool anyInputs = false;
			SDL_Event event;
			while ( SDL_PollEvent(&event) ) {
				if (event.type == SDL_QUIT) {
					inLoop = 0;
				} else if (event.type == SDL_KEYDOWN || event.type == SDL_KEYUP) {
					if (!event.key.repeat) {
						const char* id = sdlScancodeToInputID(event.key.keysym.scancode);
						if (id) {
							if (!updateInput(id, event.type == SDL_KEYDOWN ? 1.0f : 0.0f)) {
								inLoop = 0;
							}
						}
					}
				} else if (event.type == SDL_MOUSEBUTTONDOWN || event.type == SDL_MOUSEBUTTONUP) {
					const char* id = NULL;

					if (event.button.button == SDL_BUTTON_LEFT) {
						id = INPUT_ID_MOUSE_LEFT;
					} else if (event.button.button == SDL_BUTTON_MIDDLE) {
						id = INPUT_ID_MOUSE_MIDDLE;
					} else if (event.button.button == SDL_BUTTON_RIGHT) {
						id = INPUT_ID_MOUSE_RIGHT;
					}
					
					if (id) {
						if (!updateInput(id, event.type == SDL_MOUSEBUTTONDOWN ? 1.0f : 0.0f)) {
							inLoop = 0;
						}
					}
				} else if (event.type == SDL_MOUSEWHEEL) {
					mouseWheel += event.wheel.y;
				} else if (event.type == SDL_MOUSEMOTION) {
					mouseWindowPosX = event.motion.x;
					mouseWindowPosY = event.motion.y;
				} else if (event.type == SDL_WINDOWEVENT) {
					switch (event.window.event) {
						case SDL_WINDOWEVENT_RESIZED: {
							windowResized = true;
							game_windowWidth = event.window.data1;
							game_windowHeight = event.window.data2;
						} break;
					}
				}
			}

			// Resize game.
			if (windowResized) {
				windowResized = false;

				handleWindowResize();

				wrenEnsureSlots(vm, 3);
				wrenSetSlotHandle(vm, 0, handle_Game);
				wrenSetSlotDouble(vm, 1, game_windowWidth);
				wrenSetSlotDouble(vm, 2, game_windowHeight);
				wrenCall(vm, callHandle_update_2);
			}

			// Update time stuff..
			uint64_t now = SDL_GetTicks64();
			uint64_t delta = min(66, now - prevTime);
			prevTime = now;

			remainingTime -= (double)delta / 1000.0;

			if (remainingTime <= 0) {
				remainingTime += 1.0 / game_fps;

				// Do update.
				if (game_ready) {
					// Update mouse position.
					updateInputMouse();

					// Prepare WebGL.
					glBindFramebuffer(GL_FRAMEBUFFER, mainFramebuffer);
					glViewport(0, 0, game_resolutionWidth, game_resolutionHeight);

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
					
					// Finalize GL.
					glBindFramebuffer(GL_FRAMEBUFFER, 0);
					glViewport(game_renderRect.x, game_renderRect.y, game_renderRect.w, game_renderRect.h);

					glUseProgram(shaderFramebuffer.program);

					glBindVertexArray(mainFramebufferVertexArray);

					glActiveTexture(GL_TEXTURE0);
					glBindTexture(GL_TEXTURE_2D, mainFramebufferTex);
					glUniform1i(shaderFramebuffer.uniforms[0], 0);

					glBindBuffer(GL_ARRAY_BUFFER, mainFramebufferTriangles);
					glVertexAttribPointer(0, 2, GL_FLOAT, false, 0, (void*)0);
					glEnableVertexAttribArray(0);

					glDrawArrays(GL_TRIANGLES, 0, 6);

					glUseProgram(0);
					glBindVertexArray(0);
					glDisableVertexAttribArray(0);

					SDL_GL_SwapWindow(window);

					// Check for GL errors.
					if (debug_checkGlError("post update")) inLoop = 0;

					// Update local time state.
					frame++;
					totalTime += 1.0 / game_fps;
				}
			}

			// Wait and loop.
			SDL_Delay(2);
			tick++;
		}

		return 0;
	}

	int main(int argc, char** argv) {
		// Init SDL.
		if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO) < 0) {
			printf("ERR SDL_Init %s", SDL_GetError());
		} else {
			int code = mainWithSDL(argc, argv);

			if (code < 0) {
				printf("ERR %s %s", quitError, SDL_GetError());
			}

			sockAudioQuit();
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

#include <string.h>
#include <errno.h>
#include <stdio.h>
#include "wren.h"

// Array

#define ARRAY_SIZE(data) (*((unsigned*)(data)))
#define ARRAY_UINT8(data, i) ((unsigned char*)((unsigned char*)(data) + sizeof(unsigned) + (i)))
#define ARRAY_UINT16(data, i) ((unsigned short*)((unsigned char*)(data) + sizeof(unsigned) + (i)))

void arrayAllocate(WrenVM* vm) {
	unsigned size = (unsigned)wrenGetSlotDouble(vm, 1);

	void* a = wrenSetSlotNewForeign(vm, 0, 0, sizeof(unsigned) + size);
	
	((unsigned*)a)[0] = size;
}

void array_count(WrenVM* vm) {
	wrenSetSlotDouble(vm, 0, ARRAY_SIZE(wrenGetSlotForeign(vm, 0)));
}

void array_uint8_get(WrenVM* vm) {
	void* data = wrenGetSlotForeign(vm, 0);
	int i = (int)wrenGetSlotDouble(vm, 1);

	if (i < 0) i = ARRAY_SIZE(data) + i;

	wrenSetSlotDouble(vm, 0, *ARRAY_UINT8(data, i));
}

void array_uint8_set(WrenVM* vm) {
	void* data = wrenGetSlotForeign(vm, 0);
	int i = (int)wrenGetSlotDouble(vm, 1);
	int v = (unsigned char)wrenGetSlotDouble(vm, 2);

	if (i < 0) i = ARRAY_SIZE(data) + i;

	*ARRAY_UINT8(data, i) = v;
}

void array_copyFromString(WrenVM* vm) {
	void* data = wrenGetSlotForeign(vm, 0);
	unsigned len = ARRAY_SIZE(data);

	int byteLen;
	const char* bytes = wrenGetSlotBytes(vm, 1, &byteLen);

	int offset = (int)wrenGetSlotDouble(vm, 2);

	if (offset + byteLen > len) {
		wrenSetSlotString(vm, 0, "string is too large");
		wrenAbortFiber(vm, 0);
	} else {
		unsigned char* u8 = ARRAY_UINT8(data, offset);

		for (int i = 0; i < byteLen; i++) {
			u8[i] = bytes[i];
		}
	}
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

void sbAllocate(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(StringBuilder));
	sbInit(sb);
}

void sbFinalize(void* data) {
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

void sb_add(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenGetSlotForeign(vm, 0);

	int dataLen;
	const char* data = wrenGetSlotBytes(vm, 1, &dataLen);

	sbAdd(sb, data, dataLen);
}

void sb_addByte(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenGetSlotForeign(vm, 0);

	char value = (char)wrenGetSlotDouble(vm, 1);

	sbAddByte(sb, value);
}

void sb_clear(WrenVM* vm) {
	StringBuilder* sb = (StringBuilder*)wrenGetSlotForeign(vm, 0);

	sb->size = 0;
}

void sb_toString(WrenVM* vm) {
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

void colorAllocate(WrenVM* vm) {
	Color* color = (Color*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(Color));

	color->packed = 0xff000000U;
}

void color_getR(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.r / 255.0); }
void color_getG(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.g / 255.0); }
void color_getB(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.b / 255.0); }
void color_getA(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->parts.a / 255.0); }
void color_getPacked(WrenVM* vm) { wrenSetSlotDouble(vm, 0, ((Color*)wrenGetSlotForeign(vm, 0))->packed); }

void color_setR(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.r = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void color_setG(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.g = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void color_setB(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.b = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void color_setA(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->parts.a = (unsigned char)(wrenGetSlotDouble(vm, 1) * 255.999); }
void color_setPacked(WrenVM* vm) { ((Color*)wrenGetSlotForeign(vm, 0))->packed = wrenGetSlotDouble(vm, 1); }

char color_toStringGetChar(unsigned char b) {
	if (b < 10) return 48 + b;
	if (b < 16) return 87 + b;
	return '?';
}

void color_toStringAddByte(char* buffer, unsigned char b) {
	buffer[0] = color_toStringGetChar(b >> 4);
	buffer[1] = color_toStringGetChar(b & 15);
}

void color_toString(WrenVM* vm) {
	Color* color = (Color*)wrenGetSlotForeign(vm, 0);

	char buffer[9];

	buffer[0] = '#';
	color_toStringAddByte(buffer + 1, color->parts.r);
	color_toStringAddByte(buffer + 3, color->parts.g);
	color_toStringAddByte(buffer + 5, color->parts.b);
	
	int len;
	if (color->parts.a == 255) {
		len = 7;
	} else {
		color_toStringAddByte(buffer + 7, color->parts.a);
		len = 9;
	}

	wrenSetSlotBytes(vm, 0, buffer, len);
}




// class/method binding.

WrenForeignClassMethods bindForeignClass(WrenVM* vm, const char* module, const char* className) {
	WrenForeignClassMethods result;

	result.allocate = NULL;
	result.finalize = NULL;

	if (strcmp(module, "sock") == 0) {
		if (strcmp(className, "StringBuilder") == 0) {
			result.allocate = sbAllocate;
			result.finalize = sbFinalize;
		} else if (strcmp(className, "Array") == 0) {
			result.allocate = arrayAllocate;
		} else if (strcmp(className, "Color") == 0) {
			result.allocate = colorAllocate;
		}
	}

	return result;
}

WrenForeignMethodFn bindForeignMethod(WrenVM* vm, const char* module, const char* className, bool isStatic, const char* signature) {
	if (strcmp(module, "sock") == 0) {
		if (strcmp(className, "StringBuilder") == 0) {
			if (!isStatic) {
				if (strcmp(signature, "add_(_)") == 0) return sb_add;
				if (strcmp(signature, "addByte_(_)") == 0) return sb_addByte;
				if (strcmp(signature, "clear_()") == 0) return sb_clear;
				if (strcmp(signature, "toString") == 0) return sb_toString;
			}
		} else if (strcmp(className, "Array") == 0) {
			if (!isStatic) {
				if (strcmp(signature, "count") == 0) return array_count;
				if (strcmp(signature, "uint8(_)") == 0) return array_uint8_get;
				if (strcmp(signature, "uint8(_,_)") == 0) return array_uint8_set;
				if (strcmp(signature, "copyFromString(_,_)") == 0) return array_copyFromString;
			}
		} else if (strcmp(className, "Color") == 0) {
			if (!isStatic) {
				if (strcmp(signature, "r") == 0) return color_getR;
				if (strcmp(signature, "g") == 0) return color_getG;
				if (strcmp(signature, "b") == 0) return color_getB;
				if (strcmp(signature, "a") == 0) return color_getA;
				if (strcmp(signature, "r=(_)") == 0) return color_setR;
				if (strcmp(signature, "g=(_)") == 0) return color_setG;
				if (strcmp(signature, "b=(_)") == 0) return color_setB;
				if (strcmp(signature, "a=(_)") == 0) return color_setA;
				if (strcmp(signature, "uint32") == 0) return color_getPacked;
				if (strcmp(signature, "uint32=(_)") == 0) return color_setPacked;
				if (strcmp(signature, "toString") == 0) return color_toString;
			}
		}
	}

	return NULL;
}

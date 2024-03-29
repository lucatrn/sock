
//#define __IS_PIXEL_PERFECT __pp
//#define __SIZE_IS_FIXED __szf
//#define __SCALE_MAX __km

class Game {
	foreign static arguments

	foreign static title
	foreign static title=(s)

	static width { __w }
	static width=(w) { setSize(w, __h) }
	
	static height { __h }
	static height=(h) { setSize(__w, h) }

	static setSize(w, h) {
		__w = w
		__h = h
		__SIZE_IS_FIXED = true
		layoutChanged_()
	}

	static clearSize() {
		if (__SIZE_IS_FIXED) {
			__SIZE_IS_FIXED = false
			__w = __wm
			__h = __hm
			layoutChanged_()
		}
	}

	static pixelPerfectScaling { __IS_PIXEL_PERFECT }
	static pixelPerfectScaling=(pp) {
		__IS_PIXEL_PERFECT = pp
		layoutChanged_()
	}

	static maxScale { __SCALE_MAX }
	static maxScale=(s) {
		if (__SCALE_MAX != s) {
			__SCALE_MAX = s
			layoutChanged_()
		}
	}

	foreign static fullscreen
	static fullscreen=(v) {
		var a = setFullscreen_(v)
		if (a is List) update_(a[0], a[1])
	}
	foreign static setFullscreen_(value)

	foreign static scaleFilter
	foreign static scaleFilter=(value)

	foreign static fps
	foreign static fps=(fps)

	static layoutChanged_() {
		layoutChanged_(__w, __h, __SIZE_IS_FIXED, __IS_PIXEL_PERFECT, __SCALE_MAX)
	}
	foreign static layoutChanged_(x, y, fixed, pp, maxs)

	foreign static cursor
	foreign static cursor=(s)

	static print(s) {
		__drawY = 16 + print_(s.toString, __drawX, __drawY)
	}
	static print(s, c) {
		printColor = c
		print(s)
	}
	static print(s, x, y) {
		__drawX = x
		__drawY = 16 + print_(s.toString, x, y)
	}
	static print(s, x, y, c) {
		printColor = c
		print(s, x, y)
	}
	foreign static print_(s, x, y)

	foreign static printColor
	foreign static printColor=(c)

	foreign static setClip(x, y, w, h)
	foreign static clearClip()

	static clear() { clear_(0, 0, 0) }
	static clear(c) { clear_(c.red / 255, c.green / 255, c.blue / 255) }
	foreign static clear_(r, g, b)

	foreign static blendColor
	static blendColor=(c) { setBlendColor(c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255) }
	foreign static setBlendColor(r, g, b, a)

	static setBlendMode(func, src, dst) { setBlendMode(func, func, src, src, dst, dst) }
	static setBlendMode(func, srcRGB, srcA, dstRGB, dstA) { setBlendMode(func, func, srcRGB, srcA, dstRGB, dstA) }
	foreign static setBlendMode(funcRGB, funcA, srcRGB, srcA, dstRGB, dstA)
	foreign static resetBlendMode()

	foreign static openURL(url)

	static init_(w, h) {
		__w = __wm = w
		__h = __hm = h
		__SCALE_MAX = Num.infinity
		__SIZE_IS_FIXED = false
		__IS_PIXEL_PERFECT = false
		__drawX = __drawY = 4
	}

	static update_(w, h) {
		__wm = w
		__hm = h

		if (!__SIZE_IS_FIXED) {
			__w = w
			__h = h
		}
	}

	static begin(fn) {
		if (__fn) Fiber.abort("Game.begin() alread called")
		if (!(fn is Fn)) Fiber.abort("update function is %(fn.type), should be a Fn")
		if (fn.arity != 0) Fiber.abort("update function must have no arguments")
		
		__fn = fn
		ready_()
	}

	static update_() {
		// Init print location.
		__drawX = __drawY = 4

		// Reset camera.
		Camera.reset()

		// Pre update modules.
		Timer.update_()

		// Do update
		if (__fn) __fn.call()
		
		// Post update modules.
		Input.pupdate_()
		Time.pupdate_()

		// Done!
		ready_()
	}

	foreign static ready_()

	static quitNow() {
		quit()
		Fiber.suspend()
	}

	foreign static quit()
}

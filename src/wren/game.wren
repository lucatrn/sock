
//#define __IS_PIXEL_PERFECT __pp
//#define __SIZE_MAX __szm
//#define __SIZE_IS_FIXED __szf
//#define __SIZE __sz
//#define __SCALE_MAX __km

class Game {
	foreign static title

	foreign static title=(s)

	static size { __SIZE }

	static width { __SIZE.x }
	
	static height { __SIZE.y }

	static center { __SIZE / 2 }

	static fixedSize { __SIZE_IS_FIXED ? __SIZE : null }

	static fixedSize=(v) {
		if (v == null) {
			if (__SIZE_IS_FIXED) {
				__SIZE.x = __SIZE_MAX.x
				__SIZE.y = __SIZE_MAX.y
				__SIZE_IS_FIXED = false
				layoutChanged_()
			}
		} else if (!__SIZE_IS_FIXED || __SIZE.x != v.x || __SIZE.y != v.y) {
			__SIZE.x = v.x.floor.clamp(1, 2048)
			__SIZE.y = v.y.floor.clamp(1, 2048)
			__SIZE_IS_FIXED = true
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
		layoutChanged_(__SIZE.x, __SIZE.y, __SIZE_IS_FIXED, __IS_PIXEL_PERFECT, __SCALE_MAX)
	}

	foreign static layoutChanged_(x, y, fixed, pp, maxs)

	foreign static cursor
	
	foreign static cursor=(s)

	static print(s) {
		__drawY = 16 + print_(s.toString, __drawX, __drawY)
	}
	
	static print(s, x, y) {
		__drawX = x
		__drawY = 16 + print_(s.toString, x, y)
	}

	static printColor { __drawC }

	static printColor=(c) {
		__drawC = c
		setPrintColor_(c.uint32)
	}

	foreign static print_(s, x, y)

	foreign static setPrintColor_(d)

	foreign static platform

	foreign static os

	foreign static openURL(url)

	//#if WEB

		foreign static browser

	//#else

		static browser { null }

	//#endif

	static init_(w, h) {
		__SIZE_IS_FIXED = false
		__SIZE_MAX = Vec.new(w, h)
		__SIZE = Vec.new(w, h)
		__SCALE_MAX = Num.infinity
		__IS_PIXEL_PERFECT = false
		__drawX = __drawY = 4
		__drawC = Color.white
	}

	static update_(w, h) {
		__SIZE_MAX.x = w
		__SIZE_MAX.y = h

		if (!__SIZE_IS_FIXED) {
			__SIZE.x = w
			__SIZE.y = h
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
		if (Input.held("F4")) quit()

		// Init print location.
		__drawX = __drawY = 4

		// Update modules.
		Loading.update_()

		if (__fn) __fn.call()
		ready_()
	}

	foreign static ready_()

	static quit() {
		quit_()
		Fiber.suspend()
	}

	foreign static quit_()
}

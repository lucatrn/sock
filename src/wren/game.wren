
class Game {
	foreign static title

	foreign static title=(s)

	static size { __size }

	static width { __size.x }
	
	static height { __size.y }

	static center { __size / 2 }

	static size=(v) {
		if (v == null) {
			if (__fixed) {
				__size.x = __screen.x
				__size.y = __screen.y
				__fixed = false
				layoutChanged_()
			}
		} else {
			if (!__fixed || __size != v) {
				__size.x = v.x.floor.clamp(1, 2048)
				__size.y = v.y.floor.clamp(1, 2048)
				__fixed = true
				layoutChanged_()
			}
		}
	}

	static width=(w) { size = Vec.new(w, __size.y) }

	static height=(h) { size = Vec.new(__size.x, h) }

	static isFixedSize { __fixed }

	static pixelPerfectScaling { __pp }

	static pixelPerfectScaling=(pp) {
		__pp = pp
		layoutChanged_()
	}

	static maxScale { __maxs }

	static maxScale=(maxs) {
		__maxs = maxs
		layoutChanged_()
	}

	foreign static scaleFilter

	foreign static scaleFilter=(value)

	foreign static fps

	foreign static fps=(fps)

	static layoutChanged_() {
		layoutChanged_(__size.x, __size.y, __fixed, __pp, __maxs)
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

	static init_(sx, sy) {
		__size = Vec.new(sx, sy)
		__screen = Vec.new(sx, sy)
		__fixed = false
		__maxs = Num.infinity
		__pp = false
		__drawX = __drawY = 4
		__drawC = Color.white
	}

	static update_(sx, sy) {
		__screen.x = sx
		__screen.y = sy

		if (!__fixed) {
			__size.x = sx
			__size.y = sy
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

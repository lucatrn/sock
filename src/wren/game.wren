
class Game {
	foreign static title

	foreign static title=(s)

	static size { __size }

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
				__size.x = v.x
				__size.y = v.y
				__fixed = true
				layoutChanged_()
			}
		}
	}

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

	static init_(sx, sy) {
		__size = Vector.new(sx, sy)
		__screen = Vector.new(sx, sy)
		__fixed = false
		__maxs = Num.infinity
		__pp = false
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
		if (fn is Fn) {
			if (fn.arity == 0) {
				__fn = fn
				ready_()
			} else {
				Fiber.abort("update function must have no arguments")
			}
		} else {
			Fiber.abort("update function is %(fn.type), should be a Fn")
		}
	}

	static update_() {
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

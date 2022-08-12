
//#define __INPUTS __i

class Input {
	static holdCutoff { __hc }

	static holdCutoff=(value) { __hc = value.clamp(0.001, 1) }

	static mouse { __ms }

	static mouseDelta { __msd }

	static mouseWheel { __mw }

	static updateMouse_(x, y, w) {
		if (__ms) {
			__msd.x = x - __ms.x
			__msd.y = y - __ms.y
			__ms.x = x
			__ms.y = y
		} else {
			__ms = Vec.new(x, y)
			__msd = Vec.zero
		}

		__mw = w
	}

	static touches { __ts }

	static touch(id) { __ts.find{|t| t.id == id } }

	static updateTouch_(i, d, f, x, y) {
		var t = touch(i)
		if (t) {
			t.update_(d, f, x, y)
		} else {
			__ts.add(TouchInput.new(i, f, x, y))
		}
	}

	static value(s) {
		var v = 0
		if (s is String) {
			var i = __INPUTS[s]
			if (i) v = i.value
		} else if (s is Sequence) {
			for (e in s) {
				var i = __INPUTS[e]
				if (i) v = i.value.max(v)
			}
		}
		return v
	}

	static value(neg, pos) {
		return value(pos) - value(neg)
	}

	static value(negX, posX, negY, posY) {
		return Vec.new(value(negX, posX), value(negY, posY))
	}

	static valuePressed(ids) {
		return pressed(ids) ? 1 : 0
	}

	static valuePressed(neg, pos) {
		var np = pressed(neg)
		var pp = pressed(pos)

		return np == pp ? 0 : (pp ? 1 : -1)
	}

	static valuePressed(negX, posX, negY, posY) {
		return Vec.new(valuePressed(negX, posX), valuePressed(negY, posY))
	}

	static held(s) {
		if (s is String) {
			var i = __INPUTS[s]
			if (i && i.held) return true
		} else if (s is Sequence) {
			for (e in s) {
				var i = __INPUTS[e]
				if (i && i.held) return true
			}
		}
		return false
	}
	
	static pressed(s) {
		var p = false
		if (s is String) {
			var i = __INPUTS[s]
			if (i) p = i.pressed
		} else if (s is Sequence) {
			// Atleast one pressed, plus none held but not pressed.
			for (e in s) {
				var i = __INPUTS[e]
				if (i && i.held) {
					if (!i.pressed) return false
					p = true
				}
			}
		}
		return p
	}
	
	// static pressed(ids, repeatDelay, repeatStartDelay) {
	// 	return inputs_(ids).any {|s| s && s.pressed(repeatDelay, repeatStartDelay) }
	// }

	static released(s) {
		var r = false
		if (s is String) {
			var i = __INPUTS[s]
			if (i) r = i.released
		} else if (s is Sequence) {
			// Atleast one released, plus none held.
			for (e in s) {
				var i = __INPUTS[e]
				if (i) {
					if (i.held) return false
					r = r || i.released
				}
			}
		}
		return r
	}

	static whichPressed {
		for (id in __INPUTS.keys) {
			if (__INPUTS[id].pressed) return id
		}
	}

	static anyPressed { whichPressed != null }

	foreign static localize(_)

	static update_(id, v) {
		var s = __INPUTS[id]
		if (s) {
			s.update_(v)
		} else {
			__INPUTS[id] = s = InputState.new(id, v)
		}

		// if (__f) __f.call(s)
	}

	// static setCallback(f) {
	// 	__f = f
	// }

	static textBegin() { textBegin(null) }

	foreign static textBegin(type)

	foreign static textDescription
	foreign static textDescription=(s)

	foreign static textString

	foreign static textIsActive

	foreign static textSelection

	// static update_(negID, posID, value) {
	// 	update_(negID, value < 0 ? -value : 0)
	// 	update_(posID, value > 0 ?  value : 0)
	// }

	static init_() {
		__INPUTS = {}
		__ts = []
		__hc = 0.5
	}

	static pupdate_() {
		__ts.removeWhere {|t| t.released }
	}
}

Input.init_()

class InputState {
	construct new(id, v) {
		// Input ID (for client API).
		_id = id
		// Value 0..1
		_v = v
		// Frame the value last moved across [Input.holdCutoff]
		_t = Time.frame
	}

	id { _id }

	value { _v }

	held { _v > Input.holdCutoff }

	pressed { _t == Time.frame && held }

	// pressed(repeatDelay, repeatStartDelay) {
	// 	if (held) {
	// 		var t = Time.frame - _t - repeatStartDelay
	// 		return t >= 0 && (t % repeatDelay) == 0
	// 	}
	// 	return false
	// }

	released { _t == Time.frame && !held }

	update_(v) {
		var h = held
		_v = v
		if (h != held) _t = Time.frame
	}
}

class TouchInput {
	construct new(i, f, x, y) {
		_i = i
		_d = true
		_f = f
		_c = Vec.new(x, y)
		_t = Time.frame
	}

	update_(d, f, x, y) {
		_f = f
		_c.x = x
		_c.y = y
		if (d != _d) {
			_d = d
			_t = Time.frame
		}
	}

	id { _i }
	force { _f }
	center { _c }
	held { _d }
	pressed { _t == Time.frame && _d }
	released { _t == Time.frame && !_d }
	x { _c.x }
	y { _c.y }
}

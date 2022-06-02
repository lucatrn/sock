
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

	static value(ids) {
		return inputs_(ids).reduce(0) {|v, s| s ? s.value.max(v) : v }
	}

	static value(neg, pos) {
		return value(neg) - value(pos)
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

	static held(ids) {
		return inputs_(ids).any {|s| s && s.held }
	}
	
	static pressed(ids) {
		return inputs_(ids).any {|s| s && s.pressed }
	}
	
	static pressed(ids, repeatDelay, repeatStartDelay) {
		return inputs_(ids).any {|s| s && s.pressed(repeatDelay, repeatStartDelay) }
	}

	static released(ids) {
		return inputs_(ids).any {|s| s && s.released }
	}

	static whichPressed {
		for (id in __inputs.keys) {
			if (__inputs[id].pressed) return id
		}
	}

	static anyPressed {
		return whichPressed != null
	}

	foreign static localize(_)

	static inputs_(ids) {
		if (ids is String) {
			// return [ __inputs[ids] ]
			return Sequence.of(__inputs[ids])
		} else if (ids is Sequence) {
			return ids.map {|id| __inputs[id] }
		} else {
			return Sequence.empty
		}
	}

	static update_(id, v) {
		var s = __inputs[id]
		if (s) {
			s.update_(v)
		} else {
			__inputs[id] = s = InputState.new(id, v)
		}

		if (__f) __f.call(s)
	}

	static setCallback(f) {
		__f = f
	}

	// static update_(negID, posID, value) {
	// 	update_(negID, value < 0 ? -value : 0)
	// 	update_(posID, value > 0 ?  value : 0)
	// }

	static init_() {
		__inputs = {}
		__hc = 0.5
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

	pressed(repeatDelay, repeatStartDelay) {
		if (held) {
			var t = Time.frame - _t - repeatStartDelay
			return t >= 0 && (t % repeatDelay) == 0
		}
		return false
	}

	released { _t == Time.frame && !held }

	update_(v) {
		var wasHeld = held
		_v = v
		if (wasHeld != held) _t = Time.frame
	}
}

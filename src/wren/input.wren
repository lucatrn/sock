
class Input {
	static holdCutoff { __holdCutoff }

	static holdCutoff=(value) { __holdCutoff = value.clamp(0.001, 1) }

	static mouse { Vec2.new(__mouseX, __mouseY) }

	static mouseDelta { Vec2.new(__mouseX - __mouseX0, __mouseY - __mouseY0) }

	static updateMouse_(x, y) {
		__mouseX0 = __mouseX
		__mouseY0 = __mouseY
		__mouseX = x
		__mouseY = y
	}

	static value(ids) {
		return inputs_(ids).reduce(0) {|acc, state| state ? state.value.max(acc) : acc }
	}

	static value(neg, pos) {
		return value(neg) - value(pos);
	}

	static value(negX, posX, negY, posY) {
		return Vec2.new(
			value(negX, posX),
			value(negY, posY),
		)
	}

	static valuePressed(ids) {
		return pressed(ids) ? 1 : 0
	}

	static valuePressed(neg, pos) {
		var np = pressed(neg);
		var pp = pressed(pos);

		return np == pp ? 0 : (pp ? 1 : -1);
	}

	static valuePressed(negX, posX, negY, posY) {
		return Vec2.new(
			valuePressed(negX, posX),
			valuePressed(negY, posY),
		)
	}

	static held(ids) {
		return inputs_(ids).some {|state| state && state.held }
	}
	
	static pressed(ids) {
		return inputs_(ids).some {|state| state && state.pressed }
	}
	
	static pressed(ids, repeatDelay, repeatStartDelay) {
		return inputs_(ids).some {|state| state && state.pressed(repeatDelay, repeatStartDelay) }
	}

	static released(ids) {
		return inputs_(ids).some {|state| state && state.released }
	}

	static whichPressed {
		for (id in __inputs.keys) {
			if (__inputs[id].pressed) return id
		}
	}

	static anyPressed {
		return whichPressed != null
	}

	static inputs_(ids) {
		if (ids is String) {
			return ValueSequence.new(__inputs[ids])
		} else if (ids is Sequence) {
			return ids.map {|id| __inputs[id] }
		} else {
			return ValueSequence.new()
		}
	}

	static update_(id, value) {
		var state = __inputs[id]
		if (state) {
			state.update(value)
		} else {
			__inputs[id] = InputState.new(value)
		}
	}

	static update_(negID, posID, value) {
		update_(negID, value < 0 ? -value : 0);
		update_(posID, value > 0 ?  value : 0);
	}

	static init_() {
		__inputs = {}
	}
}

class InputState {
	construct new(value) {
		// Value 0..1
		_value = value
		// Frame the value last moved across [Input.holdCutoff]
		_frame = 0
	}

	value { _value }

	held { _value > Input.holdCutoff }

	pressed { _frame == Time.frame && held }

	pressed(repeatDelay, repeatStartDelay) {
		if (held) {
			var t = Time.frame - _frame - repeatStartDelay
			return t >= 0 && (t % repeatDelay) == 0
		}
		return false
	}

	released { _frame == Time.frame && !held }

	update_(value) {
		var wasHeld = held
		_value = value
		if (wasHeld != held) _frame = Time.frame
	}
}

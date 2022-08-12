
class Time {
	foreign static epoch

	static frame { __f }
	static time { __t }
	static delta { __d }

	static update_(t, d) {
		__t = t
		__d = d
	}

	static init_() {
		__f = 0
	}

	static pupdate_() {
		__f = __f + 1
	}
}

class Timer {
	construct new(t, s, f) {
		if (!(f is Fn) || f.arity > 1) Fiber.abort("callback must be a Fn with 0 or 1 arity")
		_s = s
		_f = f
		time = t
	}

	static frames(t, f) { new(t, false, f) }
	
	static seconds(t, f) { new(t, true, f) }

	isDone { _t == 0 }

	time { _t }
	time=(t) {
		if (!(t is Num)) Fiber.abort("time must be a Num")
		if (t <= 0) Fiber.abort("time must be a positive")
		if (!_t || !__t.contains(this)) __t.add(this)
		_t = t
	}

	cancel() {
		_t = 0
		__t.remove(this)
	}

	pause() {
		__t.remove(this)
	}

	resume() {
		if (_t > 0 && !__t.contains(this)) __t.add(this)
	}

	update_() {
		_t = (_t - (_s ? Time.delta : 1)).max(0)
		return _t == 0
	}

	run_() {
		__t.remove(this)
		if (_f.arity == 1) {
			_f.call(this)
		} else {
			_f.call()
		}
	}

	static init_() {
		// The list of active timers.
		__t = []
	}

	static update_() {
		// This loop is kinda awkward because:
		// 1. We may need to remove timers from the list.
		// 2. When a timer finishes and is ran, its callback may add or remove
		//    timers from the list.
		// 3. We don't want to allocate a list in the case that it isn't used.
		var a
		for (t in __t) {
			if (t.update_()) {
				if (a) {
					a.add(t)
				} else {
					a = [ t ]
				}
			}
		}
		if (a) {
			for (t in a) {
				t.run_()
			}
		}
	}
}

Time.init_()
Timer.init_()

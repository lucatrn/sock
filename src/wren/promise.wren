
class Promise {
	construct new() {
		// Callback functions and fibers.
		_f = []
		// Promise state.
		// 0: pending
		// 1: resolved OK
		// 2: resolved error
		_s = 0
	}

	// Create a promise than contains a mapper function.
	construct new_(f) {
		_f = []
		_v = f
		_s = 0
	}

	construct resolve(v) {
		_v = v
		_s = 1
		_f = []
	}

	static await(a) { a is Promise ? a.await : a }

	isResolved { _s != 0 }
	isError { _s == 2 }
	value { _s == 1 ? _v : null }
	error { _s == 2 ? _v : null }

	then(f) {
		return _s == 0 ? _f.add(Promise.new_(f)) : Promise.resolve(f.call(_v))
	}

	resolve_(ok, v) {
		if (_s == 0) {
			_s = ok ? 1 : 2
			_v = _v ? _v.call(v) : v
		}

		while (!_f.isEmpty) {
			var f = _f[-1]
			if (f is Fiber) {
				_f.removeAt(-1)
				f.transfer(_v)
			}
			if (f is Promise) {
				f.resolve_(ok, v)
			} else {
				f.call(_v)
			}
			_f.removeAt(-1)
		}

		return true
	}

	await {
		if (_s == 0) {
			_f.add(Fiber.current)
			Fiber.suspend()
		}
		if (_s == 2) Fiber.abort(_v)
		return _v
	}
}

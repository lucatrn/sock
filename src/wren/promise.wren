
class Promise {
	construct new() {
		_f = []
		_s = 0
	}

	isResolved { _s != 0 }
	isError { _s == 2 }
	value { _s == 1 ? _v : null }
	error { _s == 2 ? _v : null }

	then(f) {
		_s == 0 ? _f.add(f) : f.call(_v)
	}

	resolve_(ok, v) {
		if (_s == 0) {
			_s = ok ? 1 : 2
			_v = v
		}

		while (!_f.isEmpty) {
			var f = _f.removeAt(-1)
			if (f is Fiber) {
				f.transfer()
			}
			f.call()
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

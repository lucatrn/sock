
class Value {
	construct async(a) {
		_a = a
	}
	
	construct async(a, f) {
		_a = a
		_f = f
	}

	value {
		if (_f) {
			_a[1] = _f.call(_a[1])
			_f = null
		}
		return _a[1]
	}
}

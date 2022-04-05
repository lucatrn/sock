
class ValueSequence is Sequence {
	construct new(item) {
		__item = item
		__done = false
	}

	construct new() {
		__done = true
	}

	iterate(iter) {
		if (__done) return true
		__done = true
		return false
	}

	iteratorValue(done) {
		return __item
	}
}


// Implementers must have following methods:
//   byteSize: number
//   bytesLoaded: number
//   load_(): void

class Asset {
	isLoaded { bytesLoaded >= byteSize }

	load() {
		if (!isLoaded && !__loading.contains(this)) {
			__loading.add(this)

			load_()
		}

		return this
	}

	unload {}

	static path { "%(Meta.module(1)).wren" }

	static path(p) { resolvePath(Meta.module(1), p) }

	foreign static resolvePath(curr, next)

	static anyLoading { !__loading.isEmpty && !allLoaded }

	static allLoaded { __loading.all {|asset| asset.isLoaded } }

	static totalBytesLoaded { __loading.reduce(0) {|n, a| n + a.bytesLoaded } }

	static totalByteSize { __loading.reduce(0) {|n, a| n + a.byteSize } }

	static totalLoadRatio {
		if (__loading.isEmpty) {
			return 1
		} else {
			var total = 0
			var loaded = 0
			for (a in __loading) {
				total = total + a.byteSize
				loaded = loaded + a.bytesLoaded
			}
			return loaded / total
		}
	}

	static update_() {
		if (__loading.count > 0 && allLoaded) {
			__loading.clear()
		}
	}

	static init_() {
		__loading = []
	}
}

Asset.init_()

class TransformedAsset is Asset {
	construct new(a, f) {
		_a = a
		_f = f
	}

	bytesLoaded { _a.bytesLoaded }
	byteSize { _a.byteSize }
	load_() { _a.load_() }

	value {
		if (_f) {
			if (!isLoaded) Fiber.abort("asset not loaded")
			_v = _f.call(_a)
			_f = null
		}
		return _v
	}
}

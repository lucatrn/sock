
// Abstract: implementers must have following methods:
//   loadProgress: number
//   size: number
//   load_(): void
//
//
// Implementers should also consider overiding the following methods:
//   unload(): void
class Asset {
	isLoaded { loadProgress >= size }

	loadRatio { loadProgress / size }

	load() {
		__loading.add(this)

		load_()

		return this
	}

	unload() {}

	static init_() {
		__loading = []
	}

	static anyLoading { !__loading.isEmpty && !allLoaded }

	static allLoaded { __loading.all {|asset| asset.isLoaded } }

	static totalLoadSize { __loading.reduce(0) {|total, asset| total + asset.size } }

	static totalLoadProgress { __loading.reduce(0) {|total, asset| total + asset.loadProgress } }

	static totalLoadRatio {
		if (__loading.isEmpty) {
			return 1
		} else {
			var total = 0
			var loaded = 0
			for (asset in __loading) {
				total = total + asset.size
				loaded = loaded + asset.loadProgress
			}
			return loaded / total
		}
	}

	static update_() {
		if (__loading.count > 0 && allLoaded) {
			__loading.clear()
		}
	}
}

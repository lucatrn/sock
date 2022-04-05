
class Asset {
	construct new(path) {
		_path = path
		_progress = 0
		Assets.add_(this)
	}

	path { _path }

	progress { _progress }

	progress_=(progress) { _progress = progress }

	loaded { _progress >= 1 }
}

class Assets {
	static load() {
		if (__queue) {
			Async.resolve(load_(__queue, __update, Fiber.current))
			__queue = null
		}
	}

	static load(update) {
		__update = update
		load()
	}

	foreign static load_(queue, fn, fiber)

	static add_(asset) {
		if (__queue) {
			__queue.add(asset)
		} else {
			__queue = [ asset ]
		}
	}
}

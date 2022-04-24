
//#define __LOADING __l
//#define __COMPLETED __c

// A loading item implements "[0]: number", where the number is [0..1].
// (0: unloaded, 1: fully loaded, can be fractional).
//
// This index format makes it easy to implement loadables in the embedder.
// The embedder holds a reference to a list and just sets the first item in it.

class Loading {
	static init_() {
		__LOADING = []
		__COMPLETED = false
	}

	static any { !__LOADING.isEmpty }

	static completed { __COMPLETED }
	
	static count { __LOADING.count {|a| a[0] < 1 } }

	static totalCount { __LOADING.count }
	
	static progress { __LOADING.isEmpty ? 1 : __LOADING.reduce(0) {|acc, a| acc + a[0] } / __LOADING.count }

	static add_(a) { __LOADING.add(a) }

	static addTask(f) { addTask(1, f) }

	static addTask(n, f) {
		__LOADING.add(LoadingTask.new(n, f))
	}

	static addSlow(t) {
		t = t.max(0.001)
		var s = System.clock
		addTask { (System.clock - s) / t }
	}

	static update_() {
		__COMPLETED = false

		if (__LOADING.count > 0) {
			// Update tasks.
			// Try to use only up to 75% of this frame on Task execution.
			var t = System.clock
			var dt = 0.75 / (Game.fps || 60)

			for (a in __LOADING) {
				if (a[0] < 0) Fiber.abort(a[1] || "error loading some asset")
				if (a is LoadingTask && a[0] < 1) {
					a.call()
					if (System.clock - t >= dt) break
				}
			}

			// Check if all loaded.
			if (__LOADING.all {|a| a[0] >= 1 }) {
				__LOADING.clear()
				__COMPLETED = true
			}
		}
	}
}

class LoadingTask {
	construct new(n, f) {
		if (!(n is Num && n.isInteger && n > 0)) Fiber.abort("invalid LoadingTask count")
		_n = n
		_f = f
		_i = 0
	}

	[n] { _p || _i / _n }

	call() {
		var p = _f.arity == 0 ? _f.call() : _f.call(_i)
		if (p is Num) _p = p.clamp(0, 1)
		_i = _i + 1
	}
}

Loading.init_()

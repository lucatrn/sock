
//#define _STATE _s
//#define __DEFAULT __d

foreign class Random {
	construct new() {
		seed(Time.epoch)
	}

	construct new(s) {
		seed(s)
	}

	foreign seed(n)

	foreign float()
	float(a) { float() * a }
	float(a, b) { a.lerp(b, float()) }

	foreign integer()
	integer(a) { (float() * a).floor }
	integer(a, b) { float(a, b).floor }

	bool() { integer() < 2147483648 }
	bool(a) { float() < a }

	color() { 0xff000000 + integer(0x1000000) }

	onCircle(x, y, r) {
		var a = float()
		return Vec.new(x + a.cos * r, y + a.sin * r)
	}
	
	inCircle(x, y, r) { onCircle(x, y, r * float().sqrt) }

	pick(a) {
		// Indexible implementation.
		return (a is List || a is String) ? (a.isEmpty ? null : a[integer(a.count)]) : pick_(a)
	}
	pick_(a) {
		// Generic iterable implementation.
		// Probablity of the nth item being chosen = 1/n.
		var r
		var i = 1
		for (b in a) {
			if (i == 1 || float(i) <= 1) r = b
			i = i + 1
		}
		return r
	}

	sample(a, n) {
		// The algorithm described in "Programming pearls: a sample of brilliance".
		// Use a hash map for sample sizes less than 1/4 of the population size and
		// an array of booleans for larger samples. This simple heuristic improves
		// performance for large sample sizes as well as reduces memory usage.
		var m = a.count
	    if (n > m) Fiber.abort("Not enough elements to sample")

		var r = []
		if (n * 4 < m) {
			var b = {}
			for (i in m - n...m) {
				var j = integer(i + 1)
				if (b.containsKey(j)) j = i
				b[j] = true
				r.add(a[j])
			}
		} else {
			var b = List.filled(m, false)
			for (i in m - n...m) {
				var j = integer(i + 1)
				if (b[j]) j = i
				b[j] = true
				r.add(a[j])
			}
		}
		return r
	}

	shuffle(a) {
		if (!a.isEmpty) {
			for (i in 0...a.count - 1) a.swap(i, integer(i, a.count))
		}
		return a
	}

	static default { __DEFAULT }
	static seed(a) { __DEFAULT.seed(a) }
	static float() { __DEFAULT.float() }
	static float(a) { __DEFAULT.float(a) }
	static float(a, b) { __DEFAULT.float(a, b) }
	static integer() { __DEFAULT.integer() }
	static integer(a) { __DEFAULT.integer(a) }
	static integer(a, b) { __DEFAULT.integer(a, b) }
	static bool() { __DEFAULT.bool() }
	static bool(a) { __DEFAULT.bool(a) }
	static color() { __DEFAULT.color() }
	static onCircle(x, y, r) { __DEFAULT.onCircle(x, y, r) }
	static inCircle(x, y, r) { __DEFAULT.inCircle(x, y, r) }
	static pick(a) { __DEFAULT.pick(a) }
	static sample(a, b) { __DEFAULT.sample(a, b) }
	static shuffle(a) { __DEFAULT.shuffle(a) }

	static init_() {
		__DEFAULT = Random.new()
	}
}

Random.init_()

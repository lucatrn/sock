
class Math {
	static cos(t) { (t * Num.tau).cos }

	static sin(t) { (t * Num.tau).sin }

	static tan(t) { (t * Num.tau).tan }

	static acos(n) { n.acos / Num.tau  }

	static asin(n) { n.asin / Num.tau  }
	
	static atan(n) { n.atan / Num.tau  }

	static atan(x, y) { y.atan(x) / Num.tau }

	static pulse(t) { wrap01(t) < 0.5 ? -1 : 1 }

	static triangle(t) { (wrap01(t + 0.75) * 4 - 2).abs - 1 }

	static lerp(a, b, t) { a + (b - a) * t.clamp(0, 1) }

	static ulerp(a, b, t) { a + (b - a) * t }

	static ilerp(a, b, value) { a == b ? (value < a ? 0 : 1) : ((value - a) / (b - a)).clamp(0, 1) }

	static remap(value, a1, b1, a2, b2) { ulerp(a2, b2, ilerp(a1, b1, x)) }

	static wrap01(n) { n - n.floor }

	static wrap(n, max) { n - (n / max).floor * max }

	static wrap(n, min, max) { min + wrap(n - min, max - min) }

	static smoothstep(t) {
		t = t.clamp(0, 1)
		return t * t * (3 - 2 * t)
	}
}

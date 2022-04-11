
foreign class Color {
	construct new() {}
	
	static new(r, g, b, a) {
		var c = Color.new()
		c.r = r
		c.g = g
		c.b = b
		c.a = a
		return c
	}

	static new(r, g, b) { new(r, g, b, 1) }

	static black { Color.new() }
	static black(a) { Color.new(0, 0, 0, a) }
	
	static white { Color.new(1, 1, 1) }
	static white(a) { Color.new(1, 1, 1, a) }

	static gray(n) { Color.new(n, n, n) }
	static gray(n, a) { Color.new(n, n, n, a) }

	static hsl(h, s, l) { hsl(h, s, l, 1) }

	static hsl(h, s, l, a) {
		s = s.clamp(0, 1)
		l = l.clamp(0, 1)

		if (s == 0) return Color.new(l, l, l, a)

		h = h - h.floor
		var q = l < 0.5 ? l * (1 + s) : l + s - l * s
		var p = 2 * l - q
		
		return Color.new(
			r = hsl_(p, q, h + 0.3333),
			g = hsl_(p, q, h),
			b = hsl_(p, q, h - 0.3333),
			a
		)
	}

	static hsl_(p, q, t) {
		t = t < 0 ? t + 1 : (t > 1 ? t - 1 : t)
		if (t < 0.1667) return p + (q - p) * 6 * t
		if (t < 0.5) return q
		if (t < 0.6667) return p + (q - p) * (0.6667 - t) * 6
		return p
	}

	foreign r
	foreign g
	foreign b
	foreign a

	foreign r=(r)
	foreign g=(g)
	foreign b=(b)
	foreign a=(a)

	foreign uint32
	foreign uint32=(n)

	foreign toString

	luma { r * 0.2126 + g * 0.7152 + b * 0.0722 }

	* (k) { Color.new((r * k).clamp(0, 1), (g * k).clamp(0, 1), (r * k).clamp(0, 1), a) }

	lerp(c) {
		t = t.clamp(0, 1)
		return Color.new(
			r + (c.r - r) * t,
			g + (c.g - g) * t,
			b + (c.b - b) * t,
			a + (c.a - a) * t
		)
	}

	toJSON { uint32 }

	static fromJSON(n) {
		if (!(n is Num)) return null
		var c = Color.new()
		c.uint32 = n
		return c
	}
}

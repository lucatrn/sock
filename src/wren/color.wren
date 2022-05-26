
foreign class Color {
	construct new() {}
	
	static new(r, g, b, a) {
		var c = new()
		c.r = r
		c.g = g
		c.b = b
		c.a = a
		return c
	}

	static new(r, g, b) { new(r, g, b, 1) }

	static black { new() }
	static black(a) { gray(0, a) }
	
	static white { gray(1) }
	static white(a) { gray(1, a) }

	static gray { gray(0.5) }
	static gray(n) { new(n, n, n, 1) }
	static gray(n, a) { new(n, n, n, a) }

	static red { new(1, 0, 0) }
	static green { new(0, 1, 0) }
	static blue { new(0, 0, 1) }

	static yellow { new(1, 1, 0) }
	static cyan { new(0, 1, 1) }
	static magenta { new(1, 0, 1) }

	static hsl(h, s, l) { hsl(h, s, l, 1) }

	foreign static hsl(h, s, l, a)

	static hex(n) {
		var c = new()
		c.uint32 = 0xff000000 | ((n & 0xff0000) >> 16) | (n & 0xff00) | ((n & 0xff) << 16)
		return c
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

	== (c) { c is Color && uint32 == c.uint32 }

	* (k) { Color.new((r * k).clamp(0, 1), (g * k).clamp(0, 1), (r * k).clamp(0, 1), a) }

	lerp(c, t) {
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

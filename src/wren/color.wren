
class Color {
	static rgb(r, g, b) { rgb(r, g, b, 1) }
	foreign static rgb(r, g, b, a)

	static hsl(h, s, l) { hsl(h, s, l, 1) }
	foreign static hsl(h, s, l, a)

	static black { #000 }
	static black(a) { gray(0, a) }
	
	static white { #fff }
	static white(a) { gray(1, a) }

	static gray { #808080 }
	static gray(n) { rgb(n, n, n, 1) }
	static gray(n, a) { rgb(n, n, n, a) }

	static red { #f00 }
	static green { #0f0 }
	static blue { #00f }
	static yellow { #ff0 }
	static cyan { #0ff }
	static magenta { #f0f }

	foreign static toHexString(c)

	static luma(c) { (c.red * 0.2126 + c.green * 0.7152 + c.blue * 0.0722) / 255 }
}

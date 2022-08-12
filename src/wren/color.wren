
class Color {
	static rgb(r, g, b) { rgb(r, g, b, 1) }
	foreign static rgb(r, g, b, a)

	static hsl(h, s, l) { hsl(h, s, l, 1) }
	foreign static hsl(h, s, l, a)
	
	static gray(n) { rgb(n, n, n, 1) }
	static gray(n, a) { rgb(n, n, n, a) }

	foreign static toHexString(c)

	static luma(c) { (c.red * 0.2126 + c.green * 0.7152 + c.blue * 0.0722) / 255 }
}

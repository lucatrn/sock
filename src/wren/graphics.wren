
class Graphics {
	foreign static clear(r, g, b)

	static clear(c) { clear(c.r, c.g, c.b) }

	static clear() { color(0, 0, 0) }
}

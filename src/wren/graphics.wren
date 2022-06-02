
class Graphics {
	foreign static clear(r, g, b)

	static clear(c) { clear(c.red / 255, c.green / 255, c.blue / 255) }

	static clear() { color(0, 0, 0) }
}

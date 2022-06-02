
class Quad {
	foreign static beginBatch()
	foreign static endBatch()
	foreign static draw(x, y, w, h, c)
	foreign static draw(x1, y1, x2, y2, x3, y3, x4, y4, c)

	static drawLine(x1, y1, x2, y2, w, c) {
		var x = x2 - x1
		var y = y2 - y1
		var n = (x*x + y*y).sqrt
		if (n == 0) {
			draw(x1 - w/2, y1 - w/2, w, w, c)
		} else {
			x = (x / n) * w * 0.5
			y = (y / n) * w * 0.5
			draw(x1 + y - x, y1 - x - y, x1 - y - x, y1 + x - y, x2 + y + x, y2 - x + y, x2 - y + x, y2 + x + y, c)
		}
	}
}

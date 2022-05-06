
class Window {
	static topLeft { Vec.of(topLeft_) }

	static topleft=(a) {
		setTopLeft(a.x, a.y)
	}

	static size { Vec.of(size_) }

	static size=(a) {
		setSize(a.x, a.y)
	}

	static width { size_[0] }
	static height { size_[1] }

	foreign static size_
	foreign static setSize(w, h)
	foreign static topLeft_
	foreign static setTopLeft(x, y)
	foreign static resizable
	foreign static resizable=(b)
}

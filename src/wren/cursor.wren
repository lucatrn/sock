
class Cursor {
	static hidden { __hidden }

	static hidden=(h) {
		if (h != __hidden) {
			setHidden_(__hidden = h)
		}
	}

	foreign static setHidden_(h)

	static init_() {
		__hidden = false
	}
}

Cursor.init_()


class Cursor {
	static hidden { __hidden }

	static hidden=(hidden) {
		if (hidden != __hidden) {
			setHidden_(__hidden = hidden)
		}
	}

	foreign static setHidden_(hidden)

	static init_() {
		__hidden = false
	}
}

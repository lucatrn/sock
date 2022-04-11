
foreign class StringBuilder {
	construct new() {}

	add(a) {
		add_(a.toString)
		return this
	}

	foreign add_(a)

	addByte(b) {
		addByte_(b)
		return this
	}

	foreign addByte_(b)

	clear() {
		clear_()
		return this
	}

	foreign clear_()

	foreign toString
}

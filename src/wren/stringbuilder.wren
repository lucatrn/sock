
foreign class StringBuilder {
	construct new() {}

	add(a) { addString(a.toString) }

	foreign addString(a)

	foreign addByte(b)

	foreign clear()

	foreign toString
}

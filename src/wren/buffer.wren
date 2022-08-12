
foreign class Buffer {
	construct new(n) {}

	static fromString(s) {
		var b = Buffer.new(s.byteCount)
		b.setFromString(s)
		return b
	}

	static fromBytes(a) {
		var b = new(a.count)
		var i = 0
		for (c in a) {
			b.setByteAt(i, c)
			i = i + 1
		}
		return b
	}

	//#if WEB

		static load(p) { load_(p, Promise.new()).await }

		foreign static load_(path, promise)

	//#else

		foreign static load(path)

	//#endif

	foreign static fromBase64(s)

	foreign byteCount
	foreign setFromString(s)
	foreign toString
	foreign asString
	foreign toBase64

	foreign resize(n)

	foreign byteAt(i)
	foreign setByteAt(i, b)
	foreign fillBytes(b)
	foreign iterateByte_(it)
	bytes { ByteSequence.new(this) }
	
	// foreign getDouble(i)
	// foreign setDouble(i, b)
	// foreign fillDoubles(b)

	toJSON { toBase64 }
	static fromJSON(a) { a is String ? fromBase64(a) : null }
}

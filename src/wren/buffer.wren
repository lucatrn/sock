
foreign class Buffer is Sequence {
	construct new(n) {}

	static fromString(s) {
		var b = Buffer.new(s.byteCount)
		b.setFromString(s)
		return b
	}

	static fromUint8(a) {
		var b = new(a.count)
		var i = 0
		for (c in a) {
			b.setUint8(i, c)
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

	foreign count

	foreign resize(n)

	foreign getUint8(i)
	foreign setUint8(i, b)
	foreign fillUint8(b)

// 	foreign getInt16(i)
// 	foreign setInt16(i, b)
// 	foreign fillInt16(i, b)
// 	
// 	foreign getUint16(i)
// 	foreign setUint16(i, b)
// 	foreign fillUint16(i, b)
// 	
// 	foreign getInt32(i)
// 	foreign setInt32(i, b)
// 	foreign fillInt32(i, b)
// 
// 	foreign getUint32(i)
// 	foreign setUIint32(i, b)
// 	foreign fillUIint32(i, b)
// 
// 	foreign getFloat32(i)
// 	foreign setFloat32(i, b)
// 	foreign fillFloat32(i, b)
// 
// 	foreign getFloat64(i)
// 	foreign setFloat64(i, b)
// 	foreign fillFloat64(i, b)

	foreign toString

	foreign asString

	foreign toBase64

	foreign setFromString(s)

	iterate(i) {
		i = i ? i + 1 : 0
		return i < count ? i : false
	}

	iteratorValue(i) { getUint8(i) }

	toJSON { toBase64 }

	static fromJSON(a) { a is String ? fromBase64(a) : null }

}

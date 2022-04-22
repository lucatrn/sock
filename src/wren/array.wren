
foreign class Array is Sequence {
	construct new(n) {}

	static fromString(s) {
		var a = Array.new(s.byteCount)
		a.copyFromString(s, 0)
		return a
	}

	static fromBytes(a) {
		var b = new(a.count)
		var i = 0
		for (c in a) {
			b.setByte(i, c)
			i = i + 1
		}
		return b
	}

	foreign static fromBase64(s)

	foreign count

	foreign getByte(i)
	foreign setByte(i, b)
	foreign fillBytes(b)

// 	foreign int16(i)
// 	foreign int16(i, b)
// 	
// 	foreign uint16(i)
// 	foreign uint16(i, b)
// 	
// 	foreign int32(i)
// 	foreign int32(i, b)
// 
// 	foreign uint32(i)
// 	foreign uint32(i, b)
// 
// 	foreign float32(i)
// 	foreign float32(i, b)
// 
// 	foreign float64(i)
// 	foreign float64(i, b)

	foreign toString

	foreign copyFromString(s, i)

	iterate(i) {
		i = i ? i + 1 : 0
		return i < count ? i : false
	}

	iteratorValue(i) { getByte(i) }

	toJSON { toList }

	static fromJSON(a) { a is List ? fromBytes(a) : null }

	[i] { getByte(i) }

	[i]=(b) { setByte(i, b) }

}


foreign class Array is Sequence {
	construct new(n) {}

	static fromString(s) {
		var a = Array.new(s.bytes.count)
		a.copyFromString(s, 0)
		return a
	}

	foreign count

	foreign uint8(i)
	foreign uint8(i, b)

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

	foreign copyFromString(s, i)

	iterate(i) {
		i = i ? i + 1 : 0
		return i < count ? i : false
	}

	iteratorValue(i) { uint8(i) }

	[i] { uint8(i) }

	[i]=(b) { uint8(i, b) }
}

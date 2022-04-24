
foreign class Array is Sequence {
	construct new(n) {}

	static load(p) {
		p = Asset.path(Meta.module(1), p)
		var a = Loading.add_([0, null])
		Asset.loadString_(a, p)
		return Value.async(a) {|s| fromString(s) }
	}

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

// 	foreign getInt16(i)
// 	foreign setInt16(i, b)
// 	foreign fillInt16(i, b)
// 	
// 	foreign getUInt16(i)
// 	foreign setUInt16(i, b)
// 	foreign fillUInt16(i, b)
// 	
// 	foreign getInt32(i)
// 	foreign setInt32(i, b)
// 	foreign fillInt32(i, b)
// 
// 	foreign getUInt32(i)
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

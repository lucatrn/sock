
foreign class Array is Sequence {
	construct new(n) {}

	static new() { new(0) }

	static fromString(s) {
		var a = Array.new(s.byteCount)
		a.setFromString(s)
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

	static load(p) {
		p = Asset.path(Meta.module(1), p)
		var a = new()
		Loading.add_(a.load_(p))
		return a
	}

	foreign static fromBase64(s)

	foreign count

	foreign resize(n)

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

	foreign asString

	foreign toBase64

	foreign setFromString(s)

	foreign load_(path)

	iterate(i) {
		i = i ? i + 1 : 0
		return i < count ? i : false
	}

	iteratorValue(i) { getByte(i) }

	toJSON { toBase64 }

	static fromJSON(a) { (a is String ? fromBase64(a) : (a is List ? fromBytes(a) : null)) }

	[i] { getByte(i) }

	[i]=(b) { setByte(i, b) }

}

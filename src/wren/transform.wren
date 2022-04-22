
class Transform {
	construct new(n0, n1, n2, n3) {
		_0 = n0
		_1 = n1
		_2 = n2
		_3 = n3
		_4 = 0
		_5 = 0
	}
	
	construct new(n0, n1, n2, n3, n4, n5) {
		_0 = n0
		_1 = n1
		_2 = n2
		_3 = n3
		_4 = n4
		_5 = n5
	}

	[n] {
		if (n == 0) return _0
		if (n == 1) return _1
		if (n == 2) return _2
		if (n == 3) return _3
		if (n == 4) return _4
		if (n == 5) return _5
	}

	transform(v) { Vec.new() }

	toString { toJSON.toString }

	toJSON { [ _0, _1, _2, _3, _4, _5 ] }

	static fromJSON(a) { (a is List && a.count == 6) ? new(a[0], a[1], a[2], a[3], a[4], a[5]) : null }

	static rotate(a) {
		var c = a.cos
		var s = a.sin
		return new(c, s, -s, c) 
	}
}


class Transform {
	construct new() {
		_0 = 1
		_1 = 0
		_2 = 0
		_3 = 1
		_4 = 0
		_5 = 0
	}

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

	[n] { n < 3 ? (n < 1 ? _0 : (n < 2 ? _1 : _2)) : (n < 4 ? _3 : (n < 5 ? _4 : _5)) }

	* (a) { a is Vec ? Vec.new( _0 * v.x + _2 * v.y + _4, _1 * v.x + _3 * v.y + _5 ) : Transform.mul_(this, a) }

	then(a) { Transform.mul_(a, this) }

	static mul_(a, b) {
		var a0 = a[0]
		var a1 = a[1]
		var a2 = a[2]
		var a3 = a[3]
		var a4 = a[4]
		var a5 = a[5]

		var b0 = b[0]
		var b1 = b[1]
		var b2 = b[2]
		var b3 = b[3]
		var b4 = b[4]
		var b5 = b[5]

		return new( a0*b0+a2*b1 , a1*b0+a3*b1 , a0*b2+a2*b3 , a1*b2+a3*b3 , a0*b4+a2*b5+a4 , a1*b3+a3*b5+a5 )
	}

	toString { toJSON.toString }

	toJSON { [ _0, _1, _2, _3, _4, _5 ] }

	static fromJSON(a) { (a is List && a.count == 6) ? new(a[0], a[1], a[2], a[3], a[4], a[5]) : null }

	static translate(x, y) { new(1, 0, 0, 1, x, y) }

	static scale(a) { scale(a, a) }

	static scale(x, y) { new(x, 0, 0, y) }

	static rotate(a) {
		var c = a.cos
		var s = a.sin
		return new(c, s, -s, c) 
	}
}

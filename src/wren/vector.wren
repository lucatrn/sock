
class Vec {
	construct new(x, y) {
		_x = x
		_y = y
	}

	construct of(a) {
		if (a is List) {
			_x = a[0]
			_y = a[1]
		} else {
			_x = _y = 0
		}
	}

	static zero { new(0, 0) }

	x { _x }
	y { _y }

	x=(x) { _x = x }
	y=(y) { _y = y }

	rotation { _x.atan(_y) }

	rotation=(a) {
		var n = length
		_x = a.cos * n
		_y = a.sin * n
	}

	rotate(a) {
		var c = a.cos
		var s = a.sin
		return Vec.new(_x*c - _y*s, _x*s + _y*c)
	}

	floor { Vec.new(_x.floor, _y.floor) }
	
	ceil { Vec.new(_x.ceil, _y.ceil) }

	round { Vec.new(_x.round, _y.round) }

	isZero { _x == 0 && _y == 0 }

	length { (_x*_x + _y*_y).sqrt }

	length=(t) {
		var n = length
		if (n > 0) {
			n = t / n
			_x = _x * n
			_y = _y * n
		}
	}

	normalize {
		var n = length
		return n > 0 ? Vec.new(_x / n, _y / n) : Vec.zero
	}

	normalize(min, max) {
		var len = length
		if (len <= min) return Vec.zero
		len = ((len - min) / (max - min)).min(1) / len
		return Vec.new(_x * len, _y * len)
	}

	- { Vec.new(-_x, -_y) }
	+ (v) { Vec.new(_x + v.x, _y + v.y) }
	- (v) { Vec.new(_x - v.x, _y - v.y) }
	* (k) { Vec.new(_x * k, _y * k) }
	/ (k) { Vec.new(_x / k, _y / k) }
	== (v) { v is Vec && _x == v.x && _y == v.y }

	dot(v) { _x*v.x + _y*v.y }

	distance(v) {
		var x = _x - v.x
		var y = _y - v.y
		return (x*x + y*y).sqrt
	}

	lerp(v, t) { Vec.new(_x + (v.x - _x) * t, _y + (v.y - _y) * t) }

	moveToward(v, d) {
		var x = v.x - _x
		var y = v.y - _y
		var n = (x*x + y*y).sqrt
		if (n <= d || n == 0) return Vec.new(v.x, v.y)
		d = d / n
		return Vec.new(_x + x * d, _y + y * d)
	}

	project(v) { v * (dot(v) / v.dot(v)) }

	toString { "(%(_x), %(_y))" }

	toJSON { [ _x, _y ] }

	static fromJSON(a) {
		if (a is List && a.count == 2) {
			var x = a[0]
			var y = a[1]
			if (x is Num && y is Num) return new(x, y)
		}
		return zero
	}
}

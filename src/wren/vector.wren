
class Vec {
	construct new() {
		_x = 0
		_y = 0
	}
	
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

	x { _x }
	y { _y }

	x=(x) { _x = x }
	y=(y) { _y = y }

	floor { new(_x.floor, _y.floor) }
	
	ceil { new(_x.ceil, _y.ceil) }

	round { new(_x.round, _y.round) }

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
		return n > 0 ? Vec.new(_x / n, _y / n) : Vec.new()
	}

	normalize(min, max) {
		var len = length
		if (len <= min) return Vec.new()
		len = ((len - min) / (max - min)).min(1) / len
		return Vec.new(_x * len, _y * len)
	}

	- { Vec.new(-_x, -_y) }
	+ (v) { Vec.new(_x + v.x, _y + v.y ) }
	- (v) { Vec.new(_x - v.x, _y - v.y ) }
	* (a) { a is Num ? Vec.new(_x * a, _y * a) : dot(a) }
	/ (k) { Vec.new(_x / k, _y / k ) }
	== (v) { v is Vec && _x == v.x && _y == v.y }

	dot(v) { _x*v.x + _y*v.y }

	distance(v) {
		var dx = _x - v.x
		var dy = _y - v.y
		return (dx*dx + dy*dy).sqrt
	}

	lerp(v, t) { 
		t = t.clamp(0, 1)
		return new(_x + (v.x - _x) * t, _y + (v.y - _y) * t)
	}

	toString { "(%(_x), %(_y))" }

	toJSON { [ _x, _y ] }

	static fromJSON(a) { (a is List && a.count >= 2) ? new(a[0], a[1]) : new() }
}

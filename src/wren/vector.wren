
class Vector {
	construct new() {
		_x = 0
		_y = 0
	}
	
	construct new(x, y) {
		_x = x
		_y = y
	}

	x { _x }
	y { _y }

	x=(x) { _x = x }
	y=(y) { _y = y }

	floor { Vector.new(_x.floor, _y.floor) }
	
	ceil { Vector.new(_x.ceil, _y.ceil) }

	round { Vector.new(_x.round, _y.round) }

	length { (_x*_x + _y*_y).sqrt }

	length=(targetLength) {
		var len = length
		if (len > 0) {
			len = targetLength / len
			_x = _x * len
			_y = _y * len
		}
	}

	normalize() {
		var len = length
		if (len > 0) {
			_x = _x / len
			_y = _y / len
		}
	}

	normalizeRange(min, max) {
		var len = length
		if (len <= min) return Vector.new()
		len = ((len - min) / (max - min)).min(1) / len
		return Vector.new(_x * len, _y * len)
	}

	- { Vector.new(-_x, -_y) }
	+ (v) { Vector.new(_x + v.x, _y + v.y ) }
	- (v) { Vector.new(_x - v.x, _y - v.y ) }
	* (k) { Vector.new(_x * k, _y * k ) }
	/ (k) { Vector.new(_x / k, _y / k ) }
	== (v) { v is Vector && _x == v.x && _y == v.y }

	dot(v) { _x*v.x + _y*v.y }

	distance(v) {
		var dx = _x - v.x
		var dy = _y - v.y
		return (dx*dx + dy*dy).sqrt
	}

	lerp(v, t) { 
		t = t.clamp(0, 1)
		return Vector.new(_x + (v.x - _x) * t, _y + (v.y - _y) * t)
	}

	toString { "(%(_y), %(_x))" }
}

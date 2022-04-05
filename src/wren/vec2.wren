
class Vec2 {
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

	floor { Vec2.new(_x.floor, _y.floor) }
	
	ceil { Vec2.new(_x.ceil, _y.ceil) }

	round { Vec2.new(_x.round, _y.round) }

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
		if (len <= min) return Vec2.new();
		len = ((len - min) / (max - min)).min(1) / len
		return Vec2.new(_x * len, _y * len)
	}

	- { Vec2.new(-_x, -_y) }
	+ (v) { Vec2.new(_x + v.x, _y + v.y ) }
	- (v) { Vec2.new(_x - v.x, _y - v.y ) }
	* (k) { Vec2.new(_x * k, _y * k ) }
	/ (k) { Vec2.new(_x / k, _y / k ) }

	dot(v) { _x*v.x + _y*v.y }

	distance(v) {
		var dx = _x - v.x
		var dy = _y - v.y
		return (dx*dx + dy*dy).sqrt
	}

	lerp(v, t) { 
		t = t.clamp(0, 1)
		return Vec2.new(_x + (v.x - _x) * t, _y + (v.y - _y) * t)
	}

	toString { "(%(_y), %(_x))" }
}

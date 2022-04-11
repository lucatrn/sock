
class JSON {

	// === PARSING ===

	static fromString(s) {
		var p = JSON.new_(s)
		p.s()
		return p.m ? p.value() : null
	}

	construct new_(s) {
		_b = s.bytes
		_i = 0
		_n = _b.count
	}

	// Returns true if have more bytes to read.
	m { _i < _n }

	// Abort if have no more bytes to read.
	f() {
		if (_i >= _n) Fiber.abort("unexpected end of JSON")
	}

	// Skip and abort if have no more bytes to read.
	g() {
		s()
		f()
	}

	// Skip whitespace and comments.
	s() {
		while (m) {
			var c = _b[_i]
			if (c == 32 || c == 9 || c == 10 || c == 13) {
				_i = _i + 1
			} else if (c == 47 && _i + 1 < _n && _b[_i + 1]) {
				_i = _i + 2

				while (m) {
					c = _b[_i]
					_i = _i + 1
					if (c == 10 || c == 13) {
						break
					}
				}
			} else {
				break
			}
		}
	}

	// Parse out JSON value at current position.
	value() {
		var c = _b[_i]

		if (c == 34) return string()

		// Array.
		if (c == 91) {
			_i = _i + 1
			g()

			var l = []

			if (_b[_i] == 93) {
				_i = _i + 1
			} else {
				while (true) {
					// Get value and add to list.
					l.add(value())
					g()

					// Check for comma.
					var a
					if (_b[_i] == 44) {
						a = true
						_i = _i + 1
						g()
					}

					// Check for closing ']'.
					if (_b[_i] == 93) {
						_i = _i + 1
						break
					}

					if (!a) Fiber.abort("expect ',' or ']' after array value")
				}

				// Handle custom deserialization.
				if (l.count == 2) {
					var k = l[0]
					if (k is String && k.count > 1 && k[0] == "»") {
						var C = __m[k[1..-1]]
						if (C) return C.fromJSON(l[1])
					}
				}
			}

			return l
		}

		// Object.
		if (c == 123) {
			_i = _i + 1
			g()

			var l = {}

			if (_b[_i] == 125) {
				_i = _i + 1
			} else {
				while (true) {
					if (_b[_i] != 34) Fiber.abort("expected string for object key")
					var k = string()
					g()

					// Read ':'.
					if (_b[_i] != 58) Fiber.abort("expected ':' after object key")
					g()

					// Get value and save to map.
					l[k] = value()
					g()

					// Check for comma.
					var a 
					if (_b[_i] == 44) {
						a = true
						_i = _i + 1
						g()
					}

					// Check for closing '}'.
					if (_b[_i] == 125) {
						_i = _i + 1
						break
					}

					if (!a) Fiber.abort("expect ',' or '}' after object value")
				}
			}

			return l
		}

		// Number
		if ((c >= 48 && c <= 57) || c == 45) {
			// Get sign by optional '-' at start.
			var s = 1

			if (c == 45) {
				s = -1
				_i = _i + 1
				f()
				c = _b[_i]
			}

			
			// Integer digits.
			var d = 0
			_i = _i + 1
			
			if (c == 48) {
				// '0'
			} else if (c > 48 && c <= 57) {
				d = c - 48

				while (_i < _n) {
					c = _b[_i]
					if (c >= 48 && c <= 57) {
						d = d * 10 + c - 48
						_i = _i + 1
					} else {
						break
					}
				}
			} else {
				Fiber.abort("invalid symbol in digit")
			}

			// Decimal digis.
			if (_i < _n && _b[_i] == 46) {
				_i = _i + 1
				f()
				c = _b[_i]

				if (c >= 48 && c <= 57) {
					var a = c - 48
					var b = 10
					_i = _i + 1

					while (_i < _n) {
						c = _b[_i]
						if (c >= 48 && c <= 57) {
							a = a * 10 + c - 48
							b = b * 10
							_i = _i + 1
						} else {
							break
						}
					}

					d = d + a/b
				} else {
					Fiber.abort("expected digit after '.' in number")
				}
			}

			// Exponent.
			if (_i < _n && (_b[_i] == 69 || _b[_i] == 101)) {
				_i = _i + 1
				f()

				// Optional '-' or '+'.
				var p = true
				c = _b[_i]
				if (c == 43 || c == 45) {
					if (c == 45) p = false
					_i = _i + 1
					f()
				}
				
				if (c >= 48 && c <= 57) {
					var e = c - 48
					_i = _i + 1

					while (_i < _n) {
						c = _b[_i]
						if (c >= 48 && c <= 57) {
							e = e * 10 + c - 48
							_i = _i + 1
						} else {
							break
						}
					}

					e = 10.pow(e)

					d = p ? d * e : d / e
				} else {
					Fiber.abort("expected digit after exponent in number")
				}
			}

			return d * s
		}

		// Literals
		if (lit("null")) return null
		if (lit("true")) return true
		if (lit("false")) return false

		Fiber.abort("invalid value")
	}

	// If we match against the given string literal, skip to end and return true.
	lit(s) {
		s = s.bytes
		if (_i + s.count > _n) return false
		var i = _i
		for (c in s) {
			if (c != _b[i]) return false
			i = i + 1
		}
		_i = _i + s.count
		return true
	}

	// Read a string as a Wren string.
	string() {
		// Starting '"'
		_i = _i + 1

		// Init string builder.
		var s = _s ? _s.clear() : (_s = StringBuilder.new())

		while (true) {
			f()
			var c = _b[_i]
			_i = _i + 1

			// Closing '"'.
			if (c == 34) break
			
			// Escape with '/'.
			if (c == 92) {
				f()
				c = _b[_i]
				_i = _i + 1

				if (c == 98) {
					c = 8
				} else if (c == 102) {
					c = 12
				} else if (c == 110) {
					c = 10
				} else if (c == 114) {
					c = 13
				} else if (c == 116) {
					c = 9
				}
			}

			s.addByte(c)
		}

		return s.toString
	}


	// === STRINGIFICATION ===

	static toString(x) {
		var s = StringBuilder.new()
		toString_(s, x)
		return s.toString
	}

	static toString_(sb, x) {
		if (x is Null || x is Num || x is Bool) {
			sb.add(x)
		} else if (x is String || x is Fn || x is Class) {
			addString_(sb, x)
		} else if (x is List) {
			sb.addByte(91)

			var first = true
			for (y in x) {
				if (first) {
					first = false
				} else {
					sb.addByte(44)
				}

				toString_(sb, y)
			}

			sb.addByte(93)
		} else if (x is Map) {
			sb.addByte(123)

			var first = true
			for (e in x) {
				if (first) {
					first = false
				} else {
					sb.addByte(44)
				}

				addString_(sb, e.key)

				sb.addByte(58)

				toString_(sb, e.value)
			}

			sb.addByte(125)
		} else if (__m.containsKey(x.type)) {
			sb.add("[\"»")
			sb.add(x.type)
			sb.add("\",")
			toString_(sb, x.toJSON)
			sb.addByte(93)
		} else {
			sb.add("null")
		}
	}

	static addString_(sb, s) {
		s = s.toString

		sb.addByte(34)

		for (b in s.bytes) {
			if (b == 8) {
				sb.add("\\b")
			} else if (b == 9) {
				sb.add("\\t")
			} else if (b == 10) {
				sb.add("\\n")
			} else if (b == 12) {
				sb.add("\\f")
			} else if (b == 13) {
				sb.add("\\r")
			} else {
				if (b == 34 || b == 92) {
					sb.addByte(92)
				}
				sb.addByte(b)
			}
		}
		
		sb.addByte(34)
	}

	static register(cls) {
		__m[cls] = true
		__m[cls.name] = cls
	}

	static init_() {
		__m = {}
	}
}

JSON.init_()

JSON.register(Vector)
JSON.register(Color)

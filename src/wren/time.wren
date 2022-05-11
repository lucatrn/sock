
class Time {
	static frame { __f }

	static tick { __t }

	static time { __s }

	static update_(f, t, s) {
		__f = f
		__t = t
		__s = s
	}
}

Time.update_(0, 0, 0)


class Time {
	static frame { __f }

	static time { __t }

	static update_(f, t) {
		__f = f
		__t = t
	}
}

Time.update_(0, 0)


class Time {
	static frame { __f }
	static time { __t }
	static delta { __d }

	static update_(t, d) {
		__t = t
		__d = d
	}

	static init_() {
		__f = 0
	}

	static pupdate_() {
		__f = __f + 1
	}
}

Time.init_()

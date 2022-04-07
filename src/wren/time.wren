
class Time {
	static frame { __f }

	static time { __t }

	static update_(frame, t) {
		__f = frame
		__t = t
	}
}

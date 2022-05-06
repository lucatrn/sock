
class Screen {
	static size { Vec.of(sz_) }
	static width { sz_[0] }
	static height { sz_[1] }

	static maxWindowSize { Vec.of(sza_) }
	static maxWindowWidth { sza_[0] }
	static maxWindowHeight { sza_[1] }

	foreign static sz_
	foreign static sza_
}


//#if DESKTOP

	class Window_ {

		foreign static left
		foreign static top
		static left=(x) { setPosition(x, top) }
		static top=(y) { setPosition(left, y) }
		foreign static setPosition(x, y)
		
		foreign static center()

		foreign static width
		foreign static height
		static width=(w) { setSize_(w, height) }
		static height=(h) { setSize_(width, h) }
		foreign static setSize(w, h)

		foreign static resizable
		foreign static resizable=(b)

	}

//#endif

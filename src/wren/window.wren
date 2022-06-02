
class Window {

	//#if DESKTOP

		foreign static left
		foreign static top
		static left=(x) { setPos_(x, top) }
		static top=(y) { setPos_(left, y) }
		static topLeft { Vec.new(left, top) }
		static topleft=(a) { setPos_(a.x, a.y) }
		foreign static setPos_(x, y)
		
		foreign static center()

		foreign static width
		foreign static height
		static width=(w) { setSize_(w, height) }
		static height=(h) { setSize_(width, h) }
		static size { Vec.new(width, height) }
		static size=(a) { setSize_(a.x, a.y) }
		foreign static setSize_(w, h)

		foreign static resizable
		foreign static resizable=(b)

	//#endif

}

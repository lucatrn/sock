
class Asset {
	static path() { "%(Meta.module(1)).wren" }

	static path(p) { path(Meta.module(1), p) }

	foreign static path(curr, next)

	//#if WEB

		static loadString(p) {
			p = path(Meta.module(1), p)

			var a = Async.new()
			loadString_(a.loader, p)
			return a
		}

		foreign static loadString_(list, path)

	//#else

		static loadString(p) { loadString_(path(Meta.module(1), p)) }

		foreign static loadString_(path)

	//#endif
}

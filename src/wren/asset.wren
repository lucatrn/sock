
class Asset {
	static path() { "%(Meta.module(1)).wren" }

	static path(p) { path(Meta.module(1), p) }

	static loadString(p) {
		p = path(Meta.module(1), p)

		var a = Async.new()
		loadString_(a.loader, p)
		return a
	}

	foreign static path(curr, next)

	foreign static loadString_(list, path)
}

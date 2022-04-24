
class Asset {
	static path { "%(Meta.module(1)).wren" }

	static path(p) { path(Meta.module(1), p) }

	foreign static path(curr, next)

	foreign static loadString_(list, path)
}

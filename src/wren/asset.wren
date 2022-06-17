
class Asset {
	//#if WEB

		static loadString(p) { loadString_(p, Promise.new()).await }

		foreign static loadString_(path, promise)

	//#else

		foreign static loadString(path)

	//#endif
}

class Path {
	static current { Meta.module(1) }

	static resolve(p) { resolve(Meta.module(1), p) }

	foreign static resolve(curr, next)
}

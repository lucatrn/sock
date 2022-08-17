
class Asset {

	//#if WEB

		static exists(p) { Promise.await(exists_(p, Promise.new())) }

		foreign static exists_(path, promise)

		static loadString(p) { Promise.await(loadString_(p, Promise.new())) }

		foreign static loadString_(path, promise)
		
		static loadBundle(p) { Promise.await(loadBundle_(p, Promise.new())) }

		foreign static loadBundle_(path, promise)

	//#else

		foreign static exists(path)

		foreign static loadString(path)

		foreign static loadBundle(path)

	//#endif

}

class Path {
	static current { Meta.module(1) }

	static resolve(p) { resolve(Meta.module(1), p) }

	foreign static resolve(curr, next)
}

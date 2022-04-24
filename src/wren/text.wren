
class Text {

	static load(p) {
		p = Asset.path(Meta.module(1), p)

		var a = Async.new()
		Asset.loadString_(a.loader, p)
		return a
	}

}

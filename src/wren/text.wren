
class Text {

	static load(p) {
		p = Asset.path(Meta.module(1), p)
		var a = Loading.add_([0, null])
		Asset.loadString_(a, p)
		return Value.async(a)
	}

}

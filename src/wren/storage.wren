
class Storage {

	static load(k) {
		var s = load_(k)
		return s && JSON.fromString(s)
	}

	static save(k, a) {
		save_(k, JSON.toString(a))
	}

	foreign static load_(key)
	foreign static save_(key, json)
	foreign static contains(key)
	foreign static delete(key)
	// foreign static keys
}


class Storage {

	static load() { load("default") }
	
	static save(a) { save("default", a) }

	static containsDefault { contains("default") }

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
	foreign static remove(key)
	foreign static keys
}

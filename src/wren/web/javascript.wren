
class JavaScript {
	static eval(s) { eval(null, null, s) }
	
	static eval(av, an, s) { JSON.fromString( eval_(true, av && JSON.toString(av), an && JSON.toString(an), s) ) }

	static evalAsync(s, f) { evalAsync(null, null, s, f) }

	static evalAsync(av, an, s, f) {
		var id = eval_(false, av && JSON.toString(av), an && JSON.toString(an), s)
		if (!__async) __async = {}
		__async[id] = f
	}

	static update_(id, a, e) {
		__async.remove(id).call(JSON.fromString(a), e)
	}

	foreign static eval_(isSync, argValuesJSON, argNamesJSON, jsScript)
}

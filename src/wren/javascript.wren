
//#if WEB

	class JavaScript_ {
		static eval(s) { eval(null, null, s) }
		
		static eval(av, an, s) { JSON.fromString( eval_(null, av && JSON.toString(av), an && JSON.toString(an), s) ) }

		static evalAsync(s) { evalAsync(null, null, s) }

		static evalAsync(av, an, s) { eval_(Promise.new(), av && JSON.toString(av), an && JSON.toString(an), s) }

		foreign static eval_(promise, argValuesJSON, argNamesJSON, jsScript)
	}

//#endif

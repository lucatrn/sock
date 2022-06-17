
class Platform {

	foreign static os

	//#if WEB

		static name { "web" }

		foreign static browser

		static JavaScript { JavaScript_ }
	
	//#else

		static browser { null }

		static JavaScript { null }
	
	//#endif

	
	//#if DESKTOP

		static name { "desktop" }

		static Window { Window_ }
	
	//#else

		static Window { null }
	
	//#endif

}


class Platform {

	foreign static os

	//#if WEB

		static name { "web" }

		foreign static browser
	
	//#else

		static browser { null }
	
	//#endif

	
	//#if DESKTOP

		static name { "desktop" }
	
	//#endif

}

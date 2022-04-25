
# Sock TODOs

In order of importance.

## Essentials

* Audio
	* What formats will be supportted?
		* Are we in the age that we can safely use `mp3`?
		* Need to consider lack of `ogg` support on Safari

* Primitive drawing - `Draw` class? `Graphics.drawXYZ()`?

* Virtual Keyboard / Simple text input
	* Necessary for touch devices and consoles.
	* Improves text input accessbility on desktop (IMEs, automatically uses common shortcuts)
	* e.g. `Input.textBegin()`
	* e.g. `Input.textBegin(type)` (e.g. `"text"|"number"|"email"`)
	* e.g. `Input.textIsActive`
	* e.g. `Input.textString`
	* e.g. `Input.textSelection` (as range e.g. `0..3`)

## Would Be Cool

* `Array.fromHexString(s)` e.g. `Array.fromHexString("8f14a0")`

* Command Line / URL Arguments - `Game.arguments`?

* OS Info - `OS` class?
	* Browser Name - `Device.browser`
	* Browser Version - `Device.browserVersion`
	* OS Name - `Device.OS`
	* OS Version - `Device.OSVersion`
	* Is Mobile - `Device.isMobile`

* RGBA based pixel drawing:
	* Write pixels as RGBA bytes to an `Array`.
	* Put into `Sprite` with `sprite.setPixels(array)`

* Indexed based pixel drawing:
	* Create a `Palette` object (basically just a C array of colors)
	* Write pixels as bytes to an `Array`.
	* Put into `Sprite` with `sprite.setPixels(pal, array)`

* Control graphics blend function (is this transferable to Metal?)

* Open link e.g. `Game.openURL(s)`

* HTTP Requests - `HTTP` class?

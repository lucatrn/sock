
# Sock TODOs

In order of importance.

## Essentials

* Primitive drawing - `Draw` class? `Graphics.drawXYZ()`?
  * `Polygon.buid`

* Fullscreen

* Audio
	* Designing this API is going to be quite tricky!  
	  Wait until we can implement in both Web and Desktop in parallel, there are
	  too many unknowns otherwise.
	* What formats will be supportted?
		* Are we in the age that we can safely use `mp3`?
		* Need to consider lack of `ogg` support on Safari

* Virtual Keyboard / Simple text input
	* Necessary for touch devices and consoles.
	* Improves text input accessbility on desktop (IMEs, automatically uses common shortcuts)
	* e.g. `Input.textBegin()`
	* e.g. `Input.textBegin(type)` (e.g. `"text"|"number"|"email"`)
	* e.g. `Input.textIsActive`
	* e.g. `Input.textString`
	* e.g. `Input.textSelection` (as range e.g. `0..3`)


## Would Be Cool

* Command Line / URL Arguments
	* To keep things simple, we could only support named arguments.
		* e.g. `mygame.exe -frog -cat 42` => `{ "frog": true, "cat": "42" }`
		* e.g. `https://mygame.com/?frog&cat=42` => `{ "frog": true, "cat": "42" }`
	* Store in map e.g. `Game.arguments`

* RGBA based pixel drawing:
	* Write pixels as RGBA bytes to an `Array`.
	* Put into `Sprite` with `sprite.setPixels(array)`

* Indexed based pixel drawing:
	* Create a `Palette` object (basically just a C array of colors)
	* Write pixels as bytes to an `Array`.
	* Put into `Sprite` with `sprite.setPixels(pal, array)`

* Control graphics blend function (is this transferable to Metal?)
* `Array.fromHexString(s)` e.g. `Array.fromHexString("8f14a0")`

* HTTP Requests - `HTTP` class?


## Desktop Module

* Window management

* DLL/.so
	* e.g. for Steam/Discord APIs

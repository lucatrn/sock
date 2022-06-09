
# Sock TODOs

In order of importance.

## Essentials

### Win32

* Rest of keyboard input
* `Input.localize()`
* Gamepad Input
* Storage API


## Would Be Cool

* Command Line / URL Arguments
	* To keep things simple, we could only support named arguments.
		* e.g. `example.exe -frog -cat 42` => `{ "frog": true, "cat": "42" }`
		* e.g. `https://example.com/?frog&cat=42` => `{ "frog": true, "cat": "42" }`
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

* Dynamic usage of DLL/.so
	* e.g. for Steam/Discord APIs

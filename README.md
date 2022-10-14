# Sock 🧦

A [Wren](https://wren.io/) based 2D game engine with an emphasis on portability and useful APIs.

Sock is code driven rather than editor driven.

```wren
Game.cursor = "hidden"
Game.title = "SockQuest"

var cursor = Sprite.load("cursor.png")

Game.begin {
	Game.clear(#fff)

	cursor.draw(Input.mouse.x, Input.mouse.y)
}
```

## Development Status

In development and on hiatus, but in a somewhat usable state.  
However you will need to build the project yourself.

**Support will not be provided for the time being.**

If you are interested in other active Wren game engines please check out:

* [luxe](https://luxeengine.com/)
* [DOME](https://domeengine.com/)


## API & Documentation

[Online API documentation is provided here](https://lucatrn.github.io/sock-docs/) (via the [sock-docs repo](https://github.com/lucatrn/sock-docs)).


## API and Implementation Overview

* Graphics
	* 3D Accelerated graphics (OpenGL or WebGL)
	* Fixed or uncapped FPS
	* Fixed viewport resolution, or fit to window
	* 2D Camera, with optional transform
	* Primitive drawing (quads)
* Sprites
	* Load from `.png` `.jpg` `.gif` `.bmp`
	* Draw once or batch
	* Transformations and coloring
	* Configure scale filtering and wraping
* Audio
	* Load from `.wav` `.mp3` `.ogg`
	* Effects
		* Biquad filter: lowpass, highpass, bandpass
		* Echo and reverb
	* Buses
* Input
	* Keyboard, Mouse, Touch, Gamepad
	* Utilities for rebinding.
* Assets
	* JSON
	* Text
	* Binary data
* Storage - simple `save(key, value)` and `load(key)`
* Random
	* Instantiable and seedable
* Time


## Platforms

* Windows
* Web
	* Desktop: Chrome, Firefox, Safari
	* Mobile: iOS Safari, Android Chrome

> Mac and Linux planned!


### Platform Implementation Notes

| Feature | Desktop | Web |
| -- | -- | -- |
| Written in | C++ | C (Emscripten) & JavaScript |
| OS Abstraction<br>(Windowing etc.) | SDL | JavaScript |
| Graphics | OpenGL 3.3 | WebGL 1 |
| Image Loading | `stb_img.h` | `<img>`
| Audio | SoLoud w/ SDL backend | WebAudio |
| Audio Loading | SoLoud | WebAudio `decodeAudioData()` <br> `stbvorbis.js` fallback on Safari |
| Input | SDL | JavaScript |
| Storage | OS specific app-data folder | `localStorage` |

<!-- | Windows Feature | Library |
| -- | -- |
| Dynamic DLL Binding | libffi | -->


### Windows Builds

Windows builds are distributed as an `.exe` with `SDL2.dll`.

Assets are loaded from either:
* files in an adjacent directory `assets/`
* files contained in an adjacent `assets.zip` file


### Web Builds

Web builds are generated as a directory with the following files:

| File | Description |
| -- | -- |
| `index.html` | The page to view the game in. |
| `sock.js` | JavaScript that runs the game/APIs. |
| `sock_web.wren` | Wren code for Sock API. |
| `sock_c.wasm` | Wren intepreter as WebAssembly, and some Sock APIs. |
| `stbvorbis.js` | `.ogg` decoder, only loaded on Safari. |
| `unzipit.js` | `.zip` decoder worker |
| `assets/` | Directory containing project files. |


## Examples/Demos

| Game | Web build | Source code |
| -- | -- | -- |
| Snake | https://luca.games/s/snake/ | https://luca.games/s/snake/src/main.wren |

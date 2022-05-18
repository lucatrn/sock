# Sock 🧦

Wren based game engine with an emphasis on portability and useful APIs.

Sock is code driven rather than editor driven.

```wren
// TODO better example
Game.cursor = "hidden"
Game.title = "SockQuest"

var cursor = Sprite.load("cursor.png")

Game.begin {
	cursor.draw(Input.mouse - Vec.new(1, 1))
}
```

## API Overview

* Screen
	* Fixed or uncapped FPS
	* Fixed or fit resolution
* Sprites
	* Load from `.png` `.jpg` `.gif` `.bmp`
	* Draw once or batch
	* Transformations
* Audio
	* Load from `.wav` `.mp3` `.ogg`
	* Effects
		* Biquad filter: lowpass, highpass, bandpass
		* Echo
* Input
	* Keyboard, Mouse, Touch, Gamepad
	* Utilities for rebinding.
* Storage - simple `save(key, value)` and `load(key)`


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

| Windows Feature | Library |
| -- | -- |
| Dynamic DLL Binding | libffi |

### Windows Builds

Windows builds are distributed as an `.exe` with `SDL2.dll`.

Assets are loaded from either:
* files in an adjacent directory `assets/`
* a bundle appended to end of `.exe` at build time

### Web Builds

Web builds are generated as a directory with the following files:

| File | Description |
| -- | -- |
| `index.html` | The page to view the game in. |
| `sock.js` | JavaScript that runs the game/APIs. |
| `sock_web.wren` | Wren code for Sock API. |
| `sock_c.wasm` | Wren intepreter as WebAssembly, and some Sock APIs. |
| `stbvorbis.js` | `.ogg` decoder, only loaded on Safari. |
| `assets/` | Directory containing project files. |

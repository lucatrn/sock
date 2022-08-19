
# Sock TODOs

In order of importance.

## Essentials

* Gamepad Input (per controller?)

* Array more datatypes
	* Type aligned:
		* `getFloat32()/setFloat32()`
		* `getFloat64()/setFloat64()`
		* `getUint8/setUint8()`
		* `getInt16/setInt16()`
		* `getUint16/setUint16()`
		* `getInt32/setInt32()`
		* `getUint32/setUint32()`


## Would Be Cool

* RGBA based pixel drawing:
	* Write pixels as RGBA bytes to an `Array`.
	* Put into `Sprite` with `sprite.setPixels(array)`

* Indexed based pixel drawing:
	* Create a `Palette` object (basically just a C array of colors)
	* Write pixels as bytes to an `Array`.
	* Put into `Sprite` with `sprite.setPixels(pal, array)`

* Load audio from sample buffer
	* `Audio.fromSamples(floats, channels)`
	* `Audio.fromBuffer(floats, channels)`

```wren
var pcm = Array.new(40000)
for (i in 0...40000..4) {
	pcm.setFloat(i, (i * 0.001).sin)
}
var clp = Audio.fromSamples(pcm, 1)
```

* `Array.fromHexString(s)` e.g. `Array.fromHexString("8f14a0")`

* Dynamic usage of DLL/.so
	* e.g. for Steam/Discord APIs

* HTTP Requests - `HTTP` class?

* File
	* Simplified IO
		`File.exists(path): Bool`
		`File.read(path): String`
		`File.write(path, s): Bool`
		`File.delete(path): Bool`
	* Open/Save dialogs
		`File.readUsingDialog(dir): String`
		`File.writeUsingDialog(dir, s): Bool`
	* Get common user directories
		`File.documentsPath`
		`File.downloadsPath`
		`File.imagesPath`
		`File.desktopPath`

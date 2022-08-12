
foreign class Sprite {
	//#if WEB

		static load(p) { load_(p, Promise.new()).await }

		foreign static load_(path, promise)

	//#else

		foreign static load(path)

	//#endif

	// foreign static fromBitmap(bm)

	// Texture properties.

	foreign toString

	foreign width
	foreign height

	foreign scaleFilter
	foreign scaleFilter=(n)
	
	foreign wrapMode
	foreign wrapMode=(n)

	foreign color
	foreign color=(n)

	foreign transform
	foreign transform=(t)
	foreign setTransform(x, y, t)

	// Batching API

	foreign beginBatch()
	foreign endBatch()

	// Drawing API

	draw(x, y) { draw(x, y, width, height) }
	foreign draw(x, y, w, h)
	draw(x, y, u, v, uw, uh) { draw(x, y, uw, uh, u, v, uw, uh) }
	foreign draw(x, y, w, h, u, v, uw, vh)

	// Set/Get default Sprite properties.

	foreign static defaultScaleFilter
	foreign static defaultScaleFilter=(n)

	foreign static defaultWrapMode
	foreign static defaultWrapMode=(n)

}

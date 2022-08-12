
foreign class Bitmap {
	foreign static new(width, height)
	
	//#if WEB

		static load(a) { load_(a, Promise.new()).await }

		foreign static load_(a, promise)

	//#else

		foreign static load(a)

	//#endif

	foreign width
	foreign height

	foreign fill(c)
	foreign getPixel(x, y)
	foreign setPixel(x, y, c)
	foreign drawRect(x1, y1, x2, y2, c)
	foreign drawLine(x1, y1, x2, y2, c)
	foreign drawBitmap(bm, dx, dy)
	foreign drawBitmap(bm, dx1, dy1, dx2, dy2)
	foreign drawBitmap(bm, sx1, sy1, sx2, sy2, dx1, dy1, dx2, dy2)

	toString { "Bitmap(%(width), %(height))" }

	foreign [n]
	foreign [n]=(c)
}

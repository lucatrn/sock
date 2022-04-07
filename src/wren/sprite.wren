
foreign class Sprite is Asset {
	construct get(path) {}

	resolution { Vec2.new(width, height) }

	toString { "Sprite:%(path)" }

	foreign path

	foreign width

	foreign height

	foreign loadProgress

	foreign size

	foreign load_()

	foreign beginBatch()

	foreign endBatch()

	foreign draw(x, y, w, h)

	draw(x, y) {
		draw(x, y, width, height)
	}

	foreign static defaultScaleFilter

	foreign static defaultScaleFilter=(name)

	foreign static defaultWrapMode

	foreign static defaultWrapMode=(name)
}

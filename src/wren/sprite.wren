
foreign class Sprite {
	construct new() {}

	static load(p) {
		p = Asset.path(Meta.module(1), p)
		var s = new()
		Loading.add_(s.load_(p))
		return s
	}

	foreign load_(path)

	// foreign loadPixels_(pixels)


	// Texture properties.

	foreign width

	foreign height

	size { Vec.new(width, height) }

	foreign scaleFilter

	foreign scaleFilter=(n)
	
	foreign wrapMode

	foreign wrapMode=(n)


	// Batching API

	foreign beginBatch()

	foreign endBatch()


	// Drawing transformation.

	transform {
		var t = transform_
		return t && Transform.new(t[0], t[1], t[2], t[3], t[4], t[5])
	}

	transform=(t) {
		if (t) {
			setTransform_(t[0], t[1], t[2], t[3], t[4], t[5])
		} else {
			setTransform_(Num.nan, 0, 0, 0, 0, 0)
		}
	}

	rotation=(a) { transform = Transform.rotate(a) }

	foreign transform_

	foreign setTransform_(a, b, c, d, e, f)

	transformOrigin {
		var o = transformOrigin_
		return o && Vec.new(o[0], o[1])
	}

	transformOrigin=(o) {
		if (o) {
			setTransformOrigin(o.x, o.y)
		} else {
			setTransformOrigin(Num.nan, 0)
		}
	}

	foreign setTransformOrigin(x, y)
	
	foreign transformOrigin_


	// Drawing API

	draw(a) { draw(a.x, a.y) }

	draw(x, y) { draw(x, y, width, height, #fff) }

	draw(x, y, c) { draw(x, y, width, height, c) }
	
	draw(x, y, w, h) { draw(x, y, w, h, #fff) }

	draw(x, y, u, v, uw, vh) { draw(x, y, width, height, u, v, uw, vh, #fff) }

	draw(x, y, w, h, u, v, uw, vh) { draw(x, y, w, h, u, v, uw, vh, #fff) }

	foreign draw(x, y, w, h, c)

	foreign draw(x, y, w, h, u, v, uw, vh, c)


	// // Low level drawing for complex draw.
	// foreign beginBatch_()
	// foreign endBatch_()
	// foreign vert_(x, y, z, u, v, c)


	// Set/Get default Sprite properties.

	foreign static defaultScaleFilter

	foreign static defaultScaleFilter=(n)

	foreign static defaultWrapMode

	foreign static defaultWrapMode=(n)

	foreign toString
}

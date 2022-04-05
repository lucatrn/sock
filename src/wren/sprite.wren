
class Sprite is Asset {
	construct get(path) {
		super(path)
	}

	id { _id }

	width { _width }

	height { _height }

	size { Vec2.new(_width, _height) }
	
	toString { "Sprite:%(_id)" }

	foreign load_()
	
	load_(id, width, height) {
		_id = id
		_width = width
		_height = height
	}
}


class Camera {
	static setOrigin(x, y) { setOrigin(x, y, null) }
	foreign static setOrigin(x, y, t)

	static lookAt(x, y) { lookAt(x, y, null) }
	foreign static lookAt(x, y, t)

	foreign static reset()
}

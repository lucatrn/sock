
class Camera {
	static center { __c }

	static center=(v) {
		__c.x = v.x
		__c.y = v.y

		update_()
	}

	static scale { __s }

	static scale=(s) {
		__s = s

		update_()
	}

	static topLeft {
		return Vec.new(
			__c.x - size.x / 2,
			__c.y - size.y / 2
		)
	}

	static setTopLeft(x, y) {
		var size = Game.size

		__c.x = x + size.x / 2
		__c.y = y + size.y / 2

		update_()
	}

	static topLeft=(v) { setTopLeft(v.x, v.y) }

	static init_() {
		__c = Vec.new(0, 0)
		__s = 1
	}

	static update_() { update_(__c.x, __c.y, __s) }

	foreign static update_(cx, cy, s)
}

Camera.init_()

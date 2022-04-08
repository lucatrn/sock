
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
		return Vector.new(
			__c.x - size.x / 2,
			__c.y - size.y / 2
		)
	}

	static topLeft=(v) {
		var size = Game.size

		__c.x = v.x + size.x / 2
		__c.y = v.y + size.y / 2

		update_()
	}

	static init_() {
		__c = Vector.new(0, 0)
		__s = 1
	}

	static update_() { update_(__c.x, __c.y, __s) }

	foreign static update_(cx, cy, s)
}

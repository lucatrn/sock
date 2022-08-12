
foreign class Transform {
	foreign static new(n0, n1, n2, n3, n4, n5)

	static identity { new(1, 0, 0, 1, 0, 0) }

	foreign [n]
	foreign [n]=(v)

	* (a) { a is Vec ? Vec.new(this[0] * a.x + this[2] * a.y + this[4], this[1] * a.x + this[3] * a.y + this[5]) : mul_(a) }

	>> (a) { a.mul_(this) }

	foreign mul_(t)

	foreign toJSON

	toString { toJSON.toString }

	static fromJSON(a) { (a is List && a.count == 6) ? new(a[0], a[1], a[2], a[3], a[4], a[5]) : null }

	foreign translate(x, y)
	foreign static translate(x, y)

	foreign rotate(a)
	foreign static rotate(a)

	foreign scale(x, y)
	foreign static scale(x, y)

	scale(a) { scale(a, a) }
	static scale(a) { scale(a, a) }
}

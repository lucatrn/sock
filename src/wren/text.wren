
class Text is Asset {
	construct get(path) {}

	text { _text }
	
	toString { _text }

	foreign load_()

	load_(text) { _text = text }
}

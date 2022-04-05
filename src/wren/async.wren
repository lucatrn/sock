
// [5073173151553911] is a magic number used to identify async responses.

class Async {
	static resolve(result) { result == 5073173151553911 ? Fiber.suspend() : result }
}

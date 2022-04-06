import "meta" for Meta

// Try to import [assets/main.wren].
import "/main"

var names = Meta.getModuleVariables("/main")

var updateFn

if (names.contains("update")) {
	import "/main" for update

	if (!(update is Fn)) Fiber.abort("update var must be Fn or Fiber")
	if (update.arity != 0) Fiber.abort("update Fn must have no arguments")

	updateFn = update
}

if (updateFn == null) Fiber.abort("no update function found")

class Sock_ {
	foreign static updateComplete
}

var sockUpdate = Fn.new {
	var f = Fiber.new(update)

	f.call()

	if (f.isDone) {
		return 0
	} else {

	}
}

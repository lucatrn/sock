// RollupJS config file, for building JS client code.
//
// Usage:
//   rollup -c build-js-production.config.js

export default {
	input: "src/main.js",
	output: {
		format: "iife",
		file: "tmp/sock.js",
	},
	sourcemap: true,
}

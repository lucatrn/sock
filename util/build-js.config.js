// RollupJS config file, for building JS client code.
//
// Usage:
//   rollup -c build-js.config.js
//   rollup -c build-js.config.js --watch

import { terser } from 'rollup-plugin-terser';

let watch = !!process.env.ROLLUP_WATCH;

export default {
	input: "src/js/main.js",
	output: {
		format: "iife",
		file: "tmp/sock.js",
		sourcemap: !watch,
	},
	plugins: [
		watch ? null : terser(),
	],
}

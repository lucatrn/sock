
// Writes exported C functions to STDOUT out in the format "['_a','_b','_c']" 

let fs = require("fs");

let wren_h = fs.readFileSync("wren/src/include/wren.h", "utf8");
let lines = wren_h.split("\n");

let functions = [
	"malloc",
	"realloc",
	"free",
	"sock_init",
	"sock_font",
	"sock_new_buffer",
];

for (let l = 0; l < lines.length; l++) {
	let line = lines[l];
	if (line.startsWith('WREN_API')) {
		line = line.split('(')[0];
		let splitOnSpace = line.split(' ');
		line = splitOnSpace[splitOnSpace.length - 1];
		functions.push(line);
	}
}

process.stdout.write('[' + functions.map(f => `'_${f}'`).join(',') + ']');

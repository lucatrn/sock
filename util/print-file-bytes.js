
let fs = require("fs");

let args = process.argv;
if (args.length <= 2) {
	throw "Usage: node print-file-bytes.js <filename>";	
}

let buffer = fs.readFileSync(args[2]);

process.stdout.write("byteCount=" + buffer.byteLength + "\n" + buffer.join(", "));

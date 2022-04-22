// Concatenates the Wren scripts in "src/wren" into a single file "tmp/sock.wren".
//
// Usage:
//   node build-wren-script.mjs
//   node build-wren-script.mjs --debug

import { promises as fs } from "fs";

let argv = process.argv;

let names = argv.slice(2).filter(arg => arg[0] !== "-");

if (names.length === 0) {
	names = JSON.parse(await fs.readFile("src/wren/order.json", { encoding: "utf8" }));
	names = names.filter(name => name);
}

// Get all files and join into single string.
let files = await Promise.all(names.map(name => fs.readFile("src/wren/" + name + ".wren", "utf8")));

let megaScript = files.map(file => {
	// Process this file:
	// - Rudimentry minification.
	// - Rudimentry pre-processor.

	let min = "";
	let defines = null;

	for (let line of file.split(/[\r\n]+/g)) {
		line = line.trim();
	
		let comment = line.indexOf("//");
		if (comment === 0) {
			line = line.slice(2);
			
			// Get defines.
			let r = /^#define (\S+) (\S+)$/.exec(line);
			if (r) {
				if (!defines) defines = Object.create(null);
				defines[r[1]] = r[2];
			}
			
			continue;
		}

		if (comment >= 0) {
			line = line.slice(0, comment);
		}

		// For foreign methods, rename paramters to "a", "b" etc.
		let r = /^(foreign(?: static | )\S+)\(([^\)]+)\)$/.exec(line);
		if (r) {
			line = r[1] + "(" + r[2].split(/,\s*/).map((_,i) => String.fromCharCode(97 + i)).join(",") + ")"
		}
	
		// Split line into non-string and string parts.
		let parts = line.split(/("(?:[^"\\]|\\.)*")/);
	
		for (let i = 0; i < parts.length; i += 2) {
			let part = parts[i];

			// Remove spaces.
			part = part.replace(/ *(==|!=|[\-+*/%=<>\(\){}\[\],&\|]) */g, "$1");

			// Execute #define replaces.
			if (defines) {
				for (let name in defines) {
					part = part.replaceAll(name, defines[name]);
				}
			}
			
			parts[i] = part;
		}
	
		line = parts.join("");
	
		if (line.length > 0) {
			min += line + "\n";
		}
	}

	return min;
}).join("\n");


// Print or write to file.
if (argv[2] === "--debug" || argv[2] === "-d") {
	console.log(megaScript);
} else {
	await fs.writeFile("tmp/sock.wren", megaScript, { encoding: "utf8" })
}

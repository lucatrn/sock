// Concatenates the Wren scripts in "src/wren" into a single file "tmp/sock.wren".
//
// Usage:
//   node build-wren-script.mjs
//   node build-wren-script.mjs --debug

import { promises as fs } from "fs";

/** @type {string[]} */
let names = JSON.parse(await fs.readFile("src/wren/order.json", { encoding: "utf8" }));

names = names.filter(name => name);

// Get all files and join into single string.
let files = await Promise.all(names.map(name => fs.readFile("src/wren/" + name + ".wren")));

let script = files.join("\n");

// Rudimentry minification on the mega script.
let min = "";
for (let line of script.split(/[\r\n]+/g)) {
	line = line.trim();

	let comment = line.indexOf("//");
	if (comment >= 0) {
		line = line.slice(0, comment);
	}

	line = line.replace(/ *(==|!=|[\-+*/%=<>\(\){}\[\],&\|]) */g, "$1");

	if (line.length > 0) {
		min += line + "\n";
	}
}

// Print or write to file.
let argv = process.argv;

if (argv[2] === "--debug" || argv[2] === "-d") {
	console.log(min);
} else {
	await fs.writeFile("tmp/sock.wren", min, { encoding: "utf8" })
}

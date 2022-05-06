// Concatenates the Wren scripts in "src/wren" into a single file "tmp/sock.wren".
//
// Usage:
//   node build-wren-script.mjs
//   node build-wren-script.mjs --debug

import { promises as fs } from "fs";

let argv = process.argv;

let targets = argv.slice(2).filter(arg => arg[0] !== "-");

// Get Wren scripts we need to get.
let names = [];

await getFileList("");

for (let target of targets) {
	await getFileList(target);
}

async function getFileList(name) {
	let path = "src/wren/";
	if (name) {
		path += name + "/";
	}
	path += "order.json";
	
	let files = JSON.parse(await fs.readFile(path, { encoding: "utf8" }));
	files = files.filter(file => file && !file.startsWith("//"));

	if (name) {
		files = files.map(file => name + "/" + file);
	}

	names = names.concat(files);
}


// Get all files and join into single string.
let files = await Promise.all(names.map(name => fs.readFile("src/wren/" + name + ".wren", "utf8")));

let megaScript = files.map(file => {
	// Process this file:
	// - Rudimentry minification.
	// - Rudimentry pre-processor.

	let min = "";
	let defines = null;
	let ifStack = [];
	let ifBranch = null;
	let ifCurrBranch = null;

	for (let line of file.split(/[\r\n]+/g)) {
		line = line.trim();
	
		let comment = line.indexOf("//");
		if (comment === 0) {
			// If comment is at start of line, check for preprocessor.
			line = line.slice(2);
			
			// Get defines.
			let r = /^#define (\S+) (\S+)$/.exec(line);
			if (r) {
				if (!defines) defines = Object.create(null);
				defines[r[1]] = r[2];
			}

			// #if
			r = /^#if (\S+)$/.exec(line);
			if (r) {
				ifStack.push([ifBranch, ifCurrBranch]);

				ifCurrBranch = "if";

				if (targets.includes(r[1].toLowerCase()) || ((defines != null) && (r[1] in defines))) {
					ifBranch = ifCurrBranch;
				} else {
					ifBranch = null;
				}
			}

			// #else
			if (line === "#else") {
				if (ifStack.length === 0) {
					throw "no #if associated with #else";
				}

				ifCurrBranch = "else";

				if (ifBranch == null) {
					ifBranch = "else";
				}
			}

			// #endif
			if (line === "#endif") {
				if (ifStack.length === 0) {
					throw "no #if associated with #endif";
				}

				[ifBranch, ifCurrBranch] = ifStack.pop();
			}
			
			continue;
		}

		// Skip if not in matching conditional proprocessor block.
		if (ifBranch !== ifCurrBranch) continue;

		// If comment is at end of line after code, trip off the comment.
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
if (argv.includes("--debug") || argv.includes("-d")) {
	console.log(megaScript);
} else {
	let outName = "tmp/sock";
	for (let target of targets) {
		outName += "-" + target;
	}
	outName += ".wren";

	await fs.writeFile(outName, megaScript, { encoding: "utf8" })
}

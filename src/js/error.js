import { createElement } from "./html.js";
import { wrenErrorMessage, wrenErrorStack, wrenErrorString } from "./vm.js";

/**
 * @param {any} error
 */
export function showError(error) {
	console.error(error);

	document.body.append(
		createElement("div", { class: "error" }, [
			createElement("pre", { class: "message" }, error),
			// createElement("pre", { style: "padding:.6em" }, "[no stack trace]"),
		])
	);
}


export function showWrenError() {
	if (wrenErrorStack.length === 0) {
		document.body.append(
			createElement("div", { class: "error" }, [
				createElement("pre", { class: "message" }, wrenErrorString),
				createElement("pre", { style: "padding:.6em" }, "[no stack trace]"),
			])
		);
		return;
	}

	// Create popup with message and show immediately.
	let messageElement = createElement("pre", { class: "message" }, 
		createElement("div", {}, wrenErrorMessage)
	);


	for (let i = 0; i < wrenErrorStack.length; i++) {
		let [moduleName, lineNumber, location] = wrenErrorStack[i];

		let name = moduleName[0] === "/" ? moduleName.slice(1) : moduleName;

		let stackEl = createElement("div", {}, [
			location ? `  ${location} at ` : `  at `,
			createElement("a", { href: getModulePath(moduleName), onclick: onclick }, name + ":" + lineNumber),
		]);

		/**
		 * @param {MouseEvent} event
		 */
		function onclick(event) {
			event.preventDefault();
			showScript(i);
		}

		messageElement.append(stackEl);
	}


	let outerElement = createElement("div", { class: "error" }, messageElement);

	document.body.append(outerElement);

	let shownScript, scriptElement, scriptTitleElement, lineNumbers, lines, targetLine, targetLineNum;

	showScript(0);
	
	/**
	 * @param {number} stackIndex
	 */
	async function showScript(stackIndex) {
		let [ moduleName, lineNumber  ] = wrenErrorStack[stackIndex];
		
		if (shownScript !== moduleName) {
			if (scriptElement) {
				scriptElement.remove();
			}
			if (scriptTitleElement) {
				scriptTitleElement.remove();
			}

			let url = getModulePath(moduleName);
		
			let source = await (await fetch(url)).text();
	
			shownScript = moduleName;
	
			let sourceLines = source.split(/\r\n|\n/);
			
			// Re-format sock script.
			if (moduleName === "sock") {
				let indent = 0;
				sourceLines = sourceLines.map(line => {
					if (line[0] === "}") indent--;
	
					let newLine = "\t".repeat(indent) + line;
	
					if (line[0] !== "}" && line.endsWith("}")) indent--;
					if (line.includes("{")) indent++;
	
					return newLine;
				});
			}
		
			lineNumbers = [];
			lines = [];
		
			for (let i = 0; i < sourceLines.length; i++) {
				lineNumbers.push(createElement("div", {}, 1 + i));
				lines.push(createElement("div", {}, sourceLines[i] || "\u00A0"));
			}
		
			outerElement.append(
				scriptTitleElement = createElement("div", { class: "code-name" }, moduleName + ".wren"),
				scriptElement = createElement("div", { class: "code" }, [
					createElement("pre", { class: "code-lines" }, lineNumbers),
					createElement("pre", { class: "code-source" }, lines),
				])
			);
		}

		// Highlight line and scroll to.
		if (targetLine) {
			targetLine.className = targetLineNum.className = "";
		}

		targetLine = lines[lineNumber - 1];
		targetLineNum = lineNumbers[lineNumber - 1];

		if (targetLine) {
			targetLine.className = targetLineNum.className = "code-target";
			targetLineNum.scrollIntoView({ block: "center" });
		}
	}
}

/**
 * @param {string} name
 */
function getModulePath(name) {
	if (name[0] === "/") {
		name = "assets" + name;
	}

	return name + ".wren"
}

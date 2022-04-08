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
	console.error(wrenErrorString);

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

		if (isSockUpdateStackTraceLine(moduleName, location)) {
			messageElement.append(
				createElement("div", {}, "  in sock update")
			);
		} else {
			let name = moduleName[0] === "/" ? moduleName.slice(1) : moduleName;
	
			let stackEl = createElement("div", {}, [
				location ? `  ${location} at ` : `  at`,
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
	}


	let outerElement = createElement("div", { class: "error" }, messageElement);

	document.body.append(outerElement);

	let scriptElement;

	showScript(0);
	
	/**
	 * @param {number} stackIndex
	 */
	async function showScript(stackIndex) {
		if (scriptElement) {
			scriptElement.remove();
		}

		let [ moduleName, lineNumber ] = wrenErrorStack[stackIndex];

		let url = getModulePath(moduleName);
	
		let source = await (await fetch(url)).text();
	
		let lineCount = 0;
		let i = 0;
		while (i < source.length) {
			lineCount++;
			i = source.indexOf("\n", i);
			if (i < 0) {
				break;
			}
			i++;
		}
	
		let lineNumbers = [];
		let targetLineNum;
	
		for (let i = 1; i <= lineCount; i++) {
			let lineNum = createElement("div", {}, i);
	
			if (i === lineNumber) {
				targetLineNum = lineNum;
				lineNum.className = "code-target";
			}
	
			lineNumbers.push(lineNum);
		}
	
		outerElement.append(
			scriptElement = createElement("div", { class: "code" }, [
				createElement("pre", { class: "code-lines" }, lineNumbers),
				createElement("pre", { class: "code-source" }, source),
			])
		);
	
		if (targetLineNum) {
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

/**
 * @param {string} moduleName
 * @param {string} info
 */
function isSockUpdateStackTraceLine(moduleName, info) {
	if (moduleName === "sock" && info) {
		return info.includes("update_()");
	}

	return false;
}

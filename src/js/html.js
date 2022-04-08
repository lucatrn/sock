
/**
 * @param {K} tag 
 * @param {Record<string, any>} [attributes] 
 * @param {any} [nodes]
 * @returns {HTMLElementTagNameMap[K]}
 * @template {keyof HTMLElementTagNameMap} K
 */
export function createElement(tag, attributes, nodes) {
	let element = document.createElement(tag);

	if (attributes) {
		for (let name in attributes) {
			let value = attributes[name];
	
			if (name.startsWith("on")) {
				element[name] = value;
			} else {
				if (value === true) {
					element.setAttribute(name, "");
				} else if (value == null || value === false) {
					// Ignore.
				} else {
					element.setAttribute(name, value);
				}
			}
		}
	}

	if (nodes) {
		if (Array.isArray(nodes)) {
			for (let node of nodes) {
				element.append(node);
			}
		} else {
			element.append(nodes);
		}
	}

	return element;
}

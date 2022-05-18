
/**
 * @param {string} path
 */
export function getExtension(path) {
	let dot = path.lastIndexOf(".");
	return dot < 0 ? "" : path.slice(dot + 1).toLowerCase();
}

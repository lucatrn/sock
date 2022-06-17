
/**
 * @param {string} path
 */
export function getExtension(path) {
	let dot = path.lastIndexOf(".");
	return dot < 0 ? "" : path.slice(dot + 1).toLowerCase();
}

/**
 * @param {string} path
 * @returns {string}
 */
export function resolveAbsoluteAssetPath(path) {
	if (path[0] !== "/") {
		path = "/" + path;
	}
	return "assets" + path;
}

import * as unzipit from "./format/unzipit.js";
import { createElement } from "./html.js";
import { httpGET, httpGETImage } from "./network/http.js";
import { getExtension, resolveAbsoluteAssetPath, resolveAssetURL } from "./path.js";

/**
 * @type {Record<string, Blob | ArrayBuffer>}
 */
let assets = Object.create(null);

/**
 * @param {string} path
 * @param {(progress: number) => void} [onprogress]
 * @returns {ArrayBuffer|Promise<ArrayBuffer>}
 */
export function getAssetAsArrayBuffer(path, onprogress) {
	path = resolveAbsoluteAssetPath(path);

	// Try to read from cache.
	let data = assets[path];

	if (data) {
		if (onprogress) onprogress(1);
		return data instanceof Blob ? data.arrayBuffer() : data;
	}

	// Get via HTTP, and then cache.
	return httpGET(resolveAssetURL(path), "arraybuffer", onprogress).then(data => assets[path] = data);
}

/**
 * @param {string} path
 * @param {string} type
 * @returns {Blob|Promise<Blob>}
 */
export function getAssetAsBlob(path, type) {
	path = resolveAbsoluteAssetPath(path);

	// Try to read from cache.
	let data = assets[path];

	if (data) {
		return data instanceof Blob ? data : new Blob([ data ], { type: type });
	}

	// Get via HTTP, and then cache.	
	return httpGET(resolveAssetURL(path), "blob").then(data => assets[path] = data);
}

/**
 * @param {string} path
 * @returns {Promise<HTMLImageElement>}
 */
export function getAssetAsIMG(path) {
	path = resolveAbsoluteAssetPath(path);

	// Try to read from cache.
	let data = assets[path];

	if (data) {
		if (data instanceof ArrayBuffer) {
			data = new Blob([ data ]);
		}

		let url = URL.createObjectURL(data);
		
		// This is very lazy, but it should do the trick to prevent leaks.
		setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 5000);
		
		return httpGETImage(url);
	}

	// Get via HTTP.	
	return httpGETImage(resolveAssetURL(path));
}


unzipit.setOptions({
	workerURL: "unzipit.js",
});

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function loadBundle(url) {
	let r = await loadBundleEx(url);
	if (r) {
		console.error(r[0]);
		console.error(r[1]);
		return false;
	}
	return true;
}

/**
 * @param {string} url
 * @param {(progress: number) => void} [onprogress]
 * @returns {Promise<boolean>} true if a bundle was loaded
 */
export async function loadOptionalBundle(url, onprogress) {
	let r = await loadBundleEx(url, onprogress);
	return !r;
}

/**
 * @param {string} url
 * @param {(progress: number) => void} [onprogress]
 * @returns {Promise<undefined | [ string, any ]>} if an error, returns human readable message and original error
 */
async function loadBundleEx(url, onprogress) {
	// A note on progress, since there are many disparate progress related steps
	// we have to arbitarily combine these priorities.
	// Since network is often the slowest part, we assign 80% of the progres
	// to the HTTP get.
	const PROGRESS_HTTP_GET = 0.8;
	const PROGRESS_UNZIP_TOP = 0.9;

	let blob;
	try {
		blob = await httpGET(url, "blob", (loadProgress, ok) => {
			if (ok && onprogress) onprogress(loadProgress * PROGRESS_HTTP_GET);
		});
	} catch (error) {
		return [ "Error loading bundle '" + url + "'", error ];
	}
	if (onprogress) onprogress(PROGRESS_HTTP_GET);

	if (blob) {
		let zip;
		try {
			zip = await unzipit.unzipRaw(blob);
		} catch (error) {
			return [ "Error decoding bundle '" + url + "'", error ];
		}
		if (onprogress) onprogress(PROGRESS_UNZIP_TOP);

		if (zip) {
			let root = getCommonRootDirectory(zip);
	
			/** @type {Promise[]} */
			let filePromises = [];

			let files = zip.entries.filter(entry => !entry.isDirectory);
			let loadCount = 0;
	
			for (let file of files) {
				let name = file.name;
				if (root) name = name.slice(root.length);
				name = "/" + name;

				let ext = getExtension(name);

				// We have the choice of decoding entry as Blob or ArrayBuffer.
				// Since there may be overhead later converting to/from blob/arraybuffer, choose an appropriate type
				// based on the file extension. (even if we guess wrong, we can convert later)

				/** @type {Promise<Blob | ArrayBuffer>} */
				let dataPromise;
				if (ext === "png") {
					dataPromise = file.blob("image/png");
				} else if (ext === "jpg" || ext === "jpeg") {
					dataPromise = file.blob("image/jpeg");
				} else if (ext === "gif") {
					dataPromise = file.blob("image/gif");
				} else if (ext === "bmp") {
					dataPromise = file.blob("image/bmp");
				} else {
					dataPromise = file.arrayBuffer();
				}

				filePromises.push(
					dataPromise.then((data) => {
						assets[name] = data;
						loadCount++;

						if (onprogress) onprogress(PROGRESS_UNZIP_TOP + (loadCount / files.length) * (1 - PROGRESS_UNZIP_TOP));
					}, (error) => {
						throw [ `Error getting file '${name}' from bundle '${url}'`, error ];
					})
				);
			}
	
			try {
				await Promise.all(filePromises);
			} catch (error) {
				return error;
			}

			console.info(`[SOCK] loaded ${loadCount} assets from bundle '${url}'`);
		}
	}
}

/**
 * @param {unzipit.ZipInfoRaw} zip
 * @returns {string|null}
 */
function getCommonRootDirectory(zip) {
	let commonRoot = null;

	for (let entry of zip.entries) {
		if (!entry.isDirectory) {
			let name = entry.name;
			
			let i = name.indexOf("/");
			if (i <= 0) return null;
			
			let root = name.slice(0, i + 1);

			if (!commonRoot) {
				commonRoot = root;
			} else if (commonRoot !== root) {
				return null;
			}
		}
	}

	return commonRoot;
}

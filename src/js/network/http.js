
/**
 * @param {string} url
 * @param {XMLHttpRequestResponseType} type
 * @param {(progress: number) => void} [progressCallback]
 * @returns {Promise<any>}
 */
export function httpGET(url, type, progressCallback) {
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();

		xhr.responseType = type;
		xhr.open("GET", url);

		if (progressCallback) {
			xhr.onprogress = (event) => {
				if (event.lengthComputable) {
					progressCallback(event.loaded / event.total)
				}
			};
		}

		xhr.onerror = () => {
			reject("Could not connect to server");
		};

		xhr.onload = () => {
			if (xhr.status === 200) {
				resolve(xhr.response);
			} else {
				reject(xhr.status + ": " + xhr.statusText + ": " + url);
			}
		};

		xhr.send();
	});
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement|null>}
 */
export function httpGETImage(url) {
	return new Promise((resolve, reject) => {
		let el = new Image();
		el.onload = () => {
			resolve(el);
		};
		el.onerror = () => {
			reject(`Could not load image ${url}`);
		};
		el.src = url;
	});
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function httpExists(url) {
	try {
		let response = await fetch(url, { method: "HEAD" });

		return response.ok;
	} catch (error) {
		console.error("error for head request at " + url, error);

		return false;
	}
}

/**
 * @param {string} url
 * @returns {Promise<number>}
 */
export async function httpContentLength(url) {
	try {
		let response = await fetch(url, { method: "HEAD" });
		if (response.ok) {
			let contentLength = response.headers.get("content-length");
			if (contentLength) {
				return Number(contentLength);
			}
		}
	} catch (error) {
		console.error("error for head request at " + url, error);
	}
	return 0;
}

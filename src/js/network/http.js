
/**
 * @param {string} url
 * @param {XMLHttpRequestResponseType} type
 * @param {(loaded: number, total: number) => void} [progressCallback]
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
					progressCallback(event.loaded, event.total)
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
	return new Promise((resolve) => {
		let el = new Image();
		el.onload = () => {
			resolve(el);
		};
		el.onerror = () => {
			resolve(null);
		};
		el.src = url;
	});
}


/**
 * @param {string} path
 * @param {XMLHttpRequestResponseType} type
 * @param {{ progress: number }} progressObject
 * @returns {Promise<any>}
 */
export function httpGET(path, type, progressObject) {
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();

		xhr.responseType = type;
		xhr.open("GET", path);

		if (progressObject) {
			xhr.onprogress = (event) => {
				if (event.lengthComputable) {
					progressObject.progress = event.loaded / event.total;
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
				reject(xhr.status + ": " + xhr.statusText + ": " + path);
			}
		};

		xhr.send();
	});
}

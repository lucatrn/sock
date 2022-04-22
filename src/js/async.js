
/**
 * @param {number} delay
 * @param {number} timeout
 * @param {() => boolean} f
 * @returns {Promise<boolean>} resolves to false if timedout
 */
export function until(delay, timeout, f) {
	let time = 0;
	return new Promise((resolve) => {
		let id = setInterval(() => {
			time += delay;
			if (f()) {
				clearInterval(id);
				resolve(true);
			}
			if (time >= timeout) {
				clearInterval(id);
				resolve(false);
			}
		}, delay);
	});
}


/**
 * @param {string} s
 * @returns {any}
 */
export function wrenJSONToJS(s) {
	return JSON.parse(s, (key, value) => {
		if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && value[0][0] === "»") {
			let type = value[0].slice(1);
			value = value[1];

			if (type === "Num") {
				if (value === "infinity") return Infinity;
				if (value === "nan") return NaN;
				return Number(value);
			}

			if (type === "Map") {
				let map = new Map();
				for (let i = 1; i < value.length; i += 2) {
					map.set(value[i - 1], value[i]);
				}
				return map;
			}

			if (type === "Vec") {
				return { x: value[0], y: value[1] };
			}

			if (type === "Color") {
				let u8 = new Uint8Array(new Uint32Array([ value ]).buffer);
				return { r: u8[0], g: u8[1], b: u8[2], a: u8[3] };
			}

			if (type === "Buffer") {
				let b = atob(value);
				let array = new Uint8Array(b.length);
				for (let i = 0; i < b.length; i++) array[i] = b.charCodeAt(i);
				return array;
			}
			
			// console.warn(`unhandled type "${type}"`);
		}

		return value;
	});
}

/**
 * Converts Sock Wren JSON object to JavaScript, in place.
 * @param {any} obj
 * @returns {any}
 */
function wrenObjectToJS(obj) {
	if (Array.isArray(obj)) {
		// Handle custom serialization.
		if (obj.length === 2 && typeof obj[0] === "string" && obj[0][0] === "»") {
			let type = obj[0].slice(1);
			obj = obj[1];

			if (type === "Vec") {
				return { x: obj[0], y: obj[1] };
			}
			if (type === "Color") {
				let u8 = new Uint8Array(new Uint32Array([ obj ]).buffer);
				return { r: u8[0] / 255, g: u8[1] / 255, b: u8[2] / 255, a: u8[3] / 255 };
			}
			if (type === "Buffer") {
				let s = atob(obj);
				let array = new Uint8Array(s.length);
				for (let i = 0; i < s.length; i++) array[i] = s.charCodeAt(i);
				return array;
			}
		} else {
			for (let i = 0; i < obj.length; i++) {
				obj[i] = wrenObjectToJS(obj[i]);
			}
		}
	} else if (Object.getPrototypeOf(obj) === Object.prototype) {
		for (let k in obj) {
			obj[k] = wrenObjectToJS(obj[k]);
		}
	}

	return obj;
}


/**
 * Create copy of JS object that matches Sock Wren JSON spec.
 * @param {any} obj
 * @returns {string}
 */
export function jsToWrenJSON(obj) {
	return JSON.stringify(jsToWrenObject(obj));
}

/**
 * @param {any} obj
 * @returns {any}
 */
function jsToWrenObject(obj) {
	if (obj == null) {
		return null;
	}

	if (typeof obj === "number" || typeof obj === "string" || typeof obj === "boolean") {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(child => jsToWrenObject(child));
	}

	if (Object.getPrototypeOf(obj) === Object.prototype) {
		let result = {};
		for (let k in obj) {
			result[k] = jsToWrenObject(obj[k]);
		}
		return result;
	}

	if (obj instanceof Uint8Array || obj instanceof Uint8ClampedArray) {
		let s = "";
		for (let i = 0; i < obj.length; i++) {
			s += String.fromCharCode(obj[i]);
		}
		return [ "»Array", btoa(s) ];
	}

	return null;
}

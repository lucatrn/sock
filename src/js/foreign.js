
/**
 * @param {string} moduleName
 * @param {string} className
 * @param {boolean} isStatic
 * @param {string} signature
 * @param {() => void} callback
 */
export function addForeignMethod(moduleName, className, isStatic, signature, callback) {
	foreignMethods[methodID(moduleName || "sock", className, isStatic, signature)] = callback;
}

/**
 * @param {string} moduleName
 * @param {string} className
 * @param {Record<string, () => void>} methods
 */
export function addClassForeignStaticMethods(moduleName, className, methods) {
	for (let signature in methods) {
		addForeignMethod(moduleName, className, true, signature, methods[signature]);
	}
}

/**
 * @param {string} moduleName
 * @param {string} className
 * @param {Record<string, () => void>} methods
 */
export function addClassForeignMethods(moduleName, className, methods) {
	for (let signature in methods) {
		addForeignMethod(moduleName, className, false, signature, methods[signature]);
	}
}

/**
 * @param {string} moduleName
 * @param {string} className
 * @param {ForeignClassMethods} classMethods
 * @param {Record<string, () => void>} [methods]
 * @param {Record<string, () => void>} [staticMethods]
 */
export function addForeignClass(moduleName, className, classMethods, methods, staticMethods) {
	foreignClasses[classID(moduleName, className)] = classMethods;

	if (methods) {
		addClassForeignMethods(moduleName, className, methods);
	}

	if (staticMethods) {
		addClassForeignStaticMethods(moduleName, className, staticMethods);
	}
}

/**
 * @param {string} moduleName
 * @param {string} className
 * @param {boolean} isStatic
 * @param {string} signature
 * @returns {undefined | (() => void)}
 */
export function resolveForeignMethod(moduleName, className, isStatic, signature) {
	return foreignMethods[methodID(moduleName, className, isStatic, signature)];
}

/**
 * @param {string} moduleName
 * @param {string} className
 * @returns {undefined | ForeignClassMethods}
 */
export function resolveForeignClass(moduleName, className) {
	return foreignClasses[classID(moduleName, className)];
}

/**
 * @param {string} moduleName
 * @param {string} className
 * @param {boolean} isStatic
 * @param {string} signature
 */
function methodID(moduleName, className, isStatic, signature) {
	return `${moduleName}:${className}:${isStatic}:${signature}`;
}

/**
 * @param {string} moduleName
 * @param {string} className
 */
function classID(moduleName, className) {
	return `${moduleName}:${className}`;
}

/** @type {Record<string, () => void>} */
let foreignMethods = {};

/** @type {Record<string, ForeignClassMethods>} */
let foreignClasses = {};

/**
 * @typedef {[() => void, (ptr: number) => void]} ForeignClassMethods
 */

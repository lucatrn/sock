import { VM } from "./wren.js";

/**
 * @param {string} moduleName
 * @param {string} className
 * @param {boolean} isStatic
 * @param {string} signature
 * @param {(vm: VM) => void} callback
 */
export function addForeignMethod(moduleName, className, isStatic, signature, callback) {
	foreignMethods[methodID(moduleName, className, isStatic, signature)] = callback;
}

/**
 * @param {string} moduleName
 * @param {string} className
 * @param {boolean} isStatic
 * @param {string} signature
 * @returns {undefined | ((vm: VM) => void)}
 */
export function resolveForeignMethod(moduleName, className, isStatic, signature) {
	return foreignMethods[methodID(moduleName, className, isStatic, signature)];
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

/** @type {Record<string, (vm: VM) => void>} */
let foreignMethods = {};

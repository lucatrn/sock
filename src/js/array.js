
/**
 * @param {T[]} xs
 * @param {T} x
 * @template T
 */
export function arrayRemove(xs, x) {
	let i = xs.indexOf(x);
	if (i >= 0) xs.splice(i, 1);
}

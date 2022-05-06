
/** @type {"Windows"|"macOS"|"iOS"|"Linux"|"Android"} */
let os;
/** @type {null|"Chrome"|"Edge"|"Firefox"|"Safari"} */
let browser;
let mobile = false;

let platform = navigator.platform;
let ua = navigator.userAgent;

if (platform === "Win32") {
	os = "Windows";
} else if (platform.includes("Mac")) {
	os = "macOS";
} else if (platform === "iPhone" || platform === "iPad") {
	os = "iOS";
	mobile = true;
} else if (ua.includes("Android")) {
	os = "Android";
	mobile = true;
} else {
	os = "Linux";
}

if (ua.includes("Edg/")) {
	browser = "Edge";
} else if (ua.includes("Chrome/")) {
	browser = "Chrome";
} else if (ua.includes("Safari/")) {
	browser = "Safari";
} else if (ua.includes("Firefox/")) {
	browser = "Firefox";
}

/**
 * Information about the client device.
 */
export let device = {
	os: os,
	browser: browser,
	mobile: mobile,
};

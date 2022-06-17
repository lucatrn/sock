import { sockJsGlobal } from "./globals.js";

/** @type {"windows"|"mac"|"ios"|"linux"|"android"} */
export let deviceOS;
/** @type {null|"chrome"|"edge"|"firefox"|"safari"} */
export let deviceBrowser;
export let deviceIsMobile = false;

let platform = navigator.platform;
let userAgent = navigator.userAgent;

if (platform === "iPhone" || platform === "iPad" || userAgent.includes("iPhone")) {
	deviceOS = "ios";
	deviceIsMobile = true;
} else if (platform === "Win32") {
	deviceOS = "windows";
} else if (platform.includes("Mac")) {
	deviceOS = "mac";
} else if (userAgent.includes("Android")) {
	deviceOS = "android";
	deviceIsMobile = true;
} else {
	deviceOS = "linux";
}

if (userAgent.includes("Edg/")) {
	deviceBrowser = "edge";
} else if (userAgent.includes("Chrome/")) {
	deviceBrowser = "chrome";
} else if (userAgent.includes("Safari/")) {
	deviceBrowser = "safari";
} else if (userAgent.includes("Firefox/")) {
	deviceBrowser = "firefox";
}

sockJsGlobal.device = {
	os: deviceOS,
	isMobile: deviceIsMobile,
	browser: deviceBrowser,
};

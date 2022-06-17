import { deviceBrowser, deviceOS } from "../device.js";
import { addClassForeignStaticMethods } from "../foreign.js";
import { wrenSetSlotString } from "../vm.js";

addClassForeignStaticMethods("sock", "Platform", {
	"os"() {
		wrenSetSlotString(0, deviceOS);
	},
	"browser"() {
		wrenSetSlotString(0, deviceBrowser);
	},
});

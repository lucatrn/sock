
let documentProto = Document.prototype;
let elementProto = Element.prototype;

export let fullscreenChangeEvent = "fullscreenchange";

if (!elementProto.requestFullscreen) {
	if (elementProto["webkitRequestFullscreen"]) {
		// Safari uses webkit prefix for fullscreen API.

		fullscreenChangeEvent = "webkit" + fullscreenChangeEvent;

		Object.defineProperty(documentProto, "fullscreenElement", {
			get() {
				return this["webkitFullscreenElement"];
			}
		});
		
		Object.defineProperty(documentProto, "fullscreenEnabled", {
			get() {
				return this["webkitFullscreenEnabled"];
			}
		});

		documentProto["exitFullscreen"] = function () {
			this["webkitExitFullscreen"]();

			return Promise.resolve();
		};

		elementProto["requestFullscreen"] = function () {
			return new Promise((resolve, reject) => {
				let fullscreenChange = () => {
					finalize();
					resolve();
				};

				let fullscreenError = () => {
					finalize();
					reject(new TypeError("failed to get fullscreen"));
				};

				let finalize = () => {
					this.removeEventListener("webkitfullscreenchange", fullscreenChange);
					this.removeEventListener("webkitfullscreenerror", fullscreenError);
				};

				this.addEventListener("webkitfullscreenchange", fullscreenChange);
				this.addEventListener("webkitfullscreenerror", fullscreenError);

				this["webkitRequestFullscreen"]();
			});
		};
	}
}

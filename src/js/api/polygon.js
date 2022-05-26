import { addClassForeignStaticMethods } from "../foreign.js";
import { PolygonBatcher } from "../gl/polygon-batcher.js";

let b = new PolygonBatcher();

addClassForeignStaticMethods("sock", "Polygon", {
	"drawRectangle()"() {
		b.begin();
		b.drawRectangle(0, 0, 0.5, 0.5, 0xff000000);
		b.end();
	},
	"drawTriangle()"() {
		b.begin();
		b.drawTriangle(0, 0, 0.8, 0.8, 0xff000000);
		b.end();
	},
});

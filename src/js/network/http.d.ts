
export function httpGET(path: string, type: "blob", progress?: ProgressObject): Promise<Blob>;
export function httpGET(path: string, type: "arraybuffer", progress?: ProgressObject): Promise<ArrayBuffer>;
export function httpGET(path: string, type: "document", progress?: ProgressObject): Promise<Document>;
export function httpGET(path: string, type: "text", progress?: ProgressObject): Promise<string>;
export function httpGET(path: string, type: XMLHttpRequestResponseType, progress?: ProgressObject): Promise<any>;

interface ProgressObject {
	progress: number;
}

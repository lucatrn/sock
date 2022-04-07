
export function httpGET(url: string, type: "blob", progress?: ProgressCallback): Promise<Blob>;
export function httpGET(url: string, type: "arraybuffer", progress?: ProgressCallback): Promise<ArrayBuffer>;
export function httpGET(url: string, type: "document", progress?: ProgressCallback): Promise<Document>;
export function httpGET(url: string, type: "text", progress?: ProgressCallback): Promise<string>;
export function httpGET(url: string, type: XMLHttpRequestResponseType, progress?: ProgressCallback): Promise<any>;

/**
 * Resolves to null if there was an error getting the image.
 */
export function httpGETImage(url: string): Promise<HTMLImageElement | null>;

type ProgressCallback = (loaded: number, total: number) => void;

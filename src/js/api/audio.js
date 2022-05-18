import { addForeignClass } from "../foreign.js";
import { sockJsGlobal } from "../globals.js";
import { httpGET } from "../network/http.js";
import * as Path from "../path.js";
import { wrenAbort, wrenEnsureSlots, wrenGetSlotBool, wrenGetSlotDouble, wrenGetSlotForeign, wrenGetSlotHandle, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenReleaseHandle, wrenSetSlotBool, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNewForeign } from "../vm.js";
import { getAsset, initLoadingProgressList } from "./asset.js";

const MAX_EFFECT_PER_AUDIO = 4;

const EFFECT_TYPE_NONE = 0;
const EFFECT_TYPE_FILTER = 1;
const EFFECT_TYPE_ECHO = 2;
const EFFECT_TYPE_REVERB = 3;
const EFFECT_TYPE_DISTORTION = 4;
const EFFECT_TYPE_MIN = 1;
const EFFECT_TYPE_MAX = 4;

const EFFECT_TYPE_NAMES = [
	"none",
	"filter",
	"echo",
	"reverb",
	"distortion",
];

const PARAM_FILTER_TYPE = 0;
const PARAM_FILTER_FREQUENCY = 1;
const PARAM_FILTER_RESONANCE = 2;

const PARAM_ECHO_DELAY = 0;
const PARAM_ECHO_DECAY = 1;
const PARAM_ECHO_VOLUME = 2;

const FILTER_TYPE_LOWPASS = 0;
const FILTER_TYPE_HIGHPASS = 1;
const FILTER_TYPE_BANDPASS = 2;
const FILTER_TYPE_MIN = 0;
const FILTER_TYPE_MAX = 2;

/**
 * Used to decode audio if `audioctx` is not created yet.
 * @type {OfflineAudioContext}
 */
let offlineContext = null;

/**
 * @type {AudioContext}
 */
let audioctx;

/**
 * @type {GainNode}
 */
let masterGain;

/**
 * @type {number}
 */
let handle_Voice = null;

export function initAudioModule() {
	wrenEnsureSlots(1);
	wrenGetVariable("sock", "Voice", 0);
	handle_Voice = wrenGetSlotHandle(0);
}

export function createAudioContext() {
	audioctx = new AudioContext();
	sockJsGlobal.audio = audioctx;
	
	// Create main audio graph.
	masterGain = audioctx.createGain();
	masterGain.connect(audioctx.destination);
}

export function stopAllAudio() {
	if (audioctx) {
		audioctx.close();
		audioctx = null;
		masterGain = null;
	}
}

/**
 * @param {GainNode} gainNode
 * @param {number} volume
 * @param {number} fade
 */
function fadeVolume(gainNode, volume, fade) {
	volume = Math.max(0, volume);
	fade = Math.max(0.002, fade);

	let gain = gainNode.gain;
	gain.cancelScheduledValues(audioctx.currentTime);
	gain.value = gain.value;
	gain.linearRampToValueAtTime(volume, audioctx.currentTime + fade);
}

class Audio {
	/**
	 * @param {number} ptr
	 */
	constructor(ptr) {
		this.ptr = ptr;

		/** @type {Effect[]} */
		this.effects = Array(MAX_EFFECT_PER_AUDIO).fill(null);

		this.gain = audioctx.createGain();

		this.updateGraph();
	}

	/**
	 * @param {number} index
	 * @returns {number}
	 */
	getEffectType(index) {
		let effect = this.effects[index];
		return effect ? effect.type : EFFECT_TYPE_NONE;
	}

	updateGraph() {
		this.gain.disconnect();

		/** @type {AudioNode[]} */
		let nodes = [ this.gain ];

		for (let i = 0; i < MAX_EFFECT_PER_AUDIO; i++) {
			let effect = this.effects[i];
			if (effect) {
				// Connect from prev into this effect input.
				for (let node of nodes) {
					node.connect(effect.input);
				}
				
				// Setup current effect outputs.
				nodes = effect.outputs;
				
				// Disconnect this effect's old output connections.
				// This may break this effect's internal connections, so call
				// [setupGraph] on effect to return these to normal.
				for (let node of nodes) {
					node.disconnect();
				}

				if (effect.setupGraph) {
					effect.setupGraph();
				}
			}
		}

		for (let node of nodes) {
			node.connect(masterGain);
		}

		this.outputs = nodes;
	}

	/**
	 * @param {AudioBuffer} buffer
	 */
	setBuffer(buffer) {
		this.buffer = buffer;
	}
}

/**
 * @param {AudioParam} param
 * @param {number} value
 * @param {number} [fade]
 */
function effectSetAudioParam(param, value, fade) {
	value = Math.max(param.minValue, Math.min(param.maxValue, value));

	if (fade) {
		param.linearRampToValueAtTime(value, audioctx.currentTime + fade);
	} else {
		param.value = value;
	}
}


// === EFFECTS ===

class FilterEffect {
	constructor() {
		this.filter = audioctx.createBiquadFilter();
	}

	/**
	 * @param {number} index
	 * @returns {number}
	 */
	getParam(index) {
		if (index === PARAM_FILTER_TYPE) {
			switch (this.filter.type) {
				case "lowpass": return FILTER_TYPE_LOWPASS;
				case "highpass": return FILTER_TYPE_HIGHPASS;
				case "bandpass": return FILTER_TYPE_BANDPASS;
			}
		} else if (index === PARAM_FILTER_FREQUENCY) {
			return this.filter.frequency.value;
		} else if (index === PARAM_FILTER_RESONANCE) {
			return this.filter.Q.value;
		}
	}

	/**
	 * @param {number} index
	 * @param {number} value
	 */
	checkParam(index, value) {
		if (index === PARAM_FILTER_TYPE) {
			value = Math.floor(value);
			if (value < FILTER_TYPE_MIN || value > FILTER_TYPE_MAX) {
				return "invalid filter type";
			}
		}
	}
	
	/**
	 * @param {number} index
	 * @param {number} value
	 * @param {number} [fade]
	 */
	setParam(index, value, fade) {
		if (index === PARAM_FILTER_TYPE) {
			value = Math.floor(value);
			switch (value) {
				case FILTER_TYPE_LOWPASS:
					this.filter.type = "lowpass";
					break;
				case FILTER_TYPE_HIGHPASS:
					this.filter.type = "highpass";
					break;
				case FILTER_TYPE_BANDPASS:
					this.filter.type = "bandpass";
					break;
			}
		} else if (index === PARAM_FILTER_FREQUENCY) {
			effectSetAudioParam(this.filter.frequency, value, fade);
		} else if (index === PARAM_FILTER_RESONANCE) {
			effectSetAudioParam(this.filter.Q, value, fade);
		}
	}

	get type() { return EFFECT_TYPE_FILTER }
	get input() { return this.filter }
	get outputs() { return [ this.filter ] }
}

class EchoEffect {
	constructor() {
		this.node = audioctx.createGain();
		this.delay = audioctx.createDelay(1);
		this.delay.delayTime.value = 0.5;
		this.decay = audioctx.createGain();
		this.mix = audioctx.createGain();
		
		this.delay.connect(this.mix);
		this.delay.connect(this.decay);
		this.decay.connect(this.delay);
	}

	setupGraph() {
		this.node.connect(this.delay);
	}

	/**
	 * @param {number} index
	 * @returns {number}
	 */
	getParam(index) {
		if (index === PARAM_ECHO_DELAY) {
			return this.delay.delayTime.value;
		} else if (index === PARAM_ECHO_DECAY) {
			return this.decay.gain.value;
		} else if (index === PARAM_ECHO_VOLUME) {
			return this.mix.gain.value;
		}
	}

	/**
	 * @param {number} index
	 * @param {number} value
	 */
	checkParam(index, value) {
		if (index === PARAM_ECHO_DELAY) {
			if (value < 0.001) {
				return "decay not be less than 1ms";
			}
		} else if (index === PARAM_ECHO_DECAY) {
			if (value < 0) {
				return "decay must not be negative";
			}
			if (value >= 1) {
				return "decay must less than 1";
			}
		}
	}
	
	/**
	 * @param {number} index
	 * @param {number} value
	 * @param {number} [fade]
	 */
	setParam(index, value, fade) {
		if (index === PARAM_ECHO_VOLUME) {
			effectSetAudioParam(this.mix.gain, value, fade);
		} else if (index === PARAM_ECHO_DELAY) {
			effectSetAudioParam(this.delay.delayTime, value, fade);
		} else if (index === PARAM_ECHO_DECAY) {
			effectSetAudioParam(this.decay.gain, value, fade);
		}
	}

	free() {
		this.delay.disconnect();
		this.decay.disconnect();
		this.delay = null;
		this.decay = null;
	}

	get type() { return EFFECT_TYPE_ECHO }
	get input() { return this.node }
	get outputs() { return [ this.node, this.mix ] }
}


// === VOICE ===

class Voice {
	/**
	 * @param {number} ptr
	 * @param {Audio} audio
	 * @param {number} audioHandle
	 */
	constructor(ptr, audio, audioHandle) {
		this.ptr = ptr;
		this.audio = audio;
		this.audioHandle = audioHandle;

		this.source = audioctx.createBufferSource();
		this.source.buffer = audio.buffer;

		this.gainNode = audioctx.createGain();
		this.gainNode.connect(this.audio.gain);

		this.state = 0;
	}
	
	play() {
		this.source.connect(this.gainNode);
		this.source.start();
		this.startTime = audioctx.currentTime;
		this.state = 1;
	}
}

/**
 * @type {Map<number, Audio>}
 */
let audios = new Map();

/**
 * @type {Map<number, Voice>}
 */
let voices = new Map();

/**
 * Gets the current Audio in slot 0.
 * @returns {Audio}
 */
function getAudio() {
	return audios.get(wrenGetSlotForeign(0));
}

/**
 * Gets the current Voice in slot 0.
 * @returns {Voice}
 */
function getVoice() {
	return voices.get(wrenGetSlotForeign(0));
}

let canDecodeOGG = true;

/**
 * @param {string} url
 * @param {(progress: number) => void} [onprogress]
 * @returns {Promise<AudioBuffer>}
 */
async function loadAudioBuffer(url, onprogress) {
	let buffer = await httpGET(url, "arraybuffer", onprogress);

	let ext = Path.getExtension(url);
	let isOGG = ext === "ogg";

	try {
		if (isOGG && !canDecodeOGG) {
			return await decodeOGG(buffer);
		} else {
			if (offlineContext == null) {
				offlineContext = new OfflineAudioContext(1, 1, 44100);
			}
		
			try {
				return await offlineContext.decodeAudioData(buffer);
			} catch (error) {
				// Handle OGG failure.
				if (isOGG) {
					console.info(`Failed to natively decode ${url}, switching to JavaScript OGG decoder`, error);
					canDecodeOGG = false;
					return await decodeOGG(buffer);
				} else {
					throw error;
				}
			}
		}
	} catch (error) {
		console.error(error);
		throw Error(`failed to decode audio ${url}`);
	}
}

/** @type {Promise<STBVorbis>} */
let stbvorbisPromise;

/**
 * Decode an OGG using stbvorbis.
 * (Only needed on Safari.)
 * @param {ArrayBuffer} buffer
 * @returns {Promise<AudioBuffer>}
 */
async function decodeOGG(buffer) {
	if (stbvorbisPromise == null) {
		stbvorbisPromise = new Promise((resolve) => {
			let callback = () => {
				removeEventListener("stbvorbis", callback);
				resolve(self["stbvorbis"]);
			}
			addEventListener("stbvorbis", callback);
		});

		let script = document.createElement("script");
		script.src = "stbvorbis.js";
		document.head.append(script);
	}

	let stbvorbis = await stbvorbisPromise;

	return new Promise((resolve, reject) => {
		/** @type {Float32Array[][]} */
		let data = [];
		let sampleRate;

		stbvorbis.decode(buffer, (result) => {
			if (result.error) {
				reject(result.error);
			} else if (result.eof) {
				let totalLength = data.reduce((acc, chunk) => acc + chunk[0].length, 0);
				let channelCount = data[0].length;

				let audio = new AudioBuffer({
					sampleRate: sampleRate,
					numberOfChannels: channelCount,
					length: totalLength,
				});
				
				let writeOffset = 0;
				for (let chunk of data) {
					for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
						audio.copyToChannel(chunk[channelIndex], channelIndex, writeOffset);
						writeOffset += chunk[channelIndex].length;
					}
				}

				resolve(audio);
			} else {
				data.push(result.data);
				sampleRate = result.sampleRate;
			}
		});
	});
}

/**
 * @param {number} audioHandle
 * @param {string} path
 * @param {number} progressListHandle
 */
async function loadAudio(audioHandle, path, progressListHandle) {
	try {
		// Get ArrayBuffer and update progress in list.
		await getAsset(progressListHandle, (onprogress) => loadAudioBuffer("assets" + path, onprogress), /** @param {AudioBuffer} buffer */(buffer) => {
			wrenEnsureSlots(2);
			wrenSetSlotHandle(0, audioHandle);
			let audio = getAudio();
			
			audio.setBuffer(buffer);
		});
	} finally {
		wrenReleaseHandle(audioHandle);
	}
}


addForeignClass("sock", "Audio", [
	() => {
		let ptr = wrenSetSlotNewForeign(0, 0, 0);

		let audio = new Audio(ptr);

		audios.set(ptr, audio);
	},
	(ptr) => {
		audios.delete(ptr);
	},
], {
	"load_(_)"() {
		if (wrenGetSlotType(1) !== 6) {
			wrenAbort("path must be a string");
			return;
		}

		let audioHandle = wrenGetSlotHandle(0);

		let path = wrenGetSlotString(1);

		let progressListHandle = initLoadingProgressList();

		loadAudio(audioHandle, path, progressListHandle);
	},
	"duration"() {
		let audio = getAudio();
		wrenSetSlotDouble(0, audio.buffer ? audio.buffer.duration : 0);
	},
	"voice()"() {
		let audioHandle = wrenGetSlotHandle(0);

		let audio = getAudio();
		if (!audio.buffer) {
			wrenAbort("audio not loaded");
			return;
		}

		wrenEnsureSlots(2);
		wrenSetSlotHandle(1, handle_Voice);
		let ptr = wrenSetSlotNewForeign(0, 1, 0);

		let voice = new Voice(ptr, audio, audioHandle);
		voices.set(ptr, voice);
	},
	"setEffect_(_,_,_,_,_,_)"() {
		for (let i = 1; i <= 6; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let index = wrenGetSlotDouble(1);
		let type = wrenGetSlotDouble(2);

		/** @type {number[]} */
		let params = Array(4);
		params[0] = wrenGetSlotDouble(3);
		params[1] = wrenGetSlotDouble(4);
		params[2] = wrenGetSlotDouble(5);
		params[3] = wrenGetSlotDouble(6);

		// Validate type/index indices.
		if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
			wrenAbort("invalid effect index");
			return;
		}
		
		if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
			wrenAbort("invalid effect type");
			return;
		}

		let audio = getAudio();

		/** @type {Effect} */
		let effect;
		if (type === EFFECT_TYPE_FILTER) {
			effect = new FilterEffect();
		} else if (type === EFFECT_TYPE_ECHO) {
			effect = new EchoEffect();
		} else {
			effect = null;
		}

		if (effect) {
			if (effect.checkParam) {
				for (let i = 0; i < 4; i++) {
					let error = effect.checkParam(i, params[i]);
					if (error) {
						if (effect.free) {
							effect.free();
						}
						wrenAbort(error);
						return;
					}
				}
			}

			for (let i = 0; i < 4; i++) {
				effect.setParam(i, params[i]);
			}
		}

		let oldEffect = audio.effects[index];
		if (oldEffect) {
			for (let output of oldEffect.outputs) {
				output.disconnect();
			}
			if (oldEffect.free) {
				oldEffect.free();
			}
		}

		audio.effects[index] = effect;

		audio.updateGraph();
	},
	"getEffect_(_)"() {
		if (wrenGetSlotType(1) !== 1) {
			wrenAbort("index must be a Num");
			return;
		}
		
		let index = Math.trunc(wrenGetSlotDouble(1));
		if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
			wrenAbort("invalid effect index");
			return;
		}

		
		let audio = getAudio();

		wrenSetSlotDouble(0, audio.getEffectType(index));
	},
	"getParam_(_,_,_)"() {
		for (let i = 1; i <= 3; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let index = Math.trunc(wrenGetSlotDouble(1));
		let type = Math.trunc(wrenGetSlotDouble(2));
		let paramIndex = Math.trunc(wrenGetSlotDouble(3));

		if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
			wrenAbort("invalid effect index");
			return;
		}

		let audio = getAudio();

		if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
			wrenAbort("invalid effect type");
			return;
		}

		if (audio.getEffectType(index) != type) {
			wrenAbort(`effect at ${index} is not a ${EFFECT_TYPE_NAMES[type]}`);
			return;
		}

		if (paramIndex < 0 || paramIndex >= 4) {
			wrenAbort("invalid param index");
			return;
		}

		wrenSetSlotDouble(0, audio.effects[index].getParam(paramIndex) ?? 0);
	},
	"setParam_(_,_,_,_,_)"() {
		for (let i = 1; i <= 5; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let index = Math.trunc(wrenGetSlotDouble(1));
		let type = Math.trunc(wrenGetSlotDouble(2));
		let paramIndex = Math.trunc(wrenGetSlotDouble(3));
		let paramValue = wrenGetSlotDouble(4);
		let fadeTime = wrenGetSlotDouble(5);

		// Validate type/index indices.
		if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
			wrenAbort("invalid effect index");
			return;
		}

		let audio = getAudio();

		if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
			wrenAbort("invalid effect type");
			return;
		}

		if (audio.getEffectType(index) != type) {
			wrenAbort(`effect at ${index} is not a ${EFFECT_TYPE_NAMES[type]}`);
			return;
		}

		if (paramIndex < 0 || paramIndex >= 4) {
			wrenAbort("invalid param index");
			return;
		}
		
		if (fadeTime < 0) {
			wrenAbort("fade time must be positive");
			return;
		}

		let effect = audio.effects[index];

		if (effect.checkParam) {
			let error = effect.checkParam(paramIndex, paramValue);
			if (error) {
				wrenAbort(error);
				return;
			}
		}

		effect.setParam(paramIndex, paramValue, fadeTime);
	},
}, {
	"volume"() {
		wrenSetSlotDouble(0, masterGain.gain.value);
	},
	"fadeVolume(_,_)"() {
		for (let i = 1; i <= 2; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let volume = wrenGetSlotDouble(1);
		let fade = wrenGetSlotDouble(2);

		fadeVolume(masterGain, volume, fade);
	},
});

addForeignClass("sock", "Voice", [
	() => {
		// abortFiber("voice should not be constructed directly");
	},
	(ptr) => {
		let voice = voices.get(ptr);
		wrenReleaseHandle(voice.audioHandle);
		voices.delete(ptr);
	},
], {
	"play()"() {
		let voice = getVoice();
		
		if (voice.state === 0) {
			voice.play();
		} else if (voice.state == 2) {
			voice.source.connect(voice.gainNode);
			voice.state = 1;
		}
	},
	"pause()"() {
		let voice = getVoice();

		if (voice.state === 1) {
			voice.source.disconnect();
			voice.state = 2;
		}
	},
	"isPaused"() {
		let voice = getVoice();
		wrenSetSlotBool(0, voice.state === 0 || voice.state === 2);
	},
	"stop()"() {
		let voice = getVoice();
		voice.source.stop();
		voice.state = 3;
	},
	"volume"() {
		let voice = getVoice();
		wrenSetSlotDouble(0, voice.gainNode.gain.value);
	},
	"fadeVolume(_,_)"() {
		for (let i = 1; i <= 2; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let volume = wrenGetSlotDouble(1);
		let fade = wrenGetSlotDouble(2);

		let voice = getVoice();

		fadeVolume(voice.gainNode, volume, fade);
	},
	"rate"() {
		let voice = getVoice();
		wrenSetSlotDouble(0, voice.source.playbackRate.value);
	},
	"fadeRate(_,_)"() {
		for (let i = 1; i <= 2; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let rate = wrenGetSlotDouble(1);
		let fade = wrenGetSlotDouble(2);

		let voice = getVoice();

		effectSetAudioParam(voice.source.playbackRate, rate, fade);
	},
	"loop"() {
		let voice = getVoice();
		wrenSetSlotBool(0, voice.source.loop);
	},
	"loop=(_)"() {
		if (wrenGetSlotType(1) !== 0) {
			wrenAbort("loop must be a Bool");
			return;
		}

		let voice = getVoice();
		let loop = wrenGetSlotBool(1);

		voice.source.loop = loop;
		
		// Ensure we have a loop end point set (needed for loop start).
		if (loop) {
			voice.source.loopEnd = voice.audio.buffer.duration;
		}
	},
	"loopStart"() {
		let voice = getVoice();
		wrenSetSlotDouble(0, voice.source.loopStart);
	},
	"loopStart=(_)"() {
		if (wrenGetSlotType(1) !== 1) {
			wrenAbort("loopStart must be a Num");
			return;
		}

		let voice = getVoice();
		let loopStart = wrenGetSlotDouble(1);

		voice.source.loopStart = loopStart;
	},
});

/**
 * @typedef {object} Effect
 * @property {number} type
 * @property {AudioNode} input
 * @property {AudioNode[]} outputs if null, then 
 * @property {() => void} [setupGraph]
 * @property {(index: number) => number} getParam
 * @property {(index: number, value: number, fade?: number) => void} setParam
 * @property {(index: number, value: number) => (string|null|undefined|void)} [checkParam]
 * @property {() => void} [free]
 */

/**
 * @typedef {object} STBVorbis
 * @property {(buffer: ArrayBuffer|Uint8Array, callback: (event: { data: Float32Array[], sampleRate: number, eof: boolean, error: string | null }) => void) => void} decode
 */

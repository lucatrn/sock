import { getAssetAsArrayBuffer } from "../asset-database.js";
import { addForeignClass } from "../foreign.js";
import { sockJsGlobal } from "../globals.js";
import * as Path from "../path.js";
import { wrenAbort, wrenEnsureSlots, wrenGetSlotBool, wrenGetSlotDouble, wrenGetSlotForeign, wrenGetSlotHandle, wrenGetSlotIsInstanceOf, wrenGetSlotString, wrenGetSlotType, wrenGetVariable, wrenReleaseHandle, wrenSetSlotBool, wrenSetSlotDouble, wrenSetSlotHandle, wrenSetSlotNewForeign } from "../vm.js";
import { loadAsset } from "./asset.js";
import { WrenHandle } from "./promise.js";

const MAX_EFFECT_PER_AUDIO = 8;

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

const PARAM_REVERB_VOLUME = 0;

const FILTER_TYPE_LOWPASS = 0;
const FILTER_TYPE_HIGHPASS = 1;
const FILTER_TYPE_BANDPASS = 2;
const FILTER_TYPE_MIN = 0;
const FILTER_TYPE_MAX = 2;

const BASE_MASTER_GAIN = 0.5;

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
let handle_Audio = 0;

/**
 * @type {number}
 */
let handle_AudioBus = 0;

/**
 * @type {number}
 */
let handle_Voice = 0;

/**
 * @param {number} duration
 * @returns {AudioBuffer}
 */
function generateImpulse(duration) {
	let frameCount = Math.floor(duration * audioctx.sampleRate);
	let buffer = new AudioBuffer({
		length: frameCount,
		sampleRate: audioctx.sampleRate,
		numberOfChannels: 2,
	});

	let ch1 = buffer.getChannelData(0);
	let ch2 = buffer.getChannelData(1);
	let baseVolume = 0.022;

	for (let i = 0; i < frameCount; i++) {
		let volume = baseVolume * Math.exp(-5 * (i / frameCount));
		ch1[i] = (Math.random() * 2 - 1) * volume;
		ch2[i] = (Math.random() * 2 - 1) * volume;
	}

	return buffer;
}

/**
 * @type {AudioBuffer}
 */
let implulseChurch;

export function initAudioModule() {
	// Init audio graph.
	// Ideally the audiocontext is created from the HTML, but we have a fallback here as well.
	audioctx = sockJsGlobal.audio ?? new AudioContext();

	if (audioctx.state === "suspended") {
		console.warn("AudioContext is suspended");
	}
	
	masterGain = new GainNode(audioctx, {
		gain: BASE_MASTER_GAIN,
	});
	masterGain.connect(audioctx.destination);

	// Get handles.
	wrenEnsureSlots(1);

	wrenGetVariable("sock", "Audio", 0);
	handle_Audio = wrenGetSlotHandle(0);

	wrenGetVariable("sock", "Voice", 0);
	handle_Voice = wrenGetSlotHandle(0);
	
	wrenGetVariable("sock", "AudioBus", 0);
	handle_AudioBus = wrenGetSlotHandle(0);
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

class AudioControls {
	/**
	 * @param {AudioControls|null} [destination] 
	 */
	constructor(destination) {
		/**
		 * @type {Effect[]}
		 */
		this.effects = Array(MAX_EFFECT_PER_AUDIO).fill(null);

		this.gain = audioctx.createGain();

		/**
		 * Used to pipe this graph into another graph.
		 * @type {AudioControls|null|undefined}
		 */
		this.destination = destination;

		this.updateGraph();
	}

	/**
	 * @returns {AudioNode}
	 */
	getInput() {
		for (let i = 0; i < MAX_EFFECT_PER_AUDIO; i++) {
			let effect = this.effects[i];

			if (effect) {
				return effect.input;
			}
		}

		return this.gain;
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
		/** @type {AudioNode[]} */
		let nodes = [];

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
			node.connect(this.gain);
		}

		this.gain.disconnect();

		this.gain.connect(this.destination ? this.destination.getInput() : masterGain);
	}
}

class AudioBus extends AudioControls {
	/**
	 * @param {number} ptr
	 */
	constructor(ptr) {
		super();

		this.ptr = ptr;
	}
}

class Audio {
	/**
	 * @param {number} ptr
	 */
	constructor(ptr) {
		this.ptr = ptr;
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
		this.maxDelay = -1;
		this.node = new GainNode(audioctx);
		this.decay = new GainNode(audioctx);
		this.mix = new GainNode(audioctx);
	}

	create() {
		this.delay = new DelayNode(audioctx, {
			delayTime: this.maxDelay,
			maxDelayTime: this.maxDelay,
		});
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
			return this.delay ? this.delay.delayTime.value : this.maxDelay;
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
			if (this.maxDelay < 0) {
				this.maxDelay = value;
			}
			if (this.delay) {
				effectSetAudioParam(this.delay.delayTime, value, fade);
			}
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

class ReverbEffect {
	constructor() {
		this.gain = new GainNode(audioctx);
		this.wetGain = new GainNode(audioctx, { gain: 1 });
	}

	create() {
		if (!implulseChurch) {
			implulseChurch = generateImpulse(3);
		}

		this.convolver = new ConvolverNode(audioctx, {
			buffer: implulseChurch,
			disableNormalization: true,
		});

		this.convolver.connect(this.wetGain);
	}

	setupGraph() {
		this.gain.connect(this.convolver);
	}

	/**
	 * @param {number} index
	 * @returns {number}
	 */
	getParam(index) {
		if (index == PARAM_REVERB_VOLUME) {
			return this.wetGain.gain.value;
		}
	}

	/**
	 * @param {number} index
	 * @param {number} value
	 */
	checkParam(index, value) {
	}
	
	/**
	 * @param {number} index
	 * @param {number} value
	 * @param {number} [fade]
	 */
	setParam(index, value, fade) {
		if (index === PARAM_REVERB_VOLUME) {
			effectSetAudioParam(this.wetGain.gain, value, fade);
		}
	}

	get type() { return EFFECT_TYPE_REVERB }
	get input() { return this.gain }
	get outputs() { return [ this.gain, this.wetGain ] }
}

// === VOICE ===

class Voice extends AudioControls {
	/**
	 * @param {number} ptr
	 * @param {Audio} audio
	 * @param {number} audioHandle
	 * @param {AudioControls} [destination]
	 */
	constructor(ptr, audio, audioHandle, destination) {
		super(destination);

		this.ptr = ptr;
		this.audio = audio;
		this.audioHandle = audioHandle;

		this._initSource();

		/**
		 * 0: not yet started  
		 * 1: playing  
		 * 2: paused  
		 * 3: stopped  
		 */
		this.state = 0;
		this.time = 0;
	}

	/**
	 * @private
	 */
	_initSource() {
		this.source = audioctx.createBufferSource();
		this.source.buffer = this.audio.buffer;
		this.source.onended = () => {
			this.state = 3;
			this.time = this.audio.buffer.duration;
		};
	}
	
	play() {
		if (this.state === 0 || this.state === 2) {
			if (this.state === 2) {
				let old = this.source;

				this._initSource();

				this.source.loop = old.loop;
				this.source.loopStart = old.loopStart;
				this.source.playbackRate.value = old.playbackRate.value;
			}

			this.source.connect(this.getInput());
			this.source.start(0, this.time);
			this.startTime = audioctx.currentTime;
			this.state = 1;
		}
	}

	saveTime() {
		this.time += (audioctx.currentTime - this.startTime) * this.source.playbackRate.value;
		this.startTime = audioctx.currentTime;
	}

	pause() {
		if (this.state === 1) {
			this.saveTime();
			this.stopSource();
			this.state = 2;
		}
	}
 
	stopSource() { 
		this.source.onended = null;
		this.source.stop();
		this.source.disconnect();
	}

	updateGraph() {
		super.updateGraph();

		if (this.source) {
			this.source.disconnect();
			this.source.connect(this.getInput());
		}
	}
}

/**
 * @type {Map<number, AudioBus>}
 */
let buses = new Map();

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
 * @returns {AudioBus}
 */
function getAudioBus() {
	return buses.get(wrenGetSlotForeign(0));
}

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
 * @param {string} path
 * @returns {Promise<AudioBuffer>}
 */
async function loadAudioBuffer(path) {
	let buffer = await getAssetAsArrayBuffer(path);

	let ext = Path.getExtension(path);
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
					console.info(`Failed to natively decode ${path}, switching to JavaScript OGG decoder`, error);
					canDecodeOGG = false;
					return await decodeOGG(buffer);
				} else {
					throw error;
				}
			}
		}
	} catch (error) {
		console.error(error);
		throw Error(`failed to decode audio ${path}`);
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
 * @param {AudioControls} audio
 */
function wrenAudioSetEffect(audio) {
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

	/** @type {Effect} */
	let effect;
	if (type === EFFECT_TYPE_FILTER) {
		effect = new FilterEffect();
	} else if (type === EFFECT_TYPE_ECHO) {
		effect = new EchoEffect();
	} else if (type === EFFECT_TYPE_REVERB) {
		effect = new ReverbEffect();
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

	if (effect.create) {
		effect.create();
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
}

/**
 * @param {AudioControls} audio
 */
function wrenAudioGetEffect(audio) {
	if (wrenGetSlotType(1) !== 1) {
		wrenAbort("index must be a Num");
		return;
	}
	
	let index = Math.trunc(wrenGetSlotDouble(1));
	if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
		wrenAbort("invalid effect index");
		return;
	}

	wrenSetSlotDouble(0, audio.getEffectType(index));
}

/**
 * @param {AudioControls} audio
 */
function wrenAudioGetParam(audio) {
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
}

/**
 * @param {AudioControls} audio
 */
function wrenAudioSetParam(audio) {
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
}

/**
 * @param {GainNode} gainNode
 */
function wrenFadeVolume(gainNode) {
	for (let i = 1; i <= 2; i++) {
		if (wrenGetSlotType(i) !== 1) {
			wrenAbort("volume and fade must be Nums");
			return;
		}
	}

	let volume = wrenGetSlotDouble(1);
	let fade = wrenGetSlotDouble(2);

	fadeVolume(gainNode, volume, fade);
}


addForeignClass("sock", "AudioBus", [
	() => {
		let ptr = wrenSetSlotNewForeign(0, 0, 0);

		let bus = new AudioBus(ptr);

		buses.set(ptr, bus);
	},
	(ptr) => {
		buses.delete(ptr);
	},
], {
	"volume"() {
		let bus = getAudioBus();
		wrenSetSlotDouble(0, bus.gain.gain.value);
	},
	"fadeVolume(_,_)"() {
		wrenFadeVolume(getAudioBus().gain);
	},
	"setEffect_(_,_,_,_,_,_)"() {
		wrenAudioSetEffect(getAudioBus());
	},
	"getEffect_(_)"() {
		wrenAudioGetEffect(getAudioBus());
	},
	"getParam_(_,_,_)"() {
		wrenAudioGetParam(getAudioBus());
	},
	"setParam_(_,_,_,_,_)"() {
		wrenAudioSetParam(getAudioBus());
	},
});

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
	"voice(_)"() {
		let audioHandle = wrenGetSlotHandle(0);

		let audio = getAudio();
		if (!audio.buffer) {
			wrenAbort("audio not loaded");
			return;
		}

		// Check slot 1 is an AudioBus.
		wrenSetSlotHandle(0, handle_AudioBus);
		if (!wrenGetSlotIsInstanceOf(1, 0)) {
			wrenAbort("bus must be an AudioBus");
			return;
		}

		let bus = buses.get(wrenGetSlotForeign(1));

		wrenSetSlotHandle(1, handle_Voice);
		let ptr = wrenSetSlotNewForeign(0, 1, 0);

		let voice = new Voice(ptr, audio, audioHandle, bus);
		voices.set(ptr, voice);
	},
}, {
	"load_(_,_)"() {
		loadAsset(async (path) => {
			let buffer = await loadAudioBuffer(path);

			wrenEnsureSlots(1);
			wrenSetSlotHandle(0, handle_Audio);
			let ptr = wrenSetSlotNewForeign(0, 0, 0);

			let audio = new Audio(ptr);
			audios.set(ptr, audio);

			audio.setBuffer(buffer);

			return new WrenHandle(wrenGetSlotHandle(0));
		});
	},
	"volume"() {
		wrenSetSlotDouble(0, masterGain.gain.value / BASE_MASTER_GAIN);
	},
	"fadeVolume(_,_)"() {
		for (let i = 1; i <= 2; i++) {
			if (wrenGetSlotType(i) !== 1) {
				wrenAbort("args must be Nums");
				return;
			}
		}

		let volume = wrenGetSlotDouble(1) * BASE_MASTER_GAIN;
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
		
		voice.play();
	},
	"pause()"() {
		let voice = getVoice();

		voice.pause();
	},
	"isPaused"() {
		let voice = getVoice();
		wrenSetSlotBool(0, voice.state !== 1);
	},
	"stop()"() {
		let voice = getVoice();
		voice.stopSource();
		voice.state = 3;
	},
	"time"() {
		let voice = getVoice();
		if (voice.state === 1) {
			voice.saveTime();
		}
		wrenSetSlotDouble(0, voice.time);
	},
	"time=(_)"() {
		if (wrenGetSlotType(1) !== 1) {
			wrenAbort("time must be Num");
			return;
		}
		let time = wrenGetSlotDouble(1);
		time = Math.max(0, time);

		let voice = getVoice();
		voice.pause();
		voice.time = time;
		voice.play();
	},
	"volume"() {
		let voice = getVoice();
		wrenSetSlotDouble(0, voice.gain.gain.value);
	},
	"fadeVolume(_,_)"() {
		wrenFadeVolume(getVoice().gain);
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
	"setEffect_(_,_,_,_,_,_)"() {
		wrenAudioSetEffect(getVoice());
	},
	"getEffect_(_)"() {
		wrenAudioGetEffect(getVoice());
	},
	"getParam_(_,_,_)"() {
		wrenAudioGetParam(getVoice());
	},
	"setParam_(_,_,_,_,_)"() {
		wrenAudioSetParam(getVoice());
	},
});

/**
 * @typedef {object} Effect
 * @property {number} type
 * @property {AudioNode} input
 * @property {AudioNode[]} outputs if null, then 
 * @property {() => void} [create]
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

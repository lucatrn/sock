
//#define MAX_EFFECT_PER_AUDIO 4

//#define TYPE_NONE 0
//#define TYPE_FILTER 1
//#define TYPE_ECHO 2
//#define TYPE_REVERB 3
//#define TYPE_DISTORTION 4

//#define PARAM_FILTER_TYPE 0
//#define PARAM_FILTER_FREQUENCY 1
//#define PARAM_FILTER_RESONANCE 2

//#define PARAM_ECHO_DELAY 0
//#define PARAM_ECHO_DECAY 1
//#define PARAM_ECHO_VOLUME 2

//#define FILTER_TYPE_LOWPASS 0
//#define FILTER_TYPE_HIGHPASS 1
//#define FILTER_TYPE_BANDPASS 2

//#define FILTER_DEFAULT_RESONANCE 1

class AudioEffects {
	// Returns the type of the effect at the given index.
	// getEffect_(index)

	// Set/update effect at index with initial paramters.
	// setEffect_(index, type, param0, param1, param2, param3)

	// Get an effect parameter.
	// [type] is used for validation.
	// getParam_(index, type, param)

	// Set an effect parameter.
	// [type] is used for validation.
	// [time] is used for fading. Set to 0 for no fading.
	// setParam_(index, type, param, value, time)

	removeEffect(i) {
		setEffect_(i, TYPE_NONE, 0, 0, 0, 0)
	}

	removeEffects() {
		for (i in 0...MAX_EFFECT_PER_AUDIO) {
			removeEffect(i)
		}
	}

	effect(i) {
		var t = getEffect_(i)
		if (t == TYPE_FILTER) return FilterEffect.new(this, i)
		if (t == TYPE_ECHO) return EchoEffect.new(this, i)
		// if (t == TYPE_REVERB) return ReverbEffect.new(this, i)
		// if (t == TYPE_DISTORTION) return DistortionEffect.new(this, i)
		return null
	}

	addLowpass(i, f) { addLowpass(i, f, FILTER_DEFAULT_RESONANCE) }
	addLowpass(i, f, r) { addFilter_(i, FILTER_TYPE_LOWPASS, f, r) }

	addHighpass(i, f) { addHighpass(i, f, FILTER_DEFAULT_RESONANCE) }
	addHighpass(i, f, r) { addFilter_(i, FILTER_TYPE_HIGHPASS, f, r) }
	
	addBandpass(i, f) { addBandpass(i, f, FILTER_DEFAULT_RESONANCE) }
	addBandpass(i, f, r) { addFilter_(i, FILTER_TYPE_BANDPASS, f, r) }

	addFilter_(i, t, f, r) {
		setEffect_(i, TYPE_FILTER, t, f, r, 0)
		return FilterEffect.new(this, i)
	}

	addEcho(i, d, k) { addEcho(i, d, k, k) }
	addEcho(i, d, k, m) {
		setEffect_(i, TYPE_ECHO, d, k, m, 0)
		return EchoEffect.new(this, i)
	}
}

class FilterEffect {
	construct new(o, i) {
		_o = o
		_i = i
	}

	index { _i }
	remove() { _o.removeEffect(_i) }

	type {
		var v = _o.getParam_(_i, TYPE_FILTER, PARAM_FILTER_TYPE)
		return v == FILTER_TYPE_LOWPASS ? "low" : (v == FILTER_TYPE_HIGHPASS ? "high" : (v == FILTER_TYPE_BANDPASS ? "band" : null))
	}
	type=(v) {
		v = v == "low" ? FILTER_TYPE_LOWPASS : (v == "high" ? FILTER_TYPE_HIGHPASS : (v == "band" ? FILTER_TYPE_BANDPASS : -1))
		_o.setParam_(_i, TYPE_FILTER, PARAM_FILTER_TYPE, v, 0)
	}

	frequency { _o.getParam_(_i, TYPE_FILTER, PARAM_FILTER_FREQUENCY) }
	frequency=(v) { fadeFrequency(v, 0) }
	fadeFrequency(v, t) { _o.setParam_(_i, TYPE_FILTER, PARAM_FILTER_FREQUENCY, v, t) }
	
	resonance { _o.getParam_(_i, TYPE_FILTER, PARAM_FILTER_RESONANCE) }
	resonance=(v) { fadeResonance(v, 0) }
	fadeResonance(v, t) { _o.setParam_(_i, TYPE_FILTER, PARAM_FILTER_RESONANCE, v, t) }
}

class EchoEffect {
	construct new(o, i) {
		_o = o
		_i = i
	}

	index { _i }
	remove() { _o.removeEffect(_i) }

	volume { _o.getParam_(_i, TYPE_FILTER, PARAM_ECHO_VOLUME) }
	delay { _o.getParam_(_i, TYPE_FILTER, PARAM_ECHO_DELAY) }
	decay { _o.getParam_(_i, TYPE_FILTER, PARAM_ECHO_DECAY) }
}

// foreign class Bus is AudioEffects {
// 	construct new(id) {}
// 
// 	foreign volume
// 	volume=(v) { fadeVolume(v, 0) }
// 	foreign fadeVolume(v, t)
// }

foreign class Audio is AudioEffects {
	construct new() {}

	static load(p) {
		p = Asset.path(Meta.module(1), p)
		var a = new()
		Loading.add_(a.load_(p))
		return a
	}

	foreign load_(path)

	foreign duration

	foreign voice()

	play() { voice().play() }
	play(vol) {
		var v = voice()
		v.volume = vol
		return v.play()
	}

	foreign getEffect_(index)
	foreign setEffect_(index, type, param0, param1, param2, param3)
	foreign getParam_(index, type, param)
	foreign setParam_(index, type, param, value, time)

	foreign static volume
	static volume=(v) { fadeVolume(v, 0) }
	foreign static fadeVolume(v, t) 

	// static master { __m }

	static init_() {
		// __m = Bus.new(0)
	}
}

foreign class Voice {
	foreign play()
	foreign pause()
	foreign stop()
	foreign isPaused

	togglePaused() { isPaused ? play() : pause() }

	foreign volume
	volume=(v) { fadeVolume(v, 0) }
	foreign fadeVolume(v, t)
	
	// foreign pan
	// pan=(v) { fadePan(v, 0) }
	// foreign fadePan(v, t)
	
	foreign rate
	rate=(v) { fadeRate(v, 0) }
	foreign fadeRate(v, t)

	pitch { 12 * rate.log2 }
	pitch=(v) { fadePitch(v, 0) }
	fadePitch(v, t) { fadeRate((2).pow(v / 12), t) }

	foreign loop
	foreign loop=(v)
	foreign loopStart
	foreign loopStart=(v)
}

Audio.init_()


//#if NEVER
	Audio.volume = 0.1

	Voice.stopAll()

	var clip = Audio.load("chiptune.wav")

	clip.remove
	
//#endif

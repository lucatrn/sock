
//#define TYPE_NONE 0
//#define TYPE_FILTER 1
//#define TYPE_ECHO 2
//#define TYPE_REVERB 3
//#define TYPE_DISTORTION 4

//#define PARAM_FILTER_TYPE 0
//#define PARAM_FILTER_FREQUENCY 1
//#define PARAM_FILTER_RESONANCE 2

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

	effect(i) {
		var t = getEffect_(i)
		if (t == TYPE_FILTER) return FilterEffect.new(this, i)
		// if (t == TYPE_ECHO) return EchoEffect.new(this, i)
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
		setEffect_(i, TYPE_FILTER, i, f, r, 0)
		return FilterEffect.new(this, i)
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
		if (v == FILTER_TYPE_LOWPASS) return "low"
		if (v == FILTER_TYPE_HIGHPASS) return "high"
	}
	type=(v) {
		v = v == "low" ? FILTER_TYPE_LOWPASS : (v == "high" ? FILTER_TYPE_HIGHPASS : -1)
		_o.setParam_(_i, TYPE_FILTER, PARAM_FILTER_TYPE, v, 0)
	}

	frequency { _o.getParam_(_i, TYPE_FILTER, PARAM_FILTER_FREQUENCY) }
	frequency=(v) { fadeFrequency(v, 0) }
	fadeFrequency(v, t) { _o.setParam_(_i, TYPE_FILTER, PARAM_FILTER_FREQUENCY, v, t) }
	
	resonance { _o.getParam_(_i, TYPE_FILTER, PARAM_FILTER_RESONANCE) }
	resonance=(v) { fadeResonance(v, 0) }
	fadeResonance(v, t) { _o.setParam_(_i, TYPE_FILTER, PARAM_FILTER_RESONANCE, v, t) }
}

// foreign class Bus {
// 	construct new(id) {}
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

	// foreign static volume
	// foreign static volume=(v)

	foreign voice()

	play() { voice().play() }
	play(vol) {
		var v = voice()
		v.volume = vol
		return v.play()
	}

	// Effects interface.
	foreign getEffect_(index)
	foreign setEffect_(index, type, param0, param1, param2, param3)
	foreign getParam_(index, type, param)
	foreign setParam_(index, type, param, value, time)
	// foreign clearEffects()
	// foreign effectCount

// 	static master { __master }
// 
// 	init_() {
// 		__master = Bus.new(0)
// 	}
}

foreign class Voice {
	foreign play()
}



//#if NEVER
	Audio.volume = 0.1

	var clip = Audio.load("chiptune.wav")

	var mus1 = Audio.load("mus1.ogg")
	var mus2 = Audio.load("mus2.ogg")
	var mus3 = Audio.load("mus3.ogg")

	// volume
	// panning
	// offset
	// length
	// looping
	// effects

	var voice = clip.play()
	var voice = clip.play(0.5) // volume
	var voice = clip.play(0.5) // volume

	clip.filters.count
	clip.filters.clear()

	var lp = clip.filters[0] = LowpassFilter.new(512)
	lp.frequency = 1024
	lp.fadeFrequency(1024, 0.9)

	var ds = clip.effects.addDistortion(0, 0.5, 0.5)

	var ds = clip.addDistortion(0, 0.5, 0.5)
	clip.clearEffects()
	clip.effectCount

	clip.setFilter(0, LowpassFilter.new(512))

	clip[0] = LowpassFilter.new(512)
	clip[1] = EchoFilter.new()

	var lp = clip.addLowpassFilter(512)
	lp.frequency = 1024
	lp.fadeFrequency(1024, 2)
	lp.remove()

	clip.addEcho()
	clip.addReverb()
	clip.clearEffects()

	var voice = clip.voice()
	voice.volume = 0.4
	voice.linearVolume = 0.4
	voice.loop = true
	voice.loopEnd = 2.5
	voice.loopStart = 0.5
	voice.play()
	voice.pause()
	voice.stop()

	// stop()
	// set time
	// volume
	// panning
	// effects?

	clip.bus

	var filter = AudioEffect.new().echo(0.3, 0.99).lowpass(440, 3).split()
//#endif

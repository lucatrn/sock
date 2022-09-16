
#include <stdio.h>
#include <new>
#include <stdint.h>
#include "soloud.h"
#include "soloud_wav.h"
#include "soloud_biquadresonantfilter.h"
#include "soloud_echofilter.h"
#include "soloud_freeverbfilter.h"

extern "C" {
	#include "wren.h"
}

#define MAX_EFFECT_PER_AUDIO 8

#define EFFECT_TYPE_NONE 0
#define EFFECT_TYPE_FILTER 1
#define EFFECT_TYPE_ECHO 2
#define EFFECT_TYPE_REVERB 3
#define EFFECT_TYPE_DISTORTION 4
#define EFFECT_TYPE_MIN 1
#define EFFECT_TYPE_MAX 4

#define PARAM_FILTER_TYPE 0
#define PARAM_FILTER_FREQUENCY 1
#define PARAM_FILTER_RESONANCE 2

#define PARAM_ECHO_DELAY 0
#define PARAM_ECHO_DECAY 1
#define PARAM_ECHO_VOLUME 2

#define PARAM_REVERB_VOLUME 0

#define FILTER_TYPE_LOWPASS 0
#define FILTER_TYPE_HIGHPASS 1
#define FILTER_TYPE_BANDPASS 2
#define FILTER_TYPE_MIN 0
#define FILTER_TYPE_MAX 2

static SoLoud::Soloud soloud;

static WrenHandle* handle_Voice = NULL;
static WrenHandle* handle_AudioBus = NULL;

typedef struct {
	SoLoud::Wav wav;
} Audio;

typedef struct {
	SoLoud::Bus bus;
	SoLoud::handle handle;
	uint8_t effectTypes[MAX_EFFECT_PER_AUDIO];
} AudioBus;

typedef struct {
	// Needed for finalizer.
	WrenVM* vm;
	// Used to prevent parent Audio object from being GCed.
	WrenHandle* audioHandle;
	SoLoud::handle handle;
	uint8_t effectTypes[MAX_EFFECT_PER_AUDIO];
} Voice;

void wrenAbort(WrenVM* vm, const char* msg) {
	wrenEnsureSlots(vm, 1);
	wrenSetSlotString(vm, 0, msg);
	wrenAbortFiber(vm, 0);
}

// Validate effect paramters against type.
// Returns string with error, or NULL.
float wrenAudioValidateEffectParam(WrenVM* vm, int type, int paramIndex, float paramValue) {
	if (!isfinite(paramValue)) {
		wrenAbort(vm, "param must be finite");
		return NAN;
	}

	// None
	if (type == EFFECT_TYPE_NONE) {
	}

	// Filter
	else if (type == EFFECT_TYPE_FILTER) {
		switch (paramIndex) {
			// Filter type
			case PARAM_FILTER_TYPE: {
				int filterType = (int)paramValue;
				if (filterType < FILTER_TYPE_MIN || filterType > FILTER_TYPE_MAX) {
					wrenAbort(vm, "invalid filter index");
					return NAN;
				}
			} break;
			// Frequency
			case PARAM_FILTER_FREQUENCY: {
				if (paramValue <= 0.0f) {
					wrenAbort(vm, "filter frequency must be positive");
					return NAN;
				}

				// Frequency should not be less than 10.
				// Frequency should not be more than nyquist frequency.
				// Frequency seams to break above 22000 so we'll clamp there too.
				float nyquist = floorf(soloud.mSamplerate * 0.5f);

				paramValue = max(paramValue, 10.0f);
				paramValue = min(paramValue, nyquist);
				paramValue = min(paramValue, 22000.0f);
			} break;
			// Resonance
			case PARAM_FILTER_RESONANCE: {
				if (paramValue <= 0.0f) {
					wrenAbort(vm, "filter resonance must be positive");
					return NAN;
				}

				// Clamp with same constants as WebAudio, those seem about right.
				paramValue = max(paramValue, 0.0001f);
				paramValue = min(paramValue, 1000.0f);
			} break;
		}
	}

	// Echo
	else if (type == EFFECT_TYPE_ECHO) {
		switch (paramIndex) {
			// Delay
			case PARAM_ECHO_DELAY: {
				if (paramValue <= 0.0f) {
					wrenAbort(vm, "decay not be less than 1ms");
					return NAN;
				}
				if (paramValue > 1.0f) {
					wrenAbort(vm, "decay not be more than 1s");
					return NAN;
				}
			} break;
			// Decay
			case PARAM_ECHO_DECAY: {
				if (paramValue < 0.0f) {
					wrenAbort(vm, "decay must not be negative");
					return NAN;
				}
				if (paramValue >= 1.0f) {
					wrenAbort(vm, "decay must less than 1");
					return NAN;
				}
			} break;
			// Mix
			case PARAM_ECHO_VOLUME: {
				paramValue = max(paramValue, 0.0f);
			} break;
		}
	}
	
	// Reverb
	else if (type == EFFECT_TYPE_REVERB) {
		switch (paramIndex) {
			// Mix
			case PARAM_REVERB_VOLUME: {
				paramValue = max(paramValue, 0.0f);
			} break;
		}
	}

	return paramValue;
}

int audioSockToSoLoudParamIndex(int filterType, int paramIndex) {
	if (filterType == EFFECT_TYPE_FILTER)
	{
		switch (paramIndex) {
			case PARAM_FILTER_TYPE: return SoLoud::BiquadResonantFilter::TYPE;
			case PARAM_FILTER_FREQUENCY: return SoLoud::BiquadResonantFilter::FREQUENCY;
			case PARAM_FILTER_RESONANCE: return SoLoud::BiquadResonantFilter::RESONANCE;
		}
	}
	else if (filterType == EFFECT_TYPE_ECHO)
	{
		switch (paramIndex) {
			case PARAM_ECHO_DELAY: return SoLoud::EchoFilter::DELAY;
			case PARAM_ECHO_DECAY: return SoLoud::EchoFilter::DECAY;
			case PARAM_ECHO_VOLUME: return SoLoud::EchoFilter::WET;
		}
	}
	else if (filterType == EFFECT_TYPE_REVERB)
	{
		switch (paramIndex) {
			case PARAM_REVERB_VOLUME: return SoLoud::FreeverbFilter::WET;
		}
	}
	return -1;
}

void wrenVoiceFadeVolume(WrenVM* vm, SoLoud::handle handle) {
	for (int i = 1; i <= 2; i++) {
		if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
			wrenAbort(vm, "volume and fade must be Nums");
			return;
		}
	}

	float volume = (float)wrenGetSlotDouble(vm, 1);
	float fade = (float)wrenGetSlotDouble(vm, 2);

	volume = max(0.0f, volume);
	fade = max(0.002f, fade);

	soloud.fadeVolume(handle, volume, fade);
}

void wrenAudioSetEffect(WrenVM* vm, SoLoud::handle voiceHandle, uint8_t* effectTypes) {
	for (int i = 1; i <= 6; i++) {
		if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
			wrenAbort(vm, "args must be Nums");
			return;
		}
	}

	int index = (int)wrenGetSlotDouble(vm, 1);
	int type = (int)wrenGetSlotDouble(vm, 2);

	float params[4];
	params[0] = (float)wrenGetSlotDouble(vm, 3);
	params[1] = (float)wrenGetSlotDouble(vm, 4);
	params[2] = (float)wrenGetSlotDouble(vm, 5);
	params[3] = (float)wrenGetSlotDouble(vm, 6);

	// Validate type/index indices.
	if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
		wrenAbort(vm, "invalid effect index");
		return;
	}
	
	if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
		wrenAbort(vm, "invalid effect type");
		return;
	}

	// Validate parameter values against type.
	for (int i = 0; i < 4; i++) {
		params[i] = wrenAudioValidateEffectParam(vm, type, i, params[i]);

		if (isnan(params[i])) return;
	}

	// Update the filter.
	if (type == EFFECT_TYPE_NONE)
	{
		soloud.setFilter(voiceHandle, index, NULL);
	}
	else if (type == EFFECT_TYPE_FILTER)
	{
		SoLoud::BiquadResonantFilter filter = SoLoud::BiquadResonantFilter();
		filter.mFilterType = (int)params[PARAM_FILTER_TYPE];
		filter.mFrequency = params[PARAM_FILTER_FREQUENCY];
		filter.mResonance = params[PARAM_FILTER_RESONANCE];
		
		soloud.setFilter(voiceHandle, index, &filter);
	}
	else if (type == EFFECT_TYPE_ECHO)
	{
		SoLoud::EchoFilter filter = SoLoud::EchoFilter();
		filter.mDelay = params[PARAM_ECHO_DELAY];
		filter.mDecay = params[PARAM_ECHO_DECAY];
		filter.mWet = params[PARAM_ECHO_VOLUME];
		
		soloud.setFilter(voiceHandle, index, &filter);
	}
	else if (type == EFFECT_TYPE_REVERB)
	{
		SoLoud::FreeverbFilter filter = SoLoud::FreeverbFilter();
		filter.mWet = params[PARAM_REVERB_VOLUME];
		filter.mDamp = 0.1f;
		filter.mRoomSize = 0.9f;
		
		soloud.setFilter(voiceHandle, index, &filter);
	}
	else if (type == EFFECT_TYPE_DISTORTION)
	{
		// TODO
		return;
	}

	effectTypes[index] = type;
}

void wrenAudioGetEffect(WrenVM* vm, uint8_t* effectTypes) {
	if (wrenGetSlotType(vm, 1) != WREN_TYPE_NUM) {
		wrenAbort(vm, "index must be a Num");
		return;
	}
	
	int index = (int)wrenGetSlotDouble(vm, 1);
	if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
		wrenAbort(vm, "invalid effect index");
		return;
	}

	wrenSetSlotDouble(vm, 0, (double)effectTypes[index]);
}

void wrenAudioGetParam(WrenVM* vm, SoLoud::handle handle, uint8_t* effectTypes) {
	for (int i = 1; i <= 3; i++) {
		if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
			wrenAbort(vm, "args must be Nums");
			return;
		}
	}

	int index = (int)wrenGetSlotDouble(vm, 1);
	int type = (int)wrenGetSlotDouble(vm, 2);
	int paramIndex = (int)wrenGetSlotDouble(vm, 3);

	// Validate type/index indices.
	if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
		wrenAbort(vm, "invalid effect index");
		return;
	}

	if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
		wrenAbort(vm, "invalid effect type");
		return;
	}

	if (effectTypes[index] != type) {
		wrenAbort(vm, "effect type mismatch");
		return;
	}

	int paramIndexSoLoud = audioSockToSoLoudParamIndex(type, paramIndex);
	if (paramIndexSoLoud < 0) {
		wrenAbort(vm, "invalid param index");
		return;
	}

	// Get the parameter.
	wrenSetSlotDouble(vm, 0, soloud.getFilterParameter(handle, index, paramIndexSoLoud));
}

void wrenAudioSetParam(WrenVM* vm, SoLoud::handle handle, uint8_t* effectTypes) {
	for (int i = 1; i <= 5; i++) {
		if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
			wrenAbort(vm, "args must be Nums");
			return;
		}
	}

	int index = (int)wrenGetSlotDouble(vm, 1);
	int type = (int)wrenGetSlotDouble(vm, 2);
	int paramIndex = (int)wrenGetSlotDouble(vm, 3);
	float paramValue = (float)wrenGetSlotDouble(vm, 4);
	float fadeTime = (float)wrenGetSlotDouble(vm, 5);

	// Validate type/index indices.
	if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
		wrenAbort(vm, "invalid effect index");
		return;
	}

	if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
		wrenAbort(vm, "invalid effect type");
		return;
	}

	if (effectTypes[index] != type) {
		wrenAbort(vm, "effect type mismatch");
		return;
	}

	int paramIndexSoLoud = audioSockToSoLoudParamIndex(type, paramIndex);
	if (paramIndexSoLoud < 0) {
		wrenAbort(vm, "invalid param index");
		return;
	}
	
	if (fadeTime < 0.0f) {
		wrenAbort(vm, "fade time must be positive");
		return;
	}

	paramValue = wrenAudioValidateEffectParam(vm, type, paramIndex, paramValue);
	if (isnan(paramValue)) return;

	// Set the parameter
	soloud.setFilterParameter(handle, index, paramIndexSoLoud, paramValue);
}


extern "C" {
	bool sockAudioInit() {
		soloud.init();
		soloud.setMaxActiveVoiceCount(32);

		#if DEBUG

			printf("audio bufferSize=%d sampleRate=%d\n", (int)soloud.getBackendBufferSize(), (int)soloud.getBackendSamplerate());

		#endif

		return true;
	}

	void sockAudioQuit() {
		soloud.deinit();
	}


	// === AUDIO BUS ===

	void wren_audioBusAllocate(WrenVM* vm) {
		AudioBus* bus = (AudioBus*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(AudioBus));
		SoLoud::Bus* ptr = &bus->bus;

		new(ptr) SoLoud::Bus();

		for (int i = 0; i < MAX_EFFECT_PER_AUDIO; i++) {
			bus->effectTypes[i] = EFFECT_TYPE_NONE;
		}

		bus->handle = soloud.play(bus->bus);
	}
	
	void wren_audioBusFinalize(void* data) {
		AudioBus* bus = (AudioBus*)data;
		
		bus->bus.stop();
		
		bus->bus.~Bus();
	}

	void wren_audioBus_volume(WrenVM* vm) {
		AudioBus* bus = (AudioBus*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotDouble(vm, 0, soloud.getVolume(bus->handle));
	}

	void wren_audioBus_fadeVolume(WrenVM* vm) {
		AudioBus* bus = (AudioBus*)wrenGetSlotForeign(vm, 0);

		wrenVoiceFadeVolume(vm, bus->handle);
	}

	void wren_audioBus_setEffect_(WrenVM* vm) {
		AudioBus* bus = (AudioBus*)wrenGetSlotForeign(vm, 0);

		wrenAudioSetEffect(vm, bus->handle, bus->effectTypes);
	}

	void wren_audioBus_getEffect_(WrenVM* vm) {
		AudioBus* bus = (AudioBus*)wrenGetSlotForeign(vm, 0);

		wrenAudioGetEffect(vm, bus->effectTypes);
	}

	void wren_audioBus_getParam_(WrenVM* vm) {
		AudioBus* bus = (AudioBus*)wrenGetSlotForeign(vm, 0);

		wrenAudioGetParam(vm, bus->handle, bus->effectTypes);
	}

	void wren_audioBus_setParam_(WrenVM* vm) {
		AudioBus* bus = (AudioBus*)wrenGetSlotForeign(vm, 0);

		wrenAudioSetParam(vm,bus->handle, bus->effectTypes);
	}


	// === AUDIO ===

	void wren_Audio_volume(WrenVM* vm) {
		wrenSetSlotDouble(vm, 0, soloud.mGlobalVolume);
	}
	
	void wren_Audio_fadeVolume(WrenVM* vm) {
		for (int i = 1; i <= 2; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		float volume = (float)wrenGetSlotDouble(vm, 1);
		float fade = (float)wrenGetSlotDouble(vm, 2);

		volume = max(0.0f, volume);
		fade = max(0.002f, fade);

		soloud.fadeGlobalVolume(volume, fade);
	}

	Audio* audioAllocate(WrenVM* vm) {
		Audio* audio = (Audio*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(Audio));
		SoLoud::Wav* ptr = &audio->wav;

		new(ptr) SoLoud::Wav();

		return audio;
	}

	void wren_audioAllocate(WrenVM* vm) {
		audioAllocate(vm);
	}
	
	void wren_audioFinalize(void* data) {
		Audio* audio = (Audio*)data;

		audio->wav.~Wav();
	}

	bool wren_audio_loadHandler(WrenVM* vm, void* data, unsigned int len) {
		Audio* audio = audioAllocate(vm);

		SoLoud::result err = audio->wav.loadMem((unsigned char*)data, len, false, true);
		if (err != SoLoud::SO_NO_ERROR) {
			#if DEBUG

				printf("SoLoud error: %s\n", soloud.getErrorString(err));

			#endif

			wrenAbort(vm, "could not load Audio");
			return false;
		}

		return true;
	}

	void wren_audio_duration(WrenVM* vm) {
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);
		wrenSetSlotDouble(vm, 0, audio->wav.getLength());
	}

	void wrenVoiceInit(WrenVM* vm, Voice* voice, WrenHandle* audioHandle) {
		voice->vm = vm;
		voice->audioHandle = audioHandle;
		for (int i = 0; i < MAX_EFFECT_PER_AUDIO; i++) {
			voice->effectTypes[i] = EFFECT_TYPE_NONE;
		}
	}

	void wren_audio_voice(WrenVM* vm) {
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);
		if (audio->wav.mData == NULL) {
			wrenAbort(vm, "Audio not loaded");
			return;
		}

		WrenHandle* audioHandle = wrenGetSlotHandle(vm, 0);

		wrenEnsureSlots(vm, 2);
		if (handle_Voice) {
			wrenSetSlotHandle(vm, 1, handle_Voice);
		} else {
			wrenGetVariable(vm, "sock", "Voice", 1);
			handle_Voice = wrenGetSlotHandle(vm, 1);
		}

		Voice* voice = (Voice*)wrenSetSlotNewForeign(vm, 0, 1, sizeof(Voice));

		wrenVoiceInit(vm, voice, audioHandle);

		voice->handle = soloud.play(audio->wav, -1.0f, 0.0f, true);
	}

	void wren_audio_voiceBus(WrenVM* vm) {
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);
		if (audio->wav.mData == NULL) {
			wrenAbort(vm, "Audio not loaded");
			return;
		}

		WrenHandle* audioHandle = wrenGetSlotHandle(vm, 0);

		// Get AudioBus class in slot 0.
		if (handle_AudioBus) {
			wrenSetSlotHandle(vm, 0, handle_AudioBus);
		} else {
			wrenGetVariable(vm, "sock", "AudioBus", 0);
			handle_AudioBus = wrenGetSlotHandle(vm, 0);
		}

		// Check slot 1 is an AudioBus.
		if (!wrenGetSlotIsInstanceOf(vm, 1, 0)) {
			wrenAbort(vm, "bus must be an AudioBus");
			return;
		}

		AudioBus* audioBus = (AudioBus*)wrenGetSlotForeign(vm, 1);

		// Get Voice handle in slot 1.
		if (handle_Voice) {
			wrenSetSlotHandle(vm, 1, handle_Voice);
		} else {
			wrenGetVariable(vm, "sock", "Voice", 1);
			handle_Voice = wrenGetSlotHandle(vm, 1);
		}

		Voice* voice = (Voice*)wrenSetSlotNewForeign(vm, 0, 1, sizeof(Voice));

		wrenVoiceInit(vm, voice, audioHandle);

		voice->handle = audioBus->bus.play(audio->wav, -1.0f, 0.0f, true);
	}


	// Voice

	void wren_voiceAllocate(WrenVM* vm) {
		// wrenAbort(vm, "voice should not be constructed directly");
	}
	
	void wren_voiceFinalize(void* data) {
		Voice* voice = (Voice*)data;

		wrenReleaseHandle(voice->vm, voice->audioHandle);

		// if (voice->busHandle) {
		// 	wrenReleaseHandle(voice->vm, voice->audioHandle);
		// }

		// Paused voices should be released.
		if (soloud.getPause(voice->handle) || soloud.getSoftPause(voice->handle)) {
			soloud.stop(voice->handle);
		}
	}

	void wren_voice_play(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		soloud.setPause(voice->handle, false);
		soloud.setSoftPause(voice->handle, false);
	}
	
	void wren_voice_pause(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);
		
		soloud.setSoftPause(voice->handle, true);
	}

	void wren_voice_isPaused(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotBool(vm, 0, soloud.getPause(voice->handle) || soloud.getSoftPause(voice->handle));
	}

	void wren_voice_stop(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		soloud.stop(voice->handle);
	}

	void wren_voice_time(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotDouble(vm, 0, soloud.getStreamPosition(voice->handle));
	}
	
	void wren_voice_time_set(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_NUM) {
			wrenAbort(vm, "volume and fade must be Nums");
			return;
		}

		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);
		double time = wrenGetSlotDouble(vm, 1);
		time = max(0, time);
		
		soloud.seek(voice->handle, time);
	}

	void wren_voice_volume(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotDouble(vm, 0, soloud.getVolume(voice->handle));
	}

	void wren_voice_fadeVolume(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenVoiceFadeVolume(vm, voice->handle);
	}

	void wren_voice_rate(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotDouble(vm, 0, soloud.getRelativePlaySpeed(voice->handle));
	}
	
	void wren_voice_fadeRate(WrenVM* vm) {
		for (int i = 1; i <= 2; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		float rate = (float)wrenGetSlotDouble(vm, 1);
		float fade = (float)wrenGetSlotDouble(vm, 2);

		if (rate <= 0.0f) {
			wrenAbort(vm, "rate must be positive");
			return;
		}

		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		soloud.fadeRelativePlaySpeed(voice->handle, rate, fade);
	}

	void wren_voice_loop(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotBool(vm, 0, soloud.getLooping(voice->handle));
	}

	void wren_voice_loopSet(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_BOOL) {
			wrenAbort(vm, "loop must be a Bool");
			return;
		}

		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		bool loop = wrenGetSlotBool(vm, 1);

		soloud.setLooping(voice->handle, loop);
	}
	
	void wren_voice_loopStart(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotDouble(vm, 0, soloud.getLoopPoint(voice->handle));
	}

	void wren_voice_loopStartSet(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_NUM) {
			wrenAbort(vm, "loopStart must be a Num");
			return;
		}

		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		double loopPoint = wrenGetSlotBool(vm, 1);

		soloud.setLoopPoint(voice->handle, loopPoint);
	}

	void wren_voice_setEffect_(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenAudioSetEffect(vm, voice->handle, voice->effectTypes);
	}

	void wren_voice_getEffect_(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenAudioGetEffect(vm, voice->effectTypes);
	}

	void wren_voice_getParam_(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenAudioGetParam(vm, voice->handle, voice->effectTypes);
	}

	void wren_voice_setParam_(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenAudioSetParam(vm, voice->handle, voice->effectTypes);
	}
}

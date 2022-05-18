
#include <stdio.h>
#include <new>
#include <stdint.h>
#include "soloud/soloud.h"
#include "soloud/soloud_wav.h"
#include "soloud/soloud_biquadresonantfilter.h"
#include "soloud/soloud_echofilter.h"

extern "C" {
	#include "wren.h"
}

#define MAX_EFFECT_PER_AUDIO 4

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

#define FILTER_TYPE_LOWPASS 0
#define FILTER_TYPE_HIGHPASS 1
#define FILTER_TYPE_BANDPASS 2
#define FILTER_TYPE_MIN 0
#define FILTER_TYPE_MAX 2

static SoLoud::Soloud soloud;

static WrenHandle* handle_Voice = NULL;

typedef struct {
	SoLoud::Wav wav;
	uint8_t effectTypes[MAX_EFFECT_PER_AUDIO];
} Audio;

typedef struct {
	// Used to prevent parent Audio object from being GCed.
	WrenHandle* audioHandle;
	SoLoud::handle handle;
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

	// Filter
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
				if (paramValue < 0.0f || paramValue > 1.0f) {
					wrenAbort(vm, "mix must be 0 to 1");
					return NAN;
				}
			} break;
		}
	}

	return paramValue;
}

float wrenAudioGetParam(SoLoud::Filter* filter, int type, int paramIndex) {
	if (type == EFFECT_TYPE_FILTER) {
		SoLoud::BiquadResonantFilter* bq = (SoLoud::BiquadResonantFilter*)filter;
		// soloud.setFilterParameter(0, 0, SoLoud::BiquadResonantFilter::RESONANCE)

		switch (paramIndex) {
			case PARAM_FILTER_TYPE: return (float)bq->mFilterType;
			case PARAM_FILTER_FREQUENCY: return bq->mFrequency;
			case PARAM_FILTER_RESONANCE: return bq->mResonance;
		}
	} else if (type == EFFECT_TYPE_ECHO) {
		SoLoud::EchoFilter* echo = (SoLoud::EchoFilter*)filter;

		switch (paramIndex) {
			case PARAM_ECHO_DELAY: return echo->mDelay;
			case PARAM_ECHO_DECAY: return echo->mDecay;
			case PARAM_ECHO_VOLUME: return 1.0f;// echo->mFilter;
		}
	}

	return 0.0f;
}

// Set a live filter parameter on all playing voices of a given AudioSource.
void soloudSetParamAll(SoLoud::AudioSource &aSound, unsigned int filterIndex, unsigned int paramIndex, float paramValue) {
	if (aSound.mAudioSourceID) {
		soloud.lockAudioMutex_internal();
		
		for (int i = 0; i < (signed)soloud.mHighestVoice; i++) {
			if (soloud.mVoice[i] && soloud.mVoice[i]->mAudioSourceID == aSound.mAudioSourceID && soloud.mVoice[i]->mFilter[filterIndex]) {
				soloud.mVoice[i]->mFilter[filterIndex]->setFilterParameter(paramIndex, paramValue);
			}
		}

		soloud.unlockAudioMutex_internal();
	}
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

	void wren_audioAllocate(WrenVM* vm) {
		Audio* audio = (Audio*)wrenSetSlotNewForeign(vm, 0, 0, sizeof(Audio));
		SoLoud::Wav* ptr = &audio->wav;

		new(ptr) SoLoud::Wav();

		for (int i = 0; i < MAX_EFFECT_PER_AUDIO; i++) {
			audio->effectTypes[i] = EFFECT_TYPE_NONE;
		}
	}
	
	void wren_audioFinalize(WrenVM* vm) {
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);

		audio->wav.~Wav();
	}

	bool wren_audio_loadHandler(WrenVM* vm, const char* data, unsigned int len) {
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);

		if (audio->wav.mData) {
			wrenAbort(vm, "Audio already loaded");
			return false;
		}

		SoLoud::result err = audio->wav.loadMem((unsigned char*)data, len, false, true);
		if (err != SoLoud::SO_NO_ERROR) {
			printf("SoLoud error: %s\n", soloud.getErrorString(err));
			wrenAbort(vm, "could not load Audio");
			return false;
		}

		return true;
	}

	void wren_audio_duration(WrenVM* vm) {
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);
		wrenSetSlotDouble(vm, 0, audio->wav.getLength());
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

		voice->audioHandle = audioHandle;
		voice->handle = soloud.play(audio->wav, -1.0f, 0.0f, true);
	}

	void wren_audio_setEffect_(WrenVM* vm) {
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
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);

		int currType = audio->effectTypes[index];

		SoLoud::Filter* filter = audio->wav.mFilter[index];
		
		// Create new filter if needed.
		if (currType != type || filter == NULL) {
			// Free existing.
			if (currType != EFFECT_TYPE_NONE && filter != NULL) {
				audio->wav.mFilter[index] = NULL;
				delete filter;
			}

			// Create instance
			if (type == EFFECT_TYPE_NONE) {
				filter = NULL;
			} else if (type == EFFECT_TYPE_FILTER) {
				filter = new SoLoud::BiquadResonantFilter();
			} else if (type == EFFECT_TYPE_ECHO) {
				filter = new SoLoud::EchoFilter();
			}
		}

		// Update parameter values.
		if (type == EFFECT_TYPE_FILTER) {
			SoLoud::BiquadResonantFilter* bq = (SoLoud::BiquadResonantFilter*)filter;
			bq->mFilterType = (int)params[PARAM_FILTER_TYPE];
			bq->mFrequency = min(params[PARAM_FILTER_FREQUENCY], 22000.0f);
			bq->mResonance = params[PARAM_FILTER_RESONANCE];
		} else if (type == EFFECT_TYPE_ECHO) {
			SoLoud::EchoFilter* echo = (SoLoud::EchoFilter*)filter;
			echo->mDelay = params[PARAM_ECHO_DELAY];
			echo->mDecay = params[PARAM_ECHO_DECAY];
			// echo->mFilter = params[PARAM_ECHO_VOLUME];
		}

		// Save state changes.
		audio->effectTypes[index] = type;
		audio->wav.mFilter[index] = filter;
	}

	void wren_audio_getEffect_(WrenVM* vm) {
		if (wrenGetSlotType(vm, 1) != WREN_TYPE_NUM) {
			wrenAbort(vm, "index must be a Num");
			return;
		}
		
		int index = (int)wrenGetSlotDouble(vm, 1);
		if (index < 0 || index >= MAX_EFFECT_PER_AUDIO) {
			wrenAbort(vm, "invalid effect index");
			return;
		}

		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotDouble(vm, 0, (double)audio->effectTypes[index]);
	}

	void wren_audio_getParam_(WrenVM* vm) {
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

		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);

		if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
			wrenAbort(vm, "invalid effect type");
			return;
		}

		if (audio->effectTypes[index] != type) {
			wrenAbort(vm, "effect type mismatch");
			return;
		}

		if (paramIndex < 0 || paramIndex >= 4) {
			wrenAbort(vm, "invalid param index");
			return;
		}

		SoLoud::Filter* filter = audio->wav.mFilter[index];

		// Get the parameter.
		wrenSetSlotDouble(vm, 0, wrenAudioGetParam(filter, type, paramIndex));
	}

	void wren_audio_setParam_(WrenVM* vm) {
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

		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);

		if (type < EFFECT_TYPE_MIN || type > EFFECT_TYPE_MAX) {
			wrenAbort(vm, "invalid effect type");
			return;
		}

		if (audio->effectTypes[index] != type) {
			wrenAbort(vm, "effect type mismatch");
			return;
		}

		if (paramIndex < 0 || paramIndex >= 4) {
			wrenAbort(vm, "invalid param index");
			return;
		}
		
		if (fadeTime < 0.0f) {
			wrenAbort(vm, "fade time must be positive");
			return;
		}

		SoLoud::Filter* filter = audio->wav.mFilter[index];

		if (filter == NULL) {
			wrenAbort(vm, "effect not initialized");
			return;
		}

		paramValue = wrenAudioValidateEffectParam(vm, type, paramIndex, paramValue);
		if (isnan(paramValue)) return;

		// Set the parameter
		if (type == EFFECT_TYPE_FILTER) {
			SoLoud::BiquadResonantFilter* bq = (SoLoud::BiquadResonantFilter*)filter;

			switch (paramIndex) {
				case PARAM_FILTER_TYPE: {
					bq->mFilterType = (int)paramValue;
				} break;
				case PARAM_FILTER_FREQUENCY: {
					bq->mFrequency = paramValue;
					soloudSetParamAll(audio->wav, index, SoLoud::BiquadResonantFilter::FREQUENCY, paramValue);
					// TODO handle fade
				} break;
				case PARAM_FILTER_RESONANCE: {
					bq->mResonance = paramValue;
					soloudSetParamAll(audio->wav, index, SoLoud::BiquadResonantFilter::RESONANCE, paramValue);
					// TODO handle fade
				} break;
			}
		} else if (type == EFFECT_TYPE_ECHO) {
			SoLoud::EchoFilter* echo = (SoLoud::EchoFilter*)filter;

			switch (paramIndex) {
				case PARAM_ECHO_DELAY: {
					echo->mDelay= paramValue;
				} break;
				case PARAM_ECHO_DECAY: {
					echo->mDecay = paramValue;
				} break;
				case PARAM_ECHO_VOLUME: {
					// TODO
				} break;
			}
		}
	}


	// Voice

	void wren_voiceAllocate(WrenVM* vm) {
		// wrenAbort(vm, "voice should not be constructed directly");
	}
	
	void wren_voiceFinalize(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenReleaseHandle(vm, voice->audioHandle);

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

	void wren_voice_volume(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		wrenSetSlotDouble(vm, 0, soloud.getVolume(voice->handle));
	}

	void wren_voice_fadeVolume(WrenVM* vm) {
		for (int i = 1; i <= 2; i++) {
			if (wrenGetSlotType(vm, i) != WREN_TYPE_NUM) {
				wrenAbort(vm, "args must be Nums");
				return;
			}
		}

		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		float volume = (float)wrenGetSlotDouble(vm, 1);
		float fade = (float)wrenGetSlotDouble(vm, 2);

		volume = max(0.0f, volume);
		fade = max(0.002f, fade);

		soloud.fadeVolume(voice->handle, volume, fade);
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
}

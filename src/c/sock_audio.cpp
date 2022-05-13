
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

#define FILTER_TYPE_LOWPASS 0
#define FILTER_TYPE_HIGHPASS 1
#define FILTER_TYPE_MIN 0
#define FILTER_TYPE_MAX 1

static SoLoud::Soloud soloud;

typedef struct {
	SoLoud::Wav wav;
	uint8_t effectTypes[MAX_EFFECT_PER_AUDIO];
} Audio;

typedef struct {
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
				float nyquist = floorf(soloud.mSamplerate * 0.5f);

				paramValue = max(paramValue, 10.0f);
				paramValue = min(paramValue, nyquist);
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

	return paramValue;
}

float wrenAudioGetParam(SoLoud::Filter* filter, int type, int paramIndex) {
	if (type == EFFECT_TYPE_FILTER) {
		SoLoud::BiquadResonantFilter* bq = (SoLoud::BiquadResonantFilter*)filter;

		switch (paramIndex) {
			case PARAM_FILTER_TYPE: return (float)bq->mFilterType;
			case PARAM_FILTER_FREQUENCY: return bq->mFrequency;
			case PARAM_FILTER_RESONANCE: return bq->mResonance;
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

		if (audio->wav.mData != NULL) {
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

	void wren_audio_voice(WrenVM* vm) {
		Audio* audio = (Audio*)wrenGetSlotForeign(vm, 0);
		if (audio->wav.mData == NULL) {
			wrenAbort(vm, "Audio not loaded");
			return;
		}

		wrenEnsureSlots(vm, 2);
		wrenGetVariable(vm, "sock", "Voice", 1);

		Voice* voice = (Voice*)wrenSetSlotNewForeign(vm, 0, 1, sizeof(Voice));

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
			}
		}

		// Update parameter values.
		if (type == EFFECT_TYPE_FILTER) {
			SoLoud::BiquadResonantFilter* bq = (SoLoud::BiquadResonantFilter*)filter;
			bq->mFilterType = (int)params[PARAM_FILTER_TYPE];
			bq->mFrequency = min(params[PARAM_FILTER_FREQUENCY], 22000.0f);
			bq->mResonance = params[PARAM_FILTER_RESONANCE];
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
					paramValue = min(paramValue, 22000.0f);
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
		}
	}


	// Voice

	void wren_voiceAllocate(WrenVM* vm) {
		// wrenAbort(vm, "voice should not be constructed directly");
	}
	
	void wren_voiceFinalize(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		// Paused voices should be released.
		if (soloud.getPause(voice->handle)) {
			soloud.stop(voice->handle);
		}
	}

	void wren_voice_play(WrenVM* vm) {
		Voice* voice = (Voice*)wrenGetSlotForeign(vm, 0);

		soloud.setPause(voice->handle, false);
	}

	void wren_voice_filter(WrenVM* vm) {
		SoLoud::EchoFilter filter;

		SoLoud::Wav wav;
	}
}

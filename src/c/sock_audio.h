
bool sockAudioInit();
void sockAudioQuit();

void wren_audioAllocate(WrenVM* vm);
void wren_audioFinalize(WrenVM* vm);

void wren_Audio_volume(WrenVM* vm);
void wren_Audio_fadeVolume(WrenVM* vm);

bool wren_audio_loadHandler(WrenVM* vm, const char* data, unsigned int len);
void wren_audio_duration(WrenVM* vm);
void wren_audio_voice(WrenVM* vm);
void wren_audio_setEffect_(WrenVM* vm);
void wren_audio_getEffect_(WrenVM* vm);
void wren_audio_getParam_(WrenVM* vm);
void wren_audio_setParam_(WrenVM* vm);

void wren_voiceAllocate(WrenVM* vm);
void wren_voiceFinalize(WrenVM* vm);

void wren_voice_play(WrenVM* vm);
void wren_voice_pause(WrenVM* vm);
void wren_voice_isPaused(WrenVM* vm);
void wren_voice_stop(WrenVM* vm);
void wren_voice_volume(WrenVM* vm);
void wren_voice_fadeVolume(WrenVM* vm);
void wren_voice_rate(WrenVM* vm);
void wren_voice_fadeRate(WrenVM* vm);
void wren_voice_loop(WrenVM* vm);
void wren_voice_loopSet(WrenVM* vm);
void wren_voice_loopStart(WrenVM* vm);
void wren_voice_loopStartSet(WrenVM* vm);

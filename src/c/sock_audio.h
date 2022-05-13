
bool sockAudioInit();
void sockAudioQuit();

void wren_audioAllocate(WrenVM* vm);
void wren_audioFinalize(WrenVM* vm);
bool wren_audio_loadHandler(WrenVM* vm, const char* data, unsigned int len);
void wren_audio_voice(WrenVM* vm);
void wren_audio_setEffect_(WrenVM* vm);
void wren_audio_getEffect_(WrenVM* vm);
void wren_audio_getParam_(WrenVM* vm);
void wren_audio_setParam_(WrenVM* vm);

void wren_voiceAllocate(WrenVM* vm);
void wren_voiceFinalize(WrenVM* vm);
void wren_voice_play(WrenVM* vm);

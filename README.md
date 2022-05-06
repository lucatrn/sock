# Sock 🧦

Wren based game engine with an emphasis on portability and useful APIs.

## Platform Implementation Notes

### Libraries/APIs Used

| Feature | Desktop | Web |
| -- | -- | -- |
| OS Abstraction<br>(Windowing) | SDL | - |
| Graphics | OpenGL 4.3 | WebGL 1 |
| Image Loading | `stb_img.h` | `<img>`
| Audio | Soloud w/ SDL backend | WebAudio |
| Audio Loading | _TODO_ | WebAudio `decodeAudioData()` <br> `stb_ogg.h` fallback on Safari |
| Input | SDL | DOM |
| Storage | OS specific app-data folder | `localStorage` |
| Wren Interpreter <br> + Other C Code | Native | Emscripten |

### Platform Specific Libraries/APIs

| Feature | Library |
| -- | -- |
| Dynamic DLL Binding | libffi |

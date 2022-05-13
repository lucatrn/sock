# Sock 🧦

Wren based game engine with an emphasis on portability and useful APIs.

## Platform Implementation Notes

### Libraries/APIs Used

| Feature | Desktop | Web |
| -- | -- | -- |
| Written in | C++ | C (Emscripten) & JavaScript |
| OS Abstraction<br>(Windowing etc.) | SDL | JavaScript |
| Graphics | OpenGL 4.3 | WebGL 1 |
| Image Loading | `stb_img.h` | `<img>`
| Audio | SoLoud w/ SDL backend | WebAudio |
| Audio Loading | _TODO_ | WebAudio `decodeAudioData()` <br> `stb_ogg.h` fallback on Safari |
| Input | SDL | DOM |
| Storage | OS specific app-data folder | `localStorage` |

### Windows Specific Libraries/APIs

| Feature | Library |
| -- | -- |
| Dynamic DLL Binding | libffi |

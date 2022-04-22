
@echo off


if not exist tmp mkdir tmp


echo Generating Sock Wren Amalgamation [tmp/sock.wren] (NodeJS)

call node util/build-sock-wren-script.mjs  || echo ERROR && exit /b


echo Generating Wren Core Amalgamation [tmp/wren.c] (Python)

call python wren/util/generate_amalgamation.py > tmp/wren.c  || echo ERROR && exit /b


echo Getting Emscripten Exported Functions (Node)

for /f %%i in ('node util/em-exports.js') do set efn=%%i
if not defined efn exit /b


echo Building C to Wasm [tmp/sock_c.wasm] [tmp/sock_c.js] (Emscripten)

call emcc ^
  tmp/wren.c src/c/sock_core.c ^
  -I wren/src/include ^
  --pre-js src/js-em/common.js ^
  --js-library src/js-em/library.js ^
  -o tmp/sock_c.js ^
  -O3 ^
  -Werror -Wall ^
  -s ASSERTIONS=0 -s ENVIRONMENT='web' ^ -s MODULARIZE=1 -s EXPORT_ES6=1 ^
  -s FILESYSTEM=0 -s ^ -s ALLOW_MEMORY_GROWTH=1 -s ALLOW_TABLE_GROWTH=1 ^
  -s INCOMING_MODULE_JS_API=[] -s DYNAMIC_EXECUTION=0 ^
  -s EXPORTED_RUNTIME_METHODS=["ccall","addFunction"] ^
  -s "EXPORTED_FUNCTIONS=%efn%" ^
  || echo ERROR && exit /b


echo Moving [tmp/sock_c.js] to [src/js-generated/sock_c.js]

move tmp\sock_c.js src\js-generated  || echo ERROR && exit /b


echo Generating Main JavaScript [tmp/sock.js] (Rollup)

rollup -c util/build-js.config.js  || echo ERROR && exit /b


echo Build Complete!


@echo off

copy src\web\index.html dst\web  || echo ERROR && exit /b
copy tmp\sock.js dst\web  || echo ERROR && exit /b
copy tmp\sock.js.map dst\web  || echo ERROR && exit /b
copy tmp\sock_web.wren dst\web  || echo ERROR && exit /b
copy tmp\sock_c.wasm dst\web  || echo ERROR && exit /b
copy lib\unzipit.js dst\web  || echo ERROR && exit /b
copy lib\stbvorbis.js dst\web  || echo ERROR && exit /b
